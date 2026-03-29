> 최우선 규칙: 코드 구조, 실행 흐름, 슬래시 커맨드, 이벤트, DB 스키마, 테스트 방식이 바뀌면 먼저 문서 영향 분석부터 하고, 관련 문서(`docs/PROJECT.md`, `docs/USER_STORIES.md` 등)를 업데이트하거나 업데이트가 불필요한 이유를 PR 본문에 남긴다.

# AGENTS.md

## 목적

이 문서는 이 저장소에서 작업하는 사람이 빠르게 구조를 이해하고, 새 코드를 기존 패턴에 맞게 추가하도록 돕는 작업 기준서다. 구현보다 문서가 뒤처지지 않게 유지하는 것이 목적이다.

## 프로젝트 요약

- 이 저장소는 Discord 슬래시 커맨드와 음성 채널 이벤트를 처리하는 단일 TypeScript 봇이다.
- 런타임 진입점은 `src/index.ts`이고, 실제 Discord client 생성/커맨드·이벤트 로딩은 `src/runtime.ts`가 담당한다.
- 커맨드 등록 스크립트는 `src/deploy-commands.ts`다.
- 데이터 저장은 SQLite + Sequelize 모델(`src/repository`)로 처리한다.
- 캠스터디는 진행 중 세션을 `CamStudyActiveSession`으로 별도 저장하고, 재기동 시 `ready.ts`에서 복구한다.
- 테스트는 Vitest를 사용하며 기본 테스트, bot boot smoke test, 통합 테스트를 분리한다.
- 운영 배포는 GitHub Actions `workflow_dispatch` + production 호환 빌드 환경(`ubuntu-22.04`, Node.js 24)에서 만든 artifact/runtime metadata + SSH + PM2 조합을 기준으로 한다.

## 우선 참고 문서

- `docs/PROJECT.md`: 구조, 명령어, 이벤트, 모델 설명
- `docs/USER_STORIES.md`: 기능 요구와 사용자 흐름
- `docs/COMMIT_CONVENTION.md`: 커밋 메시지 규칙
- `docs/BRANCH_CONVENTION.md`: 브랜치 네이밍 규칙
- `docs/HOLIDAY_POLICY.md`: 공휴일 기준 변경 시 참고
- `.github/ISSUE_TEMPLATE/implementation.yml`: 구현 이슈 작성 기준
- `CLAUDE.md`: 기존 문서 참조 가이드

## 저장소 구조

```text
.
├── src/
│   ├── index.ts                  # 봇 런타임 진입점
│   ├── runtime.ts                # Discord client/커맨드/이벤트 로더와 smoke boot 진입점
│   ├── deploy-commands.ts        # Discord 슬래시 커맨드 등록
│   ├── attendance.ts             # 출석 판정/이모지 유틸리티
│   ├── daily-attendance.ts       # 운영 daily message/thread 생성 및 재탐색 유틸리티
│   ├── daily-message.ts          # daily message 질문 풀/랜덤 선택
│   ├── logger.ts                 # Winston 로거 설정
│   ├── utils.ts                  # 날짜/시간/상수 유틸리티
│   ├── commands/
│   │   └── haruharu/             # 슬래시 커맨드 구현
│   ├── events/                   # Discord 이벤트 핸들러
│   ├── repository/               # Sequelize 모델과 DB 설정
│   └── test/                     # Vitest 테스트와 테스트 헬퍼
├── docs/                         # 프로젝트/프로세스 문서
│   ├── PRODUCTION_RUNBOOK.md     # production 배포/검증/롤백 절차
│   └── plan/                     # 이슈별 구현 계획 문서
├── .github/
│   ├── ISSUE_TEMPLATE/           # GitHub 이슈 템플릿
│   ├── pull_request_template.md  # GitHub PR 템플릿
│   └── workflows/                # GitHub Actions CI / dependency review / deploy
├── scripts/                      # 배포/운영 헬퍼 스크립트
├── logs/                         # 런타임 로그 출력 디렉터리
├── README.md
├── package.json
├── tsconfig.json
├── eslint.config.js
└── vitest.config.ts
```

