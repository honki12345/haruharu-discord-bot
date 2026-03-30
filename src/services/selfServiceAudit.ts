import type { InteractionReplyOptions } from 'discord.js';
import { testChannelId } from '../commandChannelConfig.js';
import { logger } from '../logger.js';

type ReplyPayload = string | InteractionReplyOptions;
type SendableChannel = {
  send: (options: { content: string; allowedMentions: { parse: [] } }) => Promise<unknown>;
};
type SelfServiceAuditInteraction = {
  channelId: string | null;
  client: {
    channels: {
      fetch: (channelId: string) => Promise<unknown>;
    };
  };
  reply: (options: InteractionReplyOptions) => Promise<unknown>;
  user: {
    id: string;
    globalName?: string | null;
    username: string;
  };
};

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
  interaction: SelfServiceAuditInteraction;
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

const isSendableChannel = (channel: unknown): channel is SendableChannel => {
  if (typeof channel !== 'object' || channel === null) {
    return false;
  }

  return 'send' in channel && typeof channel.send === 'function';
};

const sendSelfServiceAuditLog = async ({
  commandName,
  interaction,
  reply,
}: {
  commandName: string;
  interaction: SelfServiceAuditInteraction;
  reply: ReplyPayload;
}) => {
  try {
    const channel = await interaction.client.channels.fetch(testChannelId);
    if (!isSendableChannel(channel)) {
      logger.error('self-service audit target is not sendable', {
        commandName,
        testChannelId,
      });
      return;
    }

    await channel.send({
      content: buildAuditMessage({ commandName, interaction, reply }),
      allowedMentions: {
        parse: [],
      },
    });
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
  interaction: SelfServiceAuditInteraction;
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
