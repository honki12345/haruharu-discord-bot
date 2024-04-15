const { SlashCommandBuilder } = require('discord.js');
const { Users } = require('../../repository/Users');
const { getYearMonthDate, LATE_RANGE_TIME, ABSENCE_RANGE_TIME } = require('../../utils');
const { TimeLog } = require('../../repository/TimeLog');
const logger = require('../../logger');


module.exports = {
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('check-out')
    .setDescription('check-out in the world')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('upload the image with timestamp')
        .setRequired(true),
    ),

  async execute(interaction) {
    // registered validation
    const { year, month, date, hours, minutes } = getYearMonthDate();
    const userid = interaction.user.id;
    logger.info(`check-out input value: userid: ${userid}, yearmonth: ${year + '' + month}`);
    const user = await Users.findOne({ where: { userid, yearmonth: year + '' + month } });

    if (!user) {
      return await interaction.reply(`${interaction.user.globalName} not registered`);
    }
    logger.info(`check-out 검색 유저모델`, { user });

    // duplication validation
    const yearmonthday = year + '' + month + date;
    const timelogs = await TimeLog.findAll({
      where: { yearmonthday, userid },
    });
    const isDuplicated = timelogs?.some(timelog => timelog.checkouttime);
    logger.info(`timelogs for check-out duplicated`, { timelogs });
    logger.info(`result isDuplicated: ${isDuplicated}`);
    if (isDuplicated) {
      return await interaction.reply(`you did already check-out`);
    }

    // time validation
    // 1. 10분 이내 => 출석
    let isintime = true;
    try {
      const hoursString = user.waketime.substring(0, 2);
      const minutesString = user.waketime.substring(2);
      const checkoutTimeInMinutes = (Number(hoursString) + 1) * 60 + Number(minutesString);
      const checkoutTimeString = ('0' + (Number(hoursString) + 1)).slice(-2) + minutesString;
      const nowTimeInMinutes = Number(hours) * 60 + Number(minutes);
      const timeDifferenceValue = nowTimeInMinutes - checkoutTimeInMinutes;

      // 2. 10분 이전 또는 30분 이후 => no valid time
      if (timeDifferenceValue < -LATE_RANGE_TIME || timeDifferenceValue > ABSENCE_RANGE_TIME) {
        return await interaction.reply(`Not time for check-out: now:${hours}${minutes} yours: ${checkoutTimeString}`);
      }

      // 3. 10분 이후 => 지각
      if (timeDifferenceValue > LATE_RANGE_TIME) {
        isintime = false;
      }
    } catch (e) {
      logger.error(`check-out 시간 계산 로직 오류발생`, { e });
      return await interaction.reply(`error occurred: ${e.name}`);
    }

    // image file validation
    const attachment = interaction.options.getAttachment('image');
    logger.info(`image attachment info: `, { attachment });
    if (!attachment.contentType.startsWith('image/')) {
      return await interaction.reply(`please upload image file`);
    }


    // add
    const username = interaction.user.globalName;
    const checkouttime = hours + '' + minutes;
    await TimeLog.create({ userid, username, yearmonthday, checkouttime, isintime });
    isintime ? await interaction.reply(`${interaction.user.globalName}님 check-out에 성공하셨습니다: ${checkouttime}`)
      : await interaction.reply(`${interaction.user.globalName}님 check-out에 성공하셨습니다 (지각): ${checkouttime}`);
    await interaction.channel.send({
      files: [{
        attachment: attachment?.attachment,
        name: `${attachment.name}`,
      }],
    });
  },
};
