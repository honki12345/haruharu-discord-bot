import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client, ClientOptions, Collection, GatewayIntentBits } from 'discord.js';
import { fileURLToPath } from 'url';
import { createRequire } from 'node:module';

const jsonRequire = createRequire(import.meta.url);
const config = jsonRequire('../config.json');

export class MyClient extends Client {
  cooldowns: Collection<string, Collection<string, number>>;
  commands: Collection<string, unknown>;

  constructor(options: ClientOptions) {
    super(options);
    this.cooldowns = new Collection();
    this.commands = new Collection();
  }
}

const client = new MyClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

client.cooldowns = new Collection();
client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  if (folder === 'utility') {
    continue;
  }

  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  console.log(commandFiles);
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // const command = require(filePath);
    console.log(`filePath: ${filePath}`);
    const { command } = await import(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if (command && 'data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`);
    }
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const { event } = await import(filePath);
  // const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.login(config.token);
