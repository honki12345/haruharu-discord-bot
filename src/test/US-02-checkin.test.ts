/**
 * US-02: 체크인
 * 사용자는 /check-in 호출 시 오늘의 출석 thread로 안내받는다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ensureTodayAttendanceThread } from '../daily-attendance.js';
import { testSequelize, TestUsers, TestTimeLog, createMockInteraction } from './test-setup.js';

vi.mock('../daily-attendance.js', () => ({
  ensureTodayAttendanceThread: vi.fn(),
}));

const createMockAttendanceThread = () => ({
  id: 'attendance-thread-id',
  toString: () => '<#attendance-thread-id>',
});

describe('US-02: /check-in 커맨드', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T07:05:00'));
    vi.mocked(ensureTodayAttendanceThread).mockReset();
    await TestTimeLog.destroy({ where: {} });
    await TestUsers.destroy({ where: {} });

    await TestUsers.create({
      userid: 'test-user-id',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-CI01: 오늘 출석 thread로 이동 안내를 반환하고 TimeLog를 만들지 않는다', async () => {
    vi.mocked(ensureTodayAttendanceThread).mockResolvedValue({
      thread: createMockAttendanceThread(),
      created: false,
    });

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: null,
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log).toBeNull();
    expect(interaction.getLastReply()).toContain('/check-in');
    expect(interaction.getLastReply()).toContain('더 이상 공식 출석 기록 경로가 아닙니다');
    expect(interaction.getLastReply()).toContain('<#attendance-thread-id>');
  });

  it('TC-CI02: 기존 TimeLog가 있어도 레거시 check-in 호출로 덮어쓰지 않는다', async () => {
    await TestTimeLog.create({
      userid: 'test-user-id',
      username: '홍길동',
      yearmonthday: '20251207',
      checkintime: '0700',
      checkouttime: '0800',
      isintime: true,
    });

    vi.mocked(ensureTodayAttendanceThread).mockResolvedValue({
      thread: createMockAttendanceThread(),
      created: false,
    });

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: null,
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const logs = await TestTimeLog.findAll({ where: { userid: 'test-user-id' } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.checkintime).toBe('0700');
    expect(logs[0]?.checkouttime).toBe('0800');
    expect(interaction.getLastReply()).toContain('<#attendance-thread-id>');
  });

  it('TC-CI03: 출석 thread를 직접 찾지 못해도 정책 안내는 유지한다', async () => {
    vi.mocked(ensureTodayAttendanceThread).mockRejectedValue(new Error('discord unavailable'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: null,
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log).toBeNull();
    expect(interaction.getLastReply()).toContain('/check-in');
    expect(interaction.getLastReply()).toContain('오늘 출석은');
    expect(interaction.getLastReply()).toContain('출석 쓰레드');
  });
});
