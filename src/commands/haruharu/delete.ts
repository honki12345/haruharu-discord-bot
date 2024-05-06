import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import {logger} from '../../logger.js';
import {Users} from '../../repository/Users.js';
import { PERMISSION_NUM_ADMIN } from '../../utils.js';

export const command = {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('register the member of challenge')
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
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userid = interaction.options.getString('userid')!;
    const yearmonth = interaction.options.getString('yearmonth')!;
    const foundUser = await Users.findOne({ where: { userid, yearmonth } });

    if (!foundUser) {
      return await interaction.reply(`challenge 삭제 실패: 존재하지 않는 회원입니다`);
    }

    // add logic
    try {
      logger.info(`delete 명령행에 입력한 값: userid: ${userid}`);

      await Users.destroy({ where: { userid, yearmonth } });
      await interaction.reply(`${foundUser.username}님 ${yearmonth} challenge delete success `);
    } catch (e) {
      logger.error(`challenge 삭제 실패`, { e });
      await interaction.reply(`challenge 삭제 실패`);
    }
  },
};
