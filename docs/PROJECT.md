# 하루하루 Discord Bot

## 프로젝트 개요

**하루하루**는 스터디 그룹의 출석 관리와 학습 시간 추적을 위한 Discord 봇입니다.

### 제공 가치

| 가치                 | 설명                                               |
| -------------------- | -------------------------------------------------- |
| **습관 형성**        | 매일 정해진 시간에 기상하는 습관을 만들어 줍니다   |
| **책임감 부여**      | 그룹 내 출석 공개로 자연스러운 동기 부여           |
| **학습 시간 가시화** | 캠스터디를 통해 실제 공부 시간을 객관적으로 측정   |
| **자동화된 관리**    | 수동 집계 없이 매일 자동으로 출석/학습 현황 리포트 |

### 핵심 기능

| 기능            | 설명                                                    |
| --------------- | ------------------------------------------------------- |
| **기상 챌린지** | 매일 정해진 시간에 기상하여 인증샷을 올리는 월간 챌린지 |
| **캠스터디**    | Discord 음성 채널에서 카메라를 켜고 공부하는 시간 추적  |

---

## 프로젝트 구조

```
haruharu-discord-bot/
├── src/
│   ├── index.ts                 # 봇 진입점, 커맨드/이벤트 로더
│   ├── config.ts                # 런타임 설정 로더
│   ├── deployConfig.ts          # 슬래시 커맨드 배포용 최소 설정 로더
│   ├── logger.ts                # Winston 로깅 설정
│   ├── attendance.ts            # 출석 판정 및 이모지 유틸리티
│   ├── daily-attendance.ts      # 운영 daily message/thread 생성 및 재탐색 유틸리티
│   ├── daily-message.ts         # daily message 질문 풀과 랜덤 선택 유틸리티
│   ├── utils.ts                 # 분리된 유틸 모듈 배럴 export
│   ├── deploy-commands.ts       # 슬래시 커맨드 등록
│   │
│   ├── commands/
│   │   └── haruharu/
│   │       ├── register.ts      # 사용자 기상 챌린지 등록/수정
│   │       ├── apply-vacation.ts # 사용자 휴가 등록
│   │       ├── add-vacances.ts  # 휴가 추가
│   │       ├── delete.ts        # 챌린저 삭제
│   │       ├── register-cam.ts  # 캠스터디 등록
│   │       ├── delete-cam.ts    # 캠스터디 삭제
│   │       ├── demo-daily-message.ts # 테스트 채널 daily message 데모
│   │       └── ping.ts          # 헬스체크
│   │
│   ├── events/
│   │   ├── ready.ts             # 봇 시작, DB 동기화, 리포트 스케줄러 등록
│   │   ├── interactionCreate.ts # 슬래시 커맨드 핸들러
│   │   ├── messageCreate.ts     # 출석 demo thread 댓글 감지
│   │   └── camStudyHandler.ts   # 음성 채널 상태 감지 및 캠스터디 서비스 위임
│   │
│   ├── services/
│   │   ├── attendance.ts        # check-in/check-out 공통 처리
│   │   ├── challengeSelfService.ts # 사용자 기상시간/휴가 self-service 정책 처리
│   │   ├── camStudy.ts          # 음성 상태 전이 해석 및 학습 시간 반영
│   │   └── reporting.ts         # 일일/주간 리포트 생성 및 스케줄링
│   │
│   └── repository/
│       ├── config.ts            # Sequelize 설정
│       ├── Users.ts             # 챌린저 모델
│       ├── AttendanceLog.ts     # thread 기반 하루 1회 출석 로그 모델
│       ├── VacationLog.ts       # 사용자 휴가 사용 기록 모델
│       ├── TimeLog.ts           # 출석 로그 모델
│       ├── WaketimeChangeLog.ts # 사용자 기상시간 변경 이력 모델
│       ├── CamStudyUsers.ts     # 캠스터디 참가자 모델
│       ├── CamStudyTimeLog.ts   # 일간 학습 로그 모델
│       ├── CamStudyWeeklyTimeLog.ts # 주간 학습 로그 모델
│       ├── challengeRepository.ts   # 기상 챌린지 조회/갱신 헬퍼
│       └── camStudyRepository.ts    # 캠스터디 조회/갱신 헬퍼
│
├── docs/
│   ├── PROJECT.md               # 프로젝트 문서 (현재 파일)
│   ├── USER_STORIES.md          # 사용자 스토리 및 시퀀스 다이어그램
│   ├── plan/                    # 이슈별 구현 계획 문서
│   └── COMMIT_CONVENTION.md     # 커밋 컨벤션
│
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI
│
├── logs/                        # 일별 로테이션 로그
├── dist/                        # 컴파일된 JavaScript
├── database.sqlite              # SQLite 데이터베이스
├── config.json                  # 봇 설정 (토큰, 채널 ID 등)
├── package.json                 # 의존성 및 스크립트
├── tsconfig.json                # TypeScript 설정
├── eslint.config.js             # ESLint 설정
└── .prettierrc                  # Prettier 설정
```

