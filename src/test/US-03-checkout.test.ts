/**
 * US-03: 체크아웃
 * 사용자는 기상 1시간 후에 /check-out 명령어로 최종 출석을 완료한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestUsers, TestTimeLog, createMockInteraction } from './test-setup.js';

describe('US-03: /check-out 커맨드', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T08:05:00'));
    await TestTimeLog.destroy({ where: {} });
    await TestUsers.destroy({ where: {} });

    // 기본 테스트 사용자 생성 (기상시간 07:00 -> 체크아웃 시간 08:00)
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

  it('TC-CO01: 정상 체크아웃 (체크아웃 시간 08:00, 현재 08:05)', async () => {
    vi.setSystemTime(new Date('2025-12-07T08:05:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-out.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log).not.toBeNull();
    expect(log?.checkouttime).toBe('0805');
    expect(log?.isintime).toBe(true);
    expect(interaction.getLastReply()).toContain('check-out에 성공');
  });

  it('TC-CO02: 체크아웃 경계값 - 10분 이내 (08:10)', async () => {
    vi.setSystemTime(new Date('2025-12-07T08:10:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-out.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log?.isintime).toBe(true);
  });

  it('TC-CO03: 중복 체크아웃', async () => {
    await TestTimeLog.create({
      userid: 'test-user-id',
      username: '홍길동',
      yearmonthday: '20251207',
      checkintime: '0700',
      checkouttime: '0800',
      isintime: true,
    });

    vi.setSystemTime(new Date('2025-12-07T08:05:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-out.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('already check-out');
  });

  it('TC-CO04: 체크아웃 시간 초과 (체크아웃 시간 08:00, 현재 08:35)', async () => {
    vi.setSystemTime(new Date('2025-12-07T08:35:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-out.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('Not time for check-out');
  });

  it('TC-CO05: 체크아웃 너무 이른 시간 (07:49)', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:49:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-out.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('Not time for check-out');
  });

  it('TC-CO06: 지각 체크아웃 (체크아웃 시간 08:00, 현재 08:15)', async () => {
    vi.setSystemTime(new Date('2025-12-07T08:15:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-out.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log?.isintime).toBe(false);
    expect(interaction.getLastReply()).toContain('지각');
  });
});
