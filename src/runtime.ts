import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ChatInputCommandInteraction,
  Client,
  ClientOptions,
  Collection,
  GatewayIntentBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
  cooldown?: number;
  allowedChannelIds?: string[];
}

interface EventModule {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<unknown> | unknown;
}

interface BootstrapClientOptions {
  login?: boolean;
  rootDir?: string;
  token?: string;
}

export class MyClient extends Client {
  cooldowns: Collection<string, Collection<string, number>>;
  commands: Collection<string, Command>;

  constructor(options: ClientOptions) {
    super(options);
    this.cooldowns = new Collection();
    this.commands = new Collection();
  }
}

const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeExtension = path.extname(fileURLToPath(import.meta.url));
const ignoredCommandDirectories = new Set(['utility']);

const getRuntimeFiles = (directoryPath: string) =>
  fs
    .readdirSync(directoryPath)
    .filter(file => file.endsWith(runtimeExtension) && !file.endsWith('.test.ts') && !file.endsWith('.test.js'));

const importModule = async <T>(filePath: string) => import(pathToFileURL(filePath).href) as Promise<T>;

export const createClient = (options?: ClientOptions) =>
  new MyClient({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
    ...options,
  });

export const loadCommandModules = async (rootDir = runtimeDirectory) => {
  const commands: Array<{ filePath: string; command?: Command }> = [];
  const foldersPath = path.join(rootDir, 'commands');
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    if (ignoredCommandDirectories.has(folder)) {
      continue;
    }

    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = getRuntimeFiles(commandsPath);

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const module = await importModule<{ command?: Command }>(filePath);
      commands.push({ filePath, command: module.command });
    }
  }

  return commands;
};

export const loadEventModules = async (rootDir = runtimeDirectory) => {
  const eventsPath = path.join(rootDir, 'events');
  const eventFiles = getRuntimeFiles(eventsPath);
  const events: Array<{ filePath: string; event?: EventModule }> = [];

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const module = await importModule<{ event?: EventModule }>(filePath);
    events.push({ filePath, event: module.event });
  }

  return events;
};

export const loadCommands = async (client: MyClient, rootDir = runtimeDirectory) => {
  const commandModules = await loadCommandModules(rootDir);

  for (const { filePath, command } of commandModules) {
    if (command && 'data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      continue;
    }

    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`);
  }

  return client;
};

export const registerEvents = async (client: MyClient, rootDir = runtimeDirectory) => {
  const eventModules = await loadEventModules(rootDir);

  for (const { event } of eventModules) {
    if (!event) {
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  return client;
};

export const getSlashCommandPayloads = async (rootDir = runtimeDirectory) => {
  const commandModules = await loadCommandModules(rootDir);

  return commandModules.flatMap(({ filePath, command }) => {
    if (command && 'data' in command && 'execute' in command) {
      return [command.data.toJSON()];
    }

    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property`);
    return [];
  });
};

export const bootstrapClient = async ({
  login = false,
  rootDir = runtimeDirectory,
  token,
}: BootstrapClientOptions = {}) => {
  const client = createClient();

  await loadCommands(client, rootDir);
  await registerEvents(client, rootDir);

  if (login) {
    if (!token) {
      throw new Error('A Discord token is required when login=true');
    }

    await client.login(token);
  }

  return client;
};