---

## 모듈 상세

### Commands (슬래시 커맨드)

#### 기상 챌린지 커맨드

| 커맨드            | 권한   | 설명                                 |
| ----------------- | ------ | ------------------------------------ |
| `/register`       | 사용자 | 자신의 현재 월 기상 챌린지 등록/수정 |
| `/apply-vacation` | 사용자 | 자신의 특정 날짜 휴가 등록           |
| `/add-vacances`   | 관리자 | 휴가일수 추가                        |
| `/delete`         | 관리자 | 챌린저 삭제                          |

#### 캠스터디 커맨드

| 커맨드          | 권한   | 설명          |
| --------------- | ------ | ------------- |
| `/register-cam` | 관리자 | 캠스터디 등록 |
| `/delete-cam`   | 관리자 | 캠스터디 삭제 |

#### 유틸리티 커맨드

| 커맨드                | 권한   | 설명                                                                   |
| --------------------- | ------ | ---------------------------------------------------------------------- |
| `/ping`               | 관리자 | 봇 상태 확인                                                           |
| `/demo-daily-message` | 관리자 | 테스트 채널에 랜덤 질문이 포함된 daily message + 출석 demo thread 생성 |

---

### 커맨드 파라미터 상세

#### `/register`

| 파라미터 | 필수 | 설명                       |
| -------- | ---- | -------------------------- |
| waketime | O    | 기상시간 (HHmm, 0500~0900) |

#### `/apply-vacation`

| 파라미터 | 필수 | 설명                      |
| -------- | ---- | ------------------------- |
| date     | O    | 휴가 대상 날짜 (yyyymmdd) |

#### `/add-vacances`

| 파라미터  | 필수 | 설명                 |
| --------- | ---- | -------------------- |
| userid    | O    | Discord 사용자 ID    |
| yearmonth | O    | 년월 (yyyymm)        |
| count     | O    | 추가 지급할 휴가일수 |

#### `/delete`, `/delete-cam`

| 파라미터 | 필수 | 설명              |
| -------- | ---- | ----------------- |
| userid   | O    | Discord 사용자 ID |

#### `/register-cam`

| 파라미터 | 필수 | 설명              |
| -------- | ---- | ----------------- |
| userid   | O    | Discord 사용자 ID |
| username | O    | 표시 이름         |

---

### Events (이벤트 핸들러)

#### ready.ts

| 항목   | 내용                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 트리거 | 봇 Discord 연결 완료                                                                                                                                    |
| 기능   | DB 테이블 동기화(`Users`, `TimeLog`, `AttendanceLog`, `VacationLog`, `WaketimeChangeLog`, `CamStudy*`), 운영 daily message/thread 생성 및 스케줄러 등록 |

**스케줄러:**

- 운영 daily message/thread 생성: 매일 06:00
- 기상 챌린지 리포트: 매일 13:00
- 캠스터디 리포트: 매일 23:59

