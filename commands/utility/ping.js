const { SlashCommandBuilder } = require('discord.js');
const { channelId } = require('../../config.json');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('image file')
        .setRequired(true),
    ),
  async execute(interaction) {
    console.dir(interaction.user);

    // await interaction.reply('Pang');
    await interaction.reply({ content: 'success2', ephemeral: true });
    const attachment = interaction.options.getAttachment('image');
    // TODO contentType: 'image/png',: file validation
    console.debug(attachment);
    await interaction.channel.send({
      files: [{
        attachment: attachment?.attachment,
        name: 'chart.png',
      }],
      content: `file upload`,
    });
  },
};
