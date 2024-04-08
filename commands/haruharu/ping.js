const { SlashCommandBuilder } = require('discord.js');
const { PERMISSION_NUM_ADMIN } = require('../../utils');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .setDefaultMemberPermissions(PERMISSION_NUM_ADMIN),

  async execute(interaction) {
    // await interaction.reply('Pang');
    await interaction.reply({ content: 'ping success', ephemeral: true });
  },
};
