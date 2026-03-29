import { ChatInputCommandInteraction } from 'discord.js';
import { camStudyRoleId, wakeUpRoleId } from '../config.js';
import { logger } from '../logger.js';
import { deleteCamStudyUser, findCamStudyUser, upsertCamStudyUser } from '../repository/camStudyRepository.js';
import { ParticipationApplication } from '../repository/ParticipationApplication.js';

export type ParticipationProgram = 'wake-up' | 'cam-study';

const PROGRAM_METADATA: Record<
  ParticipationProgram,
  {
    label: string;
    roleId: string;
  }
> = {
  'wake-up': {
    label: '기상인증',
    roleId: wakeUpRoleId,
  },
  'cam-study': {
    label: '캠스터디',
    roleId: camStudyRoleId,
  },
};

const isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'SequelizeUniqueConstraintError';

const getProgramActivationReply = (program: ParticipationProgram, wasAlreadyActive: boolean) => ({
  content:
    program === 'wake-up'
      ? wasAlreadyActive
        ? '기상인증 참여가 이미 활성화되어 있어요. `/register`로 기상시간을 입력하거나 수정해 주세요.'
        : '기상인증 참여가 즉시 활성화되었어요. `/register`로 기상시간을 입력해 주세요.'
      : wasAlreadyActive
        ? '캠스터디 참여가 이미 활성화되어 있어요. 전용 채널을 확인해 주세요.'
        : '캠스터디 참여가 즉시 활성화되었어요. 전용 채널을 확인해 주세요.',
  ephemeral: true,
});

const getMemberHasRole = (
  member: {
    roles?: {
      cache?: {
        has?: (roleId: string) => boolean;
      };
    };
  },
  roleId: string,
) => member.roles?.cache?.has?.(roleId) === true;

const persistApprovedParticipationApplication = async (
  userid: string,
  username: string,
  program: ParticipationProgram,
) => {
  const existingApplication = await ParticipationApplication.findOne({
    where: { userid, program },
  });

  if (!existingApplication) {
    try {
      await ParticipationApplication.create({
        userid,
        username,
        program,
        status: 'approved',
        reason: null,
      });
      return;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  await ParticipationApplication.update(
    {
      username,
      status: 'approved',
      reason: null,
    },
    {
      where: { userid, program },
    },
  );
};

const submitParticipationApplication = async (
  interaction: ChatInputCommandInteraction,
  program: ParticipationProgram,
) => {
  const userid = interaction.user.id;
  const username = interaction.user.globalName ?? interaction.user.username ?? 'unknown';
  const guild = interaction.guild;
  if (!guild) {
    return {
      content: '서버 안에서만 신청할 수 있어요.',
      ephemeral: true,
    };
  }

  const roleId = PROGRAM_METADATA[program].roleId;
  let member;
  try {
    member = await guild.members.fetch(userid);
  } catch (error) {
    logger.error('failed to fetch guild member for immediate participation activation', { error, userid, program });
    return {
      content: '서버에서 사용자를 찾을 수 없어요. 서버에 남아 있는지 확인해 주세요.',
      ephemeral: true,
    };
  }

  const hadRoleBefore = getMemberHasRole(member, roleId);
  const hadCamStudyUserBefore = program === 'cam-study' ? Boolean(await findCamStudyUser(userid)) : false;
  const hadFullyActiveState = program === 'cam-study' ? hadRoleBefore && hadCamStudyUserBefore : hadRoleBefore;
  let roleGrantedByThisCall = false;

  try {
    if (!hadRoleBefore) {
      await member.roles.add(roleId);
      roleGrantedByThisCall = true;
    }
  } catch (error) {
    logger.error('failed to add role for immediate participation activation', { error, userid, program, roleId });
    return {
      content: '역할을 부여하지 못했어요. 봇 권한과 역할 설정을 확인한 뒤 다시 시도해 주세요.',
      ephemeral: true,
    };
  }

  try {
    if (program === 'cam-study') {
      await upsertCamStudyUser({
        userid,
        username,
      });
    }

    await persistApprovedParticipationApplication(userid, username, program);
  } catch (error) {
    logger.error('failed to activate participation application immediately', {
      error,
      hadCamStudyUserBefore,
      hadRoleBefore,
      program,
      roleGrantedByThisCall,
      userid,
    });
    if (roleGrantedByThisCall) {
      try {
        await member.roles.remove(roleId);
      } catch (rollbackError) {
        logger.error('failed to rollback participation activation role', {
          rollbackError,
          userid,
          program,
          roleId,
        });
      }
    }

    if (program === 'cam-study' && !hadRoleBefore && !hadCamStudyUserBefore) {
      try {
        await deleteCamStudyUser(userid);
      } catch (rollbackError) {
        logger.error('failed to rollback cam-study user after activation failure', {
          rollbackError,
          userid,
        });
      }
    }

    return {
      content: '신청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
      ephemeral: true,
    };
  }

  return getProgramActivationReply(program, hadFullyActiveState);
};

export { PROGRAM_METADATA, submitParticipationApplication };
