import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, GatewayIntentBits, TextChannel, ChannelType } from 'discord.js';

/**
 * Discord.js 통합 테스트
 *
 * 필요한 환경 변수:
 * - DISCORD_TOKEN: Discord 봇 토큰 (GitHub Secrets)
 * - TEST_CHANNEL_ID: 테스트용 채널 ID (GitHub Variables)
 * - TEST_GUILD_ID: 테스트용 서버 ID (GitHub Variables)
 */

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TEST_CHANNEL_ID = process.env.TEST_CHANNEL_ID;
const TEST_GUILD_ID = process.env.TEST_GUILD_ID;

// 환경 변수가 없으면 테스트 스킵
const shouldSkip = !DISCORD_TOKEN || !TEST_CHANNEL_ID || !TEST_GUILD_ID;

describe.skipIf(shouldSkip)('Discord.js 통합 테스트', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    await client.login(DISCORD_TOKEN);

    // Ready 이벤트 대기
    await new Promise<void>(resolve => {
      if (client.isReady()) {
        resolve();
      } else {
        client.once('ready', () => resolve());
      }
    });
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.destroy();
    }
  });

  describe('봇 연결/로그인 테스트', () => {
    it('봇이 정상적으로 로그인되어야 한다', () => {
      expect(client.isReady()).toBe(true);
    });

    it('봇 사용자 정보가 존재해야 한다', () => {
      expect(client.user).toBeDefined();
      expect(client.user?.tag).toBeDefined();
    });

    it('테스트 서버에 접근할 수 있어야 한다', () => {
      const guild = client.guilds.cache.get(TEST_GUILD_ID!);
      expect(guild).toBeDefined();
    });
  });

  describe('채널 메시지 전송 테스트', () => {
    it('테스트 채널에 접근할 수 있어야 한다', async () => {
      const channel = await client.channels.fetch(TEST_CHANNEL_ID!);
      expect(channel).toBeDefined();
      expect(channel?.type).toBe(ChannelType.GuildText);
    });

    it('테스트 채널에 메시지를 전송할 수 있어야 한다', async () => {
      const channel = (await client.channels.fetch(TEST_CHANNEL_ID!)) as TextChannel;
      expect(channel).toBeDefined();

      const testMessage = `[테스트] 통합 테스트 메시지 - ${new Date().toISOString()}`;
      const sentMessage = await channel.send(testMessage);

      expect(sentMessage).toBeDefined();
      expect(sentMessage.content).toBe(testMessage);

      // 테스트 메시지 삭제 (cleanup)
      await sentMessage.delete();
    });

    it('임베드 메시지를 전송할 수 있어야 한다', async () => {
      const channel = (await client.channels.fetch(TEST_CHANNEL_ID!)) as TextChannel;

      const sentMessage = await channel.send({
        embeds: [
          {
            title: '통합 테스트 임베드',
            description: '테스트 설명',
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      expect(sentMessage.embeds).toHaveLength(1);
      expect(sentMessage.embeds[0].title).toBe('통합 테스트 임베드');

      await sentMessage.delete();
    });
  });

  describe('슬래시 커맨드 테스트', () => {
    it('봇의 application id가 존재해야 한다', () => {
      expect(client.application).toBeDefined();
      expect(client.application?.id).toBeDefined();
    });

    it('테스트 서버에서 등록된 커맨드를 조회할 수 있어야 한다', async () => {
      const guild = client.guilds.cache.get(TEST_GUILD_ID!);
      expect(guild).toBeDefined();

      const commands = await guild!.commands.fetch();
      expect(commands).toBeDefined();
      // 커맨드가 등록되어 있으면 size > 0
      // 등록된 커맨드가 없을 수도 있으므로 존재 여부만 확인
    });

    it('ping 커맨드가 등록되어 있어야 한다 (선택적)', async () => {
      const guild = client.guilds.cache.get(TEST_GUILD_ID!);
      const commands = await guild!.commands.fetch();

      const pingCommand = commands.find(cmd => cmd.name === 'ping');
      // ping 커맨드가 있으면 확인, 없으면 스킵
      if (pingCommand) {
        expect(pingCommand.name).toBe('ping');
        expect(pingCommand.description).toBe('Replies with Pong!');
      }
    });
  });
});
