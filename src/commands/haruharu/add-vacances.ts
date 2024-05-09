import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { logger } from '../../logger.js';
import { Users } from '../../repository/Users.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('add-vacances')
    .setDescription('add the vacances of the member of challenge')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN)
    .addStringOption(option =>
      option.setName('userid')
        .setDescription('set userid')
        .setRequired(true),
    )
    .addStringOption(option =>
      option.setName('yearmonth')
        .setDescription('set year-month yyyymm')
        .setRequired(true),
    )
    .addStringOption(option =>
      option.setName('count')
        .setDescription('count of vacances for adding')
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const yearmonth = interaction.options.getString('yearmonth')!;
    const count = Number(interaction.options.getString('count')!);
    const foundUser = await Users.findOne({ where: { userid, yearmonth } });

    if (!foundUser) {
      return await interaction.reply(`challenge 삭제 실패: 존재하지 않는 회원입니다`);
    }

    if (!Number.isInteger(count)) {
      return await interaction.reply(`추가하려는 휴가 카운트 값을 잘못 입력했습니다`);
    }


    // add logic
    try {
      logger.info(`add-vacances 명령행에 입력한 값: userid: ${userid}, yearmonth: ${yearmonth}, count: ${count}`);
      await Users.update({ vacances: foundUser.vacances + count }, { where: { userid, yearmonth } });
      const updatedUser = await Users.findOne({ where: { userid, yearmonth } });
      await interaction.reply(`${foundUser.username}님 ${yearmonth} 휴가 카운트가 총 ${updatedUser?.vacances}가 되었습니다 `);
    } catch (e) {
      logger.error(`challenge 휴가카운트 업데이트 실패`, { e });
      await interaction.reply(`challenge 휴가카운트 업데이트 실패`);
    }
  },
};
