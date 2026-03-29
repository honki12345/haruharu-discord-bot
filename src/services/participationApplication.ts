import { ChatInputCommandInteraction } from 'discord.js';
import { applyChannelId, camStudyRoleId, opsChannelId, wakeUpRoleId } from '../config.js';
import { logger } from '../logger.js';
import { ParticipationApplication } from '../repository/ParticipationApplication.js';
import { removeCamStudyUser, upsertCamStudyUser } from '../repository/camStudyRepository.js';

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

const buildOpsNotification = (userid: string, username: string, program: ParticipationProgram) => {
  const { label } = PROGRAM_METADATA[program];
  return [
    `📝 새로운 ${label} 신청이 들어왔어요.`,
    `- 사용자: ${username} (${userid})`,
    `- 승인: /approve-application userid:${userid} program:${program}`,
    `- 거절: /reject-application userid:${userid} program:${program} reason:사유입력`,
  ].join('\n');
};

const sendOpsNotification = async (interaction: ChatInputCommandInteraction, message: string) => {
  try {
    const opsChannel = await interaction.client.channels.fetch(opsChannelId);
    if (opsChannel && 'send' in opsChannel) {
      await opsChannel.send({
        content: message,
        allowedMentions: { parse: [] },
      });
    }
  } catch (error) {
    logger.warn('failed to send ops notification for participation application', { error, opsChannelId });
  }
};

const notifyApplicant = async (interaction: ChatInputCommandInteraction, userid: string, message: string) => {
  try {
    const applicant = await interaction.client.users.fetch(userid);
    if (applicant && 'send' in applicant) {
      await applicant.send(message);
    }
  } catch (error) {
    logger.warn('failed to notify participation applicant', { error, userid });
  }
};

const isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'SequelizeUniqueConstraintError';

const buildPendingReply = (label: string) => ({
  content: `${label} 신청이 이미 접수되어 있어요. 운영진 승인을 기다려 주세요.`,
  ephemeral: true,
});

const buildApprovedReply = (label: string) => ({
  content: `${label} 참여가 이미 승인되어 있어요. 전용 채널을 확인해 주세요.`,
  ephemeral: true,
});

