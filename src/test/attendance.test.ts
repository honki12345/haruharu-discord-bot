import { describe, expect, it } from 'vitest';
import {
  classifyAttendanceStatus,
  getAttendanceStatusEmoji,
  getAttendanceStatusLabel,
} from '../attendance.js';

describe('attendance helper', () => {
  it('등록 시간 10분 전보다 이르면 too-early를 반환한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T06:49:00'));
    expect(status).toBe('too-early');
    expect(getAttendanceStatusEmoji(status)).toBe('⏰');
  });

  it('등록 시간 기준 10분 이내면 출석으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T07:10:00'));
    expect(status).toBe('attended');
    expect(getAttendanceStatusLabel(status)).toBe('출석');
  });

  it('등록 시간 기준 30분 이내면 지각으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T07:25:00'));
    expect(status).toBe('late');
    expect(getAttendanceStatusEmoji(status)).toBe('🟡');
  });

  it('등록 시간 기준 30분을 넘기면 결석으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T07:31:00'));
    expect(status).toBe('absent');
    expect(getAttendanceStatusLabel(status)).toBe('결석');
  });
});
