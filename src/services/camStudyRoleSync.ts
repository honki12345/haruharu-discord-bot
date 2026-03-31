import { GuildMember } from 'discord.js';
import { camStudyRoleId, voiceChannelId } from '../config.js';
import { logger } from '../logger.js';
import {
  findCamStudyActiveSession,
  findCamStudyUser,
  removeCamStudyUser,
  updateCamStudyActiveSession,
  upsertCamStudyUser,
} from '../repository/camStudyRepository.js';
import { hasDiscordDisplayNameChanged, resolveDiscordDisplayName } from '../utils/discordName.js';

const hasCamStudyRole = (member: GuildMember) => member.roles.cache.has(camStudyRoleId);
const isActiveCamStudySession = (member: GuildMember) =>
  member.voice.channelId === voiceChannelId && (member.voice.selfVideo || member.voice.streaming);

const getDisplayName = (member: GuildMember) => resolveDiscordDisplayName(member);

const syncCamStudyNames = async (member: GuildMember, allowCreate: boolean) => {
  const userid = member.user.id;
  const username = getDisplayName(member);
  const [existingUser, activeSession] = await Promise.all([
    findCamStudyUser(userid),
    findCamStudyActiveSession(userid),
  ]);

  if (allowCreate || existingUser) {
    await upsertCamStudyUser({ userid, username });
  }

  if (activeSession && activeSession.username !== username) {
    await updateCamStudyActiveSession(userid, { username });
  }

  return { activeSession, username };
};

const syncCamStudyMemberState = async (member: GuildMember) => {
  const userid = member.user.id;
  const hasRole = hasCamStudyRole(member);
  const isLiveSession = isActiveCamStudySession(member);

  if (hasRole) {
    const { username } = await syncCamStudyNames(member, true);
    logger.info('cam study user synced from current role state', { userid, username, roleId: camStudyRoleId });
    return;
  }

  const { activeSession, username } = await syncCamStudyNames(member, false);
  if (isLiveSession || activeSession) {
    logger.info('cam study user removal deferred until active session ends', {
      username,
      userid,
      roleId: camStudyRoleId,
      hasActiveSession: Boolean(activeSession),
      isLiveInVoice: isLiveSession,
    });
    return;
  }

  await removeCamStudyUser(userid);
  logger.info('cam study user removed from current role state', { userid, roleId: camStudyRoleId });
};

const syncCamStudyRoleMembership = async (oldMember: GuildMember, newMember: GuildMember) => {
  const hadCamStudyRole = hasCamStudyRole(oldMember);
  const hasCamStudyRoleNow = hasCamStudyRole(newMember);

  if (hadCamStudyRole === hasCamStudyRoleNow && !hasDiscordDisplayNameChanged(oldMember, newMember)) {
    return;
  }

  await syncCamStudyMemberState(newMember);
};

export { syncCamStudyMemberState, syncCamStudyRoleMembership };
