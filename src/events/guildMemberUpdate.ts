import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import { logger } from '../logger.js';
import { syncCamStudyMemberState, syncCamStudyRoleMembership } from '../services/camStudyRoleSync.js';

export const event = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    try {
      if (oldMember.partial) {
        await syncCamStudyMemberState(newMember);
        return;
      }

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
