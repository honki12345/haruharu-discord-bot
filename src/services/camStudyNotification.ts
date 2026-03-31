import { testChannelId } from '../config.js';
import { logger } from '../logger.js';

type SendableChannel = {
  send: (options: { content: string; allowedMentions: { parse: [] } }) => Promise<unknown>;
};

type DmSendableMember = {
  displayName?: string | null;
  send?: (content: string) => Promise<unknown>;
  user?: {
    globalName?: string | null;
    username?: string | null;
  };
} | null;

type CamStudyNotificationClient = {
  channels: {
    fetch: (channelId: string) => Promise<unknown>;
  };
};

const isSendableChannel = (channel: unknown): channel is SendableChannel => {
  if (typeof channel !== 'object' || channel === null) {
    return false;
  }

  return 'send' in channel && typeof channel.send === 'function';
};

const resolveParticipantLabel = (member: DmSendableMember, userId: string) => {
  return member?.displayName ?? member?.user?.globalName ?? member?.user?.username ?? userId;
};

const buildCamStudyAuditMessage = ({
  channelId,
  member,
  message,
  userId,
}: {
  channelId: string | null;
  member: DmSendableMember;
  message: string;
  userId: string;
}) => {
  return [
    '[cam-study]',
    `user: ${resolveParticipantLabel(member, userId)} (${userId})`,
    `channelId: ${channelId ?? 'unknown'}`,
    `result: ${message}`,
  ].join('\n');
};

const sendCamStudyNotification = async ({
  channelId,
  client,
  member,
  message,
  userId,
}: {
  channelId: string | null;
  client: CamStudyNotificationClient;
  member: DmSendableMember;
  message: string;
  userId: string;
}) => {
  if (member?.send) {
    try {
      await member.send(message);
    } catch (error) {
      logger.error('failed to send cam study DM', {
        channelId,
        error,
        userId,
      });
    }
  } else {
    logger.warn('cam study DM skipped because member is unavailable', {
      channelId,
      userId,
    });
  }

  try {
    const channel = await client.channels.fetch(testChannelId);
    if (!isSendableChannel(channel)) {
      logger.error('cam study audit target is not sendable', {
        testChannelId,
        userId,
      });
      return;
    }

    await channel.send({
      content: buildCamStudyAuditMessage({ channelId, member, message, userId }),
      allowedMentions: {
        parse: [],
      },
    });
  } catch (error) {
    logger.error('failed to send cam study audit log', {
      channelId,
      error,
      testChannelId,
      userId,
    });
  }
};

export { sendCamStudyNotification };