**구현 메모:**

- 운영 daily message/thread 중복 방지와 재탐색은 `src/daily-attendance.ts`가 담당한다.
- 실제 출석표 생성과 캠스터디 집계는 `src/services/reporting.ts`로 위임한다.
- 스케줄러는 중복 실행 방지 플래그와 예외 로깅을 포함한다.

#### interactionCreate.ts

| 항목   | 내용                                |
| ------ | ----------------------------------- |
| 트리거 | 슬래시 커맨드 실행                  |
| 기능   | 채널 검증, 쿨다운 관리, 커맨드 실행 |

**쿨다운:**

- 기본: 3초
- 기타 커맨드: 5초

#### camStudyHandler.ts

| 항목   | 내용                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| 트리거 | 음성 채널 상태 변경                                                                  |
| 기능   | 카메라 ON/OFF 감지, 상태 전이를 `src/services/camStudy.ts`에 위임하여 학습 시간 기록 |

#### messageCreate.ts

| 항목   | 내용                                                                        |
| ------ | --------------------------------------------------------------------------- |
| 트리거 | 일반 메시지 생성                                                            |
| 기능   | 테스트 채널의 출석 demo thread에서 첫 댓글을 감지하고 출석 상태 이모지 반응 |

#### daily-attendance.ts

| 항목   | 내용                                                                                        |
| ------ | ------------------------------------------------------------------------------------------- |
| 역할   | 운영 채널용 daily message 본문, thread 이름 규칙, today thread 재탐색/중복 방지 로직을 제공 |
| 사용처 | `ready.ts` 운영 daily message/thread 자동 생성 스케줄                                       |

#### daily-message.ts

| 항목   | 내용                                                            |
| ------ | --------------------------------------------------------------- |
| 역할   | daily message에 넣을 질문 100개를 보관하고 랜덤으로 하나를 선택 |
| 사용처 | `/demo-daily-message` 커맨드, 운영 daily message 본문 생성      |

---

### Services (도메인 서비스)

#### attendance.ts

| 항목   | 내용                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| 역할   | 레거시 `TimeLog` 기반 check-in/check-out 기록 로직 보관                                  |
| 담당   | 채널 검증, 사용자 조회, 중복 출석 확인, 허용 시간 판정, 이미지 첨부 검증, `TimeLog` 생성 |
| 호출처 | 현재 공식 slash command 호출처 없음. 전환 기간 fallback/참고 구현으로만 남아 있다        |

#### camStudy.ts

| 항목   | 내용                                                                        |
| ------ | --------------------------------------------------------------------------- |
| 역할   | 음성 채널 상태 변경을 캠스터디 시작/종료 이벤트로 해석                      |
| 담당   | 입장/퇴장/카메라 ON/OFF 전이 계산, 최소 인정 시간 검증, 일간 로그 생성/갱신 |
| 호출처 | `src/events/camStudyHandler.ts`                                             |

#### challengeSelfService.ts

| 항목   | 내용                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| 역할   | 사용자 직접 `/register` upsert 와 휴가 등록 정책 처리                                                            |
| 담당   | 사용자 기준 등록/수정, 기상시간 범위 검증, register 하루 1회 변경 제한, 휴가 날짜 중복 방지, 잔여 휴가 한도 검증 |
| 호출처 | `src/commands/haruharu/register.ts`, `src/commands/haruharu/apply-vacation.ts`                                   |

#### reporting.ts

| 항목   | 내용                                                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 역할   | 일일/주간 리포트 생성과 스케줄링                                                                                                                                                         |
| 담당   | 모델 동기화, `AttendanceLog` 기반 기상 챌린지 출석표 생성, 전환 기간 `TimeLog` fallback 호환, 휴가일 결석 제외 처리, 월말 생존 명단 생성, 캠스터디 일일/주간 집계, 스케줄 중복 실행 방지 |
| 호출처 | `src/events/ready.ts`                                                                                                                                                                    |

