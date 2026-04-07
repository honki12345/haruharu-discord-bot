export type AttendanceStatus = 'attended' | 'late' | 'absent';

const KOREA_TIME_ZONE = 'Asia/Seoul';
const ATTENDANCE_OPEN_MINUTES = 10;
const ATTENDANCE_ABSENT_CUTOFF_HOUR = 13;
const ATTENDANCE_ABSENT_CUTOFF_MINUTES = ATTENDANCE_ABSENT_CUTOFF_HOUR * 60;

const getKoreaTimeInMinutes = (at: Date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KOREA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(at);
  const hours = parts.find(part => part.type === 'hour')?.value;
  const minutes = parts.find(part => part.type === 'minute')?.value;

  if (!hours || !minutes) {
    throw new Error('Failed to resolve Korea time');
  }

  return Number(hours) * 60 + Number(minutes);
};

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  attended: '출석',
  late: '지각',
  absent: '결석',
};

const ATTENDANCE_STATUS_EMOJIS: Record<AttendanceStatus, string> = {
  attended: '✅',
  late: '🟡',
  absent: '❌',
};

const isValidWakeTime = (waketime: string) => {
  if (!/^\d{4}$/.test(waketime)) {
    return false;
  }

  const hours = Number(waketime.slice(0, 2));
  const minutes = Number(waketime.slice(2));

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const getAttendanceTimeDifferenceInMinutes = (waketime: string, at: Date = new Date()) => {
  if (!isValidWakeTime(waketime)) {
    throw new Error('Invalid waketime');
  }

  const hours = Number(waketime.slice(0, 2));
  const minutes = Number(waketime.slice(2));
  const waketimeInMinutes = hours * 60 + minutes;
  const nowInMinutes = getKoreaTimeInMinutes(at);

  return nowInMinutes - waketimeInMinutes;
};

const classifyAttendanceStatus = (waketime: string, at: Date = new Date()): AttendanceStatus => {
  const diff = getAttendanceTimeDifferenceInMinutes(waketime, at);
  const nowInMinutes = getKoreaTimeInMinutes(at);

  if (diff <= ATTENDANCE_OPEN_MINUTES) {
    return 'attended';
  }

  if (nowInMinutes < ATTENDANCE_ABSENT_CUTOFF_MINUTES) {
    return 'late';
  }

  return 'absent';
};

const getAttendanceStatusLabel = (status: AttendanceStatus) => ATTENDANCE_STATUS_LABELS[status];

const getAttendanceStatusEmoji = (status: AttendanceStatus) => ATTENDANCE_STATUS_EMOJIS[status];

export {
  ATTENDANCE_OPEN_MINUTES,
  ATTENDANCE_ABSENT_CUTOFF_MINUTES,
  classifyAttendanceStatus,
  getAttendanceTimeDifferenceInMinutes,
  getAttendanceStatusLabel,
  getAttendanceStatusEmoji,
  isValidWakeTime,
};
