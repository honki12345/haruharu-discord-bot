import { GuildMember } from 'discord.js';
import { camStudyRoleId } from '../config.js';
import { logger } from '../logger.js';
import { deleteCamStudyUser, findCamStudyActiveSession, upsertCamStudyUser } from '../repository/camStudyRepository.js';

const pendingCamStudyUserRevocations = new Set<string>();

const resolveMemberSnapshot = async (member: GuildMember) => {
  if (!member.partial || typeof member.fetch !== 'function') {
    return member;
  }

  try {
    return await member.fetch();
  } catch (error) {
    logger.warn('failed to fetch partial guild member for cam-study role sync', {
      error,
      userid: member.id,
    });
    return member;
  }
};

const hasCamStudyRole = (member: GuildMember) => member.roles?.cache?.has(camStudyRoleId) === true;

const getMemberUsername = (member: GuildMember) => member.displayName ?? member.user.globalName ?? member.user.username;

const syncCamStudyRoleMembership = async (payload: { hasRole: boolean; userid: string; username: string }) => {
  if (payload.hasRole) {
    pendingCamStudyUserRevocations.delete(payload.userid);
    await upsertCamStudyUser({
      userid: payload.userid,
      username: payload.username,
    });
    return 'upserted';
  }

  const activeSession = await findCamStudyActiveSession(payload.userid);
  if (activeSession) {
    pendingCamStudyUserRevocations.add(payload.userid);
    logger.info('deferred cam-study user removal until active session closes', {
      userid: payload.userid,
    });
    return 'deferred';
  }

  pendingCamStudyUserRevocations.delete(payload.userid);
  await deleteCamStudyUser(payload.userid);
  return 'deleted';
};

const finalizeDeferredCamStudyUserRemoval = async (userid: string) => {
  if (!pendingCamStudyUserRevocations.has(userid)) {
    return false;
  }

  const activeSession = await findCamStudyActiveSession(userid);
  if (activeSession) {
    return false;
  }

  pendingCamStudyUserRevocations.delete(userid);
  await deleteCamStudyUser(userid);
  return true;
};

const handleCamStudyRoleChange = async (oldMember: GuildMember, newMember: GuildMember) => {
  const [resolvedOldMember, resolvedNewMember] = await Promise.all([
    resolveMemberSnapshot(oldMember),
    resolveMemberSnapshot(newMember),
  ]);
  const hadRole = hasCamStudyRole(resolvedOldMember);
  const hasRoleNow = hasCamStudyRole(resolvedNewMember);

  if (hadRole === hasRoleNow) {
    return null;
  }

  return syncCamStudyRoleMembership({
    hasRole: hasRoleNow,
    userid: resolvedNewMember.id,
    username: getMemberUsername(resolvedNewMember),
  });
};

const resetCamStudyRoleSyncState = () => {
  pendingCamStudyUserRevocations.clear();
};

export { finalizeDeferredCamStudyUserRemoval, handleCamStudyRoleChange, resetCamStudyRoleSyncState };
