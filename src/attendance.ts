export type AttendanceStatus = 'too-early' | 'attended' | 'late' | 'absent';

const ATTENDANCE_OPEN_MINUTES = 10;
const ATTENDANCE_LATE_MINUTES = 30;

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  'too-early': '출석 가능 시간 전',
  attended: '출석',
  late: '지각',
  absent: '결석',
};

const ATTENDANCE_STATUS_EMOJIS: Record<AttendanceStatus, string> = {
  'too-early': '⏰',
  attended: '✅',
  late: '🟡',
  absent: '❌',
};

const getAttendanceTimeDifferenceInMinutes = (waketime: string, at: Date = new Date()) => {
  const hours = Number(waketime.slice(0, 2));
  const minutes = Number(waketime.slice(2));
  const waketimeInMinutes = hours * 60 + minutes;
  const nowInMinutes = at.getHours() * 60 + at.getMinutes();

  return nowInMinutes - waketimeInMinutes;
};

const classifyAttendanceStatus = (waketime: string, at: Date = new Date()): AttendanceStatus => {
  const diff = getAttendanceTimeDifferenceInMinutes(waketime, at);

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

const getAttendanceStatusLabel = (status: AttendanceStatus) => ATTENDANCE_STATUS_LABELS[status];

const getAttendanceStatusEmoji = (status: AttendanceStatus) => ATTENDANCE_STATUS_EMOJIS[status];

export {
  ATTENDANCE_OPEN_MINUTES,
  ATTENDANCE_LATE_MINUTES,
  classifyAttendanceStatus,
  getAttendanceTimeDifferenceInMinutes,
  getAttendanceStatusLabel,
  getAttendanceStatusEmoji,
};
