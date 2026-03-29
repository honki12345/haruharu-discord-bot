import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from 'discord.js';
import './test-setup.js';

describe('interactionCreate 이벤트', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('커맨드가 개별 허용 채널을 가지면 공통 허용 채널이라도 다른 채널에서는 실행되지 않는다', async () => {
    const execute = vi.fn();
    const reply = vi.fn();
    const interaction = {
      isChatInputCommand: () => true,
      commandName: 'apply-cam',
      channel: {
        id: 'valid-channel-id',
      },
      user: {
        id: 'user-1',
      },
      client: {
        commands: new Collection([
          [
            'apply-cam',
            {
              data: { name: 'apply-cam' },
              allowedChannelIds: ['valid-start-here-channel-id'],
              execute,
            },
          ],
        ]),
        cooldowns: new Collection(),
      },
      reply,
      replied: false,
      deferred: false,
      followUp: vi.fn(),
    };

    const { event } = await import('../events/interactionCreate.js');
    await event.execute(interaction as never);

    expect(reply).toHaveBeenCalledWith({
      content: '`#start-here`에서만 사용할 수 있어요. 질문은 `#qna`를 이용해 주세요.',
      ephemeral: true,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('stale /apply-wakeup interaction은 migration 안내로 응답한다', async () => {
    const reply = vi.fn();
    const interaction = {
      isChatInputCommand: () => true,
      commandName: 'apply-wakeup',
      channel: {
        id: 'valid-apply-channel-id',
      },
      user: {
        id: 'user-1',
      },
      client: {
        commands: new Collection(),
        cooldowns: new Collection(),
      },
      reply,
      replied: false,
      deferred: false,
      followUp: vi.fn(),
    };

    const { event } = await import('../events/interactionCreate.js');
    await event.execute(interaction as never);

    expect(reply).toHaveBeenCalledWith({
      content: '`/apply-wakeup`는 더 이상 사용되지 않습니다. `/register`에서 기상시간을 입력해 참여해 주세요.',
      ephemeral: true,
    });
  });
});