const submitParticipationApplication = async (
  interaction: ChatInputCommandInteraction,
  program: ParticipationProgram,
) => {
  const userid = interaction.user.id;
  const username = interaction.user.globalName ?? interaction.user.username ?? 'unknown';
  const { label } = PROGRAM_METADATA[program];
  const existingApplication = await ParticipationApplication.findOne({
    where: { userid, program },
  });

  if (!existingApplication) {
    try {
      await ParticipationApplication.create({
        userid,
        username,
        program,
        status: 'pending',
        reason: null,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const concurrentApplication = await ParticipationApplication.findOne({
        where: { userid, program },
      });

      if (!concurrentApplication) {
        throw error;
      }

      if (concurrentApplication.status === 'pending') {
        return buildPendingReply(label);
      }

      if (concurrentApplication.status === 'approved') {
        return buildApprovedReply(label);
      }

      await ParticipationApplication.update(
        {
          username,
          status: 'pending',
          reason: null,
        },
        {
          where: { userid, program },
        },
      );
    }
  } else if (existingApplication.status === 'pending') {
    return buildPendingReply(label);
  } else if (existingApplication.status === 'approved') {
    return buildApprovedReply(label);
  } else {
    await ParticipationApplication.update(
      {
        username,
        status: 'pending',
        reason: null,
      },
      {
        where: { userid, program },
      },
    );
  }

  await sendOpsNotification(interaction, buildOpsNotification(userid, username, program));
  return {
    content: `${label} 신청이 접수되었어요. 운영진이 확인한 뒤 안내드릴게요.`,
    ephemeral: true,
  };
};

const approveParticipationApplication = async (
  interaction: ChatInputCommandInteraction,
  userid: string,
  program: ParticipationProgram,
) => {
  const application = await ParticipationApplication.findOne({
    where: { userid, program },
  });

  if (!application || application.status !== 'pending') {
    return `${PROGRAM_METADATA[program].label} 대기 신청이 없어요.`;
  }

  const guild = interaction.guild;
  if (!guild) {
    return '서버 안에서만 승인할 수 있어요.';
  }

  const roleId = PROGRAM_METADATA[program].roleId;
  let member;
  try {
    member = await guild.members.fetch(userid);
  } catch (error) {
    logger.error('failed to fetch guild member for participation approval', { error, userid, program });
    return '서버에서 사용자를 찾을 수 없어요. 서버에 남아 있는지 확인해 주세요.';
  }

  try {
    await member.roles.add(roleId);
  } catch (error) {
    logger.error('failed to add role for participation approval', { error, userid, program, roleId });
    return '역할을 부여하지 못했어요. 봇 권한과 역할 설정을 확인한 뒤 다시 시도해 주세요.';
  }

  try {
    const [affectedRows] = await ParticipationApplication.update(
      {
        status: 'approved',
        reason: null,
      },
      {
        where: { userid, program, status: 'pending' },
      },
    );

    if (affectedRows === 0) {
      const latestApplication = await ParticipationApplication.findOne({
        where: { userid, program },
      });

      if (latestApplication?.status === 'approved') {
        return `${PROGRAM_METADATA[program].label} 참여가 이미 승인되어 있어요. 전용 채널을 확인해 주세요.`;
      }

      await member.roles.remove(roleId);
      return `${PROGRAM_METADATA[program].label} 대기 신청이 없어요.`;
    }

    if (program === 'cam-study') {
      await upsertCamStudyUser({
        userid,
        username: application.username,
      });
    }
  } catch (error) {
    logger.error('failed to finalize participation approval', { error, userid, program });

    if (program === 'cam-study') {
      try {
        await removeCamStudyUser(userid);
      } catch (rollbackSyncError) {
        logger.error('failed to rollback cam study user sync after approval failure', {
          rollbackSyncError,
          userid,
          program,
        });
      }
    }

    try {
      await ParticipationApplication.update(
        {
          status: 'pending',
          reason: null,
        },
        {
          where: { userid, program, status: 'approved' },
        },
      );
    } catch (rollbackStatusError) {
      logger.error('failed to rollback participation approval status', {
        rollbackStatusError,
        userid,
        program,
      });
    }

    try {
      await member.roles.remove(roleId);
    } catch (rollbackError) {
      logger.error('failed to rollback participation approval role', {
        rollbackError,
        userid,
        program,
        roleId,
      });
    }
    return '승인 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  }

  await notifyApplicant(
    interaction,
    userid,
    `${PROGRAM_METADATA[program].label} 신청이 승인되었어요. 서버에서 전용 채널을 확인해 주세요.`,
  );

  return `${application.username}님의 ${PROGRAM_METADATA[program].label} 신청을 승인했어요.`;
};

const rejectParticipationApplication = async (
  interaction: ChatInputCommandInteraction,
  userid: string,
  program: ParticipationProgram,
  reason: string,
) => {
  const application = await ParticipationApplication.findOne({
    where: { userid, program },
  });

  if (!application || application.status !== 'pending') {
    return `${PROGRAM_METADATA[program].label} 대기 신청이 없어요.`;
  }

  const [affectedRows] = await ParticipationApplication.update(
    {
      status: 'rejected',
      reason,
    },
    {
      where: { userid, program, status: 'pending' },
    },
  );

  if (affectedRows === 0) {
    return `${PROGRAM_METADATA[program].label} 대기 신청이 없어요.`;
  }

  await notifyApplicant(
    interaction,
    userid,
    `${PROGRAM_METADATA[program].label} 신청이 거절되었어요. 사유: ${reason}\n<#${applyChannelId}> 안내를 확인한 뒤 다시 신청해 주세요.`,
  );

  return `${application.username}님의 ${PROGRAM_METADATA[program].label} 신청을 거절했어요.`;
};

export {
  PROGRAM_METADATA,
  approveParticipationApplication,
  rejectParticipationApplication,
  submitParticipationApplication,
};