## 디렉터리별 컨벤션

### `src/index.ts`

- 프로세스 시작용 진입점만 담당한다.
- 실제 Discord client 생성과 커맨드/이벤트 동적 로딩은 `src/runtime.ts`로 위임한다.
- 새 기능의 비즈니스 로직을 직접 넣지 말고 `commands`, `events`, `repository`, `utils`로 분리한다.
- 커맨드 모듈은 `export const command`, 이벤트 모듈은 `export const event` 형태를 유지한다.
- 특정 채널에서만 실행되어야 하는 슬래시 커맨드는 `allowedChannelIds` 메타데이터로 제한하고, 실제 채널 ID는 `config.json`에서 읽는다.

### `src/runtime.ts`

- Discord client 생성, 커맨드/이벤트 동적 로딩, slash command payload 수집을 담당한다.
- `src/index.ts`, `src/deploy-commands.ts`, bot boot smoke test가 같은 로더를 재사용하도록 유지한다.
- 역할 기반 등록/동기화 이벤트를 추가하면 해당 Discord gateway intent(`GuildMembers` 등)가 함께 선언되었는지 확인한다.
- 새 커맨드/이벤트 파일을 추가하면 source(`.ts`)와 build output(`.js`) 양쪽에서 로더가 동작하는지 확인한다.

### `src/commands/haruharu`

- 슬래시 커맨드 파일 하나당 명령 하나를 둔다.
- 파일명은 Discord 커맨드명과 최대한 맞춘다. 현재 저장소처럼 kebab-case 파일명을 우선한다.
- 각 파일은 다음 구조를 유지한다.
  - `cooldown`
  - `data: new SlashCommandBuilder()`
  - `async execute(interaction)`
- Discord 입력 파싱, 권한 검증, 응답 메시지 처리는 커맨드 안에서 수행한다.
- DB 접근은 직접 Sequelize 쿼리를 쓰더라도 repository 모델을 통해서만 접근한다.
- 사용자 self-service 명령은 `interaction.user.id`를 기준으로 자신의 데이터만 변경해야 한다.
- 기상시간 self-service는 `/register` 하나로 기상 참여 시작/재시작과 기상시간 등록/수정을 처리하되 하루 1회 제한을 지켜야 한다.
- `/register`, `/stop-wakeup`, `/apply-vacation`은 `#start-here`와 기상 self-service 전용 온보딩 채널에서만 실행되도록 유지한다.
- `/register` 성공 시 `@wake-up` 역할도 함께 부여하고, 역할 부여 실패 시 DB 등록을 남기지 않도록 유지한다.
- 기상 self-service 중단은 `/stop-wakeup` 으로 처리하고, 현재 월 기록은 유지한 채 이후 월 자동 등록만 중단해야 한다.
- `/stop-wakeup` 성공 시 `@wake-up` 역할도 함께 회수하고, 역할 회수 실패 시 `WakeUpMembership`을 `stopped`로 바꾸지 않도록 유지한다.
- 휴가 self-service는 총 지급량 조정이 아니라 날짜 단위 사용만 담당해야 한다.
- 캠스터디 등록 원본은 `@cam-study` 역할과 `guildMemberUpdate` 동기화로 본다.
- 관리자 명령(`/ping`, `/delete`, `/add-vacances`, `/demo-daily-message`)은 `testChannelId`에서만 실행되도록 유지한다.
- 새 커맨드를 추가하면 `src/deploy-commands.ts`와 `src/index.ts`의 동적 로딩 대상 구조를 깨지 않는지 확인한다.
- 역할 기반 운영 흐름을 추가할 때는 `#start-here` 같은 온보딩 채널을 기준으로 두고, 신청 응답은 가능하면 `ephemeral`로 처리한다.

### `src/events`

