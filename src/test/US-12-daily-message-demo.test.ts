import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection, PermissionFlagsBits } from 'discord.js';

const mockUsers = {
  findOne: vi.fn(),
};

vi.mock('../repository/Users.js', () => ({
  Users: mockUsers,
}));

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../services/challengeSelfService.js', () => ({
  ensureWakeUpMembershipSnapshot: vi.fn(),
}));

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
          noticeChannelId: 'valid-notice-channel-id',
          vacancesRegisterChannelId: 'valid-vacances-channel-id',
          checkChannelId: 'valid-check-channel-id',
          testChannelId: 'valid-test-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          startHereChannelId: 'valid-start-here-channel-id',
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
    getLastReply: () => {
      const last = replies[replies.length - 1];
      return typeof last === 'string' ? last : last?.content;
    },
  };
};

describe('US-12: daily message 데모', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T07:05:00'));
    mockUsers.findOne.mockReset();
  });

  it('demo-daily-message 커맨드는 테스트 채널에 메시지와 쓰레드를 생성한다', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
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
        fetchArchived: vi.fn().mockResolvedValue({
          threads: new Collection(),
        }),
      },
    });
    const interaction = createDemoInteraction(fetch);

    const { command } = await import('../commands/haruharu/demo-daily-message.js');
    await command.execute(interaction as never);

    expect(fetch).toHaveBeenCalledWith('valid-test-channel-id');
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toContain('📝 오늘의 질문: 오늘 꼭 이루고 싶은 한 가지는 무엇인가요?');
    expect(startThread).toHaveBeenCalledOnce();
    expect(threadSend).toHaveBeenCalledOnce();
    expect(interaction.getLastReply()).toContain('데모 출석 메시지와 쓰레드를 생성했습니다');
    randomSpy.mockRestore();
  });

  it('demo-daily-message 커맨드는 관리자 권한 비트를 사용한다', async () => {
    const { command } = await import('../commands/haruharu/demo-daily-message.js');

    expect(command.data.toJSON().default_member_permissions).toBe(PermissionFlagsBits.Administrator.toString());
  });

  it('이미 archive된 같은 날짜 쓰레드가 있으면 새 쓰레드를 만들지 않는다', async () => {
    const send = vi.fn();
    const fetchActive = vi.fn().mockResolvedValue({
      threads: new Collection(),
    });
    const fetchArchived = vi.fn().mockResolvedValue({
      threads: new Collection([
        [
          'archived-thread',
          {
            id: 'archived-thread',
            name: '2026-03-24 출석-demo',
            toString: () => '<#archived-thread>',
          },
        ],
      ]),
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      send,
      threads: {
        fetchActive,
        fetchArchived,
      },
    });
    const interaction = createDemoInteraction(fetch);

    const { command } = await import('../commands/haruharu/demo-daily-message.js');
    await command.execute(interaction as never);

    expect(fetchActive).toHaveBeenCalledOnce();
    expect(fetchArchived).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(interaction.getLastReply()).toContain('이미 데모 출석 쓰레드가 있습니다');
  });

  it('거의 동시에 두 번 실행되어도 같은 날짜 데모 쓰레드는 한 번만 생성한다', async () => {
    let resolveActiveThreads: ((value: { threads: Collection<string, unknown> }) => void) | null = null;
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
    const fetchActive = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveActiveThreads = resolve;
        }),
    );
    const fetchArchived = vi.fn().mockResolvedValue({
      threads: new Collection(),
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      send,
      threads: {
        fetchActive,
        fetchArchived,
      },
    });
    const firstInteraction = createDemoInteraction(fetch);
    const secondInteraction = createDemoInteraction(fetch);

    const { command } = await import('../commands/haruharu/demo-daily-message.js');
    const firstExecution = command.execute(firstInteraction as never);
    const secondExecution = command.execute(secondInteraction as never);

    for (let index = 0; index < 5 && !resolveActiveThreads; index += 1) {
      await Promise.resolve();
    }
    expect(resolveActiveThreads).not.toBeNull();

    resolveActiveThreads?.({
      threads: new Collection(),
    });
    await Promise.all([firstExecution, secondExecution]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(startThread).toHaveBeenCalledTimes(1);
    expect(firstInteraction.getLastReply() ?? secondInteraction.getLastReply()).toContain(
      '데모 출석 메시지와 쓰레드를 생성했습니다',
    );
    expect(firstInteraction.getLastReply() ?? secondInteraction.getLastReply()).not.toContain(
      '이미 데모 출석 쓰레드가 있습니다',
    );
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
      client: {
        user: {
          id: 'bot-user',
        },
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
                  reactions: {
                    cache: new Collection([
                      [
                        '✅',
                        {
                          emoji: { name: '✅' },
                          users: {
                            cache: new Collection([
                              [
                                'bot-user',
                                {
                                  id: 'bot-user',
                                },
                              ],
                            ]),
                          },
                        },
                      ],
                    ]),
                  },
                },
              ],
              [
                'message-2',
                {
                  id: 'message-2',
                  author: { id: 'demo-user', bot: false },
                  createdTimestamp: new Date('2026-03-24T07:06:00').getTime(),
                  reactions: {
                    cache: new Collection(),
                  },
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

  it('사용자가 직접 단 최종 이모지는 이전 공식 판정으로 간주하지 않는다', async () => {
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
      client: {
        user: {
          id: 'bot-user',
        },
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
                  reactions: {
                    cache: new Collection([
                      [
                        '✅',
                        {
                          emoji: { name: '✅' },
                          users: {
                            cache: new Collection([
                              [
                                'other-user',
                                {
                                  id: 'other-user',
                                },
                              ],
                            ]),
                          },
                        },
                      ],
                    ]),
                  },
                },
              ],
              [
                'message-2',
                {
                  id: 'message-2',
                  author: { id: 'demo-user', bot: false },
                  createdTimestamp: new Date('2026-03-24T07:06:00').getTime(),
                  reactions: {
                    cache: new Collection(),
                  },
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

  it('미등록 또는 too-early 반응만 있던 이전 댓글은 이후 공식 판정을 막지 않는다', async () => {
    mockUsers.findOne.mockResolvedValue({
      userid: 'demo-user',
      username: '데모유저',
      waketime: '0700',
    });

    const react = vi.fn();
    const message = {
      id: 'message-2',
      createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      client: {
        user: {
          id: 'bot-user',
        },
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
                  createdTimestamp: new Date('2026-03-24T07:00:00').getTime(),
                  reactions: {
                    cache: new Collection([
                      [
                        '❓',
                        {
                          emoji: { name: '❓' },
                        },
                      ],
                    ]),
                  },
                },
              ],
              [
                'message-2',
                {
                  id: 'message-2',
                  author: { id: 'demo-user', bot: false },
                  createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
                  reactions: {
                    cache: new Collection(),
                  },
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
                  reactions: {
                    cache: new Collection(),
                  },
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

  it('월 경계에서는 현재 시각이 아니라 댓글 시각 기준 yearmonth로 사용자를 조회한다', async () => {
    vi.setSystemTime(new Date('2026-02-01T00:05:00'));
    mockUsers.findOne.mockResolvedValue(null);

    const react = vi.fn();
    const message = {
      id: 'message-month-boundary',
      createdTimestamp: new Date('2026-01-31T23:59:00').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      inGuild: () => true,
      react,
      channel: {
        id: 'thread-1',
        parentId: 'valid-test-channel-id',
        name: '2026-01-31 출석-demo',
        isThread: () => true,
        messages: {
          fetch: vi.fn().mockResolvedValue(
            new Collection([
              [
                'message-month-boundary',
                {
                  id: 'message-month-boundary',
                  author: { id: 'demo-user', bot: false },
                  createdTimestamp: new Date('2026-01-31T23:59:00').getTime(),
                  reactions: {
                    cache: new Collection(),
                  },
                },
              ],
            ]),
          ),
        },
      },
    };

    const { event } = await import('../events/messageCreate.js');
    await event.execute(message as never);

    expect(mockUsers.findOne).toHaveBeenCalledWith({
      where: {
        userid: 'demo-user',
        yearmonth: '202601',
      },
    });
  });

  it('100개를 넘는 쓰레드에서도 이전 최종 판정을 찾아 두 번째 댓글을 무시한다', async () => {
    mockUsers.findOne.mockResolvedValue({
      userid: 'demo-user',
      username: '데모유저',
      waketime: '0700',
    });

    const react = vi.fn();
    const fetchMessages = vi
      .fn()
      .mockResolvedValueOnce(
        new Collection(
          Array.from({ length: 100 }, (_, index) => [
            `message-${index + 2}`,
            {
              id: `message-${index + 2}`,
              author: { id: `other-user-${index}`, bot: false },
              createdTimestamp: new Date('2026-03-24T07:05:00').getTime() + index,
              reactions: {
                cache: new Collection(),
              },
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Collection([
          [
            'message-1',
            {
              id: 'message-1',
              author: { id: 'demo-user', bot: false },
              createdTimestamp: new Date('2026-03-24T07:00:00').getTime(),
              reactions: {
                cache: new Collection([
                  [
                    '✅',
                    {
                      emoji: { name: '✅' },
                      users: {
                        cache: new Collection([
                          [
                            'bot-user',
                            {
                              id: 'bot-user',
                            },
                          ],
                        ]),
                      },
                    },
                  ],
                ]),
              },
            },
          ],
        ]),
      );

    const message = {
      id: 'message-102',
      createdTimestamp: new Date('2026-03-24T07:06:00').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      client: {
        user: {
          id: 'bot-user',
        },
      },
      inGuild: () => true,
      react,
      channel: {
        id: 'thread-1',
        parentId: 'valid-test-channel-id',
        name: '2026-03-24 출석-demo',
        isThread: () => true,
        messages: {
          fetch: fetchMessages,
        },
      },
    };

    const { event } = await import('../events/messageCreate.js');
    await event.execute(message as never);

    expect(fetchMessages).toHaveBeenCalledTimes(2);
    expect(react).not.toHaveBeenCalled();
  });

  it('빠르게 연속 댓글을 남겨도 두 번째 댓글은 최종 판정을 받지 않는다', async () => {
    let resolveUser: ((value: { userid: string; username: string; waketime: string }) => void) | null = null;
    mockUsers.findOne.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveUser = resolve;
        }),
    );

    const reactFirst = vi.fn();
    const reactSecond = vi.fn();
    const fetchMessages = vi.fn().mockResolvedValue(
      new Collection([
        [
          'message-1',
          {
            id: 'message-1',
            author: { id: 'demo-user', bot: false },
            createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
            reactions: {
              cache: new Collection(),
            },
          },
        ],
        [
          'message-2',
          {
            id: 'message-2',
            author: { id: 'demo-user', bot: false },
            createdTimestamp: new Date('2026-03-24T07:05:01').getTime(),
            reactions: {
              cache: new Collection(),
            },
          },
        ],
      ]),
    );

    const baseChannel = {
      id: 'thread-1',
      parentId: 'valid-test-channel-id',
      name: '2026-03-24 출석-demo',
      isThread: () => true,
      messages: {
        fetch: fetchMessages,
      },
    };

    const firstMessage = {
      id: 'message-1',
      createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      inGuild: () => true,
      react: reactFirst,
      channel: baseChannel,
    };

    const secondMessage = {
      id: 'message-2',
      createdTimestamp: new Date('2026-03-24T07:05:01').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      inGuild: () => true,
      react: reactSecond,
      channel: baseChannel,
    };

    const { event } = await import('../events/messageCreate.js');
    const firstExecution = event.execute(firstMessage as never);
    let safetyCounter = 0;
    while (mockUsers.findOne.mock.calls.length === 0 && safetyCounter < 100) {
      await Promise.resolve();
      safetyCounter += 1;
    }
    await event.execute(secondMessage as never);

    resolveUser?.({
      userid: 'demo-user',
      username: '데모유저',
      waketime: '0700',
    });
    await firstExecution;

    expect(mockUsers.findOne).toHaveBeenCalledTimes(1);
    expect(reactFirst).toHaveBeenCalledWith('✅');
    expect(reactSecond).not.toHaveBeenCalled();
  });

  it('임시 상태로 끝난 첫 댓글이 있으면 대기 중이던 재시도 댓글을 다시 처리한다', async () => {
    let resolveUser: ((value: { userid: string; username: string; waketime: string } | null) => void) | null = null;
    mockUsers.findOne
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveUser = resolve;
          }),
      )
      .mockResolvedValueOnce({
        userid: 'demo-user',
        username: '데모유저',
        waketime: '0700',
      });

    const reactFirst = vi.fn();
    const reactSecond = vi.fn();
    const fetchMessages = vi.fn().mockResolvedValue(
      new Collection([
        [
          'message-1',
          {
            id: 'message-1',
            author: { id: 'demo-user', bot: false },
            createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
            reactions: {
              cache: new Collection(),
            },
          },
        ],
        [
          'message-2',
          {
            id: 'message-2',
            author: { id: 'demo-user', bot: false },
            createdTimestamp: new Date('2026-03-24T07:05:01').getTime(),
            reactions: {
              cache: new Collection(),
            },
          },
        ],
      ]),
    );

    const baseChannel = {
      id: 'thread-1',
      parentId: 'valid-test-channel-id',
      name: '2026-03-24 출석-demo',
      isThread: () => true,
      messages: {
        fetch: fetchMessages,
      },
    };

    const firstMessage = {
      id: 'message-1',
      createdTimestamp: new Date('2026-03-24T07:05:00').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      client: {
        user: {
          id: 'bot-user',
        },
      },
      inGuild: () => true,
      react: reactFirst,
      channel: baseChannel,
    };

    const secondMessage = {
      id: 'message-2',
      createdTimestamp: new Date('2026-03-24T07:05:01').getTime(),
      author: {
        id: 'demo-user',
        bot: false,
      },
      client: {
        user: {
          id: 'bot-user',
        },
      },
      inGuild: () => true,
      react: reactSecond,
      channel: baseChannel,
    };

    const { event } = await import('../events/messageCreate.js');
    const firstExecution = event.execute(firstMessage as never);
    for (let index = 0; index < 5 && !resolveUser; index += 1) {
      await Promise.resolve();
    }
    expect(resolveUser).not.toBeNull();
    const secondExecution = event.execute(secondMessage as never);

    resolveUser?.(null);
    await firstExecution;
    await secondExecution;

    expect(mockUsers.findOne).toHaveBeenCalledTimes(2);
    expect(reactFirst).toHaveBeenCalledWith('❓');
    expect(reactSecond).toHaveBeenCalledWith('✅');
  });
});
