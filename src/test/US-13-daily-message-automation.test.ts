import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from 'discord.js';

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const mockSyncModels = vi.fn().mockResolvedValue(undefined);
const mockScheduleDailyReports = vi.fn();
const mockBuildChallengeReport = vi.fn().mockResolvedValue({
  attendanceMessage: 'attendance report',
  attendanceMessages: ['attendance report'],
  hallOfFameMessage: null,
});
const mockBuildCamStudyReports = vi.fn().mockResolvedValue({
  dailyMessage: 'cam study daily report',
  weeklyMessage: 'cam study weekly report',
});
const mockSyncCamStudyActiveSessionsFromClient = vi.fn().mockResolvedValue(undefined);

vi.mock('../logger.js', () => ({
  logger: mockLogger,
}));

vi.mock('../services/reporting.js', () => ({
  buildCamStudyReports: mockBuildCamStudyReports,
  buildChallengeReport: mockBuildChallengeReport,
  scheduleDailyReports: mockScheduleDailyReports,
  syncModels: mockSyncModels,
}));

vi.mock('../services/camStudy.js', () => ({
  syncCamStudyActiveSessionsFromClient: mockSyncCamStudyActiveSessionsFromClient,
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
          checkChannelId: 'valid-channel-id',
          testChannelId: 'valid-test-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
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

describe('US-13: 운영 daily message 자동화', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T05:30:00'));
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
    mockSyncModels.mockClear();
    mockScheduleDailyReports.mockClear();
    mockBuildChallengeReport.mockClear();
    mockBuildCamStudyReports.mockClear();
    mockSyncCamStudyActiveSessionsFromClient.mockClear();
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
    expect(send.mock.calls[0]?.[0]).toContain('오늘의 질문:');
    expect(send.mock.calls[0]?.[0]).toContain('👇 아래 쓰레드에 오늘 출석과 함께 답변을 남겨주세요');
    expect(send.mock.calls[0]?.[0]).not.toContain('오늘의 한마디:');
    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '2026-03-29 출석',
      }),
    );
    expect(threadSend).toHaveBeenCalledOnce();
    expect(threadSend).toHaveBeenCalledWith(expect.stringContaining('주말/공휴일 보너스'));
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
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const { calculateRemainingTimeDailyMessage } = await import('../utils.js');
    const { CAM_STUDY_HEARTBEAT_MILLISECONDS } = await import('../utils/constants.js');
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

    expect(mockSyncModels).toHaveBeenCalledOnce();
    expect(mockScheduleDailyReports).toHaveBeenCalledOnce();
    expect(mockSyncCamStudyActiveSessionsFromClient).toHaveBeenCalledOnce();
    const hasDailyScheduler = setTimeoutSpy.mock.calls.some(
      ([, delay]) => delay === calculateRemainingTimeDailyMessage(),
    );
    const hasHeartbeatScheduler = setIntervalSpy.mock.calls.some(
      ([, delay]) => delay === CAM_STUDY_HEARTBEAT_MILLISECONDS,
    );
    expect(hasDailyScheduler).toBe(true);
    expect(hasHeartbeatScheduler).toBe(true);
  });

  it('challenge 결과표는 당일 출석 thread 댓글로 전송한다', async () => {
    const threadSend = vi.fn().mockResolvedValue(undefined);
    const checkChannelSend = vi.fn();
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send: checkChannelSend,
      threads: {
        fetchActive: vi.fn().mockResolvedValue({
          threads: new Collection([
            [
              'attendance-thread',
              {
                id: 'attendance-thread',
                name: '2026-03-29 출석',
                send: threadSend,
                toString: () => '<#attendance-thread>',
              },
            ],
          ]),
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
          get: vi.fn().mockReturnValue(undefined),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    const challengeReportRunner = mockScheduleDailyReports.mock.calls[0]?.[0];
    expect(challengeReportRunner).toBeTypeOf('function');

    await challengeReportRunner();

    expect(fetch).toHaveBeenCalledWith('valid-channel-id');
    expect(checkChannelSend).not.toHaveBeenCalled();
    expect(threadSend).toHaveBeenCalledOnce();
    expect(threadSend).toHaveBeenCalledWith('attendance report');
  });

  it('challenge 결과표가 여러 메시지로 분할되면 같은 thread에 순서대로 모두 전송한다', async () => {
    const threadSend = vi.fn().mockResolvedValue(undefined);
    const checkChannelSend = vi.fn();
    mockBuildChallengeReport.mockResolvedValueOnce({
      attendanceMessage: 'chunk-1chunk-2',
      attendanceMessages: ['chunk-1', 'chunk-2'],
      hallOfFameMessage: null,
    });
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send: checkChannelSend,
      threads: {
        fetchActive: vi.fn().mockResolvedValue({
          threads: new Collection([
            [
              'attendance-thread',
              {
                id: 'attendance-thread',
                name: '2026-03-29 출석',
                send: threadSend,
                toString: () => '<#attendance-thread>',
              },
            ],
          ]),
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
          get: vi.fn().mockReturnValue(undefined),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    const challengeReportRunner = mockScheduleDailyReports.mock.calls[0]?.[0];
    expect(challengeReportRunner).toBeTypeOf('function');

    await challengeReportRunner();

    expect(checkChannelSend).not.toHaveBeenCalled();
    expect(threadSend).toHaveBeenNthCalledWith(1, 'chunk-1');
    expect(threadSend).toHaveBeenNthCalledWith(2, 'chunk-2');
  });

  it('출석 로그가 없어도 당일 thread 이름으로 재탐색해 결과표를 전송한다', async () => {
    const archivedThreadSend = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue({
      type: 0,
      id: 'valid-channel-id',
      send: vi.fn(),
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
                send: archivedThreadSend,
                toString: () => '<#archived-thread>',
              },
            ],
          ]),
        }),
      },
    });

    const { event } = await import('../events/ready.js');

    await event.execute({
      channels: {
        fetch,
        cache: {
          get: vi.fn().mockReturnValue(undefined),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    const challengeReportRunner = mockScheduleDailyReports.mock.calls[0]?.[0];
    expect(challengeReportRunner).toBeTypeOf('function');

    await challengeReportRunner();

    expect(fetch).toHaveBeenCalledWith('valid-channel-id');
    expect(archivedThreadSend).toHaveBeenCalledOnce();
    expect(archivedThreadSend).toHaveBeenCalledWith('attendance report');
  });

  it('월말 생존명단 전송 위치는 결과 채널 본문으로 유지한다', async () => {
    const resultChannelSend = vi.fn().mockResolvedValue(undefined);
    mockBuildChallengeReport.mockResolvedValueOnce({
      attendanceMessage: null,
      attendanceMessages: null,
      hallOfFameMessage: 'hall of fame',
    });

    const { event } = await import('../events/ready.js');

    await event.execute({
      channels: {
        fetch: vi.fn(),
        cache: {
          get: vi
            .fn()
            .mockImplementation((id: string) =>
              id === 'valid-result-channel-id' ? { send: resultChannelSend } : undefined,
            ),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    const challengeReportRunner = mockScheduleDailyReports.mock.calls[0]?.[0];
    expect(challengeReportRunner).toBeTypeOf('function');

    await challengeReportRunner();

    expect(resultChannelSend).toHaveBeenCalledOnce();
    expect(resultChannelSend).toHaveBeenCalledWith('hall of fame');
  });

  it('출석 thread 확보가 실패해도 월말 생존명단 전송은 계속한다', async () => {
    const resultChannelSend = vi.fn().mockResolvedValue(undefined);
    mockBuildChallengeReport.mockResolvedValueOnce({
      attendanceMessage: 'attendance report',
      attendanceMessages: ['attendance report'],
      hallOfFameMessage: 'hall of fame',
    });

    const { event } = await import('../events/ready.js');

    await event.execute({
      channels: {
        fetch: vi.fn().mockRejectedValue(new Error('fetch failed')),
        cache: {
          get: vi
            .fn()
            .mockImplementation((id: string) =>
              id === 'valid-result-channel-id' ? { send: resultChannelSend } : undefined,
            ),
        },
      },
      user: {
        tag: 'haruharu#0001',
      },
    } as never);

    const challengeReportRunner = mockScheduleDailyReports.mock.calls[0]?.[0];
    expect(challengeReportRunner).toBeTypeOf('function');

    await expect(challengeReportRunner()).resolves.toBeUndefined();

    expect(resultChannelSend).toHaveBeenCalledOnce();
    expect(resultChannelSend).toHaveBeenCalledWith('hall of fame');
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

  it('syncModels 동안 06시를 넘기면 현재 시각 기준으로 오늘 운영 daily message 생성을 즉시 시도한다', async () => {
    vi.setSystemTime(new Date('2026-03-29T05:59:59'));
    mockSyncModels.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date('2026-03-29T06:00:01'));
    });

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

  it('운영 채널 fetch 실패도 로그로 남긴다', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('fetch failed'));

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
    ).rejects.toThrow('fetch failed');

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