- Discord 이벤트당 파일 하나를 유지한다.
- `ready.ts`는 부팅, 테이블 sync, 매일 04:00 운영 daily message/thread 생성 스케줄, 기상 결과표 thread 댓글 전송을 포함한 집계 스케줄 등록, 캠스터디 active session 복구와 heartbeat 등록을 담당한다.
- `interactionCreate.ts`는 채널 검증, 쿨다운, 커맨드 실행 라우팅을 담당한다.
- `interactionCreate.ts`는 배포 전환 중 stale 슬래시 등록이 남을 수 있는 경우, 무응답으로 끝내지 말고 migration 안내를 우선 반환한다. 현재는 stale `/apply-wakeup` 에 대해 `/register` 안내를 반환한다.
- `guildMemberUpdate.ts`는 `@cam-study` 역할 부여/회수를 감지해서 `CamStudyUsers`를 자동 동기화하고, 활성 세션 중 역할 회수면 삭제를 종료 시점까지 미룬다.
- `camStudyHandler.ts`는 캠스터디 음성 채널에서 `selfVideo` 또는 `streaming` 활성 상태 전이를 시작/종료 이벤트로 해석하고, 역할 회수 뒤 종료 시점 정리까지 포함해 실패 시 상태 전이 문맥을 로그에 남긴다.
- 이벤트 파일은 `name`, `once`, `execute` 필드를 가진 `event` 객체를 export 한다.
- 이벤트에 새 분기나 스케줄을 추가하면 시간 기준, 채널 사용, 부작용을 문서화한다.
- `interactionCreate.ts`에 커맨드별 허용 채널 분기가 추가되면, 어떤 커맨드가 `#start-here`/기상 self-service 온보딩 채널/`test` 같은 전용 채널에 묶이는지 문서에 남긴다.

### `src/daily-attendance.ts`

- 운영 채널의 daily message 본문 생성, thread 이름 규칙, 결과표 전송용 today thread 재탐색/중복 방지 로직을 한곳에 모은다.
- 운영 자동화와 테스트 채널 demo 흐름이 서로 다른 채널/이름 규칙을 쓰도록 분리 기준을 유지한다.
- 오늘 thread를 재사용하는 기준이 바뀌면 `docs/PROJECT.md`, `docs/USER_STORIES.md`도 함께 갱신한다.

### `src/repository`

- Sequelize 모델은 파일당 모델 하나를 유지한다.
- 모델 클래스명과 export 이름은 PascalCase를 사용한다.
- thread 기반 하루 1회 출석 저장은 `AttendanceLog`로 분리하고, 기존 `TimeLog`는 집계 원본이 아닌 과거 레거시 데이터 호환용으로만 유지한다.
- 캠스터디 진행 중 세션은 `CamStudyActiveSession`으로 저장하고, `CamStudyTimeLog`는 종료 정산된 누적 시간만 보관한다.
- `CamStudyWeeklyTimeLog`는 해당 주차의 `CamStudyTimeLog`를 재계산한 결과를 반영하는 용도로 유지하고, 같은 일간 로그를 누적 덧셈으로 중복 반영하지 않는다.
- `CamStudyUsers`는 수동 등록 원본이 아니라 `@cam-study` 역할 상태를 반영하는 캐시/인덱스로 유지하되, 활성 세션 중 역할 회수면 종료 이벤트까지 임시로 유지할 수 있다.
- 사용자 직접 휴가 사용 날짜는 `VacationLog`로 분리하고, `Users.vacances`는 총 지급 휴가일수로 해석한다.
- 사용자 기상시간 하루 1회 변경 제한은 `WaketimeChangeLog`로 추적한다.
- 기상 챌린지 상시 참여 상태와 최근 `/register` 기상시간은 `WakeUpMembership` 같은 별도 모델로 관리하고, `Users` 는 월별 집계 스냅샷으로 유지한다.
- 기상 self-service의 역할 접근 제어 원본은 `/register`, `/stop-wakeup` 성공 시점의 `@wake-up` 역할 동기화로 유지한다.
- 관리자 `/delete` 로 제거한 `(userid, yearmonth)` 월 스냅샷은 별도 exclusion 기록으로 남겨 자동 backfill 이 같은 달 사용자를 되살리지 않도록 유지한다.
- 실제 기능 등록 모델(`Users`, `CamStudyUsers`)과 신청/활성화 상태 모델 책임은 계속 분리한다.
- 역할 기반 온보딩 흐름은 `ParticipationApplication` 같은 별도 모델로 관리하되, 현재 정책상 `/apply-cam` 실행 시 즉시 `approved` 상태로 반영한다.
- 스키마 변경 시 다음을 함께 점검한다.
  - 기존 테스트 영향
  - `docs/PROJECT.md`의 테이블 설명
  - 운영 데이터 호환성
