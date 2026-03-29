import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockInteraction } from './test-setup.js';

type ProgramType = 'wake-up' | 'cam-study';
type ApplicationStatus = 'pending' | 'approved' | 'rejected';

interface ParticipationApplicationRecord {
  userid: string;
  username: string;
  program: ProgramType;
  status: ApplicationStatus;
  reason: string | null;
}

const applications = new Map<string, ParticipationApplicationRecord>();
const camStudyUsers = new Map<string, { userid: string; username: string }>();

const getApplicationKey = (userid: string, program: ProgramType) => `${userid}:${program}`;

const ParticipationApplication = {
  findOne: vi.fn(async ({ where }: { where: { userid: string; program: ProgramType } }) => {
    return applications.get(getApplicationKey(where.userid, where.program)) ?? null;
  }),
  create: vi.fn(async (record: ParticipationApplicationRecord) => {
    applications.set(getApplicationKey(record.userid, record.program), record);
    return record;
  }),
  update: vi.fn(
    async (
      values: Partial<ParticipationApplicationRecord>,
      { where }: { where: { userid: string; program: ProgramType } },
    ) => {
      const current = applications.get(getApplicationKey(where.userid, where.program));
      if (!current) {
        return [0];
      }

      applications.set(getApplicationKey(where.userid, where.program), {
        ...current,
        ...values,
      });
      return [1];
    },
  ),
};

const upsertCamStudyUser = vi.fn(async ({ userid, username }: { userid: string; username: string }) => {
  camStudyUsers.set(userid, { userid, username });
  return camStudyUsers.get(userid);
});

const deleteCamStudyUser = vi.fn(async (userid: string) => {
  camStudyUsers.delete(userid);
  return 1;
});

const findCamStudyUser = vi.fn(async (userid: string) => {
  return camStudyUsers.get(userid) ?? null;
});

vi.mock('../repository/ParticipationApplication.js', () => ({
  ParticipationApplication,
}));

vi.mock('../repository/camStudyRepository.js', async importOriginal => {
  const original = await importOriginal<typeof import('../repository/camStudyRepository.js')>();
  return {
    ...original,
    deleteCamStudyUser,
    findCamStudyUser,
    upsertCamStudyUser,
  };
});

describe('US-14: 역할 기반 신청/자동 활성화 흐름', () => {
  beforeEach(() => {
    vi.resetModules();
    applications.clear();
    camStudyUsers.clear();
    ParticipationApplication.findOne.mockReset();
    ParticipationApplication.create.mockReset();
    ParticipationApplication.update.mockReset();
    upsertCamStudyUser.mockClear();
    deleteCamStudyUser.mockClear();
    findCamStudyUser.mockClear();
    ParticipationApplication.findOne.mockImplementation(
      async ({ where }: { where: { userid: string; program: ProgramType } }) => {
        return applications.get(getApplicationKey(where.userid, where.program)) ?? null;
      },
    );
    ParticipationApplication.create.mockImplementation(async (record: ParticipationApplicationRecord) => {
      applications.set(getApplicationKey(record.userid, record.program), record);
      return record;
    });
    ParticipationApplication.update.mockImplementation(
      async (
        values: Partial<ParticipationApplicationRecord>,
        { where }: { where: { userid: string; program: ProgramType } },
      ) => {
        const current = applications.get(getApplicationKey(where.userid, where.program));
        if (!current) {
          return [0];
        }

        applications.set(getApplicationKey(where.userid, where.program), {
          ...current,
          ...values,
        });
        return [1];
      },
    );
    upsertCamStudyUser.mockImplementation(async ({ userid, username }: { userid: string; username: string }) => {
      camStudyUsers.set(userid, { userid, username });
      return camStudyUsers.get(userid);
    });
    deleteCamStudyUser.mockImplementation(async (userid: string) => {
      camStudyUsers.delete(userid);
      return 1;
    });
    findCamStudyUser.mockImplementation(async (userid: string) => camStudyUsers.get(userid) ?? null);
  });

  it('TC-RA01: /apply-wakeup은 신청을 즉시 approved 로 반영하고 역할을 부여한 뒤 /register 안내를 보낸다', async () => {
    const member = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
        cache: new Map<string, object>(),
      },
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(member),
        },
      },
      client: {
        channels: {
          fetch: vi.fn(),
        },
        users: {
          fetch: vi.fn(),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-wakeup.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:wake-up')).toMatchObject({
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'wake-up',
      status: 'approved',
    });
    expect(member.roles.add).toHaveBeenCalledWith('valid-wake-up-role-id');
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('/register'),
      ephemeral: true,
    });
    expect(interaction.client.channels.fetch).not.toHaveBeenCalled();
  });

  it('TC-RA02: /apply-cam은 신청을 즉시 approved 로 반영하고 역할과 CamStudyUsers upsert 를 함께 수행한다', async () => {
    const member = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
        cache: new Map<string, object>(),
      },
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(member),
        },
      },
      client: {
        channels: {
          fetch: vi.fn(),
        },
        users: {
          fetch: vi.fn(),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:cam-study')).toMatchObject({
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'approved',
    });
    expect(member.roles.add).toHaveBeenCalledWith('valid-cam-study-role-id');
    expect(upsertCamStudyUser).toHaveBeenCalledWith({
      userid: 'test-user-id',
      username: '테스트유저',
    });
    expect(camStudyUsers.get('test-user-id')).toMatchObject({
      userid: 'test-user-id',
      username: '테스트유저',
    });
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('즉시 활성화'),
      ephemeral: true,
    });
    expect(interaction.client.channels.fetch).not.toHaveBeenCalled();
  });

  it('TC-RA03: 기존 캠스터디 역할 보유자의 /apply-cam 재시도에서 오류가 나도 기존 role/row 를 롤백하지 않는다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'approved',
      reason: null,
    });
    camStudyUsers.set('test-user-id', {
      userid: 'test-user-id',
      username: '테스트유저',
    });
    ParticipationApplication.update.mockRejectedValueOnce(new Error('db update failed'));

    const member = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
        cache: new Map<string, object>([['valid-cam-study-role-id', {}]]),
      },
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(member),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    expect(member.roles.remove).not.toHaveBeenCalled();
    expect(camStudyUsers.get('test-user-id')).toMatchObject({
      userid: 'test-user-id',
      username: '테스트유저',
    });
    expect(interaction.getLastReply()).toContain('잠시 후 다시 시도');
  });

  it('TC-RA04: /approve-application은 deprecated 안내만 반환한다', async () => {
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'wake-up',
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(ParticipationApplication.update).not.toHaveBeenCalled();
    expect(interaction.getLastReply()).toContain('deprecated');
  });

  it('TC-RA05: /reject-application은 deprecated 안내만 반환한다', async () => {
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
        reason: 'legacy',
      },
    });

    const { command } = await import('../commands/haruharu/reject-application.js');
    await command.execute(interaction as never);

    expect(ParticipationApplication.update).not.toHaveBeenCalled();
    expect(interaction.getLastReply()).toContain('deprecated');
  });
});
