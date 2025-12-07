import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  testSequelize,
  setupTestDB,
  teardownTestDB,
  clearAllTables,
  TestUsers,
  TestTimeLog,
  TestCamStudyUsers,
  TestCamStudyTimeLog,
} from './setup.js';

describe('Repository 모델 테스트 (인메모리 DB)', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearAllTables();
  });

  describe('Users 모델', () => {
    describe('US-1: 챌린저 등록', () => {
      it('TC-R01: 신규 사용자를 등록할 수 있다', async () => {
        const user = await TestUsers.create({
          userid: 'user123',
          username: '홍길동',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 0,
        });

        expect(user.id).toBeDefined();
        expect(user.userid).toBe('user123');
        expect(user.username).toBe('홍길동');
        expect(user.waketime).toBe('0700');
        expect(user.vacances).toBe(5);
      });

      it('TC-R02: 기존 사용자 정보를 업데이트할 수 있다', async () => {
        await TestUsers.create({
          userid: 'user123',
          username: '홍길동',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 0,
        });

        const [affectedCount] = await TestUsers.update({ waketime: '0800' }, { where: { userid: 'user123' } });

        expect(affectedCount).toBe(1);

        const updated = await TestUsers.findOne({ where: { userid: 'user123' } });
        expect(updated?.waketime).toBe('0800');
      });

      it('userid와 yearmonth로 사용자를 조회할 수 있다', async () => {
        await TestUsers.create({
          userid: 'user123',
          username: '홍길동',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 0,
        });

        const user = await TestUsers.findOne({
          where: { userid: 'user123', yearmonth: '202512' },
        });

        expect(user).not.toBeNull();
        expect(user?.username).toBe('홍길동');
      });

      it('등록되지 않은 사용자는 null을 반환한다', async () => {
        const user = await TestUsers.findOne({
          where: { userid: 'nonexistent', yearmonth: '202512' },
        });

        expect(user).toBeNull();
      });
    });

    describe('US-4: 휴가 추가', () => {
      it('TC-V01: 휴가일수를 추가할 수 있다', async () => {
        await TestUsers.create({
          userid: 'user123',
          username: '홍길동',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 0,
        });

        const user = await TestUsers.findOne({ where: { userid: 'user123' } });
        const currentVacances = user!.vacances;

        await TestUsers.update({ vacances: currentVacances + 2 }, { where: { userid: 'user123' } });

        const updated = await TestUsers.findOne({ where: { userid: 'user123' } });
        expect(updated?.vacances).toBe(7);
      });
    });

    describe('US-5/6: 출석 카운트', () => {
      it('TC-DR05: 결석 카운트를 증가시킬 수 있다', async () => {
        await TestUsers.create({
          userid: 'user123',
          username: '홍길동',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 0,
        });

        await TestUsers.increment('absencecount', { where: { userid: 'user123' } });

        const user = await TestUsers.findOne({ where: { userid: 'user123' } });
        expect(user?.absencecount).toBe(1);
      });

      it('TC-DR06: 지각 카운트를 증가시킬 수 있다', async () => {
        await TestUsers.create({
          userid: 'user123',
          username: '홍길동',
          yearmonth: '202512',
          waketime: '0700',
          vacances: 5,
          latecount: 0,
          absencecount: 0,
        });

        await TestUsers.increment('latecount', { where: { userid: 'user123' } });

        const user = await TestUsers.findOne({ where: { userid: 'user123' } });
        expect(user?.latecount).toBe(1);
      });

      it('TC-HF02: 삼진아웃 (absencecount >= 3) 사용자를 필터링할 수 있다', async () => {
        await TestUsers.bulkCreate([
          {
            userid: 'user1',
            username: '홍길동',
            yearmonth: '202512',
            waketime: '0700',
            vacances: 5,
            latecount: 0,
            absencecount: 2,
          },
          {
            userid: 'user2',
            username: '김철수',
            yearmonth: '202512',
            waketime: '0700',
            vacances: 5,
            latecount: 0,
            absencecount: 3,
          },
          {
            userid: 'user3',
            username: '이영희',
            yearmonth: '202512',
            waketime: '0700',
            vacances: 5,
            latecount: 0,
            absencecount: 0,
          },
        ]);

        const { Op } = await import('sequelize');
        const completers = await TestUsers.findAll({
          where: { absencecount: { [Op.lt]: 3 } },
        });

        expect(completers.length).toBe(2);
        expect(completers.map(u => u.username)).toContain('홍길동');
        expect(completers.map(u => u.username)).toContain('이영희');
        expect(completers.map(u => u.username)).not.toContain('김철수');
      });
    });
  });

  describe('TimeLog 모델', () => {
    describe('US-2: 체크인', () => {
      it('TC-CI01: 체크인 기록을 생성할 수 있다', async () => {
        const log = await TestTimeLog.create({
          userid: 'user123',
          username: '홍길동',
          yearmonthday: '20251207',
          checkintime: '0705',
          checkouttime: null,
          isintime: true,
        });

        expect(log.id).toBeDefined();
        expect(log.checkintime).toBe('0705');
        expect(log.isintime).toBe(true);
      });

      it('TC-CI08: 중복 체크인 여부를 확인할 수 있다', async () => {
        await TestTimeLog.create({
          userid: 'user123',
          username: '홍길동',
          yearmonthday: '20251207',
          checkintime: '0705',
          checkouttime: null,
          isintime: true,
        });

        const timelogs = await TestTimeLog.findAll({
          where: { yearmonthday: '20251207', userid: 'user123' },
        });
        const isDuplicated = timelogs.some(log => log.checkintime !== null);

        expect(isDuplicated).toBe(true);
      });

      it('TC-CI03: 지각 체크인을 기록할 수 있다', async () => {
        const log = await TestTimeLog.create({
          userid: 'user123',
          username: '홍길동',
          yearmonthday: '20251207',
          checkintime: '0715',
          checkouttime: null,
          isintime: false,
        });

        expect(log.isintime).toBe(false);
      });
    });

    describe('US-3: 체크아웃', () => {
      it('TC-CO02: 체크인 기록이 없으면 조회 결과가 없다', async () => {
        const timelog = await TestTimeLog.findOne({
          where: { yearmonthday: '20251207', userid: 'user123' },
        });

        expect(timelog).toBeNull();
      });

      it('TC-CO01: 체크아웃 시간을 업데이트할 수 있다', async () => {
        await TestTimeLog.create({
          userid: 'user123',
          username: '홍길동',
          yearmonthday: '20251207',
          checkintime: '0700',
          checkouttime: null,
          isintime: true,
        });

        await TestTimeLog.update({ checkouttime: '0800' }, { where: { yearmonthday: '20251207', userid: 'user123' } });

        const updated = await TestTimeLog.findOne({
          where: { yearmonthday: '20251207', userid: 'user123' },
        });

        expect(updated?.checkouttime).toBe('0800');
      });

      it('TC-CO03: 이미 체크아웃한 기록을 확인할 수 있다', async () => {
        await TestTimeLog.create({
          userid: 'user123',
          username: '홍길동',
          yearmonthday: '20251207',
          checkintime: '0700',
          checkouttime: '0800',
          isintime: true,
        });

        const timelog = await TestTimeLog.findOne({
          where: { yearmonthday: '20251207', userid: 'user123' },
        });

        expect(timelog?.checkouttime).not.toBeNull();
      });
    });

    describe('US-5: 일일 출석 리포트', () => {
      it('특정 날짜의 모든 TimeLog를 조회할 수 있다', async () => {
        await TestTimeLog.bulkCreate([
          {
            userid: 'user1',
            username: '홍길동',
            yearmonthday: '20251206',
            checkintime: '0700',
            checkouttime: '0800',
            isintime: true,
          },
          {
            userid: 'user2',
            username: '김철수',
            yearmonthday: '20251206',
            checkintime: '0715',
            checkouttime: '0815',
            isintime: false,
          },
          {
            userid: 'user3',
            username: '이영희',
            yearmonthday: '20251207',
            checkintime: '0700',
            checkouttime: null,
            isintime: true,
          },
        ]);

        const yesterdayLogs = await TestTimeLog.findAll({
          where: { yearmonthday: '20251206' },
        });

        expect(yesterdayLogs.length).toBe(2);
      });

      it('출석/지각/결석 분류가 가능하다', async () => {
        await TestTimeLog.bulkCreate([
          {
            userid: 'user1',
            username: '출석자',
            yearmonthday: '20251206',
            checkintime: '0700',
            checkouttime: '0800',
            isintime: true,
          },
          {
            userid: 'user2',
            username: '지각자',
            yearmonthday: '20251206',
            checkintime: '0715',
            checkouttime: '0815',
            isintime: false,
          },
        ]);

        const logs = await TestTimeLog.findAll({ where: { yearmonthday: '20251206' } });

        const onTime = logs.filter(l => l.checkintime && l.checkouttime && l.isintime);
        const late = logs.filter(l => l.checkintime && l.checkouttime && !l.isintime);

        expect(onTime.length).toBe(1);
        expect(late.length).toBe(1);
        expect(onTime[0].username).toBe('출석자');
        expect(late[0].username).toBe('지각자');
      });
    });
  });

  describe('CamStudyUsers 모델', () => {
    describe('US-7: 캠스터디 등록', () => {
      it('TC-RC01: 캠스터디 사용자를 등록할 수 있다', async () => {
        const user = await TestCamStudyUsers.create({
          userid: 'cam_user1',
          username: '홍길동',
        });

        expect(user.id).toBeDefined();
        expect(user.userid).toBe('cam_user1');
        expect(user.username).toBe('홍길동');
      });

      it('TC-RC02: 이미 등록된 사용자인지 확인할 수 있다', async () => {
        await TestCamStudyUsers.create({
          userid: 'cam_user1',
          username: '홍길동',
        });

        const existing = await TestCamStudyUsers.findOne({
          where: { userid: 'cam_user1' },
        });

        expect(existing).not.toBeNull();
      });
    });

    describe('US-11: 캠스터디 탈퇴', () => {
      it('TC-DC01: 캠스터디 사용자를 삭제할 수 있다', async () => {
        await TestCamStudyUsers.create({
          userid: 'cam_user1',
          username: '홍길동',
        });

        await TestCamStudyUsers.destroy({ where: { userid: 'cam_user1' } });

        const deleted = await TestCamStudyUsers.findOne({
          where: { userid: 'cam_user1' },
        });

        expect(deleted).toBeNull();
      });
    });
  });

  describe('CamStudyTimeLog 모델', () => {
    describe('US-8: 학습 시간 자동 추적', () => {
      it('TC-CS01: 학습 시작 시 타임로그를 생성할 수 있다', async () => {
        const timestamp = Date.now().toString();

        const log = await TestCamStudyTimeLog.create({
          userid: 'cam_user1',
          username: '홍길동',
          yearmonthday: '20251207',
          timestamp: timestamp,
          totalminutes: 0,
        });

        expect(log.id).toBeDefined();
        expect(log.totalminutes).toBe(0);
      });

      it('TC-CS05: 학습 종료 시 시간을 업데이트할 수 있다', async () => {
        const startTimestamp = Date.now().toString();

        await TestCamStudyTimeLog.create({
          userid: 'cam_user1',
          username: '홍길동',
          yearmonthday: '20251207',
          timestamp: startTimestamp,
          totalminutes: 0,
        });

        // 45분 학습 후 종료
        const studyMinutes = 45;
        await TestCamStudyTimeLog.update(
          {
            timestamp: Date.now().toString(),
            totalminutes: studyMinutes,
          },
          { where: { userid: 'cam_user1', yearmonthday: '20251207' } },
        );

        const updated = await TestCamStudyTimeLog.findOne({
          where: { userid: 'cam_user1', yearmonthday: '20251207' },
        });

        expect(updated?.totalminutes).toBe(45);
      });

      it('여러 세션의 학습 시간을 누적할 수 있다', async () => {
        await TestCamStudyTimeLog.create({
          userid: 'cam_user1',
          username: '홍길동',
          yearmonthday: '20251207',
          timestamp: Date.now().toString(),
          totalminutes: 30,
        });

        const log = await TestCamStudyTimeLog.findOne({
          where: { userid: 'cam_user1', yearmonthday: '20251207' },
        });

        const currentMinutes = log!.totalminutes;
        const additionalMinutes = 45;

        await TestCamStudyTimeLog.update(
          { totalminutes: currentMinutes + additionalMinutes },
          { where: { userid: 'cam_user1', yearmonthday: '20251207' } },
        );

        const updated = await TestCamStudyTimeLog.findOne({
          where: { userid: 'cam_user1', yearmonthday: '20251207' },
        });

        expect(updated?.totalminutes).toBe(75);
      });
    });

    describe('US-9: 일간 학습 시간 리포트', () => {
      it('TC-CDR01: 학습 시간 기준 내림차순 정렬이 가능하다', async () => {
        await TestCamStudyTimeLog.bulkCreate([
          {
            userid: 'user1',
            username: '홍길동',
            yearmonthday: '20251207',
            timestamp: Date.now().toString(),
            totalminutes: 330, // 5시간 30분
          },
          {
            userid: 'user2',
            username: '김철수',
            yearmonthday: '20251207',
            timestamp: Date.now().toString(),
            totalminutes: 255, // 4시간 15분
          },
          {
            userid: 'user3',
            username: '이영희',
            yearmonthday: '20251207',
            timestamp: Date.now().toString(),
            totalminutes: 180, // 3시간
          },
        ]);

        const ranking = await TestCamStudyTimeLog.findAll({
          where: { yearmonthday: '20251207' },
          order: [['totalminutes', 'DESC']],
        });

        expect(ranking.length).toBe(3);
        expect(ranking[0].username).toBe('홍길동');
        expect(ranking[1].username).toBe('김철수');
        expect(ranking[2].username).toBe('이영희');
      });
    });
  });

  describe('DB 연결 상태', () => {
    it('인메모리 DB 연결이 정상이다', async () => {
      await expect(testSequelize.authenticate()).resolves.not.toThrow();
    });
  });
});
