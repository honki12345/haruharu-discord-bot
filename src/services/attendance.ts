import { checkChannelId } from '../config.js';
import { logger } from '../logger.js';
import { createChallengeLog, findChallengeUser, listUserChallengeLogs } from '../repository/challengeRepository.js';
import { ABSENCE_RANGE_TIME, LATE_RANGE_TIME } from '../utils/constants.js';
import { getYearMonth, getYearMonthDate, getYearMonthDay } from '../utils/date.js';

type AttendanceAction = 'check-in' | 'check-out';

interface AttendanceAttachment {
  contentType?: string | null;
  name?: string | null;
  url: string;
}

interface AttendanceRequest {
  action: AttendanceAction;
  attachment: AttendanceAttachment | null;
  channelId: string;
  globalName?: string | null;
  userId: string;
}

interface AttendanceResult {
  attachmentToForward?: {
    attachment: string;
    name: string;
  };
  reply: string | { content: string; ephemeral?: boolean };
}

const attendanceMessages = {
  'check-in': {
    duplicate: 'you did already check-in',
    invalidTime: (currentTime: string, expectedTime: string) =>
      `Not time for check-in: now:${currentTime} yours: ${expectedTime}`,
    missingUser: (globalName: string) => `check-in fail: ${globalName} not registered`,
    success: (username: string, recordedTime: string, isInTime: boolean) =>
      isInTime
        ? `${username}님 check-in에 성공하셨습니다: ${recordedTime}`
        : `${username}님 check-in에 성공하셨습니다 (지각): ${recordedTime}`,
  },
  'check-out': {
    duplicate: 'you did already check-out',
    invalidTime: (currentTime: string, expectedTime: string) =>
      `Not time for check-out: now:${currentTime} yours: ${expectedTime}`,
    missingUser: (globalName: string) => `${globalName} not registered`,
    success: (username: string, recordedTime: string, isInTime: boolean) =>
      isInTime
        ? `${username}님 check-out에 성공하셨습니다: ${recordedTime}`
        : `${username}님 check-out에 성공하셨습니다 (지각): ${recordedTime}`,
  },
} satisfies Record<
  AttendanceAction,
  {
    duplicate: string;
    invalidTime: (currentTime: string, expectedTime: string) => string;
    missingUser: (globalName: string) => string;
    success: (username: string, recordedTime: string, isInTime: boolean) => string;
  }
>;

const validateAttachment = (attachment: AttendanceAttachment | null) =>
  Boolean(attachment?.contentType?.startsWith('image/'));

const evaluateAttendanceWindow = (
  action: AttendanceAction,
  waketime: string,
  hours: string,
  minutes: string,
): { isInTime: boolean; valid: boolean; waketimeForMessage: string } => {
  const nowTimeInMinutes = Number(hours) * 60 + Number(minutes);

  if (action === 'check-in') {
    const checkinTimeInMinutes = Number(waketime.substring(0, 2)) * 60 + Number(waketime.substring(2));
    const timeDifferenceValue = nowTimeInMinutes - checkinTimeInMinutes;

    return {
      isInTime: timeDifferenceValue <= LATE_RANGE_TIME,
      valid: Math.abs(timeDifferenceValue) <= ABSENCE_RANGE_TIME,
      waketimeForMessage: waketime,
    };
  }

  const hoursString = waketime.substring(0, 2);
  const minutesString = waketime.substring(2);
  const checkoutTimeInMinutes = (Number(hoursString) + 1) * 60 + Number(minutesString);
  const timeDifferenceValue = nowTimeInMinutes - checkoutTimeInMinutes;

  return {
    isInTime: timeDifferenceValue <= LATE_RANGE_TIME,
    valid: !(timeDifferenceValue < -LATE_RANGE_TIME || timeDifferenceValue > ABSENCE_RANGE_TIME),
    waketimeForMessage: `0${Number(hoursString) + 1}`.slice(-2) + minutesString,
  };
};

const executeAttendance = async ({
  action,
  attachment,
  channelId,
  globalName,
  userId,
}: AttendanceRequest): Promise<AttendanceResult> => {
  if (channelId !== checkChannelId) {
    return { reply: { content: 'no valid channel for command', ephemeral: true } };
  }

  const { year, month, date, hours, minutes } = getYearMonthDate();
  const yearmonth = getYearMonth(year, month);
  const yearmonthday = getYearMonthDay(year, month, date);

  logger.info(`${action} input value: userid: ${userId}, yearmonth: ${yearmonth}`);
  const user = await findChallengeUser(userId, yearmonth);

  if (!user) {
    return { reply: attendanceMessages[action].missingUser(globalName ?? 'unknown') };
  }

  logger.info(`${action} 검색 유저모델`, { user });

  const timelogs = await listUserChallengeLogs(userId, yearmonthday);
  const isDuplicated = timelogs.some(timelog =>
    action === 'check-in' ? Boolean(timelog.checkintime) : Boolean(timelog.checkouttime),
  );
  logger.info(`timelogs for ${action} duplicated`, { timelogs });
  logger.info(`result isDuplicated: ${isDuplicated}`);
  if (isDuplicated) {
    return { reply: attendanceMessages[action].duplicate };
  }

  const { isInTime, valid, waketimeForMessage } = evaluateAttendanceWindow(action, user.waketime, hours, minutes);
  if (!valid) {
    return { reply: attendanceMessages[action].invalidTime(`${hours}${minutes}`, waketimeForMessage) };
  }

  logger.info(`image attachment info: `, { attachment });
  if (!attachment || !validateAttachment(attachment)) {
    return { reply: 'please upload image file' };
  }

  const verifiedAttachment = attachment;
  const recordedTime = `${hours}${minutes}`;
  await createChallengeLog({
    userid: userId,
    username: user.username,
    yearmonthday,
    checkintime: action === 'check-in' ? recordedTime : null,
    checkouttime: action === 'check-out' ? recordedTime : null,
    isintime: isInTime,
  });

  return {
    attachmentToForward: {
      attachment: verifiedAttachment.url,
      name: verifiedAttachment.name ?? 'image',
    },
    reply: attendanceMessages[action].success(user.username, recordedTime, isInTime),
  };
};

export { executeAttendance };
