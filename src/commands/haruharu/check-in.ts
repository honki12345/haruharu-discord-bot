import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Users } from '../../repository/Users.js';
import { getYearMonthDate, LATE_RANGE_TIME, ABSENCE_RANGE_TIME } from '../../utils.js';
import { TimeLog } from '../../repository/TimeLog.js';
import { logger } from '../../logger.js';
import { createRequire } from 'node:module';

const jsonRequire = createRequire(import.meta.url);
const { checkChannelId } = jsonRequire('../../../config.json');

export const command = {
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('check-in')
    .setDescription('check-in in the world')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('upload the image with timestamp')
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // fired channel validation
    const firedChannelId = interaction.channelId;
    if (firedChannelId !== checkChannelId) {
      return await interaction.reply({ content: `no valid channel for command`, ephemeral: true });
    }

    // registered validation
    const { year, month, date, hours, minutes } = getYearMonthDate();
    const userid = interaction.user.id;
    logger.info(`check-in input value: userid: ${userid}, yearmonth: ${year + '' + month}`);
    const user = await Users.findOne({
      attributes: ['waketime', 'id'],
      where: { userid, yearmonth: year + '' + month },
    });

    if (!user) {
      return await interaction.reply(`check-in fail: ${interaction.user.globalName} not registered`);
    }
    logger.info(`check-in 검색 유저모델`, { user });

    // duplication validation
    const yearmonthday = year + '' + month + date;
    const timelogs = await TimeLog.findAll({
      where: { yearmonthday, userid },
    });
    const isDuplicated = timelogs?.some(timelog => timelog.checkintime);
    logger.info(`timelogs for check-in duplicated`, { timelogs });
    logger.info(`result isDuplicated: ${isDuplicated}`);
    if (isDuplicated) {
      return await interaction.reply(`you did already check-in`);
    }

    // time validation
    // 3. -30 <= timeDifferenceValue && timeDifferenceValue <= 10: 30분 이내 그리고 10분 이전 => 출석
    let isintime = true;
    try {
      const checkinTimeInMinutes = Number(user.waketime.substring(0, 2)) * 60 + Number(user.waketime.substring(2));
      const nowTimeInMinutes = Number(hours) * 60 + Number(minutes);
      const timeDifferenceValue = nowTimeInMinutes - checkinTimeInMinutes;

      // 1. timeDifferenceValue < -30 || timeDifferenceValue > 30 : 30분 이전 또는 30분 이후 => no valid time
      if (Math.abs(timeDifferenceValue) > ABSENCE_RANGE_TIME) {
        return await interaction.reply(`Not time for check-in: now:${hours}${minutes} yours: ${user.waketime}`);
      }

      // 2. timeDifferenceValue > 10 : 10분 이후 => 지각
      if (timeDifferenceValue > LATE_RANGE_TIME) {
        isintime = false;
      }
    } catch (e) {
      logger.error(`check-in 시간 계산 로직 오류발생`, { e });
      if (e instanceof Error) {
        return await interaction.reply(`error occurred: ${e.name}`);
      }
    }

    // image file validation
    const attachment = interaction.options.getAttachment('image');
    logger.info(`image attachment info: `, { attachment });
    if (!attachment?.contentType?.startsWith('image/')) {
      return await interaction.reply(`please upload image file`);
    }


    // add
    const username = interaction.user.globalName ?? 'null';
    const checkintime = hours + '' + minutes;
    await TimeLog.create({ userid, username, yearmonthday, checkintime, checkouttime: null, isintime });
    isintime ? await interaction.reply(`${interaction.user.globalName}님 check-in에 성공하셨습니다: ${checkintime}`)
      : await interaction.reply(`${interaction.user.globalName}님 check-in에 성공하셨습니다 (지각): ${checkintime}`);
    await interaction.channel?.send({
      files: [{
        attachment: attachment?.url,
        name: `${attachment.name}`,
      }],
    });
  },
};