---

### Repository (데이터 모델)

#### Repository helper 모듈

| 파일                     | 역할                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `challengeRepository.ts` | `Users`, `TimeLog`, `AttendanceLog`, `VacationLog`, `WaketimeChangeLog` 기반 기상 챌린지 조회/생성/집계 헬퍼 |
| `camStudyRepository.ts`  | `CamStudyUsers`, `CamStudyTimeLog`, `CamStudyWeeklyTimeLog` 기반 조회/갱신 헬퍼                              |

#### Users (기상 챌린지 참가자)

| 컬럼         | 타입    | 설명                       |
| ------------ | ------- | -------------------------- |
| id           | INTEGER | PK, Auto Increment         |
| userid       | STRING  | Discord 사용자 ID          |
| username     | STRING  | 표시 이름                  |
| yearmonth    | STRING  | 년월 (yyyymm)              |
| waketime     | STRING  | 기상시간 (HHmm)            |
| vacances     | INTEGER | 총 지급 휴가일수 (기본: 5) |
| latecount    | INTEGER | 지각 횟수                  |
| absencecount | INTEGER | 결석 횟수                  |

#### TimeLog (출석 로그)

| 컬럼         | 타입    | 설명                 |
| ------------ | ------- | -------------------- |
| id           | INTEGER | PK, Auto Increment   |
| userid       | STRING  | Discord 사용자 ID    |
| username     | STRING  | 표시 이름            |
| yearmonthday | STRING  | 날짜 (yyyymmdd)      |
| checkintime  | STRING  | 체크인 시간 (HHmm)   |
| checkouttime | STRING  | 체크아웃 시간 (HHmm) |
| isintime     | BOOLEAN | 정시 출석 여부       |

비고:

- 과거 레거시 `/check-in`, `/check-out` 2건 구조 데이터 호환용 테이블이다.
- thread 기반 하루 1회 출석 전환과 별도로 유지되며, 현재 등록된 slash command 중 이 테이블을 직접 갱신하는 경로는 없다.
- 13:00 집계는 `AttendanceLog`가 없는 전환 기간 동안에만 이 테이블을 fallback 으로 읽는다.

#### VacationLog (휴가 사용 기록)

| 컬럼         | 타입    | 설명                      |
| ------------ | ------- | ------------------------- |
| id           | INTEGER | PK, Auto Increment        |
| userid       | STRING  | Discord 사용자 ID         |
| username     | STRING  | 표시 이름                 |
| yearmonthday | STRING  | 휴가 사용 날짜 (yyyymmdd) |
| createdAt    | DATE    | 생성 시각                 |
| updatedAt    | DATE    | 수정 시각                 |

비고:

- `(userid, yearmonthday)` 조합은 UNIQUE이며 같은 날짜 중복 등록을 막는다.
- `Users.vacances` 총량과 별도로, 실제 사용한 휴가 날짜를 기록한다.
- 잔여 휴가 수는 `vacances - VacationLog 월별 사용 건수`로 해석한다.

#### WaketimeChangeLog (기상시간 변경 이력)

| 컬럼         | 타입    | 설명                      |
| ------------ | ------- | ------------------------- |
| id           | INTEGER | PK, Auto Increment        |
| userid       | STRING  | Discord 사용자 ID         |
| yearmonthday | STRING  | 변경 발생 날짜 (yyyymmdd) |
| waketime     | STRING  | 변경한 기상시간 (HHmm)    |
| createdAt    | DATE    | 생성 시각                 |
| updatedAt    | DATE    | 수정 시각                 |

비고:

- `(userid, yearmonthday)` 조합은 UNIQUE이며 하루 1회 변경 제한을 강제한다.

#### AttendanceLog (thread 출석 로그)

