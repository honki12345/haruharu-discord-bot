import { REST, Routes } from 'discord.js';
import { clientId, guildId, token } from './deployConfig.js';
import { getSlashCommandPayloads } from './runtime.js';

const commands = await getSlashCommandPayloads();

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

    if (data !== null && typeof data === 'object' && 'length' in data) {
      console.log(`Successfully reloaded ${data.length} application (/) commands`);
    }
  } catch (e) {
    // And of course, make sure you catch and log any errors
    console.error(e);
  }
})();
