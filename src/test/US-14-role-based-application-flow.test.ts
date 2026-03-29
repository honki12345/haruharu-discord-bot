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
    ParticipationApplication.findOne.mockClear();
    ParticipationApplication.create.mockClear();
    ParticipationApplication.update.mockClear();
  });

  it('TC-RA01: /apply-wakeup은 신청을 pending으로 저장하고 ephemeral 응답과 운영 알림을 보낸다', async () => {
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

    const { command } = await import('../commands/haruharu/apply-wakeup.js');
    await command.execute(interaction as never);

    expect(applications.get('test-user-id:wake-up')).toMatchObject({
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'wake-up',
      status: 'pending',
    });
    expect(interaction.getReplies()[0]).toMatchObject({
      content: expect.stringContaining('기상인증 신청이 접수'),
      ephemeral: true,
    });
    expect(opsSend).toHaveBeenCalledWith(expect.stringContaining('기상인증'));
  });

  it('TC-RA02: /apply-cam은 신청을 pending으로 저장하고 ephemeral 응답과 운영 알림을 보낸다', async () => {
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
    expect(opsSend).toHaveBeenCalledWith(expect.stringContaining('캠스터디'));
  });

  it('TC-RA03: /approve-application은 pending 신청을 승인하고 역할을 부여한 뒤 사용자에게 안내를 보낸다', async () => {
    applications.set('test-user-id:wake-up', {
      userid: 'test-user-id',
      username: '테스트유저',
      program: 'wake-up',
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
        program: 'wake-up',
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

    expect(applications.get('test-user-id:wake-up')?.status).toBe('approved');
    expect(applicantMember.roles.add).toHaveBeenCalledWith('valid-wake-up-role-id');
    expect(notifyApplicant).toHaveBeenCalledWith(expect.stringContaining('승인'));
    expect(interaction.getLastReply()).toContain('승인');
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
});