- DB 연결 설정은 `src/repository/config.ts`에 둔다.

### `src/test`

- 테스트 파일명은 현재 관례대로 `US-xx-*.test.ts`를 우선 사용한다.
- 사용자 스토리 또는 버그 시나리오 단위로 테스트를 추가한다.
- 공통 mock/helper는 `src/test/test-setup.ts`에 둔다.
- 통합 테스트는 `src/test/integration`에 둔다.
- bot boot smoke test는 Discord 로그인 없이 `config 로딩 -> client 생성 -> command/event 로딩`까지만 검증한다.
- workflow/CI 회귀 테스트가 필요하면 `.github/workflows`를 읽는 정적 테스트를 추가할 수 있다.
- 기능 수정 시 가능하면 회귀 테스트를 같이 추가한다.

### `docs`

- 구현 설명은 `docs/PROJECT.md`, 요구사항 변화는 `docs/USER_STORIES.md`를 우선 갱신한다.
- 구현 계획 문서는 `docs/plan` 아래에 이슈 단위로 추가한다.
- 프로세스 변경은 각 전용 문서(`COMMIT_CONVENTION`, `BRANCH_CONVENTION`, `pull_request_template`)를 수정한다.
- 주말/공휴일 보너스 정책이나 공휴일 연도 상수 변경 시 `docs/HOLIDAY_POLICY.md`도 함께 맞춘다.
- 문서가 필요 없다고 판단했으면 PR 본문에 그 이유를 명시한다.

### `.github`

- GitHub에서 직접 사용하는 이슈/PR 입력 폼은 `.github/ISSUE_TEMPLATE`, `.github/pull_request_template.md`에서 관리한다.
- PR 템플릿을 수정하면 `docs/pull_request_template.md`도 함께 동기화한다.
- 구현 이슈는 `.github/ISSUE_TEMPLATE/implementation.yml`을 기본으로 사용한다.
- 이슈 템플릿은 현재 저장소 문맥에 맞는 예시와 완료 조건을 유지한다.
- 구현 이슈 템플릿에는 최소한 `완료조건`, `검증항목`, `회귀 테스트 계획`, `구현 계획`이 있어야 한다.
- workflow는 역할을 분리한다.
  - `ci.yml`: lint / prettier / unit test / smoke test / integration test. integration test는 같은 저장소 PR(`dependabot[bot]` 제외), `main` push, `workflow_dispatch`에서만 실행하고, 실행 전 테스트용 `config.json` 생성 + slash command sync를 선행한다. 같은 테스트 길드를 쓰는 실행은 `concurrency`로 직렬화한다.
  - `dependency-review.yml`: 의존성 변경 PR 리뷰
  - `deploy-production.yml`: `ubuntu-22.04` + Node.js 24 verify 뒤 production artifact와 runtime metadata를 만들고 서버 호환성 검증 후 반영한 뒤 readiness 확인

## 구현 컨벤션

