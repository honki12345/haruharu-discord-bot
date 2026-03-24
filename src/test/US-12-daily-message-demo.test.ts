import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from 'discord.js';

const mockUsers = {
  findOne: vi.fn(),
};

vi.mock('../repository/Users.js', () => ({
  Users: mockUsers,
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('node:module', async importOriginal => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () => (path: string) => {
      if (path.includes('config.json')) {
        return {
          testChannelId: 'valid-test-channel-id',
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
    getLastReply: () => {
      const last = replies[replies.length - 1];
      return typeof last === 'string' ? last : last?.content;
    },
  };
};

describe('US-12: daily message 데모', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T07:05:00'));
    mockUsers.findOne.mockReset();
  });

  it('demo-daily-message 커맨드는 테스트 채널에 메시지와 쓰레드를 생성한다', async () => {
    const threadSend = vi.fn();
    const startThread = vi.fn().mockResolvedValue({
      id: 'demo-thread',
      send: threadSend,
      toString: () => '<#demo-thread>',
    });
    const send = vi.fn().mockResolvedValue({
      id: 'demo-message',
      startThread,
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      send,
      threads: {
        fetchActive: vi.fn().mockResolvedValue({
          threads: new Collection(),
        }),
      },
    });
    const interaction = createDemoInteraction(fetch);

    const { command } = await import('../commands/haruharu/demo-daily-message.js');
    await command.execute(interaction as never);

    expect(fetch).toHaveBeenCalledWith('valid-test-channel-id');
    expect(send).toHaveBeenCalledOnce();
    expect(startThread).toHaveBeenCalledOnce();
    expect(threadSend).toHaveBeenCalledOnce();
    expect(interaction.getLastReply()).toContain('데모 daily message와 쓰레드를 생성했습니다');
  });

  it('등록된 사용자의 첫 댓글에는 출석 이모지를 단다', async () => {
    mockUsers.findOne.mockResolvedValue({
      userid: 'demo-user',
      username: '데모유저',
      waketime: '0700',
    });

    const react = vi.fn();
    const message = {
      id: 'message-1',
      createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      inGuild: () => true,
      react,
      channel: {
        id: 'thread-1',
        parentId: 'valid-test-channel-id',
        name: '2026-03-24 출석-demo',
        isThread: () => true,
        messages: {
          fetch: vi.fn().mockResolvedValue(
            new Collection([
              [
                'message-1',
                {
                  id: 'message-1',
                  author: { id: 'demo-user', bot: false },
                  createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
                },
              ],
            ]),
          ),
        },
      },
    };

    const { event } = await import('../events/messageCreate.js');
    await event.execute(message as never);

    expect(react).toHaveBeenCalledWith('✅');
  });

  it('같은 사용자의 두 번째 댓글은 무시한다', async () => {
    mockUsers.findOne.mockResolvedValue({
      userid: 'demo-user',
      username: '데모유저',
      waketime: '0700',
    });

    const react = vi.fn();
    const message = {
      id: 'message-2',
      createdTimestamp: new Date('2026-03-24T07:06:00').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      inGuild: () => true,
      react,
      channel: {
        id: 'thread-1',
        parentId: 'valid-test-channel-id',
        name: '2026-03-24 출석-demo',
        isThread: () => true,
        messages: {
          fetch: vi.fn().mockResolvedValue(
            new Collection([
              [
                'message-1',
                {
                  id: 'message-1',
                  author: { id: 'demo-user', bot: false },
                  createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
                },
              ],
              [
                'message-2',
                {
                  id: 'message-2',
                  author: { id: 'demo-user', bot: false },
                  createdTimestamp: new Date('2026-03-24T07:06:00').getTime(),
                },
              ],
            ]),
          ),
        },
      },
    };

    const { event } = await import('../events/messageCreate.js');
    await event.execute(message as never);

    expect(react).not.toHaveBeenCalled();
  });

  it('등록되지 않은 사용자의 댓글에는 물음표 이모지를 단다', async () => {
    mockUsers.findOne.mockResolvedValue(null);

    const react = vi.fn();
    const message = {
      id: 'message-3',
      createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
      author: {
        id: 'unknown-user',
        bot: false,
      },
      inGuild: () => true,
      react,
      channel: {
        id: 'thread-1',
        parentId: 'valid-test-channel-id',
        name: '2026-03-24 출석-demo',
        isThread: () => true,
        messages: {
          fetch: vi.fn().mockResolvedValue(
            new Collection([
              [
                'message-3',
                {
                  id: 'message-3',
                  author: { id: 'unknown-user', bot: false },
                  createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
                },
              ],
            ]),
          ),
        },
      },
    };

    const { event } = await import('../events/messageCreate.js');
    await event.execute(message as never);

    expect(react).toHaveBeenCalledWith('❓');
  });
});
