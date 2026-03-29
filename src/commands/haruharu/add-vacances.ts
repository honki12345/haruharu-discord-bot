import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { testChannelId } from '../../config.js';
import { logger } from '../../logger.js';
import { Users } from '../../repository/Users.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 5,
  allowedChannelIds: [testChannelId],
  data: new SlashCommandBuilder()
    .setName('add-vacances')
    .setDescription('add the vacances of the member of challenge')
    .setNameLocalizations({ ko: 'admin-휴가추가' })
    .setDescriptionLocalizations({ ko: '관리자가 대상 사용자의 월별 휴가일수를 추가합니다' })
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
    )
    .addStringOption(option =>
      option
        .setName('count')
        .setDescription('count of vacances for adding')
        .setNameLocalizations({ ko: '추가일수' })
        .setDescriptionLocalizations({ ko: '추가할 휴가 일수를 입력합니다' })
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const yearmonth = interaction.options.getString('yearmonth')!;
    const count = Number(interaction.options.getString('count')!);
    const foundUser = await Users.findOne({ where: { userid, yearmonth } });

    if (!foundUser) {
      return await interaction.reply('휴가 추가 실패: 존재하지 않는 회원입니다');
    }

    if (!Number.isInteger(count)) {
      return await interaction.reply(`추가하려는 휴가 카운트 값을 잘못 입력했습니다`);
    }

    // add logic
    try {
      logger.info(`add-vacances 명령행에 입력한 값: userid: ${userid}, yearmonth: ${yearmonth}, count: ${count}`);
      await Users.update({ vacances: foundUser.vacances + count }, { where: { userid, yearmonth } });
      const updatedUser = await Users.findOne({ where: { userid, yearmonth } });
      await interaction.reply(
        `${foundUser.username}님 ${yearmonth} 휴가 일수가 총 ${updatedUser?.vacances}일이 되었습니다`,
      );
    } catch (e) {
      logger.error(`challenge 휴가카운트 업데이트 실패`, { e });
      await interaction.reply('휴가 일수 업데이트 실패');
    }
  },
};
