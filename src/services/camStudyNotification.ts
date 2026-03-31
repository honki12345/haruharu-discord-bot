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

type DmSendableUser = {
  globalName?: string | null;
  send: (content: string) => Promise<unknown>;
  username?: string | null;
} | null;

type ResolvedDmSendableMember = Exclude<DmSendableMember, null> & {
  send: (content: string) => Promise<unknown>;
};

type CamStudyNotificationClient = {
  channels: {
    fetch: (channelId: string) => Promise<unknown>;
  };
  users?: {
    fetch: (userId: string) => Promise<unknown>;
  };
};

type CamStudyNotificationRecipient = ResolvedDmSendableMember | NonNullable<DmSendableUser> | null;

const isSendableChannel = (channel: unknown): channel is SendableChannel => {
  if (typeof channel !== 'object' || channel === null) {
    return false;
  }

  return 'send' in channel && typeof channel.send === 'function';
};

const isDmSendableUser = (user: unknown): user is NonNullable<DmSendableUser> => {
  if (typeof user !== 'object' || user === null) {
    return false;
  }

  return 'send' in user && typeof user.send === 'function';
};

const resolveParticipantLabel = (recipient: CamStudyNotificationRecipient, userId: string) => {
  if (!recipient) {
    return userId;
  }

  return (
    ('displayName' in recipient ? recipient.displayName : null) ??
    ('user' in recipient ? recipient.user?.globalName : null) ??
    ('globalName' in recipient ? recipient.globalName : null) ??
    ('user' in recipient ? recipient.user?.username : null) ??
    ('username' in recipient ? recipient.username : null) ??
    userId
  );
};

const resolveRecipient = async ({
  client,
  member,
  userId,
}: {
  client: CamStudyNotificationClient;
  member: DmSendableMember;
  userId: string;
}): Promise<CamStudyNotificationRecipient> => {
  if (member?.send) {
    return member as ResolvedDmSendableMember;
  }

  if (typeof client.users?.fetch !== 'function') {
    return null;
  }

  try {
    const fetchedUser = await client.users.fetch(userId);
    if (!isDmSendableUser(fetchedUser)) {
      return null;
    }

    return fetchedUser;
  } catch (error) {
    logger.error('failed to fetch cam study user for DM', {
      error,
      userId,
    });
    return null;
  }
};

const buildCamStudyAuditMessage = ({
  channelId,
  recipient,
  message,
  userId,
}: {
  channelId: string | null;
  recipient: CamStudyNotificationRecipient;
  message: string;
  userId: string;
}) => {
  return [
    '[cam-study]',
    `user: ${resolveParticipantLabel(recipient, userId)} (${userId})`,
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
  const recipient = await resolveRecipient({ client, member, userId });

  if (recipient) {
    try {
      await recipient.send(message);
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
      content: buildCamStudyAuditMessage({ channelId, recipient, message, userId }),
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
