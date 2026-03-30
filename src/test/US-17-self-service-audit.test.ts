import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockInteraction } from './test-setup.js';

const createAuditChannel = () => ({
  send: vi.fn().mockResolvedValue(undefined),
});

const createAuditClient = (auditChannel: { send: ReturnType<typeof vi.fn> }) => ({
  channels: {
    fetch: vi.fn().mockResolvedValue(auditChannel),
  },
});

describe('US-17: self-service 응답/운영 로그', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.each([
    {
      name: '/register 성공',
      commandModulePath: '../commands/haruharu/register.js' as const,
      mockModulePath: '../services/challengeSelfService.js',
      mockFactory: () => ({
        executeRegisterWithRoleSync: vi
          .fn()
          .mockResolvedValue({ reply: '홍길동님 기상시간을 등록했습니다. 기준월: 202603, 기상시간: 0800' }),
      }),
      interactionOptions: { waketime: '0800' },
      expectedReplyText: '기상시간을 등록했습니다',
    },
    {
      name: '/register 실패',
      commandModulePath: '../commands/haruharu/register.js' as const,
      mockModulePath: '../services/challengeSelfService.js',
      mockFactory: () => ({
        executeRegisterWithRoleSync: vi
          .fn()
          .mockResolvedValue({ reply: '기상시간은 05:00부터 09:00 사이 HHmm 또는 HH:mm 형식으로 입력해주세요' }),
      }),
      interactionOptions: { waketime: '0400' },
      expectedReplyText: '05:00부터 09:00',
    },
    {
      name: '/stop-wakeup 성공',
      commandModulePath: '../commands/haruharu/stop-wakeup.js' as const,
      mockModulePath: '../services/challengeSelfService.js',
      mockFactory: () => ({
        executeStopWakeUpWithRoleSync: vi.fn().mockResolvedValue({
          reply: '기상스터디 참여를 중단했습니다. 현재 월 기록은 유지되고 다음 달부터 자동 등록되지 않습니다',
        }),
      }),
      interactionOptions: {},
      expectedReplyText: '참여를 중단했습니다',
    },
    {
      name: '/stop-wakeup 실패',
      commandModulePath: '../commands/haruharu/stop-wakeup.js' as const,
      mockModulePath: '../services/challengeSelfService.js',
      mockFactory: () => ({
        executeStopWakeUpWithRoleSync: vi
          .fn()
          .mockResolvedValue({ reply: '현재 진행 중인 기상스터디 참여가 없습니다' }),
      }),
      interactionOptions: {},
      expectedReplyText: '현재 진행 중인 기상스터디 참여가 없습니다',
    },
    {
      name: '/apply-vacation 성공',
      commandModulePath: '../commands/haruharu/apply-vacation.js' as const,
      mockModulePath: '../services/challengeSelfService.js',
      mockFactory: () => ({
        executeApplyVacation: vi.fn().mockResolvedValue({ reply: '홍길동님 20260330 휴가를 등록했습니다' }),
      }),
      interactionOptions: { date: '20260330' },
      expectedReplyText: '휴가를 등록했습니다',
    },
    {
      name: '/apply-vacation 실패',
      commandModulePath: '../commands/haruharu/apply-vacation.js' as const,
      mockModulePath: '../services/challengeSelfService.js',
      mockFactory: () => ({
        executeApplyVacation: vi.fn().mockResolvedValue({ reply: '휴가 날짜를 yyyymmdd 형식으로 입력해주세요' }),
      }),
      interactionOptions: { date: '2026033' },
      expectedReplyText: 'yyyymmdd 형식',
    },
  ])('$name 응답은 ephemeral 이고 testChannelId 로그를 남긴다', async spec => {
    vi.doMock(spec.mockModulePath, spec.mockFactory);

    const auditChannel = createAuditChannel();
    const interaction = createMockInteraction({
      channelId: 'valid-start-here-channel-id',
      globalName: '홍길동',
      client: createAuditClient(auditChannel),
      options: spec.interactionOptions,
    });

    const { command } = await import(spec.commandModulePath);
    await command.execute(interaction as never);

    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining(spec.expectedReplyText),
      ephemeral: true,
    });
    expect(interaction.client.channels.fetch).toHaveBeenCalledWith('valid-test-channel-id');
    expect(auditChannel.send).toHaveBeenCalledTimes(1);
    expect(auditChannel.send.mock.calls[0]?.[0]).toMatchObject({
      content: expect.stringContaining(command.data.name),
      allowedMentions: {
        parse: [],
      },
    });
    expect(auditChannel.send.mock.calls[0]?.[0]).toMatchObject({
      content: expect.stringContaining(spec.expectedReplyText),
    });
  });

  it.each([
    {
      name: '/apply-cam 성공',
      mockReply: {
        content: '캠스터디 참여가 바로 활성화되었어요. 전용 채널을 확인해 주세요.',
        ephemeral: true,
      },
      expectedReplyText: '캠스터디 참여가 바로 활성화',
    },
    {
      name: '/apply-cam 실패',
      mockReply: {
        content: '서버에서 사용자를 찾을 수 없어요. 서버에 남아 있는지 확인해 주세요.',
        ephemeral: true,
      },
      expectedReplyText: '서버에서 사용자를 찾을 수 없어요',
    },
  ])('$name 결과도 testChannelId 로그를 남긴다', async spec => {
    vi.doMock('../services/participationApplication.js', () => ({
      submitParticipationApplication: vi.fn().mockResolvedValue(spec.mockReply),
    }));

    const auditChannel = createAuditChannel();
    const interaction = createMockInteraction({
      channelId: 'valid-start-here-channel-id',
      globalName: '홍길동',
      client: createAuditClient(auditChannel),
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining(spec.expectedReplyText),
      ephemeral: true,
    });
    expect(interaction.client.channels.fetch).toHaveBeenCalledWith('valid-test-channel-id');
    expect(auditChannel.send).toHaveBeenCalledTimes(1);
    expect(auditChannel.send.mock.calls[0]?.[0]).toMatchObject({
      content: expect.stringContaining('apply-cam'),
      allowedMentions: {
        parse: [],
      },
    });
    expect(auditChannel.send.mock.calls[0]?.[0]).toMatchObject({
      content: expect.stringContaining(spec.expectedReplyText),
    });
  });

  it('testChannelId 로그 전송에 실패해도 사용자 ephemeral 응답은 유지된다', async () => {
    vi.doMock('../services/challengeSelfService.js', () => ({
      executeRegisterWithRoleSync: vi
        .fn()
        .mockResolvedValue({ reply: '홍길동님 기상시간을 등록했습니다. 기준월: 202603, 기상시간: 0800' }),
    }));
    const { logger } = await import('../logger.js');
    const loggerErrorSpy = vi.spyOn(logger, 'error');

    const auditChannel = {
      send: vi.fn().mockRejectedValue(new Error('audit send failed')),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-start-here-channel-id',
      globalName: '홍길동',
      client: createAuditClient(auditChannel),
      options: { waketime: '0800' },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await expect(command.execute(interaction as never)).resolves.toBeUndefined();

    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('기상시간을 등록했습니다'),
      ephemeral: true,
    });
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('testChannelId 감사 로그는 멘션 파싱을 비활성화한다', async () => {
    vi.doMock('../services/challengeSelfService.js', () => ({
      executeRegisterWithRoleSync: vi.fn().mockResolvedValue({ reply: '@everyone 홍길동님 기상시간을 등록했습니다' }),
    }));

    const auditChannel = createAuditChannel();
    const interaction = createMockInteraction({
      channelId: 'valid-start-here-channel-id',
      globalName: '@everyone',
      client: createAuditClient(auditChannel),
      options: { waketime: '0800' },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    expect(auditChannel.send).toHaveBeenCalledWith({
      content: expect.any(String),
      allowedMentions: {
        parse: [],
      },
    });
  });
});
