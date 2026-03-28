import { Client, Events } from 'discord.js';
import { logger } from '../logger.js';
import { checkChannelId, logChannelId, resultChannelId } from '../config.js';
import { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels } from '../services/reporting.js';

export const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    await syncModels();

    scheduleDailyReports(
      async () => {
        const { attendanceMessage, hallOfFameMessage } = await buildChallengeReport();
        const checkChannel = client.channels.cache.get(checkChannelId);
        const resultChannel = client.channels.cache.get(resultChannelId);

        if (attendanceMessage && checkChannel && 'send' in checkChannel) {
          await checkChannel.send(attendanceMessage);
        }
        if (hallOfFameMessage && resultChannel && 'send' in resultChannel) {
          await resultChannel.send(hallOfFameMessage);
        }
      },
      async () => {
        const { dailyMessage, weeklyMessage } = await buildCamStudyReports();
        const channel = client.channels.cache.get(logChannelId);
        if (channel && 'send' in channel) {
          await channel.send(dailyMessage);
          await channel.send(weeklyMessage);
        }
      },
    );

    logger.info(`Ready! Logged in as ${client.user?.tag}`);
  },
};
