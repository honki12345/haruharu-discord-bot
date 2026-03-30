import { describe, expect, it, vi } from 'vitest';

vi.mock('node:module', async importOriginal => {
  const original = await importOriginal<typeof import('node:module')>();
  return {
    ...original,
    createRequire: () => (path: string) => {
      if (path.includes('config.json')) {
        return {
          token: 'test-token',
          clientId: 'test-client-id',
          guildId: 'test-guild-id',
          databaseUser: 'test-db-user',
          password: 'test-db-password',
          checkChannelId: 'valid-channel-id',
          testChannelId: 'valid-test-channel-id',
          voiceChannelId: 'valid-voice-channel-id',
          logChannelId: 'valid-log-channel-id',
          resultChannelId: 'valid-result-channel-id',
          startHereChannelId: 'valid-start-here-channel-id',
          timeStartHereChannelId: 'valid-time-start-here-channel-id',
          wakeUpRoleId: 'valid-wake-up-role-id',
          camStudyRoleId: 'valid-cam-study-role-id',
        };
      }
      return original.createRequire(import.meta.url)(path);
    },
  };
});

const commandSpecs = [
  {
    modulePath: '../commands/haruharu/register.js',
    baseName: 'register',
    koName: '기상등록',
    koDescription: '자신의 기상시간을 등록하거나 수정합니다',
    category: 'user',
    options: [{ name: 'waketime', koName: '기상시간', koDescription: '기상시간을 입력합니다 (HHmm 또는 HH:mm)' }],
  },
  {
    modulePath: '../commands/haruharu/apply-vacation.js',
    baseName: 'apply-vacation',
    koName: '휴가신청',
    koDescription: '특정 날짜에 사용할 휴가를 신청합니다',
    category: 'user',
    options: [{ name: 'date', koName: '날짜', koDescription: '휴가 날짜를 입력합니다 (yyyymmdd)' }],
  },
  {
    modulePath: '../commands/haruharu/stop-wakeup.js',
    baseName: 'stop-wakeup',
    koName: '기상중단',
    koDescription: '기상스터디 참여를 중단합니다',
    category: 'user',
    options: [],
  },
  {
    modulePath: '../commands/haruharu/apply-cam.js',
    baseName: 'apply-cam',
    koName: '캠스터디신청',
    koDescription: '캠스터디 참여를 신청합니다',
    category: 'user',
    options: [],
  },
  {
    modulePath: '../commands/haruharu/add-vacances.js',
    baseName: 'add-vacances',
    koName: 'admin-휴가추가',
    koDescription: '관리자가 대상 사용자의 월별 휴가일수를 추가합니다',
    category: 'admin',
    options: [
      { name: 'userid', koName: '사용자id', koDescription: '대상 Discord 사용자 ID를 입력합니다' },
      { name: 'yearmonth', koName: '년월', koDescription: '대상 년월을 입력합니다 (yyyymm)' },
      { name: 'count', koName: '추가일수', koDescription: '추가할 휴가 일수를 입력합니다' },
    ],
  },
  {
    modulePath: '../commands/haruharu/delete.js',
    baseName: 'delete',
    koName: 'admin-챌린저삭제',
    koDescription: '관리자가 기상 챌린지 사용자를 삭제합니다',
    category: 'admin',
    options: [
      { name: 'userid', koName: '사용자id', koDescription: '대상 Discord 사용자 ID를 입력합니다' },
      { name: 'yearmonth', koName: '년월', koDescription: '대상 년월을 입력합니다 (yyyymm)' },
    ],
  },
  {
    modulePath: '../commands/haruharu/demo-daily-message.js',
    baseName: 'demo-daily-message',
    koName: 'admin-demo-출석생성',
    koDescription: '관리자가 테스트 채널에 데일리 출석 메시지와 데모 쓰레드를 생성합니다',
    category: 'admin-demo',
    options: [],
  },
  {
    modulePath: '../commands/haruharu/demo-self-service-ui.js',
    baseName: 'demo-self-service-ui',
    koName: 'admin-demo-셀프서비스ui',
    koDescription: '관리자가 테스트 채널에 셀프서비스 버튼 UI 데모 메시지를 게시합니다',
    category: 'admin-demo',
    options: [],
  },
  {
    modulePath: '../commands/haruharu/ping.js',
    baseName: 'ping',
    koName: 'admin-상태확인',
    koDescription: '관리자가 봇 응답 상태를 확인합니다',
    category: 'admin',
    options: [],
  },
] as const;

describe('슬래시 커맨드 한국어 localization', () => {
  it('활성 커맨드는 기본 key를 유지하고 한국어 표시명을 제공한다', async () => {
    for (const spec of commandSpecs) {
      const { command } = await import(spec.modulePath);
      const json = command.data.toJSON();

      expect(json.name).toBe(spec.baseName);
      expect(json.name_localizations?.ko).toBe(spec.koName);
      expect(json.description_localizations?.ko).toBe(spec.koDescription);
    }
  });

  it('옵션 localization은 기존 option key를 유지한다', async () => {
    for (const spec of commandSpecs) {
      const { command } = await import(spec.modulePath);
      const json = command.data.toJSON();

      for (const expectedOption of spec.options) {
        const option = json.options?.find(candidate => candidate.name === expectedOption.name);
        expect(option).toBeDefined();
        expect(option?.name).toBe(expectedOption.name);
        expect(option?.name_localizations?.ko).toBe(expectedOption.koName);
        expect(option?.description_localizations?.ko).toBe(expectedOption.koDescription);
      }
    }
  });

  it('관리자 커맨드는 admin 접두어, 데모 커맨드는 admin-demo 접두어를 사용한다', async () => {
    const adminExpected = commandSpecs.filter(spec => spec.category === 'admin' || spec.category === 'admin-demo');

    for (const spec of adminExpected) {
      const { command } = await import(commandSpecs.find(item => item.baseName === spec.baseName)!.modulePath);
      const json = command.data.toJSON();
      const localizedName = json.name_localizations?.ko ?? '';

      if (spec.category === 'admin-demo') {
        expect(localizedName.startsWith('admin-demo-')).toBe(true);
      } else {
        expect(localizedName.startsWith('admin-')).toBe(true);
      }
    }
  });
});
