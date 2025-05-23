import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';
import { logger } from '../../logger.js';
import { CamStudyUsers } from '../../repository/CamStudyUsers.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('delete-cam')
    .setDescription('register the member of cam study')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option.setName('userid')
        .setDescription('set userid')
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const foundUser = await CamStudyUsers.findOne({ where: { userid } });

    if (!foundUser) {
      return await interaction.reply(`cam-study 삭제 실패: 존재하지 않는 회원입니다`);
    }

    // add logic
    try {
      logger.info(`delete 명령행에 입력한 값: userid: ${userid}`);

      await CamStudyUsers.destroy({ where: { userid } });
      await interaction.reply(`${foundUser.username}님 cam-study  delete success `);
    } catch (e) {
      logger.error(`cam-study 삭제 실패`, { e });
      await interaction.reply(`cam-study 삭제 실패`);
    }
  },
};
