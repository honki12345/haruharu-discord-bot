import { describe, expect, it } from 'vitest';
import { buildDailyAttendanceThreadGuide } from '../daily-attendance.js';

describe('US-13: daily attendance thread guide', () => {
  it('새 정책 문구를 안내문에 포함한다', () => {
    const guide = buildDailyAttendanceThreadGuide();

    expect(guide).toContain('+11분~12:59 지각');
    expect(guide).toContain('13:00 집계 무댓글 결석');
    expect(guide).toContain('주말/공휴일 보너스');
  });
});
