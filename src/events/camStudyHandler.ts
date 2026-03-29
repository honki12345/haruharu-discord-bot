import { VoiceState } from 'discord.js';
import { camStudyRoleId, voiceChannelId } from '../config.js';
import { logger } from '../logger.js';
import { processCamStudyStateChange } from '../services/camStudy.js';

export const event = {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    try {
      const voiceChannel = newState.guild.channels.cache.get(voiceChannelId);
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

      if (result.target === 'channel') {
        await newState.channel?.send(result.message);
        return;
      }

      if (voiceChannel && 'send' in voiceChannel) {
        await voiceChannel.send(result.message);
      }
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
