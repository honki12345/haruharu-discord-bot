import { Client, Events } from 'discord.js';
import { checkChannelId, logChannelId, resultChannelId, voiceChannelId } from '../config.js';
import { ensureTodayAttendanceThread } from '../daily-attendance.js';
import { logger } from '../logger.js';
import { syncCamStudyActiveSessionsFromClient } from '../services/camStudy.js';
import { buildCamStudyReports, buildChallengeReport, scheduleDailyReports, syncModels } from '../services/reporting.js';
import { syncSelfServiceOnboardingMessages } from '../services/selfServiceOnboarding.js';
import {
  calculateRemainingTimeDailyMessage,
  CAM_STUDY_HEARTBEAT_MILLISECONDS,
  getYearMonthDate,
  ONE_DAY_MILLISECONDS,
  PRINT_HOURS_DAILY_MESSAGE,
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

const syncSelfServiceOnboarding = async (client: Client) => {
  try {
    await syncSelfServiceOnboardingMessages({
      client,
      botUserId: client.user?.id ?? null,
    });
  } catch (error) {
    logger.error('Failed to sync self-service onboarding UI', {
      botUserId: client.user?.id ?? null,
      error,
    });
  }
};

export const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    await syncModels();
    await syncSelfServiceOnboarding(client);
    await syncCamStudyActiveSessions(client, 'ready');
    const { hours } = getYearMonthDate();

    if (Number(hours) >= PRINT_HOURS_DAILY_MESSAGE) {
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
        const { attendanceMessage, attendanceMessages, hallOfFameMessage } = await buildChallengeReport();
        const resultChannel = client.channels.cache.get(resultChannelId);

        if (attendanceMessage) {
          try {
            const attendanceThreadResult = await ensureTodayAttendanceThread(client, checkChannelId);
            const attendanceThread = attendanceThreadResult?.thread;

            if (attendanceThread && 'send' in attendanceThread) {
              for (const message of attendanceMessages ?? [attendanceMessage]) {
                await attendanceThread.send(message);
              }
            }
          } catch (error) {
            logger.error('Failed to send scheduled challenge report to attendance thread', {
              channelId: checkChannelId,
              error,
            });
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
