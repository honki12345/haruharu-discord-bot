import { Events, Collection, type Interaction } from 'discord.js';
import { commandChannelIds } from '../config.js';
import type { MyClient } from '../runtime.js';

const buildInvalidChannelMessage = (commandName: string) => {
  if (commandName === 'apply-wakeup' || commandName === 'apply-cam') {
    return '`#start-here`에서만 사용할 수 있어요. 질문은 `#qna`를 이용해 주세요.';
  }

  return '이 명령어는 이 채널에서 사용할 수 없어요.';
};

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if ('isButton' in interaction && typeof interaction.isButton === 'function' && interaction.isButton()) {
      const { handleSelfServiceDemoButtonInteraction, isSelfServiceDemoButtonCustomId } =
        await import('../services/selfServiceOnboardingDemo.js');
      if (isSelfServiceDemoButtonCustomId(interaction.customId)) {
        await handleSelfServiceDemoButtonInteraction(interaction);
        return;
      }

      const { handleSelfServiceOnboardingButtonInteraction, isSelfServiceOnboardingButtonCustomId } =
        await import('../services/selfServiceOnboarding.js');
      if (isSelfServiceOnboardingButtonCustomId(interaction.customId)) {
        await handleSelfServiceOnboardingButtonInteraction(interaction);
      }
      return;
    }

    if (
      'isModalSubmit' in interaction &&
      typeof interaction.isModalSubmit === 'function' &&
      interaction.isModalSubmit()
    ) {
      const { handleSelfServiceDemoModalSubmitInteraction, isSelfServiceDemoModalCustomId } =
        await import('../services/selfServiceOnboardingDemo.js');
      if (isSelfServiceDemoModalCustomId(interaction.customId)) {
        await handleSelfServiceDemoModalSubmitInteraction(interaction);
        return;
      }

      const { handleSelfServiceOnboardingModalSubmitInteraction, isSelfServiceOnboardingModalCustomId } =
        await import('../services/selfServiceOnboarding.js');
      if (isSelfServiceOnboardingModalCustomId(interaction.customId)) {
        await handleSelfServiceOnboardingModalSubmitInteraction(interaction);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = (interaction.client as MyClient).commands.get(interaction.commandName);

    if (!command) {
      if (interaction.commandName === 'apply-wakeup') {
        await interaction.reply({
          content: '`/apply-wakeup`는 더 이상 사용되지 않습니다. `/register`에서 기상시간을 입력해 참여해 주세요.',
          ephemeral: true,
        });
        return;
      }

      console.error(`No command matching ${interaction.commandName} was found`);
      return;
    }

    const firedChannelId = interaction.channel?.id;
    const allowedChannelIds = command.allowedChannelIds ?? Array.from(commandChannelIds);
    const isValidChannelId = firedChannelId ? allowedChannelIds.includes(firedChannelId) : false;
    if (!isValidChannelId) {
      await interaction.reply({
        content: buildInvalidChannelMessage(command.data.name),
        ephemeral: true,
      });
      return;
    }

    const { cooldowns } = interaction.client as MyClient;

    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const defaultCooldownDuration = 3;
    const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

    if (!timestamps) return;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = (timestamps.get(interaction.user.id) ?? 0) + cooldownAmount;

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
