import process from 'node:process';
import {
  ATTENDANCE_LATE_MINUTES,
  ATTENDANCE_OPEN_MINUTES,
  AttendanceStatus,
  getAttendanceStatusEmoji,
  isValidWakeTime,
} from './attendance.js';
import { logger } from './logger.js';

const KOREA_TIME_ZONE = 'Asia/Seoul';
type BackfillAttendanceStatus = AttendanceStatus | 'too-early';

type BackfillEntry = {
  threadId: string;
  messageId: string;
  userId: string;
};

type BackfillInput = {
  entries: BackfillEntry[];
};

type KoreaDateParts = {
  year: string;
  month: string;
  date: string;
  hours: string;
  minutes: string;
};

const usage = [
  'Usage:',
  '  npm run backfill:attendance -- <input.json>',
  '',
  'Input JSON:',
  '  {',
  '    "entries": [',
  '      { "threadId": "...", "messageId": "...", "userId": "..." }',
  '    ]',
  '  }',
].join('\n');

const getKoreaDateParts = (at: Date): KoreaDateParts => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(at);
  const readPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find(part => part.type === type)?.value;
    if (!value) {
      throw new Error(`Missing ${type} while formatting Korea date parts`);
    }
    return value;
  };

  return {
    year: readPart('year'),
    month: readPart('month'),
    date: readPart('day'),
    hours: readPart('hour'),
    minutes: readPart('minute'),
  };
};

const classifyAttendanceStatusInKorea = (waketime: string, at: Date): BackfillAttendanceStatus => {
  if (!isValidWakeTime(waketime)) {
    throw new Error(`Invalid waketime: ${waketime}`);
  }

  const { hours, minutes } = getKoreaDateParts(at);
  const waketimeHours = Number(waketime.slice(0, 2));
  const waketimeMinutes = Number(waketime.slice(2));
  const waketimeInMinutes = waketimeHours * 60 + waketimeMinutes;
  const commentTimeInMinutes = Number(hours) * 60 + Number(minutes);
  const diff = commentTimeInMinutes - waketimeInMinutes;

  if (diff < -ATTENDANCE_OPEN_MINUTES) {
    return 'too-early';
  }

  if (diff <= ATTENDANCE_OPEN_MINUTES) {
    return 'attended';
  }

  if (diff <= ATTENDANCE_LATE_MINUTES) {
    return 'late';
  }

  return 'absent';
};

const loadInput = async (inputPath: string): Promise<BackfillInput> => {
  const input = await import(inputPath, { with: { type: 'json' } });
  const data = input.default as Partial<BackfillInput>;

  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    throw new Error('Input JSON must contain a non-empty "entries" array');
  }

  for (const [index, entry] of data.entries.entries()) {
    if (
      !entry ||
      typeof entry.threadId !== 'string' ||
      typeof entry.messageId !== 'string' ||
      typeof entry.userId !== 'string'
    ) {
      throw new Error(`Invalid entry at index ${index}`);
    }
  }

  return data as BackfillInput;
};

const resolveInputPath = (rawPath: string) => {
  if (rawPath.startsWith('/')) {
    return new URL(`file://${rawPath}`);
  }

  return new URL(rawPath, `file://${process.cwd()}/`);
};

const main = async () => {
  const inputArg = process.argv[2];
  if (!inputArg || inputArg === '--help' || inputArg === '-h') {
    process.stdout.write(`${usage}\n`);
    return;
  }

  const [{ token }, { AttendanceLog }, { sequelize }, { Users }, { createClient }] = await Promise.all([
    import('./config.js'),
    import('./repository/AttendanceLog.js'),
    import('./repository/config.js'),
    import('./repository/Users.js'),
    import('./runtime.js'),
  ]);
  const client = createClient();

  try {
    const input = await loadInput(resolveInputPath(inputArg).href);
    await AttendanceLog.sync();
    await client.login(token);

    for (const entry of input.entries) {
      const channel = await client.channels.fetch(entry.threadId);
      if (!channel || !channel.isThread()) {
        throw new Error(`Thread not found: ${entry.threadId}`);
      }

      const message = await channel.messages.fetch(entry.messageId);
      if (message.author.id !== entry.userId) {
        throw new Error(
          `Message author mismatch for ${entry.messageId}: expected ${entry.userId}, got ${message.author.id}`,
        );
      }

      const commentedAt = new Date(message.createdTimestamp);
      const { year, month, date } = getKoreaDateParts(commentedAt);
      const yearmonth = `${year}${month}`;
      const yearmonthday = `${year}${month}${date}`;
      const user = await Users.findOne({
        where: {
          userid: entry.userId,
          yearmonth,
        },
      });

      if (!user) {
        throw new Error(`Registered Users snapshot not found for ${entry.userId} at ${yearmonth}`);
      }

      const status = classifyAttendanceStatusInKorea(user.waketime, commentedAt);
      const isTooEarlyAttendance = status === 'too-early';
      const attendanceLogStatus: 'attended' | 'late' | 'absent' = isTooEarlyAttendance ? 'attended' : status;

      const [attendanceLog] = await AttendanceLog.findOrCreate({
        where: {
          userid: user.userid,
          yearmonthday,
        },
        defaults: {
          userid: user.userid,
          username: user.username,
          yearmonthday,
          threadid: entry.threadId,
          messageid: entry.messageId,
          commentedat: commentedAt.toISOString(),
          status: attendanceLogStatus,
        },
      });

      if (attendanceLog.messageid !== entry.messageId) {
        throw new Error(
          `AttendanceLog already exists for ${entry.userId} on ${yearmonthday} with another message: ${attendanceLog.messageid}`,
        );
      }

      await message.react(getAttendanceStatusEmoji(attendanceLog.status));
      if (isTooEarlyAttendance) {
        await message.react('🌅');
      }
      logger.info('attendance backfill completed', {
        threadId: entry.threadId,
        messageId: entry.messageId,
        userId: entry.userId,
        status: attendanceLog.status,
      });
    }
  } finally {
    client.destroy();
    await sequelize.close();
  }
};

main().catch(error => {
  logger.error('attendance backfill failed', { error });
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
