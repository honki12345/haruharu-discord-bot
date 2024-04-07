const { SlashCommandBuilder } = require('discord.js');
const { Users } = require('../../repository/Users');
const { getYearMonthDate, RANGE_IN_TIME, RANGE_OUT_TIME } = require('../../utils');
const { TimeLog } = require('../../repository/TimeLog');
const logger = require('../../logger');


module.exports = {
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('check-in')
    .setDescription('check-in in the world')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('upload the image with timestamp')
        .setRequired(true),
    ),

  async execute(interaction) {
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
    let isintime = true;
    try {
      const wakeTime = Number(user.waketime.substring(0, 2)) * 60 + Number(user.waketime.substring(2));
      const nowTime = Number(hours) * 60 + Number(minutes);
      const timeValue = Math.abs(wakeTime - nowTime);
      if (timeValue > RANGE_OUT_TIME) {
        return await interaction.reply(`Not time for check-in/out: now:${hours}${minutes} yours: ${user.waketime}`);
      }
      if (timeValue > RANGE_IN_TIME) {
        isintime = false;
      }
    } catch (e) {
      logger.error(`check-in 시간 계산 로직 오류발생`, { e });
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
    const checkintime = hours + '' + minutes;
    await TimeLog.create({ userid, username, yearmonthday, checkintime, isintime });
    await interaction.channel.send({
      files: [{
        attachment: attachment?.attachment,
        name: `${attachment.name}`,
      }],
    });
    await interaction.reply(`${interaction.user.globalName}님 check-in에 성공하셨습니다: ${checkintime}`);
  },
};
