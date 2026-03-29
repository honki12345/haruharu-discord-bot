/**
 * US-13: 사용자 직접 기상시간 변경
 * 사용자는 /set-waketime 명령어로 자신의 기상시간을 직접 변경한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  testSequelize,
  TestUsers,
  TestWaketimeChangeLog,
  clearAllTables,
  createMockInteraction,
} from './test-setup.js';

describe('US-13: /set-waketime 커맨드', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T07:05:00'));
    await clearAllTables();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-SW01: 등록된 사용자는 자신의 현재 월 기상시간을 변경할 수 있다', async () => {
    await TestUsers.create({
      userid: 'self-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const interaction = createMockInteraction({
      userId: 'self-user',
      options: {
        waketime: '0800',
      },
    });

    const { command } = await import('../commands/haruharu/set-waketime.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'self-user', yearmonth: '202512' } });
    const changeLog = await TestWaketimeChangeLog.findOne({
      where: { userid: 'self-user', yearmonthday: '20251207' },
    });

    expect(user?.waketime).toBe('0800');
    expect(changeLog?.waketime).toBe('0800');
    expect(interaction.getLastReply()).toContain('0800');
  });

  it('TC-SW02: 같은 사용자는 같은 날 두 번 기상시간을 변경할 수 없다', async () => {
    await TestUsers.create({
      userid: 'self-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestWaketimeChangeLog.create({
      userid: 'self-user',
      yearmonthday: '20251207',
      waketime: '0730',
    });

    const interaction = createMockInteraction({
      userId: 'self-user',
      options: {
        waketime: '0800',
      },
    });

    const { command } = await import('../commands/haruharu/set-waketime.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'self-user', yearmonth: '202512' } });
    expect(user?.waketime).toBe('0700');
    expect(interaction.getLastReply()).toContain('하루에 한 번만');
  });
});
