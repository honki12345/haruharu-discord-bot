import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';
import { logger } from '../../logger.js';
import { CamStudyUsers } from '../../repository/CamStudyUsers.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('register-cam')
    .setDescription('register the member of cam study')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option => option.setName('userid').setDescription('set userid').setRequired(true))
    .addStringOption(option => option.setName('username').setDescription('username').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const foundUser = await CamStudyUsers.findOne({ where: { userid } });

    if (foundUser) {
      await interaction.reply(`cam-study register 등록 실패: 이미 존재하는 회원입니다`);
    }

    // add logic
    try {
      const username = interaction.options.getString('username') ?? 'null';
      logger.info(`register-cam 명령행에 입력한 값: userid: ${userid}, username: ${username}`);

      await CamStudyUsers.create({
        userid,
        username,
      });
      await interaction.reply(`${username}님 cam-study  register success `);
    } catch (e) {
      logger.error(`cam-study register 등록 실패`, { e });
      await interaction.reply(`cam-study register 등록 실패`);
    }
  },
};
