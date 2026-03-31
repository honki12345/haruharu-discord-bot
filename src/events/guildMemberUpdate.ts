import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import { logger } from '../logger.js';
import { syncWakeUpMemberProfile, syncWakeUpMemberState } from '../services/challengeSelfService.js';
import { syncCamStudyMemberState, syncCamStudyRoleMembership } from '../services/camStudyRoleSync.js';

export const event = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    try {
      if (oldMember.partial) {
        await Promise.all([syncWakeUpMemberState(newMember), syncCamStudyMemberState(newMember)]);
        return;
      }

      await Promise.all([
        syncWakeUpMemberProfile(oldMember, newMember),
        syncCamStudyRoleMembership(oldMember, newMember),
      ]);
    } catch (error) {
      logger.error('guildMemberUpdate member sync failed', {
        error,
        newMemberId: newMember.id,
        oldMemberId: oldMember.id,
      });
    }
  },
};
