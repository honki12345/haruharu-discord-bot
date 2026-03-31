import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from 'discord.js';

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

const createManagedMessage = ({
  id,
  content = '',
  createdTimestamp,
  customIds = [],
  authorId = 'bot-user-id',
}: {
  id: string;
  content?: string;
  createdTimestamp: number;
  customIds?: string[];
  authorId?: string;
}) => ({
  id,
  content,
  createdTimestamp,
  author: {
    id: authorId,
  },
  components: customIds.map(customId => ({
    components: [{ customId }],
  })),
  editable: true,
  edit: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe('US-19: 운영 self-service 온보딩 UI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('운영 온보딩 메시지는 채널별로 UI-only 버튼 구성만 노출한다', async () => {
    const { buildSelfServiceOnboardingMessage } = await import('../services/selfServiceOnboarding.js');

    const startHereMessage = buildSelfServiceOnboardingMessage('start-here');
    const timeStartHereMessage = buildSelfServiceOnboardingMessage('time-start-here');

    const startHereButtons = startHereMessage.components.flatMap(
      (row: { toJSON: () => { components: Array<{ label: string; custom_id: string }> } }) =>
        row.toJSON().components.map(component => ({
          label: component.label,
          customId: component.custom_id,
        })),
    );
    const timeStartHereButtons = timeStartHereMessage.components.flatMap(
      (row: { toJSON: () => { components: Array<{ label: string; custom_id: string }> } }) =>
        row.toJSON().components.map(component => ({
          label: component.label,
          customId: component.custom_id,
        })),
    );

    expect(startHereMessage.content).toBe('');
    expect(startHereButtons).toEqual([
      {
        label: '캠스터디 참여',
        customId: 'self-service-onboarding:apply-cam:submit',
      },
      {
        label: '기상챌린지 참여',
        customId: 'self-service-onboarding:register:open',
      },
    ]);

    expect(timeStartHereMessage.content).toBe('');
    expect(timeStartHereButtons).toEqual([
      {
        label: '기상 등록/수정',
        customId: 'self-service-onboarding:register:open',
      },
      {
        label: '휴가 신청',
        customId: 'self-service-onboarding:apply-vacation:open',
      },
      {
        label: '기상 중단',
        customId: 'self-service-onboarding:stop-wakeup:open',
      },
    ]);
  });

  it('운영 기상 중단 버튼의 첫 클릭은 destructive action 없이 확인 단계만 연다', async () => {
    const executeStopWakeupSelfService = vi.fn();
    vi.doMock('../services/selfServiceActions.js', () => ({
      executeRegisterSelfService: vi.fn(),
      executeApplyVacationSelfService: vi.fn(),
      executeStopWakeupSelfService,
      executeApplyCamSelfService: vi.fn(),
    }));

    const { handleSelfServiceOnboardingButtonInteraction } = await import('../services/selfServiceOnboarding.js');
    const reply = vi.fn();
    const interaction = {
      customId: 'self-service-onboarding:stop-wakeup:open',
      channelId: 'valid-start-here-channel-id',
      reply,
      showModal: vi.fn(),
    };

    await handleSelfServiceOnboardingButtonInteraction(interaction as never);

    expect(executeStopWakeupSelfService).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('기상스터디 참여를 중단할까요'),
        ephemeral: true,
      }),
    );
  });

  it('운영 기상 등록 modal submit 은 기존 register 처리 경로를 재사용한다', async () => {
    const executeRegisterSelfService = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../services/selfServiceActions.js', () => ({
      executeRegisterSelfService,
      executeApplyVacationSelfService: vi.fn(),
      executeStopWakeupSelfService: vi.fn(),
      executeApplyCamSelfService: vi.fn(),
    }));

    const { handleSelfServiceOnboardingModalSubmitInteraction } = await import('../services/selfServiceOnboarding.js');
    const interaction = {
      customId: 'self-service-onboarding:register:submit',
      channelId: 'valid-start-here-channel-id',
      fields: {
        getTextInputValue: vi.fn().mockReturnValue('0730'),
      },
      reply: vi.fn(),
    };

    await handleSelfServiceOnboardingModalSubmitInteraction(interaction as never);

    expect(executeRegisterSelfService).toHaveBeenCalledWith({
      interaction,
      waketime: '0730',
      commandName: 'register',
    });
  });

  it('운영 캠스터디 참여 버튼은 start-here 외 채널에서 거부된다', async () => {
    const executeApplyCamSelfService = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../services/selfServiceActions.js', () => ({
      executeRegisterSelfService: vi.fn(),
      executeApplyVacationSelfService: vi.fn(),
      executeStopWakeupSelfService: vi.fn(),
      executeApplyCamSelfService,
    }));

    const { handleSelfServiceOnboardingButtonInteraction } = await import('../services/selfServiceOnboarding.js');
    const reply = vi.fn();
    const interaction = {
      customId: 'self-service-onboarding:apply-cam:submit',
      channelId: 'valid-time-start-here-channel-id',
      reply,
      showModal: vi.fn(),
    };

    await handleSelfServiceOnboardingButtonInteraction(interaction as never);

    expect(executeApplyCamSelfService).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith({
      content: '`#start-here`에서만 사용할 수 있어요. 질문은 `#qna`를 이용해 주세요.',
      ephemeral: true,
    });
  });

  it('운영 UI sync 는 marker 없이도 기존 봇 메시지를 갱신하고 중복 메시지는 제거한다', async () => {
    const olderMessage = createManagedMessage({
      id: 'message-1',
      createdTimestamp: 100,
      customIds: ['self-service-onboarding:apply-cam:submit', 'self-service-onboarding:register:open'],
    });
    const latestMessage = createManagedMessage({
      id: 'message-2',
      createdTimestamp: 200,
      customIds: ['self-service-onboarding:apply-cam:submit', 'self-service-onboarding:register:open'],
    });
    const unrelatedMessage = createManagedMessage({
      id: 'message-3',
      createdTimestamp: 300,
      customIds: ['self-service-onboarding:register:open', 'self-service-onboarding:apply-vacation:open'],
    });
    const foreignAuthorMessage = createManagedMessage({
      id: 'message-4',
      createdTimestamp: 400,
      customIds: ['self-service-onboarding:apply-cam:submit', 'self-service-onboarding:register:open'],
      authorId: 'other-bot-id',
    });
    const channel = {
      messages: {
        fetch: vi.fn().mockResolvedValue(
          new Collection([
            ['message-1', olderMessage],
            ['message-2', latestMessage],
            ['message-3', unrelatedMessage],
            ['message-4', foreignAuthorMessage],
          ]),
        ),
      },
      send: vi.fn(),
    };

    const { syncSelfServiceOnboardingMessage } = await import('../services/selfServiceOnboarding.js');
    await syncSelfServiceOnboardingMessage({
      channel: channel as never,
      onboardingType: 'start-here',
      botUserId: 'bot-user-id',
    });

    expect(latestMessage.edit).toHaveBeenCalledOnce();
    expect(olderMessage.delete).toHaveBeenCalledOnce();
    expect(unrelatedMessage.edit).not.toHaveBeenCalled();
    expect(unrelatedMessage.delete).not.toHaveBeenCalled();
    expect(foreignAuthorMessage.edit).not.toHaveBeenCalled();
    expect(foreignAuthorMessage.delete).not.toHaveBeenCalled();
    expect(channel.send).not.toHaveBeenCalled();
  });
});
