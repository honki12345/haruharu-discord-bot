# 브랜치 컨벤션

## 브랜치 전략

- main으로 머지를 하되 feature 단위로 파서 진행

## 브랜치 네이밍 규칙

핵심 구조는 **`[유형]/[내용요약]`** 입니다.

| **순서** | **요소** | **설명** | **예시** |
| --- | --- | --- | --- |
| **1. 접두사 (유형)** | 작업의 성격 | 반드시 **소문자**를 사용하며, 작업의 목적을 나타냅니다. | `feature`, `bugfix`, `hotfix`, `refactor`, `test` |
| **2. 슬래시(`/`)** | 계층 구분 | 브랜치를 종류별로 묶어주는 역할을 합니다. | `/` |
| **3. 본문 (내용)** | 작업 내용 | **하이픈(`-`)**으로 단어를 구분하고, 구체적인 내용을 간결하게 요약합니다. | `login-page-ui`, `issue-404-fix`, `db-migration` |

## 브랜치 이름 예시

- `feature/login-page-ui`
- `bugfix/issue-404-fix`
- `refactor/db-migration`
- `hotfix/critical-security-patch`
- `test/frontend-test`

## 브랜치 생성 시 주의사항

- 브랜치 이름에 `#`이 포함되면 zsh/bash에서 주석으로 인식되므로 **반드시 따옴표로 감싸야 함**
- 올바른 생성 방법: `git checkout -b 'fix/frontend-build-type-error-fix'`
- 잘못된 생성 방법: `git checkout -b fix/frontend-build-type-error-fix` (오류 발생)

## 브랜치 작업 흐름

```bash
# 2. 브랜치 생성 (따옴표로 감싸기!)
git checkout -b 'feature/login-page-ui'

# 3. 작업 진행 및 커밋
git add .
git commit -m "feat: 로그인 페이지 UI 구현"

# 4. 원격 브랜치에 푸시
git push -u origin feature/login-page-ui

# 5. PR 생성(mcp 이용)
```
