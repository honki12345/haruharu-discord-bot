import { GuildMember } from 'discord.js';
import { camStudyRoleId } from '../config.js';
import { logger } from '../logger.js';
import { removeCamStudyUser, upsertCamStudyUser } from '../repository/camStudyRepository.js';

const hasCamStudyRole = (member: GuildMember) => member.roles.cache.has(camStudyRoleId);

const getDisplayName = (member: GuildMember) => member.user.globalName ?? member.user.username ?? member.id;

const syncCamStudyRoleMembership = async (oldMember: GuildMember, newMember: GuildMember) => {
  const hadCamStudyRole = hasCamStudyRole(oldMember);
  const hasCamStudyRoleNow = hasCamStudyRole(newMember);

  if (hadCamStudyRole === hasCamStudyRoleNow) {
    return;
  }

  const userid = newMember.user.id;

  if (hasCamStudyRoleNow) {
    const username = getDisplayName(newMember);
    await upsertCamStudyUser({ userid, username });
    logger.info('cam study user synced from role grant', { userid, username, roleId: camStudyRoleId });
    return;
  }

  await removeCamStudyUser(userid);
  logger.info('cam study user removed after role revoke', { userid, roleId: camStudyRoleId });
};

export { syncCamStudyRoleMembership };
