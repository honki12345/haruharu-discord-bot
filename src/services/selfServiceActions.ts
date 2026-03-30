import type { Guild, InteractionReplyOptions } from 'discord.js';
import { logger } from '../logger.js';
import { getReplyContent, replyWithEphemeralAudit, sendSelfServiceAuditLog } from './selfServiceAudit.js';

type SelfServiceInteraction = {
  channelId: string | null;
  client: {
    channels: {
      fetch: (channelId: string) => Promise<unknown>;
    };
  };
  guild: Guild | null;
  member?: {
    displayName?: string | null;
    nickname?: string | null;
    nick?: string | null;
  } | null;
  reply: (options: InteractionReplyOptions) => Promise<unknown>;
  user: {
    id: string;
    globalName?: string | null;
    username: string;
  };
};

const resolveInteractionUsername = (interaction: SelfServiceInteraction) => {
  return (
    interaction.member?.displayName ??
    interaction.member?.nickname ??
    interaction.member?.nick ??
    interaction.user.globalName ??
    interaction.user.username ??
    'unknown'
  );
};

const executeRegisterSelfService = async ({
  interaction,
  waketime,
  commandName = 'register',
}: {
  interaction: SelfServiceInteraction;
  waketime: string;
  commandName?: string;
}) => {
  const userId = interaction.user.id;
  const username = resolveInteractionUsername(interaction);
  logger.info(`register 명령행에 입력한 값: userid: ${userId}, waketime: ${waketime}`);

  const { executeRegisterWithRoleSync } = await import('./challengeSelfService.js');

  try {
    const result = await executeRegisterWithRoleSync({
      userId,
      username,
      waketime,
      guild: interaction.guild,
    });
    await replyWithEphemeralAudit({
      commandName,
      interaction,
      content: result.reply,
    });
  } catch (error) {
    logger.error('register 등록 실패', { error });
    await replyWithEphemeralAudit({
      commandName,
      interaction,
      content: 'register 등록 실패',
    });
  }
};

const executeApplyVacationSelfService = async ({
  interaction,
  yearmonthday,
  commandName = 'apply-vacation',
}: {
  interaction: SelfServiceInteraction;
  yearmonthday: string;
  commandName?: string;
}) => {
  try {
    const { executeApplyVacation } = await import('./challengeSelfService.js');
    const result = await executeApplyVacation({
      userId: interaction.user.id,
      yearmonthday,
    });

    await replyWithEphemeralAudit({
      commandName,
      interaction,
      content: result.reply,
    });
  } catch (error) {
    logger.error('apply-vacation 실행 실패', { error });
    await replyWithEphemeralAudit({
      commandName,
      interaction,
      content: '휴가 신청 처리에 실패했습니다',
    });
  }
};

const executeStopWakeupSelfService = async ({
  interaction,
  commandName = 'stop-wakeup',
}: {
  interaction: SelfServiceInteraction;
  commandName?: string;
}) => {
  const { executeStopWakeUpWithRoleSync } = await import('./challengeSelfService.js');

  try {
    const result = await executeStopWakeUpWithRoleSync({
      userId: interaction.user.id,
      guild: interaction.guild,
    });
    await replyWithEphemeralAudit({
      commandName,
      interaction,
      content: result.reply,
    });
  } catch (error) {
    logger.error('stop-wakeup 실행 실패', { error });
    await replyWithEphemeralAudit({
      commandName,
      interaction,
      content: '기상스터디 중단 처리에 실패했습니다',
    });
  }
};

const executeApplyCamSelfService = async ({
  interaction,
  commandName = 'apply-cam',
}: {
  interaction: SelfServiceInteraction;
  commandName?: string;
}) => {
  try {
    const { submitParticipationApplication } = await import('./participationApplication.js');
    const reply = await submitParticipationApplication(interaction, 'cam-study');
    await interaction.reply(reply);
    await sendSelfServiceAuditLog({
      commandName,
      interaction,
      reply,
    });
  } catch (error) {
    logger.error('apply-cam 실행 실패', { error });
    const reply = {
      content: '캠스터디 참여 처리에 실패했습니다',
      ephemeral: true,
    } satisfies InteractionReplyOptions;
    await interaction.reply(reply);
    await sendSelfServiceAuditLog({
      commandName,
      interaction,
      reply: getReplyContent(reply),
    });
  }
};

export {
  executeApplyCamSelfService,
  executeApplyVacationSelfService,
  executeRegisterSelfService,
  executeStopWakeupSelfService,
  resolveInteractionUsername,
};