| 컬럼         | 타입    | 설명                                |
| ------------ | ------- | ----------------------------------- |
| id           | INTEGER | PK, Auto Increment                  |
| userid       | STRING  | Discord 사용자 ID                   |
| username     | STRING  | 표시 이름                           |
| yearmonthday | STRING  | 날짜 (yyyymmdd)                     |
| threadid     | STRING  | daily message thread ID             |
| messageid    | STRING  | 공식 출석으로 인정된 댓글 메시지 ID |
| commentedat  | STRING  | 댓글 시각 ISO 문자열                |
| status       | STRING  | `attended` / `late` / `absent`      |
| createdAt    | DATE    | 생성 시각                           |
| updatedAt    | DATE    | 수정 시각                           |

비고:

- `(userid, yearmonthday)` 조합은 UNIQUE이며 하루 1건만 저장한다.
- `too-early`는 공식 출석 로그에 저장하지 않는다.
- 13:00 출석 집계의 우선 원본이며, `attended` / `late` / `absent` 상태에 따라 결과표와 `latecount` / `absencecount`가 반영된다.
- 전환 기간에는 `AttendanceLog`가 없는 사용자만 `TimeLog` fallback 으로 판정하고, 둘 다 없으면 결석으로 확정된다.

#### CamStudyUsers (캠스터디 참가자)

| 컬럼     | 타입    | 설명                       |
| -------- | ------- | -------------------------- |
| id       | INTEGER | PK, Auto Increment         |
| userid   | STRING  | Discord 사용자 ID (UNIQUE) |
| username | STRING  | 표시 이름                  |

#### CamStudyTimeLog (일간 학습 로그)

| 컬럼         | 타입    | 설명                   |
| ------------ | ------- | ---------------------- |
| id           | INTEGER | PK, Auto Increment     |
| userid       | STRING  | Discord 사용자 ID      |
| username     | STRING  | 표시 이름              |
| yearmonthday | STRING  | 날짜 (yyyymmdd)        |
| timestamp    | STRING  | 마지막 갱신 타임스탬프 |
| totalminutes | INTEGER | 총 학습 분 (기본: 0)   |

#### CamStudyWeeklyTimeLog (주간 학습 로그)

| 컬럼         | 타입    | 설명                      |
| ------------ | ------- | ------------------------- |
| id           | INTEGER | PK, Auto Increment        |
| userid       | STRING  | Discord 사용자 ID         |
| username     | STRING  | 표시 이름                 |
| weektimes    | INTEGER | 주차 (2024-04-06 기준)    |
| totalminutes | INTEGER | 주간 총 학습 분 (기본: 0) |

---

### Utils (유틸리티)

비고:

- `src/utils.ts`는 배럴 파일이며 실제 구현은 `src/utils/constants.ts`, `src/utils/date.ts`, `src/utils/format.ts`로 분리되어 있다.

#### 날짜/시간 함수

| 함수                                | 반환    | 설명                                                    |
| ----------------------------------- | ------- | ------------------------------------------------------- |
| `getYearMonthDate()`                | Object  | 현재 시간 정보 (year, month, date, day, hours, minutes) |
| `isLastDayOfMonth()`                | boolean | 월말 여부 확인                                          |
| `getFormattedYesterday()`           | string  | 어제 날짜 (yyyymmdd)                                    |
| `getTimeDiffFromNowInMinutes()`     | number  | 타임스탬프와 현재 시간 차이 (분)                        |
| `calculateWeekTimes()`              | number  | 주차 계산 (2024-04-06 기준)                             |
| `formatFromMinutesToHours()`        | string  | 분 → "X시간 Y분" 포맷                                   |
| `calculateRemainingTimeChallenge()` | number  | 다음 13:00까지 남은 밀리초                              |
| `calculateRemainingTimeCamStudy()`  | number  | 다음 23:59까지 남은 밀리초                              |

#### 상수

