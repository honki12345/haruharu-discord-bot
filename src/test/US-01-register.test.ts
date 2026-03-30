/**
 * US-01: 회원 등록
 * 사용자는 기상 챌린지에 참여하거나 설정을 바꾸기 위해 Discord에서 /register 명령어를 직접 사용한다.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  testSequelize,
  TestUsers,
  TestWakeUpMembership,
  TestWaketimeChangeLog,
  clearAllTables,
  createMockInteraction,
} from './test-setup.js';

describe('US-01: /register 커맨드', () => {
  beforeAll(async () => {
    await testSequelize.sync({ force: true });
  });

  afterAll(async () => {
    await testSequelize.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-07T07:05:00'));
    await clearAllTables();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC-R01: 신규 사용자 등록 성공', async () => {
    const interaction = createMockInteraction({
      userId: 'new-user-123',
      globalName: '홍길동',
      options: {
        waketime: '0700',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'new-user-123' } });
    expect(user).not.toBeNull();
    expect(user?.yearmonth).toBe('202512');
    expect(user?.username).toBe('홍길동');
    expect(user?.waketime).toBe('0700');
    expect(user?.vacances).toBe(5);
    expect(interaction.getLastReply()).toContain('등록했습니다');
  });

  it('TC-R02: 기존 사용자 업데이트 성공', async () => {
    await TestUsers.create({
      userid: 'existing-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const interaction = createMockInteraction({
      userId: 'existing-user',
      globalName: '홍길동',
      options: {
        waketime: '0800',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'existing-user' } });
    expect(user?.waketime).toBe('0800');
    expect(interaction.getLastReply()).toContain('수정했습니다');
  });

  it('TC-R02A: HH:mm 형식으로 입력해도 register에 성공하고 HHmm으로 저장한다', async () => {
    const interaction = createMockInteraction({
      userId: 'colon-format-user',
      globalName: '콜론유저',
      options: {
        waketime: '09:00',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'colon-format-user', yearmonth: '202512' } });
    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'colon-format-user' } });
    const changeLog = await TestWaketimeChangeLog.findOne({
      where: { userid: 'colon-format-user', yearmonthday: '20251207' },
    });

    expect(user?.waketime).toBe('0900');
    expect(membership?.waketime).toBe('0900');
    expect(changeLog?.waketime).toBe('0900');
    expect(interaction.getLastReply()).toContain('등록했습니다');
    expect(interaction.getLastReply()).toContain('0900');
  });

  it('TC-R02B: 잘못된 HH:mm 유사 형식은 계속 거부한다', async () => {
    for (const waketime of ['9:00', '09-00', '090', '09:0', '09:61']) {
      const interaction = createMockInteraction({
        userId: `invalid-format-${waketime}`,
        globalName: '포맷실패유저',
        options: {
          waketime,
        },
      });

      const { command } = await import('../commands/haruharu/register.js');
      await command.execute(interaction as never);

      const user = await TestUsers.findOne({ where: { userid: `invalid-format-${waketime}`, yearmonth: '202512' } });
      const membership = await TestWakeUpMembership.findOne({ where: { userid: `invalid-format-${waketime}` } });

      expect(user).toBeNull();
      expect(membership).toBeNull();
      expect(interaction.getLastReply()).toContain('HHmm 또는 HH:mm');
    }
  });

  it('TC-R03: 같은 날 두 번 register로 기상시간을 바꿀 수 없다', async () => {
    await TestUsers.create({
      userid: 'existing-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    await TestWaketimeChangeLog.create({
      userid: 'existing-user',
      yearmonthday: '20251207',
      waketime: '0730',
    });

    const interaction = createMockInteraction({
      userId: 'existing-user',
      globalName: '홍길동',
      options: {
        waketime: '0800',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'existing-user' } });
    expect(user?.waketime).toBe('0700');
    expect(interaction.getLastReply()).toContain('하루에 한 번만');
  });

  it('TC-R04: repository 조회 결과가 plain object 여도 기존 사용자 기상시간을 수정할 수 있다', async () => {
    await TestUsers.create({
      userid: 'existing-user',
      username: '홍길동',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const existingUser = await TestUsers.findOne({
      where: { userid: 'existing-user', yearmonth: '202512' },
    });

    const findOneSpy = vi.spyOn(TestUsers, 'findOne').mockImplementation(async options => {
      const where = (options as { where?: { userid?: string; yearmonth?: string } } | undefined)?.where;
      if (where?.userid === 'existing-user' && where?.yearmonth === '202512') {
        return existingUser?.get({ plain: true }) as never;
      }

      return null as never;
    });

    const interaction = createMockInteraction({
      userId: 'existing-user',
      globalName: '홍길동',
      options: {
        waketime: '0800',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');

    await command.execute(interaction as never);

    findOneSpy.mockRestore();

    const updatedUser = await TestUsers.findOne({ where: { userid: 'existing-user', yearmonth: '202512' } });
    expect(updatedUser?.waketime).toBe('0800');
    expect(interaction.getLastReply()).toContain('수정했습니다');
  });

  it('TC-R05: 서버 닉네임이 있으면 globalName보다 우선 저장한다', async () => {
    const interaction = createMockInteraction({
      userId: 'display-name-user',
      globalName: '글로벌이름',
      username: 'plain-user',
      memberDisplayName: '서버닉네임',
      options: {
        waketime: '0700',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'display-name-user', yearmonth: '202512' } });
    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'display-name-user' } });

    expect(user?.username).toBe('서버닉네임');
    expect(membership?.username).toBe('서버닉네임');
    expect(interaction.getLastReply()).toContain('서버닉네임님');
  });

  it('TC-R06: 서버 닉네임이 없으면 globalName으로 fallback 한다', async () => {
    const interaction = createMockInteraction({
      userId: 'global-name-user',
      globalName: '글로벌이름',
      username: 'plain-user',
      memberDisplayName: null,
      options: {
        waketime: '0700',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'global-name-user', yearmonth: '202512' } });
    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'global-name-user' } });

    expect(user?.username).toBe('글로벌이름');
    expect(membership?.username).toBe('글로벌이름');
    expect(interaction.getLastReply()).toContain('글로벌이름님');
  });

  it('TC-R07: 서버 닉네임과 globalName이 모두 없으면 username으로 fallback 한다', async () => {
    const interaction = createMockInteraction({
      userId: 'username-user',
      globalName: undefined,
      username: 'plain-user',
      memberDisplayName: null,
      options: {
        waketime: '0700',
      },
    });

    interaction.user.globalName = null;

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'username-user', yearmonth: '202512' } });
    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'username-user' } });

    expect(user?.username).toBe('plain-user');
    expect(membership?.username).toBe('plain-user');
    expect(interaction.getLastReply()).toContain('plain-user님');
  });

  it('TC-R08: raw guild interaction에서는 member.nick을 서버 닉네임으로 사용한다', async () => {
    const interaction = createMockInteraction({
      userId: 'raw-guild-user',
      globalName: '글로벌이름',
      username: 'plain-user',
      memberDisplayName: null,
      memberNick: 'raw-서버닉네임',
      member: {
        nick: 'raw-서버닉네임',
        roles: {
          add: vi.fn(),
          remove: vi.fn(),
        },
        send: vi.fn(),
      },
      options: {
        waketime: '0700',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const user = await TestUsers.findOne({ where: { userid: 'raw-guild-user', yearmonth: '202512' } });
    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'raw-guild-user' } });

    expect(user?.username).toBe('raw-서버닉네임');
    expect(membership?.username).toBe('raw-서버닉네임');
    expect(interaction.getLastReply()).toContain('raw-서버닉네임님');
  });

  it('TC-R09: /register 성공 시 @wake-up 역할이 부여된다', async () => {
    const interaction = createMockInteraction({
      userId: 'wake-role-user',
      globalName: '역할사용자',
      options: {
        waketime: '0710',
      },
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'wake-role-user' } });

    expect(interaction.member.roles.add).toHaveBeenCalledWith('valid-wake-up-role-id');
    expect(membership?.status).toBe('active');
    expect(interaction.getLastReply()).toContain('등록했습니다');
  });

  it('TC-R10: @wake-up 역할 부여 실패 시 등록을 중단하고 DB를 변경하지 않는다', async () => {
    const member = {
      roles: {
        add: vi.fn().mockRejectedValue(new Error('role add failed')),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const interaction = createMockInteraction({
      userId: 'role-fail-user',
      globalName: '실패사용자',
      options: {
        waketime: '0720',
      },
      member,
    });

    const { command } = await import('../commands/haruharu/register.js');
    await command.execute(interaction as never);

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'role-fail-user' } });
    const user = await TestUsers.findOne({ where: { userid: 'role-fail-user', yearmonth: '202512' } });
    const changeLog = await TestWaketimeChangeLog.findOne({
      where: { userid: 'role-fail-user', yearmonthday: '20251207' },
    });

    expect(member.roles.add).toHaveBeenCalledWith('valid-wake-up-role-id');
    expect(member.roles.remove).not.toHaveBeenCalled();
    expect(membership).toBeNull();
    expect(user).toBeNull();
    expect(changeLog).toBeNull();
    expect(interaction.getLastReply()).toContain('역할');
  });

  it('TC-R11: 기존 @wake-up 역할이 있던 사용자는 register rollback 시 역할을 잃지 않는다', async () => {
    await TestWakeUpMembership.create({
      userid: 'existing-role-user',
      username: '기존역할사용자',
      waketime: '0700',
      status: 'active',
      stoppedat: null,
    });
    await TestUsers.create({
      userid: 'existing-role-user',
      username: '기존역할사용자',
      yearmonth: '202512',
      waketime: '0700',
      vacances: 5,
      latecount: 0,
      absencecount: 0,
    });

    const changeLogCreateSpy = vi
      .spyOn(TestWaketimeChangeLog, 'create')
      .mockRejectedValueOnce(new Error('change log write failed'));

    const member = {
      roles: {
        cache: {
          has: vi.fn().mockReturnValue(true),
        },
        add: vi.fn(),
        remove: vi.fn(),
      },
      send: vi.fn(),
    };
    const guild = {
      members: {
        fetch: vi.fn().mockResolvedValue(member),
      },
    };

    const { executeRegisterWithRoleSync } = await import('../services/challengeSelfService.js');

    await expect(
      executeRegisterWithRoleSync({
        userId: 'existing-role-user',
        username: '기존역할사용자',
        waketime: '0715',
        guild: guild as never,
      }),
    ).rejects.toThrow('change log write failed');

    changeLogCreateSpy.mockRestore();

    const membership = await TestWakeUpMembership.findOne({ where: { userid: 'existing-role-user' } });
    const user = await TestUsers.findOne({ where: { userid: 'existing-role-user', yearmonth: '202512' } });
    const changeLog = await TestWaketimeChangeLog.findOne({
      where: { userid: 'existing-role-user', yearmonthday: '20251207' },
    });

    expect(member.roles.add).toHaveBeenCalledWith('valid-wake-up-role-id');
    expect(member.roles.remove).not.toHaveBeenCalled();
    expect(membership?.status).toBe('active');
    expect(membership?.waketime).toBe('0700');
    expect(user?.waketime).toBe('0700');
    expect(changeLog).toBeNull();
  });
});
