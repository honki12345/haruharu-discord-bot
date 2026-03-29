import { ChatInputCommandInteraction } from 'discord.js';
import { applyChannelId, camStudyRoleId, opsChannelId, wakeUpRoleId } from '../config.js';
import { logger } from '../logger.js';
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
  const opsChannel = await interaction.client.channels.fetch(opsChannelId);
  if (opsChannel && 'send' in opsChannel) {
    await opsChannel.send(message);
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
    await ParticipationApplication.create({
      userid,
      username,
      program,
      status: 'pending',
      reason: null,
    });
  } else if (existingApplication.status === 'pending') {
    return {
      content: `${label} 신청이 이미 접수되어 있어요. 운영진 승인을 기다려 주세요.`,
      ephemeral: true,
    };
  } else if (existingApplication.status === 'approved') {
    return {
      content: `${label} 참여가 이미 승인되어 있어요. 전용 채널을 확인해 주세요.`,
      ephemeral: true,
    };
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

  const member = await guild.members.fetch(userid);
  await member.roles.add(PROGRAM_METADATA[program].roleId);
  await ParticipationApplication.update(
    {
      status: 'approved',
      reason: null,
    },
    {
      where: { userid, program },
    },
  );

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

  await ParticipationApplication.update(
    {
      status: 'rejected',
      reason,
    },
    {
      where: { userid, program },
    },
  );

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
