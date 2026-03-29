import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { testChannelId } from '../../commandChannelConfig.js';
import { logger } from '../../logger.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [testChannelId],
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('register the member of challenge')
    .setNameLocalizations({ ko: 'admin-챌린저삭제' })
    .setDescriptionLocalizations({ ko: '관리자가 기상 챌린지 사용자를 삭제합니다' })
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option
        .setName('userid')
        .setDescription('set userid')
        .setNameLocalizations({ ko: '사용자id' })
        .setDescriptionLocalizations({ ko: '대상 Discord 사용자 ID를 입력합니다' })
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('yearmonth')
        .setDescription('set year-month yyyymm')
        .setNameLocalizations({ ko: '년월' })
        .setDescriptionLocalizations({ ko: '대상 년월을 입력합니다 (yyyymm)' })
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const { findChallengeUser, deleteChallengeUser } = await import('../../repository/challengeRepository.js');
    const { createChallengeUserExclusion } = await import('../../services/challengeSelfService.js');
    const userid = interaction.options.getString('userid')!;
    const yearmonth = interaction.options.getString('yearmonth')!;
    const foundUser = await findChallengeUser(userid, yearmonth);

    if (!foundUser) {
      return await interaction.reply('챌린저 삭제 실패: 존재하지 않는 회원입니다');
    }

    // add logic
    try {
      logger.info(`delete 명령행에 입력한 값: userid: ${userid}`);

      await createChallengeUserExclusion(userid, yearmonth);
      await deleteChallengeUser(userid, yearmonth);
      await interaction.reply(`${foundUser.username}님 ${yearmonth} 챌린저 정보를 삭제했습니다`);
    } catch (e) {
      logger.error(`challenge 삭제 실패`, { e });
      await interaction.reply('챌린저 삭제 실패');
    }
  },
};
