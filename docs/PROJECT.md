# 하루하루 Discord Bot

## 프로젝트 개요

**하루하루**는 스터디 그룹의 출석 관리와 학습 시간 추적을 위한 Discord 봇입니다.

### 제공 가치

| 가치 | 설명 |
|------|------|
| **습관 형성** | 매일 정해진 시간에 기상하는 습관을 만들어 줍니다 |
| **책임감 부여** | 그룹 내 출석 공개로 자연스러운 동기 부여 |
| **학습 시간 가시화** | 캠스터디를 통해 실제 공부 시간을 객관적으로 측정 |
| **자동화된 관리** | 수동 집계 없이 매일 자동으로 출석/학습 현황 리포트 |

### 핵심 기능

| 기능 | 설명 |
|------|------|
| **기상 챌린지** | 매일 정해진 시간에 기상하여 인증샷을 올리는 월간 챌린지 |
| **캠스터디** | Discord 음성 채널에서 카메라를 켜고 공부하는 시간 추적 |

---

## 프로젝트 구조

```
haruharu-discord-bot/
├── src/
│   ├── index.ts                 # 봇 진입점, 커맨드/이벤트 로더
│   ├── logger.ts                # Winston 로깅 설정
│   ├── utils.ts                 # 유틸리티 함수 및 상수
│   ├── deploy-commands.ts       # 슬래시 커맨드 등록
│   │
│   ├── commands/
│   │   └── haruharu/
│   │       ├── register.ts      # 기상 챌린지 등록
│   │       ├── check-in.ts      # 체크인
│   │       ├── check-out.ts     # 체크아웃
│   │       ├── add-vacances.ts  # 휴가 추가
│   │       ├── delete.ts        # 챌린저 삭제
│   │       ├── register-cam.ts  # 캠스터디 등록
│   │       ├── delete-cam.ts    # 캠스터디 삭제
│   │       └── ping.ts          # 헬스체크
│   │
│   ├── events/
│   │   ├── ready.ts             # 봇 시작, DB 동기화, 스케줄러
│   │   ├── interactionCreate.ts # 슬래시 커맨드 핸들러
│   │   └── camStudyHandler.ts   # 음성 채널 상태 감지
│   │
│   └── repository/
│       ├── config.ts            # Sequelize 설정
│       ├── Users.ts             # 챌린저 모델
│       ├── TimeLog.ts           # 출석 로그 모델
│       ├── CamStudyUsers.ts     # 캠스터디 참가자 모델
│       ├── CamStudyTimeLog.ts   # 일간 학습 로그 모델
│       └── CamStudyWeeklyTimeLog.ts # 주간 학습 로그 모델
│
├── docs/
│   ├── PROJECT.md               # 프로젝트 문서 (현재 파일)
│   ├── USER_STORIES.md          # 사용자 스토리 및 시퀀스 다이어그램
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

| 커맨드 | 권한 | 설명 |
|--------|------|------|
| `/register` | 관리자 | 기상 챌린지 등록/수정 |
| `/check-in` | 사용자 | 기상 체크인 (인증샷 필수) |
| `/check-out` | 사용자 | 기상 체크아웃 (인증샷 필수) |
| `/add-vacances` | 관리자 | 휴가일수 추가 |
| `/delete` | 관리자 | 챌린저 삭제 |

#### 캠스터디 커맨드

| 커맨드 | 권한 | 설명 |
|--------|------|------|
| `/register-cam` | 관리자 | 캠스터디 등록 |
| `/delete-cam` | 관리자 | 캠스터디 삭제 |

#### 유틸리티 커맨드

| 커맨드 | 권한 | 설명 |
|--------|------|------|
| `/ping` | 관리자 | 봇 상태 확인 |

---

### 커맨드 파라미터 상세

#### `/register`
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| userid | O | Discord 사용자 ID |
| yearmonth | O | 년월 (yyyymm) |
| waketime | O | 기상시간 (HHmm, 0500~0900) |
| username | O | 표시 이름 |
| vacances | X | 휴가일수 (기본값: 5) |

#### `/check-in`, `/check-out`
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| image | O | 타임스탬프가 포함된 인증 이미지 |

#### `/add-vacances`
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| userid | O | Discord 사용자 ID |
| yearmonth | O | 년월 (yyyymm) |
| count | O | 추가할 휴가일수 |

#### `/delete`, `/delete-cam`
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| userid | O | Discord 사용자 ID |

#### `/register-cam`
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| userid | O | Discord 사용자 ID |
| username | O | 표시 이름 |

---

### Events (이벤트 핸들러)

#### ready.ts
| 항목 | 내용 |
|------|------|
| 트리거 | 봇 Discord 연결 완료 |
| 기능 | DB 테이블 동기화, 스케줄러 등록 |

**스케줄러:**
- 기상 챌린지 리포트: 매일 13:00
- 캠스터디 리포트: 매일 23:59

#### interactionCreate.ts
| 항목 | 내용 |
|------|------|
| 트리거 | 슬래시 커맨드 실행 |
| 기능 | 채널 검증, 쿨다운 관리, 커맨드 실행 |

**쿨다운:**
- 기본: 3초
- `/check-in`, `/check-out`: 30초
- 기타 커맨드: 5초

#### camStudyHandler.ts
| 항목 | 내용 |
|------|------|
| 트리거 | 음성 채널 상태 변경 |
| 기능 | 카메라 ON/OFF 감지, 학습 시간 기록 |

---

### Repository (데이터 모델)

#### Users (기상 챌린지 참가자)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK, Auto Increment |
| userid | STRING | Discord 사용자 ID |
| username | STRING | 표시 이름 |
| yearmonth | STRING | 년월 (yyyymm) |
| waketime | STRING | 기상시간 (HHmm) |
| vacances | INTEGER | 휴가일수 (기본: 5) |
| latecount | INTEGER | 지각 횟수 |
| absencecount | INTEGER | 결석 횟수 |

#### TimeLog (출석 로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK, Auto Increment |
| userid | STRING | Discord 사용자 ID |
| username | STRING | 표시 이름 |
| yearmonthday | STRING | 날짜 (yyyymmdd) |
| checkintime | STRING | 체크인 시간 (HHmm) |
| checkouttime | STRING | 체크아웃 시간 (HHmm) |
| isintime | BOOLEAN | 정시 출석 여부 |

#### CamStudyUsers (캠스터디 참가자)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK, Auto Increment |
| userid | STRING | Discord 사용자 ID (UNIQUE) |
| username | STRING | 표시 이름 |

#### CamStudyTimeLog (일간 학습 로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK, Auto Increment |
| userid | STRING | Discord 사용자 ID |
| username | STRING | 표시 이름 |
| yearmonthday | STRING | 날짜 (yyyymmdd) |
| timestamp | STRING | 마지막 갱신 타임스탬프 |
| totalminutes | INTEGER | 총 학습 분 (기본: 0) |

#### CamStudyWeeklyTimeLog (주간 학습 로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER | PK, Auto Increment |
| userid | STRING | Discord 사용자 ID |
| username | STRING | 표시 이름 |
| weektimes | INTEGER | 주차 (2024-04-06 기준) |
| totalminutes | INTEGER | 주간 총 학습 분 (기본: 0) |

---

### Utils (유틸리티)

#### 날짜/시간 함수

| 함수 | 반환 | 설명 |
|------|------|------|
| `getYearMonthDate()` | Object | 현재 시간 정보 (year, month, date, day, hours, minutes) |
| `isLastDayOfMonth()` | boolean | 월말 여부 확인 |
| `getFormattedYesterday()` | string | 어제 날짜 (yyyymmdd) |
| `getTimeDiffFromNowInMinutes()` | number | 타임스탬프와 현재 시간 차이 (분) |
| `calculateWeekTimes()` | number | 주차 계산 (2024-04-06 기준) |
| `formatFromMinutesToHours()` | string | 분 → "X시간 Y분" 포맷 |
| `calculateRemainingTimeChallenge()` | number | 다음 13:00까지 남은 밀리초 |
| `calculateRemainingTimeCamStudy()` | number | 다음 23:59까지 남은 밀리초 |

#### 상수

| 상수 | 값 | 설명 |
|------|-----|------|
| `PERMISSION_NUM_ADMIN` | 0 | 관리자 권한 레벨 |
| `LATE_RANGE_TIME` | 10 | 정시 인정 범위 (분) |
| `ABSENCE_RANGE_TIME` | 30 | 출석 유효 범위 (분) |
| `DEFAULT_VACANCES_COUNT` | 5 | 기본 휴가일수 |
| `LEAST_TIME_LIMIT` | 5 | 최소 학습 인정 시간 (분) |
| `PRINT_HOURS_CHALLENGE` | 13 | 기상 챌린지 리포트 시간 |
| `PRINT_HOURS_CAM_STUDY` | 23 | 캠스터디 리포트 시간 |
| `PRINT_MINUTES_CAM_STUDY` | 59 | 캠스터디 리포트 분 |
| `PUBLIC_HOLIDAYS_2025` | [...] | 2025년 한국 공휴일 목록 |

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

### package.json 스크립트

| 스크립트 | 설명 |
|----------|------|
| `npm start` | TypeScript 컴파일 후 봇 실행 |
| `npm run pm2` | PM2로 프로덕션 배포 |
| `npm run lint` | ESLint 검사 |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run format` | Prettier 포맷팅 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 언어 | TypeScript |
| 런타임 | Node.js 20+ |
| Discord API | discord.js 14 |
| 데이터베이스 | SQLite3 + Sequelize |
| 로깅 | Winston + Daily Rotate |
| 코드 품질 | ESLint + Prettier |
| 배포 | PM2 |
| CI/CD | GitHub Actions |

---

## 관련 문서

- [사용자 스토리 및 시퀀스 다이어그램](./USER_STORIES.md)
- [커밋 컨벤션](./COMMIT_CONVENTION.md)
