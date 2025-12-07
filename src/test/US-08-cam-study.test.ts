/**
 * US-08: 캠스터디 공부 시간 기록
 * 시스템은 사용자가 음성 채널에서 스트리밍을 켜고 끌 때 공부 시간을 기록한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testSequelize, TestCamStudyUsers, TestCamStudyTimeLog, createMockVoiceState } from './test-setup.js';

describe('US-08: 캠스터디 공부 시간 기록', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T10:00:00'));
    await TestCamStudyTimeLog.destroy({ where: {} });
    await TestCamStudyUsers.destroy({ where: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('TC-CS01: 미등록 사용자', () => {
    it('등록되지 않은 사용자가 채널에 입장하면 알림 메시지를 보낸다', async () => {
      const oldState = createMockVoiceState({
        channelId: null,
        streaming: false,
        userId: 'unregistered-user',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'unregistered-user',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      expect(newState._sendMock).toHaveBeenCalledWith('등록되지 않은 회원입니다');
    });
  });

  describe('TC-CS02: 공부 시작 (스트리밍 켜기)', () => {
    beforeEach(async () => {
      await TestCamStudyUsers.create({
        userid: 'test-user-id',
        username: '테스트유저',
      });
    });

    it('채널에서 스트리밍을 시작하면 타임로그가 생성된다', async () => {
      vi.setSystemTime(new Date('2025-12-07T10:00:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id' } });
      expect(log).not.toBeNull();
      expect(log?.yearmonthday).toBe('20251207');
      expect(log?.totalminutes).toBe(0);
      expect(newState._sendMock).toHaveBeenCalledWith('테스트유저님 study start');
    });

    it('이미 타임로그가 있으면 timestamp만 업데이트한다', async () => {
      await TestCamStudyTimeLog.create({
        userid: 'test-user-id',
        username: '테스트유저',
        yearmonthday: '20251207',
        timestamp: '1733562000000',
        totalminutes: 30,
      });

      vi.setSystemTime(new Date('2025-12-07T14:00:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id' } });
      expect(log?.totalminutes).toBe(30); // totalminutes는 변경되지 않음
    });
  });

  describe('TC-CS03: 공부 종료 (스트리밍 끄기)', () => {
    beforeEach(async () => {
      await TestCamStudyUsers.create({
        userid: 'test-user-id',
        username: '테스트유저',
      });
    });

    it('5분 이상 공부 후 스트리밍을 끄면 공부시간이 기록된다', async () => {
      const startTime = new Date('2025-12-07T10:00:00').getTime();
      await TestCamStudyTimeLog.create({
        userid: 'test-user-id',
        username: '테스트유저',
        yearmonthday: '20251207',
        timestamp: startTime.toString(),
        totalminutes: 0,
      });

      vi.setSystemTime(new Date('2025-12-07T10:30:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id' } });
      expect(log?.totalminutes).toBe(30);
      expect(newState._sendMock).toHaveBeenCalledWith(expect.stringContaining('30분 입력완료'));
    });

    it('5분 이내면 공부시간이 기록되지 않는다', async () => {
      const startTime = new Date('2025-12-07T10:00:00').getTime();
      await TestCamStudyTimeLog.create({
        userid: 'test-user-id',
        username: '테스트유저',
        yearmonthday: '20251207',
        timestamp: startTime.toString(),
        totalminutes: 0,
      });

      vi.setSystemTime(new Date('2025-12-07T10:03:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id' } });
      expect(log?.totalminutes).toBe(0);
      expect(newState._sendMock).toHaveBeenCalledWith('테스트유저님 study end: 5분 이내 입력안됨');
    });

    it('누적 공부시간이 합산된다', async () => {
      const startTime = new Date('2025-12-07T14:00:00').getTime();
      await TestCamStudyTimeLog.create({
        userid: 'test-user-id',
        username: '테스트유저',
        yearmonthday: '20251207',
        timestamp: startTime.toString(),
        totalminutes: 60,
      });

      vi.setSystemTime(new Date('2025-12-07T14:30:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id' } });
      expect(log?.totalminutes).toBe(90);
      expect(newState._sendMock).toHaveBeenCalledWith(expect.stringContaining('총 공부시간: 90분'));
    });
  });

  describe('TC-CS04: 채널 퇴장으로 공부 종료', () => {
    beforeEach(async () => {
      await TestCamStudyUsers.create({
        userid: 'test-user-id',
        username: '테스트유저',
      });
    });

    it('스트리밍 중에 채널을 나가면 공부시간이 기록된다', async () => {
      const startTime = new Date('2025-12-07T10:00:00').getTime();
      await TestCamStudyTimeLog.create({
        userid: 'test-user-id',
        username: '테스트유저',
        yearmonthday: '20251207',
        timestamp: startTime.toString(),
        totalminutes: 0,
      });

      vi.setSystemTime(new Date('2025-12-07T11:00:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: null,
        streaming: false,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id' } });
      expect(log?.totalminutes).toBe(60);
    });
  });

  describe('TC-CS05: 자정을 넘긴 공부 (어제 타임로그)', () => {
    beforeEach(async () => {
      await TestCamStudyUsers.create({
        userid: 'test-user-id',
        username: '테스트유저',
      });
    });

    it('어제 시작한 공부가 오늘까지 이어지면 새 타임로그에 기록된다', async () => {
      const yesterdayStartTime = new Date('2025-12-06T23:00:00').getTime();
      await TestCamStudyTimeLog.create({
        userid: 'test-user-id',
        username: '테스트유저',
        yearmonthday: '20251206',
        timestamp: yesterdayStartTime.toString(),
        totalminutes: 0,
      });

      vi.setSystemTime(new Date('2025-12-07T01:00:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const todayLog = await TestCamStudyTimeLog.findOne({
        where: { userid: 'test-user-id', yearmonthday: '20251207' },
      });
      expect(todayLog).not.toBeNull();
      expect(todayLog?.totalminutes).toBe(120);
    });
  });

  describe('TC-CS06: 타임로그 없이 공부 종료 (비정상 케이스)', () => {
    beforeEach(async () => {
      await TestCamStudyUsers.create({
        userid: 'test-user-id',
        username: '테스트유저',
      });
    });

    it('오늘/어제 타임로그 없이 종료하면 비정상 로그 메시지를 보낸다', async () => {
      vi.setSystemTime(new Date('2025-12-07T10:00:00'));

      const oldState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'valid-voice-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      expect(newState._sendMock).toHaveBeenCalledWith('테스트유저님 study end: 공부시간 정상 입력안됨');
    });
  });

  describe('TC-CS07: 다른 채널에서의 이벤트', () => {
    beforeEach(async () => {
      await TestCamStudyUsers.create({
        userid: 'test-user-id',
        username: '테스트유저',
      });
    });

    it('설정된 채널이 아닌 곳에서는 이벤트가 무시된다', async () => {
      const oldState = createMockVoiceState({
        channelId: 'other-channel-id',
        streaming: false,
        userId: 'test-user-id',
      });

      const newState = createMockVoiceState({
        channelId: 'other-channel-id',
        streaming: true,
        userId: 'test-user-id',
      });

      const { event } = await import('../events/camStudyHandler.js');
      await event.execute(oldState as never, newState as never);

      const log = await TestCamStudyTimeLog.findOne({ where: { userid: 'test-user-id' } });
      expect(log).toBeNull();
      expect(newState._sendMock).not.toHaveBeenCalled();
    });
  });
});
