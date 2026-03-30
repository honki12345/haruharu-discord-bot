import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { startHereChannelId, timeStartHereChannelId } from '../../commandChannelConfig.js';
import { logger } from '../../logger.js';
import { replyWithEphemeralAudit } from '../../services/selfServiceAudit.js';

const resolveRegisterUsername = (interaction: ChatInputCommandInteraction) => {
  const member = interaction.member as {
    displayName?: string | null;
    nickname?: string | null;
    nick?: string | null;
  } | null;

  return (
    member?.displayName ??
    member?.nickname ??
    member?.nick ??
    interaction.user.globalName ??
    interaction.user.username ??
    'unknown'
  );
};

export const command = {
  cooldown: 5,
  allowedChannelIds: [startHereChannelId, timeStartHereChannelId],
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('register or update your challenge waketime')
    .setNameLocalizations({ ko: '기상등록' })
    .setDescriptionLocalizations({ ko: '자신의 기상시간을 등록하거나 수정합니다' })
    .addStringOption(option =>
      option
        .setName('waketime')
        .setDescription('set waketime HHmm or HH:mm')
        .setNameLocalizations({ ko: '기상시간' })
        .setDescriptionLocalizations({ ko: '기상시간을 입력합니다 (HHmm 또는 HH:mm)' })
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const waketime = interaction.options.getString('waketime')!;
    const userId = interaction.user.id;
    const username = resolveRegisterUsername(interaction);
    logger.info(`register 명령행에 입력한 값: userid: ${userId}, waketime: ${waketime}`);

    const { executeRegisterWithRoleSync } = await import('../../services/challengeSelfService.js');

    try {
      const result = await executeRegisterWithRoleSync({
        userId,
        username,
        waketime,
        guild: interaction.guild,
      });
      await replyWithEphemeralAudit({
        commandName: command.data.name,
        interaction,
        content: result.reply,
      });
    } catch (e) {
      logger.error(`register 등록 실패`, { e });
      await replyWithEphemeralAudit({
        commandName: command.data.name,
        interaction,
        content: 'register 등록 실패',
      });
    }
  },
};