| 상수                      | 값                                  | 설명                     |
| ------------------------- | ----------------------------------- | ------------------------ |
| `PERMISSION_NUM_ADMIN`    | `PermissionFlagsBits.Administrator` | Discord 관리자 권한 비트 |
| `LATE_RANGE_TIME`         | 10                                  | 정시 인정 범위 (분)      |
| `ABSENCE_RANGE_TIME`      | 30                                  | 출석 유효 범위 (분)      |
| `DEFAULT_VACANCES_COUNT`  | 5                                   | 기본 휴가일수            |
| `LEAST_TIME_LIMIT`        | 5                                   | 최소 학습 인정 시간 (분) |
| `PRINT_HOURS_CHALLENGE`   | 13                                  | 기상 챌린지 리포트 시간  |
| `PRINT_HOURS_CAM_STUDY`   | 23                                  | 캠스터디 리포트 시간     |
| `PRINT_MINUTES_CAM_STUDY` | 59                                  | 캠스터디 리포트 분       |
| `ONE_DAY_MILLISECONDS`    | 86400000                            | 일일 스케줄 반복 간격    |
| `PUBLIC_HOLIDAYS_2026`    | [...]                               | 2026년 한국 공휴일 목록  |

---

## 설정 파일

### config.json

```json
{
  "token": "Discord 봇 토큰",
  "clientId": "봇 애플리케이션 ID",
  "guildId": "대상 Discord 서버 ID",
  "checkChannelId": "체크인/체크아웃 채널 ID",
  "logChannelId": "학습 시간 로그 채널 ID",
  "resultChannelId": "결과/리더보드 채널 ID",
  "voiceChannelId": "캠스터디 음성 채널 ID",
  "noticeChannelId": "공지 채널 ID",
  "vacancesRegisterChannelId": "휴가 등록 채널 ID",
  "testChannelId": "테스트 채널 ID"
}
```

비고:

- `src/config.ts`는 런타임 진입점에서 사용하는 설정 로더이며 `token`, `clientId`, `guildId`, 각 채널 ID를 fail-fast로 검증한다.
- `databaseUser`, `password`는 SQLite 사용 기준 optional 값이며 비어 있어도 동작한다.
- `src/deployConfig.ts`는 slash command 등록 전용 최소 설정 로더이며 `token`, `clientId`, `guildId`만 요구한다.

---

## 운영 메모

- 사용자 직접 변경 명령은 `interaction.user.id`를 기준으로 자신의 데이터만 수정한다.
- `/register`는 사용자가 자신의 월별 기상시간을 신규 등록하거나 수정하는 단일 명령이다.
- `/register`는 같은 날 두 번째 변경을 거부한다.
- `/register`는 현재 시각 기준 `yearmonth`를 내부에서 계산한다.
- `/apply-vacation`은 날짜 단위(`yyyymmdd`)로 동작한다.
- 휴가가 등록된 날짜는 일일 출석 리포트에서 `휴가`로 표시되고, 결석 카운트는 증가하지 않는다.

### package.json 스크립트

| 스크립트           | 설명                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| `npm start`        | TypeScript 컴파일 후 봇 실행                                                   |
| `npm run pm2`      | PM2로 프로덕션 배포                                                            |
| `npm run local:ci` | GitHub Actions CI와 같은 로컬 검증 실행 (`lint` + `prettier --check` + `test`) |
| `npm run lint`     | ESLint 검사                                                                    |
| `npm run lint:fix` | ESLint 자동 수정                                                               |
| `npm run format`   | Prettier 포맷팅                                                                |

---

## 기술 스택

| 구분         | 기술                   |
| ------------ | ---------------------- |
| 언어         | TypeScript             |
| 런타임       | Node.js 20+            |
| Discord API  | discord.js 14          |
| 데이터베이스 | SQLite3 + Sequelize    |
| 로깅         | Winston + Daily Rotate |
| 코드 품질    | ESLint + Prettier      |
| 배포         | PM2                    |
| CI/CD        | GitHub Actions         |

---

## 관련 문서

- [사용자 스토리 및 시퀀스 다이어그램](./USER_STORIES.md)
- [커밋 컨벤션](./COMMIT_CONVENTION.md)
