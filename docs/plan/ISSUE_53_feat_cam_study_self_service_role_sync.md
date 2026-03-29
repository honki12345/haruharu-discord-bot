# ISSUE #53 구현 계획

## 목표

- 캠스터디 참가자 등록의 진실 원본을 관리자 수동 명령에서 `@cam-study` 역할 상태로 전환한다.
- 역할 부여/회수 시 `CamStudyUsers`가 자동 동기화되도록 해서 기존 음성 추적 로직이 그대로 동작하게 유지한다.
- 기존 `/register-cam`, `/delete-cam`은 호환용 deprecated 명령으로 축소해 운영 모델을 명확히 한다.

## 범위

포함:

- `guildMemberUpdate` 기반 `@cam-study` 역할 동기화
- `CamStudyUsers` upsert / remove 헬퍼 추가
- `/register-cam`, `/delete-cam` deprecated 처리
- 관련 테스트와 문서 정리

제외:

- 캠스터디 음성 추적 규칙 변경
- 캠스터디 집계 로직 변경
- `#start-here` 문구 전체 개편
- 역할 신청 채널/공지 문구 전체 개편

## 상위 계층 계획

```mermaid
flowchart TD
    A[@cam-study 역할 부여] --> B[guildMemberUpdate]
    B --> C[camStudyRoleSync]
    C --> D[CamStudyUsers upsert]
    D --> E[기존 음성 추적 / 리포트 유지]
    F[@cam-study 역할 회수] --> B
    B --> G[활성 세션 없으면 CamStudyUsers delete]
    B --> H[활성 세션이면 종료 시점까지 delete defer]
```

- `CamStudyUsers`는 역할 상태를 반영하는 캐시/인덱스로 유지한다.
- 역할 기반 자동 등록은 `/apply-cam` self-service 활성화와 수동 역할 부여 양쪽에 동일하게 적용한다.
- 역할 회수 정책은 별도 비활성화 컬럼 추가 대신 row 삭제로 유지한다.
- 역할 회수 직후에도 이미 시작한 세션은 `CamStudyUsers` 삭제를 종료 시점까지 미뤄서 정상적으로 종료 분 계산을 마무리한다.

## 하위 계층 계획

- `src/events/guildMemberUpdate.ts`
  - `@cam-study` 역할 변화만 감지해서 동기화 서비스 호출
  - partial member 이벤트면 `newMember` 현재 역할 상태를 기준으로 self-heal 동기화
- `src/services/camStudyRoleSync.ts`
  - 역할 추가/제거 비교, 표시 이름 추출, 저장소 upsert/remove 책임 분리
  - 활성 세션 중 역할 제거면 삭제 defer
- `src/repository/camStudyRepository.ts`
  - `CamStudyUsers` upsert/remove 헬퍼 추가
  - 같은 `userid` 중복 row가 있으면 최신 값으로 1건 정리
- `src/runtime.ts`
  - 역할 변경 이벤트를 받기 위한 `GuildMembers` intent 추가
- `src/services/camStudy.ts`
  - revoke 이후 종료 이벤트에서 누적 분 계산을 마무리하고 `CamStudyUsers`를 정리
  - 등록 row가 없는 사용자는 stale timelog만으로 종료 적립을 만들지 못하도록 유지
- `src/commands/haruharu/register-cam.ts`
  - deprecated 안내 응답으로 전환
- `src/commands/haruharu/delete-cam.ts`
  - deprecated 안내 응답으로 전환
- `src/test/*`
  - 역할 부여/회수 기반 자동 등록 red -> green 테스트 추가
  - 기존 수동 명령 테스트를 deprecated 기대값으로 전환
  - smoke test에서 새 이벤트 로딩 확인

## 검증 전략

- 완료조건
  - 역할 부여 시 `CamStudyUsers` 자동 등록: `src/test/US-16-cam-study-role-sync.test.ts`
  - 역할 회수 시 `CamStudyUsers` 자동 해제, 활성 세션이면 종료 시점 defer: `src/test/US-16-cam-study-role-sync.test.ts`, `src/test/US-08-cam-study.test.ts`
  - 수동 명령 정리: `src/test/US-07-register-cam.test.ts`, `src/test/US-11-delete-cam.test.ts`, `src/test/integration/discord.integration.test.ts`
  - 기존 음성 추적 유지: `src/test/US-08-cam-study.test.ts`, `src/test/US-09-10-cam-study-report.test.ts`
  - runtime / partial member / 중복 정리 / revoke 경계 회귀: `src/test/US-14-bot-boot-smoke.test.ts`, `src/test/US-16-cam-study-role-sync.test.ts`, `src/test/repository.test.ts`, `src/test/US-08-cam-study.test.ts`

- 로컬 검증 명령
  - `npm run lint`
  - `npx prettier --check src docs`
  - `npm run build`
  - `npm test`

- 수동 검증
  - 실제 서버에서 `@cam-study` 역할 부여 후 별도 관리자 명령 없이 음성 추적 대상이 되는지 확인
  - 역할 제거 후 새 캠스터디 세션부터 추적 대상에서 빠지는지 확인
