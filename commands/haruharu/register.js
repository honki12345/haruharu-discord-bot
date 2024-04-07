const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { Users } = require('../../repository/Users');
const { DEFAULT_VACANCES_COUNT, PERMISSION_NUM_ADMIN, getFileName } = require('../../utils');
const path = require('node:path');
const logger = require('../../logger');

module.exports = {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('register time of member')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option.setName('userid')
        .setDescription('set userid')
        .setRequired(true),
    )
    .addStringOption(option =>
      option.setName('username')
        .setDescription('set username'),
    )
    .addStringOption(option =>
      option.setName('yearmonth')
        .setDescription('set year-month yyyymm')
        .setRequired(true),
    )
    .addStringOption(option =>
      option.setName('vacances')
        .setDescription('set vacances count'),
    )
    .addStringOption(option =>
      option.setName('waketime')
        .setDescription('set waketime HHmm')
        .setRequired(true),
    ),
  async execute(interaction) {
    const userid = interaction.options.getString('userid') ?? '';
    const yearmonth = interaction.options.getString('yearmonth');
    const waketime = interaction.options.getString('waketime');
    logger.info(`register 명령행에 입력한 값: userid: ${userid}, yearmonth: ${yearmonth}, waketime: ${waketime}`);

    const user = await Users.findOne({ where: { userid, yearmonth } });

    // update, not add
    if (user) {
      logger.info(`등록 전 유저 검색값 : `, { user });
      const username = interaction.options.getString('username') ?? user.username;
      const vacances = interaction.options.getString('vacances') ?? user.vacances;

      const affectedRows = await Users.update({ username, yearmonth, waketime, vacances }, {
        where: { userid, yearmonth },
      });
      if (affectedRows > 0) {
        return await interaction.reply(`${username} update success => yearmonth: ${yearmonth}, waketime: ${waketime}, vacances: ${vacances}`);
      }
      return await interaction.reply(`register 업데이트 실패`);
    }

    // add logic
    try {
      const username = interaction.options.getString('username');
      const yearmonth = interaction.options.getString('yearmonth');
      const waketime = interaction.options.getString('waketime');
      const vacances = interaction.options.getString('vacances') ?? DEFAULT_VACANCES_COUNT;
      logger.info(`register model: username: ${username}, yearmonth: ${yearmonth}, waketime: ${waketime}, vacances: ${vacances}`);

      const user = await Users.create({
        userid,
        username,
        yearmonth,
        waketime,
        vacances,
      });
      await interaction.reply(`${username} register success => yearmonth: ${yearmonth}, waketime: ${waketime}`);
    } catch (e) {
      logger.error(`register 등록 실패`, { e });
      await interaction.reply(`register 등록 실패`);
    }
  },
};
