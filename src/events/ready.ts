import { Client, Events } from 'discord.js';
import { checkChannelId, logChannelId, resultChannelId, voiceChannelId } from '../config.js';
import { ensureTodayAttendanceThread } from '../daily-attendance.js';
import { logger } from '../logger.js';
import { syncCamStudyActiveSessionsFromClient } from '../services/camStudy.js';
import { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels } from '../services/reporting.js';
import {
  calculateRemainingTimeDailyMessage,
  CAM_STUDY_HEARTBEAT_MILLISECONDS,
  getYearMonthDate,
  ONE_DAY_MILLISECONDS,
} from '../utils.js';

const ensureDailyAttendanceThreadInterval = async (client: Client) => {
  try {
    await ensureTodayAttendanceThread(client, checkChannelId);
  } catch {
    // ensureTodayAttendanceThread logs failures itself; swallow here to keep scheduling alive.
  }
};

const syncCamStudyActiveSessions = async (client: Client, source: 'ready' | 'heartbeat') => {
  try {
    await syncCamStudyActiveSessionsFromClient(client, voiceChannelId, source);
  } catch (error) {
    logger.error('Failed to sync cam study active sessions', { source, channelId: voiceChannelId, error });
  }
};

export const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    await syncModels();
    await syncCamStudyActiveSessions(client, 'ready');
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
    setInterval(() => {
      void syncCamStudyActiveSessions(client, 'heartbeat');
    }, CAM_STUDY_HEARTBEAT_MILLISECONDS);

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
