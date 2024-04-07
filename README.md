# haruharu-discord-bot

스터디 운영을 위한 디스코드봇

## 규칙

- 초기화:
    - 매월 초에 `등록`채널에 글을 올려 자신의 기상시간을 설정합니다.
    - 설정가능한 유효한 기상시간 범위: 0500 ~ 0900
    - 작성: yyyymm HH 등록합니다 (e.g. `202404 0700 등록합니다`)
- 체크인 & 체크아웃:
    - check-in: (설정한 기상시간) 전후 10분 안으로 타임스탬프 사진을 찍어 `체크인체크아웃` 채널에 올림으로써 check-in 합니다
    - check-out: (설정한 기상시간) 한시간 뒤 전후 10분 안으로 타임스탬프 사진을 찍어 `체크인체크아웃` 채널에 올림으로써 check-out 합니다
- 지각&결석
    - 지각은 설정한 기상시간 전후 30분안으로 인정됩니다
        - check-in, check-out 둘 다 성공하여야 출석으로 인정됩니다
        - check-in, check-out 중 하나라도 하지않으면 결석으로 됩니다
            - 3회 결석 초과시 퇴출됩니다 (삼진아웃)
- 공지
    - 오전 11시에 출석결과가 공지됩니다.

## 기능

- 자신의 기상시간을 설정한다
- 정해진 유효시간동안(0500-0900/ 평일) `check-in`, `check-out`을 받는다
    - 유효한 시간에 성공시 전체메세지로 `출석/지각`을 노출한다
    - 유효한 시간은 자신이 설정한 기상시간을 기반으로 작성한다
    - 유효한 시간대가 아니면 에러메세지를 노출한다
- 특정 시간이(11:00) 지나면은 결과를 공지한다
    - 출석/지각/결석 결과를 보여준다

## 명령어

- `/check-in`
    - 명령을 요청한 시간을 기록한다
    - 요청한 시간의 유효성에 따라 `출석/지각` 값을 데이터베이스에 저장한다
- `/check-out`
    - 명령을 요청한 시간을 기록한다
    - 요청한 시간의 유효성에 따라 `출석/지각` 값을 데이터베이스에 저장한다
- `/register <memberId> <yearMonth> <time>`
    - 월별 기상시간을 설정한다
    - 관리자에게만 허용한다