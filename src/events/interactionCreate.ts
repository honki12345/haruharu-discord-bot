import { Events, Collection, ChatInputCommandInteraction } from 'discord.js';
import { createRequire } from 'node:module';
import { MyClient } from '../index.js';

const jsonRequire = createRequire(import.meta.url);
const {
  noticeChannelId,
  vacancesRegisterChannelId,
  checkChannelId,
  testChannelId,
  camStudyRegisterChannelId,
} = jsonRequire('../../config.json');

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const command = (interaction.client as MyClient).commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found`);
      return;
    }

    const firedChannelId = interaction.channel?.id;
    const isValidChannelId = firedChannelId === noticeChannelId || firedChannelId === checkChannelId || firedChannelId === testChannelId || firedChannelId === camStudyRegisterChannelId || firedChannelId === vacancesRegisterChannelId;
    if (!isValidChannelId) {
      await interaction.reply({ content: 'no valid channel for command', ephemeral: true });
      return;
    }


    const { cooldowns } = (interaction.client as MyClient);

    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const defaultCooldownDuration = 3;
    const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1_000);
        return interaction.reply({
          content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction);
    } catch (e) {
      console.error(e);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  },
};
