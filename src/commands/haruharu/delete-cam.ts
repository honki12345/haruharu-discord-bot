import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';
import { logger } from '../../logger.js';
import { CamStudyUsers } from '../../repository/CamStudyUsers.js';

export const command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('delete-cam')
    .setDescription('register the member of cam study')
    .setNameLocalizations({ ko: 'admin-캠스터디삭제' })
    .setDescriptionLocalizations({ ko: '관리자가 캠스터디 참가자를 삭제합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('set userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: '대상 Discord 사용자 ID를 입력합니다' })
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
      await interaction.reply(`${foundUser.username}님을 캠스터디 참가자에서 삭제했습니다`);
    } catch (e) {
      logger.error(`cam-study 삭제 실패`, { e });
      await interaction.reply('캠스터디 삭제 실패');
    }
  },
};
