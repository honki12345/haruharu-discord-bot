import { describe, expect, it } from 'vitest';
import { buildDailyAttendanceThreadGuide } from '../daily-attendance.js';

describe('US-13: daily attendance thread guide', () => {
  it('실제 반응 이모지 안내만 포함하고 무패널티 absent 문구는 포함하지 않는다', () => {
    const guide = buildDailyAttendanceThreadGuide();

    expect(guide).toContain('봇 판정(이모지) 안내');
    expect(guide).toContain('- 🌅 얼리 출석: 등록 시간 -11분 이전 댓글도 출석으로 인정, ✅와 함께 추가 반응');
    expect(guide).toContain('- ✅ 출석: 등록 시간 -10분~+10분');
    expect(guide).toContain('- 🟡 지각: 등록 시간 +11~30분');
    expect(guide).toContain('- ❌ 결석: 등록 시간 +30분 초과');
    expect(guide).toContain(
      '- 🎁 주말/공휴일 보너스: 출석/지각 성공 댓글에 추가 반응, 13:00에 결석 1회 없으면 지각 1회 차감',
    );
    expect(guide).toContain('- ❓ 미등록: 등록되지 않은 사용자');
    expect(guide).not.toContain('😌 주말/공휴일 미참여 또는 absent: 무패널티');
  });
});
