import { Events, GuildMember } from 'discord.js';
import { logger } from '../logger.js';
import { handleCamStudyRoleChange } from '../services/camStudyRoleSync.js';

export const event = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember) {
    try {
      await handleCamStudyRoleChange(oldMember, newMember);
    } catch (error) {
      logger.error('cam study role sync failed', {
        error,
        newPartial: newMember.partial,
        oldPartial: oldMember.partial,
        userid: newMember.id,
      });
    }
  },
};
