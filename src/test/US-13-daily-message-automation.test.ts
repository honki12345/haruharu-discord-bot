import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from 'discord.js';

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('../logger.js', () => ({
  logger: mockLogger,
}));

vi.mock('../repository/Users.js', () => ({
  Users: {
    sync: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue([0]),
  },
}));

vi.mock('../repository/TimeLog.js', () => ({
  TimeLog: {
    sync: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repository/AttendanceLog.js', () => ({
  AttendanceLog: {
    sync: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../repository/CamStudyUsers.js', () => ({
  CamStudyUsers: {
    sync: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repository/CamStudyTimeLog.js', () => ({
  CamStudyTimeLog: {
    sync: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repository/CamStudyWeeklyTimeLog.js', () => ({
  CamStudyWeeklyTimeLog: {
    sync: vi.fn().mockResolvedValue(undefined),
    findOne: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue([0]),
    create: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../repository/config.js', () => ({
  sequelize: {},
}));

vi.mock('node:module', async importOriginal => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () => (path: string) => {
      if (path.includes('config.json')) {
        return {
          checkChannelId: 'valid-channel-id',
          testChannelId: 'valid-test-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
        };
      }
      return original.createRequire(import.meta.url)(path);
    },
  };
});

describe('US-13: 운영 daily message 자동화', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T05:30:00'));
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('운영 채널에 daily message와 출석 쓰레드를 생성한다', async () => {
    const threadSend = vi.fn();
    const startThread = vi.fn().mockResolvedValue({
      id: 'attendance-thread',
      send: threadSend,
      toString: () => '<#attendance-thread>',
    });
    const send = vi.fn().mockResolvedValue({
      id: 'daily-message',
      startThread,
    });
    const fetchActive = vi.fn().mockResolvedValue({
      threads: new Collection(),
    });
    const fetchArchived = vi.fn().mockResolvedValue({
      threads: new Collection(),
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send,
      threads: {
        fetchActive,
        fetchArchived,
      },
    });

    const { ensureTodayAttendanceThread } = await import('../daily-attendance.js');
    const result = await ensureTodayAttendanceThread(
      {
        channels: {
          fetch,
        },
      } as never,
      'valid-channel-id',
    );

    expect(fetch).toHaveBeenCalledWith('valid-channel-id');
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toContain('[🌅 2026-03-29]');
    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '2026-03-29 출석',
      }),
    );
    expect(threadSend).toHaveBeenCalledOnce();
    expect(result?.created).toBe(true);
  });

  it('같은 날짜 archived 쓰레드가 있으면 새 daily message를 만들지 않는다', async () => {
    const send = vi.fn();
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send,
      threads: {
        fetchActive: vi.fn().mockResolvedValue({
          threads: new Collection(),
        }),
        fetchArchived: vi.fn().mockResolvedValue({
          threads: new Collection([
            [
              'archived-thread',
              {
                id: 'archived-thread',
                name: '2026-03-29 출석',
                toString: () => '<#archived-thread>',
              },
            ],
          ]),
        }),
      },
    });

    const { ensureTodayAttendanceThread } = await import('../daily-attendance.js');
    const result = await ensureTodayAttendanceThread(
      {
        channels: {
          fetch,
        },
      } as never,
      'valid-channel-id',
    );

    expect(send).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      created: false,
    });
  });

  it('운영 자동화는 demo suffix 쓰레드와 충돌하지 않는다', async () => {
    const threadSend = vi.fn();
    const startThread = vi.fn().mockResolvedValue({
      id: 'attendance-thread',
      send: threadSend,
      toString: () => '<#attendance-thread>',
    });
    const send = vi.fn().mockResolvedValue({
      id: 'daily-message',
      startThread,
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send,
      threads: {
        fetchActive: vi.fn().mockResolvedValue({
          threads: new Collection([
            [
              'demo-thread',
              {
                id: 'demo-thread',
                name: '2026-03-29 출석-demo',
              },
            ],
          ]),
        }),
        fetchArchived: vi.fn().mockResolvedValue({
          threads: new Collection(),
        }),
      },
    });

    const { ensureTodayAttendanceThread } = await import('../daily-attendance.js');
    const result = await ensureTodayAttendanceThread(
      {
        channels: {
          fetch,
        },
      } as never,
      'valid-channel-id',
    );

    expect(send).toHaveBeenCalledOnce();
    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '2026-03-29 출석',
      }),
    );
    expect(result?.created).toBe(true);
  });

  it('거의 동시에 두 번 실행되어도 운영 쓰레드는 한 번만 생성한다', async () => {
    let resolveActiveThreads: ((value: { threads: Collection<string, unknown> }) => void) | null = null;
    const threadSend = vi.fn();
    const startThread = vi.fn().mockResolvedValue({
      id: 'attendance-thread',
      send: threadSend,
      toString: () => '<#attendance-thread>',
    });
    const send = vi.fn().mockResolvedValue({
      id: 'daily-message',
      startThread,
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send,
      threads: {
        fetchActive: vi.fn().mockImplementation(
          () =>
            new Promise(resolve => {
              resolveActiveThreads = resolve;
            }),
        ),
        fetchArchived: vi.fn().mockResolvedValue({
          threads: new Collection(),
        }),
      },
    });

    const { ensureTodayAttendanceThread } = await import('../daily-attendance.js');
    const firstExecution = ensureTodayAttendanceThread(
      {
        channels: {
          fetch,
        },
      } as never,
      'valid-channel-id',
    );
    const secondExecution = ensureTodayAttendanceThread(
      {
        channels: {
          fetch,
        },
      } as never,
      'valid-channel-id',
    );

    for (let index = 0; index < 5 && !resolveActiveThreads; index += 1) {
      await Promise.resolve();
    }

    resolveActiveThreads?.({
      threads: new Collection(),
    });

    const [firstResult, secondResult] = await Promise.all([firstExecution, secondExecution]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(startThread).toHaveBeenCalledTimes(1);
    expect(firstResult?.thread.id).toBe('attendance-thread');
    expect(secondResult?.thread.id).toBe('attendance-thread');
  });

  it('ready 이벤트는 daily message 스케줄을 등록한다', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const { calculateRemainingTimeDailyMessage } = await import('../utils.js');
    const { event } = await import('../events/ready.js');

    await event.execute({
      channels: {
        cache: {
          get: vi.fn(),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    const hasDailyScheduler = setTimeoutSpy.mock.calls.some(
      ([, delay]) => delay === calculateRemainingTimeDailyMessage(),
    );
    expect(hasDailyScheduler).toBe(true);
  });

  it('06시 이후에 부팅되면 오늘 운영 daily message 생성을 즉시 시도한다', async () => {
    vi.setSystemTime(new Date('2026-03-29T07:30:00'));
    const startThread = vi.fn().mockResolvedValue({
      id: 'attendance-thread',
      send: vi.fn(),
      toString: () => '<#attendance-thread>',
    });
    const send = vi.fn().mockResolvedValue({
      id: 'daily-message',
      startThread,
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
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

    const { event } = await import('../events/ready.js');

    await event.execute({
      channels: {
        fetch,
        cache: {
          get: vi.fn(),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    expect(fetch).toHaveBeenCalledWith('valid-channel-id');
    expect(send).toHaveBeenCalledOnce();
  });

  it('운영 daily message 생성 실패는 로그로 남긴다', async () => {
    const send = vi.fn().mockRejectedValue(new Error('send failed'));
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
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

    const { logger } = await import('../logger.js');
    const { ensureTodayAttendanceThread } = await import('../daily-attendance.js');

    await expect(
      ensureTodayAttendanceThread(
        {
          channels: {
            fetch,
          },
        } as never,
        'valid-channel-id',
      ),
    ).rejects.toThrow('send failed');

    expect(logger.error).toHaveBeenCalled();
  });

  it('06시 이후 즉시 생성이 실패해도 중복 에러 로그를 남기지 않는다', async () => {
    vi.setSystemTime(new Date('2026-03-29T07:30:00'));
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send: vi.fn().mockRejectedValue(new Error('send failed')),
      threads: {
        fetchActive: vi.fn().mockResolvedValue({
          threads: new Collection(),
        }),
        fetchArchived: vi.fn().mockResolvedValue({
          threads: new Collection(),
        }),
      },
    });

    const { logger } = await import('../logger.js');
    const { event } = await import('../events/ready.js');

    await event.execute({
      channels: {
        fetch,
        cache: {
          get: vi.fn(),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