- TypeScript ESM import 경로는 현재 코드베이스처럼 `.js` 확장자를 명시한다.
- 설정값은 `config.json`에서 읽으며, 현재 패턴대로 `createRequire(import.meta.url)` 사용을 우선한다.
- 역할 기반 접근 제어를 추가할 때는 채널 ID와 역할 ID를 `config.json`에 명시하고, 코드에서는 하드코딩하지 않는다.
- 로깅은 `console.log`보다 `src/logger.ts`의 `logger` 사용을 우선한다. 단, 부팅 로더 수준의 단순 진단 출력은 기존 패턴을 따른다.
- 날짜/시간 계산과 상수는 가능한 한 `src/utils.ts`에 모은다.
- daily message 질문 정책은 `src/daily-message.ts`, 운영 daily message/thread 생성 규칙은 `src/daily-attendance.ts`에 모은다.
- 캠스터디 재기동 복구, heartbeat, 종료 이벤트 유실 보호 로직은 `src/services/camStudy.ts`에 모은다.
- 비즈니스 규칙은 하드코딩을 흩뿌리지 말고 상수 또는 유틸 함수로 끌어올린다.
- 기존 파일 스타일을 존중한다. 이 저장소는 한국어 설명과 영어 식별자가 혼용된다.

## TDD 원칙

- 기능 변경이나 버그 수정은 가능하면 TDD로 진행한다.
- 반드시 `Red -> Green -> Refactor` 사이클을 지킨다.
- 구현 전에 먼저 테스트를 추가하거나 수정해서 현재 코드가 실제로 실패하는지 확인한다.
- 실패를 확인하지 않은 상태에서 구현부터 진행하지 않는다.
- 구현은 방금 추가한 실패 테스트를 통과시키는 최소 변경부터 시작한다.
- 테스트가 통과한 뒤에만 리팩터링, 중복 제거, 네이밍 개선을 진행한다.
- 버그 수정이면 `재현 테스트 -> 실패 확인 -> 수정 -> 재통과 확인` 순서를 PR 설명이나 작업 로그에 남긴다.
- 리팩토링이나 구조 변경도 회귀 위험이 있으면 먼저 동작을 고정하는 테스트를 만든다.
- 이슈 단계에서는 테스트 구현 상세보다 검증 의도와 회귀 위험을 적는다.
- 실제 어떤 테스트를 만들고 어떤 항목을 `red -> green`으로 확인할지는 `issue-implement-pr` 스킬이 구체화하고 실행한다.
- failing test를 만들기 어렵다면 이슈 본문에는 이유와 대체 검증 절차를 남기고, 실제 판단과 실행은 스킬이 맡는다.

## 작업 체크리스트

코드를 바꿀 때 아래를 기본 체크리스트로 사용한다.

1. 변경 위치가 `commands`, `events`, `repository`, `utils`, `docs` 중 어디에 속하는지 먼저 정한다.
2. 새 기능이면 대응하는 테스트를 `src/test`에 추가하거나 기존 테스트를 확장한다.
3. 커밋 전에 문서 영향 분석을 하고, 커맨드/이벤트/모델 동작이 바뀌면 `AGENTS.md`와 관련 `docs/*.md`를 함께 수정한다.
4. 문서 변경이 없으면 왜 없는지 PR 본문에 남긴다.
5. 스키마나 일정 로직을 바꿨다면 운영 영향과 기존 데이터 영향까지 확인한다.
6. PR push 전에 GitHub Actions CI와 같은 명령을 로컬에서 먼저 실행하고 통과를 확인한다.
7. 마지막에 lint/test 중 영향 범위에 맞는 검증을 실행한다.

## PR / 이슈 동기화 원칙

