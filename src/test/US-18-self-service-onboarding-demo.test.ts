import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelType, PermissionFlagsBits } from 'discord.js';

vi.mock('node:module', async importOriginal => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () => (path: string) => {
      if (path.includes('config.json')) {
        return {
          token: 'test-token',
          clientId: 'test-client-id',
          guildId: 'test-guild-id',
          checkChannelId: 'valid-check-channel-id',
          testChannelId: 'valid-test-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          startHereChannelId: 'valid-start-here-channel-id',
          timeStartHereChannelId: 'valid-time-start-here-channel-id',
          wakeUpRoleId: 'valid-wake-up-role-id',
          camStudyRoleId: 'valid-cam-study-role-id',
        };
      }

      return original.createRequire(import.meta.url)(path);
    },
  };
});

const createDemoInteraction = (fetch: ReturnType<typeof vi.fn>) => {
  const replies: Array<string | { content: string; ephemeral?: boolean }> = [];

  return {
    client: {
      channels: {
        fetch,
      },
    },
    reply: async (content: string | { content: string; ephemeral?: boolean }) => {
      replies.push(content);
      return content;
    },
    getReplies: () => replies,
    getLastReply: () => {
      const last = replies[replies.length - 1];
      return typeof last === 'string' ? last : last?.content;
    },
  };
};

describe('US-18: self-service 온보딩 버튼 데모', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('demo-self-service-ui 커맨드는 테스트 채널에 버튼 UI 메시지를 게시한다', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'demo-self-service-message' });
    const fetch = vi.fn().mockResolvedValue({
      type: ChannelType.GuildText,
      send,
    });
    const interaction = createDemoInteraction(fetch);

    const { command } = await import('../commands/haruharu/demo-self-service-ui.js');
    await command.execute(interaction as never);

    expect(fetch).toHaveBeenCalledWith('valid-test-channel-id');
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0]?.[0];
    expect(payload.content).toContain('[self-service-demo]');
    const componentLabels = payload.components.flatMap(
      (row: { toJSON: () => { components: Array<{ label: string }> } }) =>
        row.toJSON().components.map(component => component.label),
    );
    expect(componentLabels).toEqual(
      expect.arrayContaining(['기상 등록/수정', '휴가 신청', '기상 중단', '캠스터디 참여']),
    );
    expect(interaction.getLastReply()).toContain('셀프서비스 데모 메시지를 게시했습니다');
  });

  it('demo-self-service-ui 커맨드는 관리자 권한 비트를 사용한다', async () => {
    const { command } = await import('../commands/haruharu/demo-self-service-ui.js');

    expect(command.data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.Administrator.toString());
  });

  it('기상 중단 버튼의 첫 클릭은 중단을 실행하지 않고 확인 단계를 연다', async () => {
    const executeStopWakeupSelfService = vi.fn();
    vi.doMock('../services/selfServiceActions.js', () => ({
      executeRegisterSelfService: vi.fn(),
      executeApplyVacationSelfService: vi.fn(),
      executeStopWakeupSelfService,
      executeApplyCamSelfService: vi.fn(),
    }));

    const { handleSelfServiceDemoButtonInteraction } = await import('../services/selfServiceOnboardingDemo.js');
    const reply = vi.fn();
    const interaction = {
      customId: 'self-service-demo:stop-wakeup:open',
      channelId: 'valid-test-channel-id',
      reply,
      showModal: vi.fn(),
    };

    await handleSelfServiceDemoButtonInteraction(interaction as never);

    expect(executeStopWakeupSelfService).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('기상스터디 참여를 중단할까요'),
        ephemeral: true,
      }),
    );
  });

  it('기상 중단 확인 버튼은 기존 self-service 중단 경로를 재사용한다', async () => {
    const executeStopWakeupSelfService = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../services/selfServiceActions.js', () => ({
      executeRegisterSelfService: vi.fn(),
      executeApplyVacationSelfService: vi.fn(),
      executeStopWakeupSelfService,
      executeApplyCamSelfService: vi.fn(),
    }));

    const { handleSelfServiceDemoButtonInteraction } = await import('../services/selfServiceOnboardingDemo.js');
    const interaction = {
      customId: 'self-service-demo:stop-wakeup:confirm',
      channelId: 'valid-test-channel-id',
      reply: vi.fn(),
      showModal: vi.fn(),
    };

    await handleSelfServiceDemoButtonInteraction(interaction as never);

    expect(executeStopWakeupSelfService).toHaveBeenCalledWith({
      interaction,
      commandName: 'stop-wakeup',
    });
  });

  it('기상 등록 버튼은 허용 시간 범위를 안내하는 modal을 연다', async () => {
    vi.doMock('../services/selfServiceActions.js', () => ({
      executeRegisterSelfService: vi.fn(),
      executeApplyVacationSelfService: vi.fn(),
      executeStopWakeupSelfService: vi.fn(),
      executeApplyCamSelfService: vi.fn(),
    }));

    const { handleSelfServiceDemoButtonInteraction } = await import('../services/selfServiceOnboardingDemo.js');
    const showModal = vi.fn();
    const interaction = {
      customId: 'self-service-demo:register:open',
      channelId: 'valid-test-channel-id',
      reply: vi.fn(),
      showModal,
    };

    await handleSelfServiceDemoButtonInteraction(interaction as never);

    expect(showModal).toHaveBeenCalledOnce();
    const modalPayload = showModal.mock.calls[0]?.[0].toJSON();
    const textInput = modalPayload.components[0].components[0];

    expect(textInput.label).toBe('기상시간 (05:00~09:00, HHmm)');
    expect(textInput.placeholder).toBe('0700');
  });

  it('기상 등록 modal submit은 입력값을 기존 register 처리 경로로 전달한다', async () => {
    const executeRegisterSelfService = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../services/selfServiceActions.js', () => ({
      executeRegisterSelfService,
      executeApplyVacationSelfService: vi.fn(),
      executeStopWakeupSelfService: vi.fn(),
      executeApplyCamSelfService: vi.fn(),
    }));

    const { handleSelfServiceDemoModalSubmitInteraction } = await import('../services/selfServiceOnboardingDemo.js');
    const interaction = {
      customId: 'self-service-demo:register:submit',
      channelId: 'valid-test-channel-id',
      fields: {
        getTextInputValue: vi.fn().mockReturnValue('0730'),
      },
      reply: vi.fn(),
    };

    await handleSelfServiceDemoModalSubmitInteraction(interaction as never);

    expect(executeRegisterSelfService).toHaveBeenCalledWith({
      interaction,
      waketime: '0730',
      commandName: 'register',
    });
  });
});
