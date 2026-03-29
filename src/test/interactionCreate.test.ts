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
              allowedChannelIds: ['valid-apply-channel-id'],
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

    expect(reply).toHaveBeenCalledWith({ content: 'no valid channel for command', ephemeral: true });
    expect(execute).not.toHaveBeenCalled();
  });
});
