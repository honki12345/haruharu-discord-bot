import { GuildMember } from 'discord.js';
import { camStudyRoleId } from '../config.js';
import { logger } from '../logger.js';
import { removeCamStudyUser, upsertCamStudyUser } from '../repository/camStudyRepository.js';

const hasCamStudyRole = (member: GuildMember) => member.roles.cache.has(camStudyRoleId);

const getDisplayName = (member: GuildMember) => member.user.globalName ?? member.user.username ?? member.id;

const syncCamStudyMemberState = async (member: GuildMember) => {
  const userid = member.user.id;

  if (hasCamStudyRole(member)) {
    const username = getDisplayName(member);
    await upsertCamStudyUser({ userid, username });
    logger.info('cam study user synced from current role state', { userid, username, roleId: camStudyRoleId });
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
