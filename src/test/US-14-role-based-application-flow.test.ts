import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockInteraction } from './test-setup.js';

type ProgramType = 'cam-study';
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

describe('US-14: 역할 기반 신청/승인 흐름', () => {
  beforeEach(() => {
    vi.resetModules();
    applications.clear();
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

  it('TC-RA01: /apply-cam은 신청을 pending으로 저장하고 ephemeral 응답과 운영 알림을 보낸다', async () => {
    const opsSend = vi.fn();
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      client: {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            send: opsSend,
          }),
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
      status: 'pending',
    });
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('캠스터디 신청이 접수'),
      ephemeral: true,
    });
    expect(opsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('캠스터디'),
        allowedMentions: { parse: [] },
      }),
    );
  });

  it('TC-RA05: 중복 신청 race로 create가 unique 제약에 걸려도 pending 상태로 흡수한다', async () => {
    const opsSend = vi.fn();
    ParticipationApplication.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });
    ParticipationApplication.create.mockRejectedValueOnce({
      name: 'SequelizeUniqueConstraintError',
    });

    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      client: {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            send: opsSend,
          }),
        },
        users: {
          fetch: vi.fn(),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('이미 접수'),
      ephemeral: true,
    });
    expect(opsSend).not.toHaveBeenCalled();
  });

  it('TC-RA06: 운영 채널 알림은 사용자 이름에 멘션이 있어도 allowedMentions를 비활성화한다', async () => {
    const opsSend = vi.fn();
    const interaction = createMockInteraction({
      channelId: 'valid-apply-channel-id',
      globalName: '@everyone',
      client: {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            send: opsSend,
          }),
        },
        users: {
          fetch: vi.fn(),
        },
      },
    });

    const { command } = await import('../commands/haruharu/apply-cam.js');
    await command.execute(interaction as never);

    expect(opsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('@everyone'),
        allowedMentions: { parse: [] },
      }),
    );
  });

  it('TC-RA03: /approve-application은 cam-study pending 신청을 승인하고 역할을 부여한 뒤 사용자에게 안내를 보낸다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });

    const notifyApplicant = vi.fn();
    const applicantMember = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: notifyApplicant,
    };
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
      },
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
          fetch: vi.fn().mockResolvedValue({
            send: notifyApplicant,
          }),
        },
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:cam-study')?.status).toBe('approved');
    expect(applicantMember.roles.add).toHaveBeenCalledWith('valid-cam-study-role-id');
    expect(notifyApplicant).toHaveBeenCalledWith(expect.stringContaining('승인'));
    expect(interaction.getLastReply()).toContain('승인');
  });

  it('TC-RA11: /approve-application의 운영 응답은 신청자 이름에 멘션이 있어도 allowedMentions를 비활성화한다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '@everyone',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });

    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
      },
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue({
            roles: {
              add: vi.fn(),
              remove: vi.fn(),
            },
          }),
        },
      },
      client: {
        channels: {
          fetch: vi.fn(),
        },
        users: {
          fetch: vi.fn().mockResolvedValue({
            send: vi.fn(),
          }),
        },
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('@everyone'),
      allowedMentions: { parse: [] },
    });
  });

  it('TC-RA08: /approve-application은 신청자가 서버에 없으면 역할 부여 전에 명시적으로 실패를 안내한다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });

    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
      },
      guild: {
        members: {
          fetch: vi.fn().mockRejectedValue(new Error('Unknown Member')),
        },
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:cam-study')?.status).toBe('pending');
    expect(interaction.getLastReply()).toContain('서버에서 사용자를 찾을 수 없어요');
  });

  it('TC-RA15: /approve-application은 오래된 슬래시 커맨드에서 들어온 비지원 program 값을 명시적으로 거절한다', async () => {
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'wake-up',
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('지원하지 않는 프로그램'),
      allowedMentions: { parse: [] },
    });
  });

  it('TC-RA09: /approve-application은 역할 부여에 실패하면 상태를 승인으로 바꾸지 않는다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });

    const applicantMember = {
      roles: {
        add: vi.fn().mockRejectedValue(new Error('missing permissions')),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
      },
      guild: {
        members: {
          fetch: vi.fn().mockResolvedValue(applicantMember),
        },
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:cam-study')?.status).toBe('pending');
    expect(interaction.getLastReply()).toContain('역할을 부여하지 못했어요');
  });

  it('TC-RA10: /approve-application은 DB 업데이트 실패 시 방금 부여한 역할을 롤백한다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });
    ParticipationApplication.update.mockRejectedValueOnce(new Error('db update failed'));

    const notifyApplicant = vi.fn();
    const applicantMember = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: notifyApplicant,
    };
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
      },
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
          fetch: vi.fn().mockResolvedValue({
            send: notifyApplicant,
          }),
        },
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:cam-study')?.status).toBe('pending');
    expect(applicantMember.roles.remove).toHaveBeenCalledWith('valid-cam-study-role-id');
    expect(interaction.getLastReply()).toContain('승인 처리 중 오류');
  });

  it('TC-RA13: /approve-application은 pending 조건 업데이트가 실패하면 역할을 롤백하고 성공으로 응답하지 않는다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });
    ParticipationApplication.update.mockResolvedValueOnce([0]);

    const notifyApplicant = vi.fn();
    const applicantMember = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: notifyApplicant,
    };
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
      },
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
          fetch: vi.fn().mockResolvedValue({
            send: notifyApplicant,
          }),
        },
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(applicantMember.roles.remove).toHaveBeenCalledWith('valid-cam-study-role-id');
    expect(notifyApplicant).not.toHaveBeenCalled();
    expect(interaction.getLastReply()).toContain('대기 신청이 없어요');
  });

  it('TC-RA14: /approve-application은 다른 운영자가 이미 승인한 상태면 역할을 롤백하지 않는다', async () => {
    const pendingApplication = {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study' as const,
      status: 'pending' as const,
      reason: null,
    };
    applications.set('test-user-id:cam-study', pendingApplication);
    ParticipationApplication.findOne.mockResolvedValueOnce(pendingApplication).mockResolvedValueOnce({
      ...pendingApplication,
      status: 'approved',
    });
    ParticipationApplication.update.mockResolvedValueOnce([0]);

    const notifyApplicant = vi.fn();
    const applicantMember = {
      roles: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: notifyApplicant,
    };
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
      },
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
          fetch: vi.fn().mockResolvedValue({
            send: notifyApplicant,
          }),
        },
      },
    });

    const { command } = await import('../commands/haruharu/approve-application.js');
    await command.execute(interaction as never);

    expect(applicantMember.roles.remove).not.toHaveBeenCalled();
    expect(notifyApplicant).not.toHaveBeenCalled();
    expect(interaction.getLastReply()).toContain('이미 승인');
  });

  it('TC-RA04: /reject-application은 pending 신청을 거절하고 재신청 안내를 보낸다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });

    const notifyApplicant = vi.fn();
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
        reason: '운영진 확인 후 다시 신청해 주세요.',
      },
      client: {
        channels: {
          fetch: vi.fn(),
        },
        users: {
          fetch: vi.fn().mockResolvedValue({
            send: notifyApplicant,
          }),
        },
      },
    });

    const { command } = await import('../commands/haruharu/reject-application.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:cam-study')).toMatchObject({
      status: 'rejected',
      reason: '운영진 확인 후 다시 신청해 주세요.',
    });
    expect(notifyApplicant).toHaveBeenCalledWith(expect.stringContaining('다시 신청'));
    expect(interaction.getLastReply()).toContain('거절');
  });

  it('TC-RA12: /reject-application은 pending 조건 업데이트가 실패하면 거절 성공으로 응답하지 않는다', async () => {
    applications.set('test-user-id:cam-study', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'cam-study',
      status: 'pending',
      reason: null,
    });
    ParticipationApplication.update.mockResolvedValueOnce([0]);

    const notifyApplicant = vi.fn();
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'cam-study',
        reason: '운영진 확인 후 다시 신청해 주세요.',
      },
      client: {
        channels: {
          fetch: vi.fn(),
        },
        users: {
          fetch: vi.fn().mockResolvedValue({
            send: notifyApplicant,
          }),
        },
      },
    });

    const { command } = await import('../commands/haruharu/reject-application.js');
    await command.execute(interaction as never);

    expect(notifyApplicant).not.toHaveBeenCalled();
    expect(interaction.getLastReply()).toContain('대기 신청이 없어요');
  });

  it('TC-RA16: /reject-application은 오래된 슬래시 커맨드에서 들어온 비지원 program 값을 명시적으로 거절한다', async () => {
    const interaction = createMockInteraction({
      channelId: 'valid-ops-channel-id',
      options: {
        userid: 'test-user-id',
        program: 'wake-up',
        reason: '사유',
      },
    });

    const { command } = await import('../commands/haruharu/reject-application.js');
    await command.execute(interaction as never);

    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('지원하지 않는 프로그램'),
      allowedMentions: { parse: [] },
    });
  });
});
