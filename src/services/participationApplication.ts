import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { camStudyRoleId } from '../config.js';
import { logger } from '../logger.js';
import { ParticipationApplication } from '../repository/ParticipationApplication.js';
import { removeCamStudyUser, upsertCamStudyUser } from '../repository/camStudyRepository.js';

export type ParticipationProgram = 'cam-study';

const PROGRAM_METADATA: Record<
  ParticipationProgram,
  {
    label: string;
    roleId: string;
  }
> = {
  'cam-study': {
    label: '캠스터디',
    roleId: camStudyRoleId,
  },
};

const isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'SequelizeUniqueConstraintError';

const buildApprovedReply = () => ({
  content: '캠스터디 참여가 이미 활성화되어 있어요. 전용 채널을 확인해 주세요.',
  ephemeral: true,
});

const buildActivatedReply = () => ({
  content: '캠스터디 참여가 바로 활성화되었어요. 전용 채널을 확인해 주세요.',
  ephemeral: true,
});

const persistApprovedApplication = async (
  existingApplication: Pick<ParticipationApplication, 'userid' | 'username' | 'program' | 'status' | 'reason'> | null,
  userid: string,
  username: string,
  program: ParticipationProgram,
) => {
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

      const concurrentApplication = await ParticipationApplication.findOne({
        where: { userid, program },
      });

      if (concurrentApplication?.status === 'approved') {
        return 'already-approved' as const;
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
      return;
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
  const existingApplication = await ParticipationApplication.findOne({
    where: { userid, program },
  });

  const guild = interaction.guild;
  if (!guild) {
    return {
      content: '서버 안에서만 자동 참여를 진행할 수 있어요.',
      ephemeral: true,
    };
  }

  const roleId = PROGRAM_METADATA[program].roleId;
  let member: GuildMember;
  try {
    member = (await guild.members.fetch(userid)) as GuildMember;
  } catch (error) {
    logger.error('failed to fetch guild member for participation activation', { error, userid, program });
    return {
      content: '서버에서 사용자를 찾을 수 없어요. 서버에 남아 있는지 확인해 주세요.',
      ephemeral: true,
    };
  }

  const hadRoleBeforeActivation = member.roles.cache?.has(roleId) ?? false;

  if (!hadRoleBeforeActivation) {
    try {
      await member.roles.add(roleId);
    } catch (error) {
      logger.error('failed to add role for participation activation', { error, userid, program, roleId });
      return {
        content: '역할을 부여하지 못했어요. 봇 권한과 역할 설정을 확인한 뒤 다시 시도해 주세요.',
        ephemeral: true,
      };
    }
  }

  try {
    if (existingApplication?.status === 'approved' && hadRoleBeforeActivation) {
      await upsertCamStudyUser({ userid, username });
      return buildApprovedReply();
    }

    await upsertCamStudyUser({ userid, username });

    const persistResult = await persistApprovedApplication(existingApplication, userid, username, program);
    if (persistResult === 'already-approved') {
      return buildApprovedReply();
    }
  } catch (error) {
    logger.error('failed to finalize participation activation', { error, userid, program });

    if (!hadRoleBeforeActivation) {
      try {
        await removeCamStudyUser(userid);
      } catch (rollbackSyncError) {
        logger.error('failed to rollback cam study user sync after activation failure', {
          rollbackSyncError,
          userid,
          program,
        });
      }

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

    return {
      content: '자동 참여 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
      ephemeral: true,
    };
  }

  return buildActivatedReply();
};

export { PROGRAM_METADATA, submitParticipationApplication };
