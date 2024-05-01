const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('../../../config.json');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  if (folder === 'utility') {
    continue;
  }

  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`);
    }
  }
}


// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands`);
  } catch (e) {
    // And of course, make sure you catch and log any errors
    console.error(e);
  }
})();