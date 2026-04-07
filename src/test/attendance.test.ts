import { describe, expect, it } from 'vitest';
import { classifyAttendanceStatus, getAttendanceStatusEmoji, getAttendanceStatusLabel } from '../attendance.js';

describe('attendance helper', () => {
  it('등록 시간 10분 전보다 일러도 출석으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T06:49:00+09:00'));
    expect(status).toBe('attended');
    expect(getAttendanceStatusEmoji(status)).toBe('✅');
  });

  it('등록 시간보다 훨씬 이른 댓글도 상한 없이 출석으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T03:00:00+09:00'));
    expect(status).toBe('attended');
    expect(getAttendanceStatusLabel(status)).toBe('출석');
  });

  it('등록 시간 기준 10분 이내면 출석으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T07:10:00+09:00'));
    expect(status).toBe('attended');
    expect(getAttendanceStatusLabel(status)).toBe('출석');
  });

  it('등록 시간 기준 30분 이내면 지각으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T07:25:00+09:00'));
    expect(status).toBe('late');
    expect(getAttendanceStatusEmoji(status)).toBe('🟡');
  });

  it('등록 시간 기준 07:11은 지각으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T07:11:00+09:00'));
    expect(status).toBe('late');
    expect(getAttendanceStatusLabel(status)).toBe('지각');
  });

  it('13:00 직전인 12:59까지는 지각으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T12:59:00+09:00'));
    expect(status).toBe('late');
    expect(getAttendanceStatusEmoji(status)).toBe('🟡');
  });

  it('13:00 정각이면 결석으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T13:00:00+09:00'));
    expect(status).toBe('absent');
    expect(getAttendanceStatusLabel(status)).toBe('결석');
  });

  it('등록 시간 기준 30분을 넘겨도 13:00 전이면 지각으로 판정한다', () => {
    const status = classifyAttendanceStatus('0700', new Date('2026-03-24T07:31:00+09:00'));
    expect(status).toBe('late');
    expect(getAttendanceStatusLabel(status)).toBe('지각');
  });

  it('잘못된 waketime 형식이면 명시적으로 예외를 던진다', () => {
    expect(() => classifyAttendanceStatus('7am', new Date('2026-03-24T07:31:00+09:00'))).toThrow('Invalid waketime');
    expect(() => classifyAttendanceStatus('2460', new Date('2026-03-24T07:31:00+09:00'))).toThrow('Invalid waketime');
  });
});
