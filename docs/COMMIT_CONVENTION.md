# 커밋 컨벤션

## 커밋 타입

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅, 세미콜론 누락, 코드 변경이 없는 경우
- `refactor`: 코드 리팩토링
- `test`: 테스트 코드, 리팩토링 테스트 코드 추가
- `chore`: 빌드 업무 수정, 패키지 매니저 수정

## 커밋 메시지 형식

```
[타입]: [작업 내용] (#[이슈번호])
```

## 커밋 메시지 예시

- `feat: 로그인 페이지 UI 구현 (#123)`
- `fix: 404 에러 처리 로직 수정 (#456)`
- `refactor: 데이터베이스 마이그레이션 코드 개선 (#789)`
- `test: processStore 단위 테스트 추가 (#9)`
- `docs: README에 설치 가이드 추가 (#321)`
- `chore: 빌드 스크립트 최적화 (#555)`

## 커밋 규칙

### 1. 적절한 단위로 커밋
- 의미 있는 작업 단위가 완료되면 즉시 커밋
- **원자적 커밋(Atomic Commit)**: 하나의 커밋은 하나의 의도만 가져야 함

### 2. 커밋 시점
- 기능 하나가 완성되었을 때
- 버그 수정이 완료되었을 때
- 설정 파일 변경이 완료되었을 때
- 테스트 코드 작성이 완료되었을 때

### 3. 커밋 전 필수 검증

**Frontend 코드 작업 시**:
```bash
# 1. 린트 확인
cd frontend && npm run lint

# 2. 테스트 실행
npm run test:run

# 3. 빌드 테스트 (TypeScript 컴파일 및 번들링 검증)
npm run build

# 4. 모두 통과하면 커밋
git add .
git commit -m "커밋 메시지"
```

**Backend 코드 작업 시**:
```bash
# 1. 린트 확인
cd backend && npm run lint

# 2. 테스트 실행
npm run test

# 3. 빌드 테스트
npm run build

# 4. 모두 통과하면 커밋
git add .
git commit -m "커밋 메시지"
```

## 좋은 커밋 예시

```bash
# 1. 린트 확인
cd frontend && npm run lint

# 2. 테스트 확인
npm run test:run

# 3. 특정 파일만 커밋 (작은 단위)
git add frontend/src/store/processStore.test.ts
git commit -m "test: processStore 단위 테스트 추가 (#9)"

# 4. 다음 작업 진행
git add frontend/src/store/windowStore.test.ts
git commit -m "test: windowStore 단위 테스트 추가 (#9)"
```

## 나쁜 커밋 예시

```bash
# ❌ 여러 의도가 섞임 (원자적 커밋 위반)
git commit -m "feat: 로그인 추가 및 버그 수정 및 테스트 추가"

# ❌ 린트/테스트 확인 없이 커밋
git commit -m "fix: 버그 수정" # 린트 에러가 있을 수 있음

# ❌ 모호한 메시지
git commit -m "수정"
git commit -m "작업 완료"

# ❌ 이슈 번호 누락
git commit -m "feat: 로그인 기능 추가"  # (#123) 같은 이슈 번호가 없음
```

## 커밋 작업 흐름

```bash
# 1. 작업 진행
# ... 코드 작성 ...

# 2. 린트 검사
npm run lint

# 3. 테스트 검사
npm run test:run

# 4. 빌드 검사 (프론트엔드)
npm run build

# 5. 변경사항 확인
git status
git diff

# 6. 스테이징
git add [파일명]  # 또는 git add .

# 7. 커밋
git commit -m "feat: 새로운 기능 추가 (#이슈번호)"

# 8. 푸시
git push
```

## 커밋 메시지 작성 팁

1. **명확하고 간결하게**: 무엇을 변경했는지 한눈에 알 수 있게 작성
2. **현재형 동사 사용**: "추가한다", "수정한다" (X) → "추가", "수정" (O)
3. **이슈 번호 필수**: 모든 커밋은 이슈와 연결되어야 함
4. **의미 있는 단위**: 너무 크거나 작지 않게, 리뷰 가능한 단위로 커밋
5. **테스트 통과 상태**: 모든 커밋은 테스트가 통과하는 상태여야 함
