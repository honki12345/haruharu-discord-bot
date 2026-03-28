import { VoiceState } from 'discord.js';
import { voiceChannelId } from '../config.js';
import { processCamStudyStateChange } from '../services/camStudy.js';

export const event = {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    const voiceChannel = newState.guild.channels.cache.get(voiceChannelId);
    const result = await processCamStudyStateChange(
      { channelId: oldState.channelId, streaming: oldState.streaming === true, userId: oldState.id },
      { channelId: newState.channelId, streaming: newState.streaming === true, userId: newState.id },
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
  },
};
