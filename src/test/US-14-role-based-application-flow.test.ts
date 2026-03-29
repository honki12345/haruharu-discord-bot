import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockInteraction, testSequelize, TestCamStudyUsers } from './test-setup.js';

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

vi.mock('../repository/ParticipationApplication.js', () => ({
  ParticipationApplication,
}));

describe('US-14: 역할 기반 자동 참여 흐름', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.resetModules();
    applications.clear();
    await TestCamStudyUsers.destroy({ where: {} });
    ParticipationApplication.findOne.mockReset();
    ParticipationApplication.create.mockReset();
    ParticipationApplication.update.mockReset();
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
  });

  it('TC-RA01: /apply-wakeup은 즉시 역할을 부여하고 approved 상태로 저장한다', async () => {
    const applicantMember = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
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
    expect(applicantMember.roles.add).toHaveBeenCalledWith('valid-wake-up-role-id');
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('기상인증 참여가 바로 활성화'),
      ephemeral: true,
    });
  });

  it('TC-RA02: /apply-cam은 즉시 역할을 부여하고 CamStudyUsers를 등록한다', async () => {
    const applicantMember = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
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

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(applications.get('test-user-id:cam-study')).toMatchObject({
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'approved',
    });
    expect(applicantMember.roles.add).toHaveBeenCalledWith('valid-cam-study-role-id');
    expect(user).not.toBeNull();
    expect(user?.username).toBe('테스트유저');
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('캠스터디 참여가 바로 활성화'),
      ephemeral: true,
    });
  });

  it('TC-RA03: 이미 approved 상태면 /apply-cam은 중복 역할 부여 없이 안내만 한다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'approved',
      reason: null,
    });

    const applicantMember = {
      roles: {
        cache: {
          has: vi.fn().mockReturnValue(true),
        },
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    expect(applicantMember.roles.add).not.toHaveBeenCalled();
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('전용 채널'),
      ephemeral: true,
    });
  });

  it('TC-RA03-1: 이미 approved 상태인 /apply-wakeup은 /register 다음 행동을 다시 안내한다', async () => {
    applications.set('test-user-id:wake-up', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'wake-up',
      status: 'approved',
      reason: null,
    });

    const applicantMember = {
      roles: {
        cache: {
          has: vi.fn().mockReturnValue(true),
        },
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-wakeup.js');
    await command.execute(interaction as never);

    expect(applicantMember.roles.add).not.toHaveBeenCalled();
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('/register'),
      ephemeral: true,
    });
  });

  it('TC-RA04: approved 상태여도 역할이 없으면 /apply-cam으로 재활성화할 수 있다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'approved',
      reason: null,
    });

    const applicantMember = {
      roles: {
        cache: {
          has: vi.fn().mockReturnValue(false),
        },
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(applicantMember.roles.add).toHaveBeenCalledWith('valid-cam-study-role-id');
    expect(user).not.toBeNull();
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('캠스터디 참여가 바로 활성화'),
      ephemeral: true,
    });
  });

  it('TC-RA05: /apply-wakeup은 서버에서 사용자를 찾지 못하면 자동 참여를 실패로 안내한다', async () => {
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockRejectedValue(new Error('Unknown Member')),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-wakeup.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:wake-up')).toBeUndefined();
    expect(interaction.getLastReply()).toContain('서버에서 사용자를 찾을 수 없어요');
  });

  it('TC-RA06: /apply-wakeup은 역할 부여에 실패하면 approved 상태를 저장하지 않는다', async () => {
    const applicantMember = {
      roles: {
        add: vi.fn().mockRejectedValue(new Error('missing permissions')),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-wakeup.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:wake-up')).toBeUndefined();
    expect(interaction.getLastReply()).toContain('역할을 부여하지 못했어요');
  });

  it('TC-RA07: /apply-cam에서 CamStudyUsers 동기화가 실패하면 역할을 롤백한다', async () => {
    const applicantMember = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });
    const repository = await import('../repository/camStudyRepository.js');
    vi.spyOn(repository, 'upsertCamStudyUser').mockRejectedValueOnce(new Error('db boom'));

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(applications.get('test-user-id:cam-study')).toBeUndefined();
    expect(applicantMember.roles.remove).toHaveBeenCalledWith('valid-cam-study-role-id');
    expect(user).toBeNull();
    expect(interaction.getLastReply()).toContain('자동 참여 처리 중 오류');
  });

  it('TC-RA08: 이미 역할이 있는 /apply-cam 재시도에서 persist 실패가 나도 기존 role/row를 롤백하지 않는다', async () => {
    await TestCamStudyUsers.create({
      userid: 'test-user-id',
      username: '기존이름',
    });
    ParticipationApplication.create.mockRejectedValueOnce(new Error('db boom'));

    const applicantMember = {
      roles: {
        cache: {
          has: vi.fn().mockReturnValue(true),
        },
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(applicantMember.roles.add).not.toHaveBeenCalled();
    expect(applicantMember.roles.remove).not.toHaveBeenCalled();
    expect(user).not.toBeNull();
    expect(interaction.getLastReply()).toContain('자동 참여 처리 중 오류');
  });

  it('TC-RA09: approved 상태와 기존 역할이 있는 /apply-cam 재시도에서 row self-heal 실패도 자동 참여 오류로 안내한다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'approved',
      reason: null,
    });

    const applicantMember = {
      roles: {
        cache: {
          has: vi.fn().mockReturnValue(true),
        },
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });
    const repository = await import('../repository/camStudyRepository.js');
    vi.spyOn(repository, 'upsertCamStudyUser').mockRejectedValueOnce(new Error('db boom'));

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await expect(command.execute(interaction as never)).resolves.toBeUndefined();

    const user = await TestCamStudyUsers.findOne({ where: { userid: 'test-user-id' } });
    expect(applicantMember.roles.add).not.toHaveBeenCalled();
    expect(applicantMember.roles.remove).not.toHaveBeenCalled();
    expect(user).toBeNull();
    expect(interaction.getLastReply()).toContain('자동 참여 처리 중 오류');
  });

  it('TC-RA10: /approve-application은 deprecated 안내만 반환한다', async () => {
    const { command } = await import('../commands/haruharu/approve-application.js');
    expect(command.data.toJSON().options?.map(option => option.required)).toEqual([false, false]);

    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'wake-up',
      },
    });

    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('deprecated');
  });

  it('TC-RA11: /reject-application은 deprecated 안내만 반환한다', async () => {
    const { command } = await import('../commands/haruharu/reject-application.js');
    expect(command.data.toJSON().options?.map(option => option.required)).toEqual([false, false, false]);

    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
        reason: '사유',
      },
    });

    await command.execute(interaction as never);

    expect(interaction.getLastReply()).toContain('deprecated');
  });
});