- PR 브랜치에서 커밋을 만들고 push할 때마다 이번 변경사항에 맞게 GitHub PR 본문과 관련 이슈 본문을 함께 점검하고 필요하면 즉시 업데이트한다.
- PR 본문에는 이번 push에 포함된 변경 요약, 테스트/검증 결과, 범위 변화가 반영되어 있어야 한다.
- PR 본문에는 이번 push 기준 문서 영향 분석 결과도 반영되어 있어야 한다.
- 구조, 실행 흐름, 데이터 흐름이 바뀐 PR이면 본문에 단일 `mermaid` 블록 하나로 변경 흐름을 요약한다.
- 비교 다이어그램을 쓸 때는 `subgraph`를 쓰지 않고, 최상위 박스에 `Before: ...`, `After: ...` 라벨을 직접 둔다.
- 예시는 `Before: operator manually deploys on OCI`, `After: operator runs workflow_dispatch`처럼 박스 텍스트 자체로 상태를 구분한다.
- 흐름 변화가 없으면 단일 `Current` 다이어그램만 두거나, 아주 작은 변경이면 `mermaid`를 생략하고 그 이유를 PR 본문에 남긴다.
- PR 본문에는 이번 변경으로 추가되거나 수정된 테스트 명세도 포함한다.
  - 어떤 시나리오를 검증하는지
  - 실패를 먼저 확인했는지
  - 최종적으로 어떤 테스트를 통과했는지
- 이슈 본문에는 정책 변경, 완료 조건 변화, phase 범위 변화처럼 구현 계획에 영향을 주는 내용만 반영한다.
- 이슈 본문에는 최소한 아래 2가지를 유지한다.
  - 완료 조건
  - 회귀 테스트 관점의 검증 항목
- PR 본문에는 관련 이슈의 테스트/검증 항목을 실제로 어떻게 체크했는지 대응 관계가 드러나야 한다.
- PR 체크리스트에는 관련 이슈의 완료 조건과 테스트 항목을 이번 변경에서 확인했는지 점검하는 항목을 둔다.
- 테스트 명세나 이번 커밋에서 추가된 검증 항목은 이슈보다 PR 본문에 우선 반영한다.
- PR과 이슈 설명이 현재 브랜치 상태와 어긋난 채로 커밋/푸시하지 않는다.
- 매 PR push마다 아래를 다시 확인한다.
  - 문서 영향 분석을 다시 했는가
  - 관련 문서를 업데이트했는가, 아니면 불필요 이유를 남겼는가
  - 이슈의 완료 조건이 여전히 최신 정책과 맞는가
  - 이슈의 회귀 테스트 항목이 빠지지 않았는가
  - PR 본문이 이번 push의 테스트 체크 결과를 반영하는가
  - 로컬에서 GitHub Actions CI와 동일한 명령을 실행해 통과했는가

## 로컬 CI 원칙

- PR을 push하기 전에는 GitHub Actions 워크플로우에 들어 있는 명령을 로컬에서 동일하게 실행하고 모두 통과시킨다.
- `lint만 통과`, `테스트만 통과`처럼 일부만 확인한 상태로 push하지 않는다.
- CI에 `prettier --check`, `typecheck`, `build`, `test`가 있으면 로컬에서도 같은 명령으로 확인한다.
- 가능하면 저장소에 `local:ci` 같은 스크립트를 만들어 반복 실행을 단순화한다.
- 현재 저장소 기준 최소 확인 명령은 아래와 같다.
  - `npm run lint`
  - `npx prettier --check src`
  - `npm run build`
  - `npm test`

## 이슈 작성 원칙

- 구현 이슈는 `.github/ISSUE_TEMPLATE/implementation.yml`을 사용한다.
- 이슈 본문에는 배경, 목표, 범위, 완료 조건, 검증 항목, 회귀 테스트, 구현 계획을 함께 적는다.
- 이슈 본문에는 문서 영향도 함께 적는다.
- `완료조건`은 추상적인 표현이 아니라 머지 전 확인 가능한 결과로 적는다.
- `검증항목`은 실제 명령 또는 수동 확인 절차로 적는다.
- `회귀 테스트 계획`에는 어떤 동작을 깨뜨리면 안 되는지와 어떤 관점으로 확인해야 하는지 적는다.
- `문서 영향`에는 어떤 문서를 갱신해야 하는지 적고, 없으면 그 이유를 적는다.
- 이슈는 테스트 코드 수준의 상세 설계까지 책임지지 않는다. 테스트 구체화, red 확인, green 확인은 `issue-implement-pr` 스킬이 담당한다.
- 이슈는 문서 diff 자체를 설계하지 않고, 어떤 문서가 영향을 받는지만 선언한다. 실제 문서 업데이트 여부 판단과 반영은 구현 스킬이 맡는다.
- 실패 테스트가 어렵다면 이슈 본문에는 이유와 대체 검증 절차를 적고, 실제 red/green 또는 대체 검증 판단은 스킬이 맡는다.
- 구현 계획은 2계층으로 나눈다.

