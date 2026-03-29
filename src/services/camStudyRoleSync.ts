import { GuildMember } from 'discord.js';
import { camStudyRoleId, voiceChannelId } from '../config.js';
import { logger } from '../logger.js';
import { findCamStudyActiveSession, removeCamStudyUser, upsertCamStudyUser } from '../repository/camStudyRepository.js';

const hasCamStudyRole = (member: GuildMember) => member.roles.cache.has(camStudyRoleId);
const isActiveCamStudySession = (member: GuildMember) =>
  member.voice.channelId === voiceChannelId && (member.voice.selfVideo || member.voice.streaming);

const getDisplayName = (member: GuildMember) => member.user.globalName ?? member.user.username ?? member.id;

const syncCamStudyMemberState = async (member: GuildMember) => {
  const userid = member.user.id;

  if (hasCamStudyRole(member)) {
    const username = getDisplayName(member);
    await upsertCamStudyUser({ userid, username });
    logger.info('cam study user synced from current role state', { userid, username, roleId: camStudyRoleId });
    return;
  }

  const activeSession = await findCamStudyActiveSession(userid);
  if (isActiveCamStudySession(member) || activeSession) {
    logger.info('cam study user removal deferred until active session ends', {
      userid,
      roleId: camStudyRoleId,
      hasActiveSession: Boolean(activeSession),
      isLiveInVoice: isActiveCamStudySession(member),
    });
    return;
  }

  await removeCamStudyUser(userid);
  logger.info('cam study user removed from current role state', { userid, roleId: camStudyRoleId });
};

const syncCamStudyRoleMembership = async (oldMember: GuildMember, newMember: GuildMember) => {
  const hadCamStudyRole = hasCamStudyRole(oldMember);
  const hasCamStudyRoleNow = hasCamStudyRole(newMember);

  if (hadCamStudyRole === hasCamStudyRoleNow) {
    return;
  }

  await syncCamStudyMemberState(newMember);
};

export { syncCamStudyMemberState, syncCamStudyRoleMembership };
