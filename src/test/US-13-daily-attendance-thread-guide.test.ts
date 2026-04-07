import { describe, expect, it } from 'vitest';
import { buildDailyAttendanceThreadGuide } from '../daily-attendance.js';

describe('US-13: daily attendance thread guide', () => {
  it('새 정책 문구를 포함하고 제거된 무패널티 문구는 다시 넣지 않는다', () => {
    const guide = buildDailyAttendanceThreadGuide();

    expect(guide).toContain('봇 판정(이모지) 안내');
    expect(guide).toContain('- 🌅 얼리 출석: 등록 시간 -11분 이전 댓글도 출석으로 인정, ✅와 함께 추가 반응');
    expect(guide).toContain('- ✅ 출석: 등록 시간 -10분~+10분');
    expect(guide).toContain('+11분~12:59 지각');
    expect(guide).toContain('13:00 집계 무댓글 결석');
    expect(guide).toContain('주말/공휴일 보너스');
    expect(guide).toContain('- ❓ 미등록: 등록되지 않은 사용자');
    expect(guide).not.toContain('😌 주말/공휴일 미참여 또는 absent: 무패널티');
  });
});
