import { Client, Events } from 'discord.js';
import { checkChannelId, logChannelId, resultChannelId } from '../config.js';
import { ensureTodayAttendanceThread } from '../daily-attendance.js';
import { logger } from '../logger.js';
import { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels } from '../services/reporting.js';
import { calculateRemainingTimeDailyMessage, getYearMonthDate, ONE_DAY_MILLISECONDS } from '../utils.js';

const ensureDailyAttendanceThreadInterval = async (client: Client) => {
  try {
    await ensureTodayAttendanceThread(client, checkChannelId);
  } catch {
    // ensureTodayAttendanceThread logs failures itself; swallow here to keep scheduling alive.
  }
};

export const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    await syncModels();
    const { hours } = getYearMonthDate();

    if (Number(hours) >= 6) {
      await ensureDailyAttendanceThreadInterval(client);
    }

    const remainingTimeDailyMessage = calculateRemainingTimeDailyMessage();
    setTimeout(() => {
      void ensureDailyAttendanceThreadInterval(client);
      setInterval(() => {
        void ensureDailyAttendanceThreadInterval(client);
      }, ONE_DAY_MILLISECONDS);
    }, remainingTimeDailyMessage);

    scheduleDailyReports(
      async () => {
        const { attendanceMessage, attendanceMessages, hallOfFameMessage } = await buildChallengeReport();
        const checkChannel = client.channels.cache.get(checkChannelId);
        const resultChannel = client.channels.cache.get(resultChannelId);

        if (attendanceMessage && checkChannel && 'send' in checkChannel) {
          for (const message of attendanceMessages ?? [attendanceMessage]) {
            await checkChannel.send(message);
          }
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
