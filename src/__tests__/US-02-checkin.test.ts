/**
 * US-02: 체크인
 * 사용자는 기상 시간에 /check-in 명령어로 출석 체크를 한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestUsers, TestTimeLog, createMockInteraction } from './test-setup.js';

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
    await TestTimeLog.destroy({ where: {} });
    await TestUsers.destroy({ where: {} });

    // 기본 테스트 사용자 생성
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

  it('TC-CI01: 정시 체크인 성공 (기상시간 07:00, 현재 07:05)', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:05:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log).not.toBeNull();
    expect(log?.checkintime).toBe('0705');
    expect(log?.isintime).toBe(true);
    expect(interaction.getLastReply()).toContain('check-in에 성공');
    expect(interaction.getLastReply()).not.toContain('지각');
  });

  it('TC-CI02: 정시 경계값 (기상시간 07:00, 현재 07:10)', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:10:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log?.isintime).toBe(true);
  });

  it('TC-CI03: 지각 체크인 (기상시간 07:00, 현재 07:15)', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:15:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log?.isintime).toBe(false);
    expect(interaction.getLastReply()).toContain('지각');
  });

  it('TC-CI04: 지각 경계값 (기상시간 07:00, 현재 07:11)', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:11:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log?.isintime).toBe(false);
  });

  it('TC-CI05: 시간 초과 (기상시간 07:00, 현재 07:31)', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:31:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log).toBeNull();
    expect(interaction.getLastReply()).toContain('Not time for check-in');
  });

  it('TC-CI06: 너무 이른 시간 (기상시간 07:00, 현재 06:29)', async () => {
    vi.setSystemTime(new Date('2025-12-07T06:29:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log).toBeNull();
    expect(interaction.getLastReply()).toContain('Not time for check-in');
  });

  it('TC-CI07: 미등록 사용자', async () => {
    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'unregistered-user',
      globalName: '미등록유저',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('not registered');
  });

  it('TC-CI08: 중복 체크인', async () => {
    await TestTimeLog.create({
      userid: 'test-user-id',
      username: '홍길동',
      yearmonthday: '20251207',
      checkintime: '0700',
      checkouttime: null,
      isintime: true,
    });

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('already check-in');
  });

  it('TC-CI09: 이미지 미첨부', async () => {
    vi.setSystemTime(new Date('2025-12-07T07:05:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: null,
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('please upload image file');
  });

  it('TC-CI10: 잘못된 채널', async () => {
    const interaction = createMockInteraction({
      channelId: 'invalid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('no valid channel');
  });

  it('TC-CI11: 30분 전 정확히 체크인 가능 (기상시간 07:00, 현재 06:30)', async () => {
    vi.setSystemTime(new Date('2025-12-07T06:30:00'));

    const interaction = createMockInteraction({
      channelId: 'valid-channel-id',
      userId: 'test-user-id',
      attachment: { url: 'https://example.com/image.jpg', name: 'image.jpg', contentType: 'image/jpeg' },
    });

    const { command } = await import('../commands/haruharu/check-in.js');
    await command.execute(interaction as never);

    const log = await TestTimeLog.findOne({ where: { userid: 'test-user-id' } });
    expect(log).not.toBeNull();
    expect(log?.isintime).toBe(true);
  });
});
