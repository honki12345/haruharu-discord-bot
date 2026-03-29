import type { ChatInputCommandInteraction, InteractionReplyOptions } from 'discord.js';
import { testChannelId } from '../commandChannelConfig.js';
import { logger } from '../logger.js';

type ReplyPayload = string | InteractionReplyOptions;

const getReplyContent = (reply: ReplyPayload) => {
  if (typeof reply === 'string') {
    return reply;
  }

  if (typeof reply.content === 'string') {
    return reply.content;
  }

  return '';
};

const buildAuditMessage = ({
  commandName,
  interaction,
  reply,
}: {
  commandName: string;
  interaction: ChatInputCommandInteraction;
  reply: ReplyPayload;
}) => {
  const username = interaction.user.globalName ?? interaction.user.username ?? 'unknown';
  const channelId = interaction.channelId ?? 'unknown';
  const replyContent = getReplyContent(reply);

  return [
    `[self-service] /${commandName}`,
    `user: ${username} (${interaction.user.id})`,
    `channelId: ${channelId}`,
    `result: ${replyContent}`,
  ].join('\n');
};

const sendSelfServiceAuditLog = async ({
  commandName,
  interaction,
  reply,
}: {
  commandName: string;
  interaction: ChatInputCommandInteraction;
  reply: ReplyPayload;
}) => {
  try {
    const channel = await interaction.client.channels.fetch(testChannelId);
    if (!channel || !('send' in channel)) {
      logger.error('self-service audit target is not sendable', {
        commandName,
        testChannelId,
      });
      return;
    }

    await channel.send(buildAuditMessage({ commandName, interaction, reply }));
  } catch (error) {
    logger.error('failed to send self-service audit log', {
      commandName,
      testChannelId,
      userId: interaction.user.id,
      error,
    });
  }
};

const replyWithEphemeralAudit = async ({
  commandName,
  interaction,
  content,
}: {
  commandName: string;
  interaction: ChatInputCommandInteraction;
  content: string;
}) => {
  const reply = {
    content,
    ephemeral: true,
  } satisfies InteractionReplyOptions;

  await interaction.reply(reply);
  await sendSelfServiceAuditLog({ commandName, interaction, reply });
};

export { getReplyContent, replyWithEphemeralAudit, sendSelfServiceAuditLog };
