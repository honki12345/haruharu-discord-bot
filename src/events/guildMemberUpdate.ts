import { Events, GuildMember } from 'discord.js';
import { logger } from '../logger.js';
import { syncCamStudyRoleMembership } from '../services/camStudyRoleSync.js';

export const event = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember) {
    try {
      await syncCamStudyRoleMembership(oldMember, newMember);
    } catch (error) {
      logger.error('guildMemberUpdate cam study sync failed', {
        error,
        newMemberId: newMember.id,
        oldMemberId: oldMember.id,
      });
    }
  },
};