### 1. 상위 계층 구현 계획

- 상위 계층은 아키텍처 접근과 해결 전략을 설명한다.
- 가능하면 `mermaid` 다이어그램을 넣어서 흐름, 컴포넌트 관계, 이벤트/데이터 이동을 먼저 보여준다.
- 상위 계층에는 구체적인 코드나 함수 구현 세부사항을 적지 않는다.
- 무엇을 어떤 구조로 해결할지, 어떤 책임으로 나눌지, 어떤 순서로 전환할지를 설명한다.

### 2. 하위 계층 구현 계획

- 하위 계층은 상위 계층 계획을 실제 저장소 구조에 어떻게 반영할지 적는다.
- 파일/모듈/이벤트/모델/테스트 단위로 어디를 어떻게 바꿀지 구체적으로 적는다.
- 단, 하위 계층도 이슈 본문에서는 코드 스니펫보다 구현 방향과 변경 포인트 설명을 우선한다.
- 필요하면 다음을 포함한다.
  - 변경 대상 파일
  - 추가/수정할 책임
  - 검증 방법
  - 후속 작업 또는 별도 PR 분리 기준

- 구현 계획은 읽는 사람이 \"왜 이 구조로 가는지\"와 \"어떤 순서로 구현할지\"를 코드 없이도 이해할 수 있어야 한다.

## 자주 쓰는 명령

- `npm run build`
- `npm run local:ci`
- `npm run lint`
- `npm run lint:fix`
- `npm run test`
- `npm run test:smoke`
- `npm run test:integration`
- `npm run start`

## 문서 갱신 기준

- 새 슬래시 커맨드 추가: `AGENTS.md`, `docs/PROJECT.md`, 필요 시 `docs/USER_STORIES.md`
- 역할 기반 신청/자동 활성화 흐름 추가: `AGENTS.md`, `docs/PROJECT.md`, `docs/USER_STORIES.md`
- 이벤트 흐름 변경: `AGENTS.md`, `docs/PROJECT.md`
- DB 컬럼/테이블 변경: `AGENTS.md`, `docs/PROJECT.md`, 관련 테스트
- self-service 정책 변경: `AGENTS.md`, `docs/PROJECT.md`, `docs/USER_STORIES.md`, `README.md`
- 정책/운영 규칙 변경: `AGENTS.md`, 해당 정책 문서
- 주말/공휴일 보너스 정책 변경: `AGENTS.md`, `docs/PROJECT.md`, `docs/USER_STORIES.md`, `docs/HOLIDAY_POLICY.md`, `README.md`
- CI/CD 또는 배포 절차 변경: `AGENTS.md`, `docs/PROJECT.md`, `docs/USER_STORIES.md`, `docs/PRODUCTION_RUNBOOK.md`
- 구현 계획 문서 추가/수정: `AGENTS.md`, `docs/plan/*`
- GitHub 이슈/PR 프로세스 변경: `AGENTS.md`, `.github/*`, 필요 시 `docs/pull_request_template.md`

## Sources

- `package.json`
- `README.md`
- `CLAUDE.md`
- `docs/PROJECT.md`
- `src/index.ts`
- `src/deploy-commands.ts`
- `src/events/interactionCreate.ts`
- `src/events/ready.ts`
- `src/repository/config.ts`
- `src/repository/Users.ts`
- `src/repository/AttendanceLog.ts`
- `src/repository/CamStudyActiveSession.ts`
- `src/commands/haruharu/register.ts`
- `src/test/US-01-register.test.ts`
- `vitest.config.ts`
