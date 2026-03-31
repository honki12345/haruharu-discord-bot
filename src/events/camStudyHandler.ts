import { VoiceState } from 'discord.js';
import { camStudyRoleId, voiceChannelId } from '../config.js';
import { logger } from '../logger.js';
import { sendCamStudyNotification } from '../services/camStudyNotification.js';
import { processCamStudyStateChange } from '../services/camStudy.js';

export const event = {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    try {
      const result = await processCamStudyStateChange(
        {
          channelId: oldState.channelId,
          hasCamStudyRole: oldState.member?.roles.cache.has(camStudyRoleId) ?? null,
          selfVideo: oldState.selfVideo === true,
          streaming: oldState.streaming === true,
          userId: oldState.id,
        },
        {
          channelId: newState.channelId,
          hasCamStudyRole: newState.member?.roles.cache.has(camStudyRoleId) ?? null,
          selfVideo: newState.selfVideo === true,
          streaming: newState.streaming === true,
          userId: newState.id,
        },
        voiceChannelId,
      );

      if (!result) {
        return;
      }

      await sendCamStudyNotification({
        channelId: newState.channelId ?? oldState.channelId,
        client: newState.client,
        member: newState.member ?? oldState.member,
        message: result.message,
        userId: newState.id,
      });
    } catch (error) {
      logger.error('cam study handler failed', {
        error,
        oldChannelId: oldState.channelId,
        oldSelfVideo: oldState.selfVideo === true,
        oldStreaming: oldState.streaming === true,
        newChannelId: newState.channelId,
        newSelfVideo: newState.selfVideo === true,
        newStreaming: newState.streaming === true,
        userId: newState.id,
      });
    }
  },
};
