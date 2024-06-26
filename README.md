# haruharu-discord-bot

스터디 운영을 위한 디스코드봇

## 캠스터디

- 공부시간
    - 평일 09:00 ~ 18:00
- 계획과 회고
    - 아침 9시에 10분간 체크인타임으로 서로의 공부계획을 공유하고
    - 오후 6시에 체크아웃으로 하루공부회고를 공유합니다
- 캠스터디
    - 캠으로 마우스, 키보드, 신체부분노출 등 가능합니다
    - 캠이 아닌 화면공유로는 불가합니다
- 하루 공부시간 계산
    - '스터디실'에서 카메라를 켜면 타임카운트에 들어갑니다.
    - '스터디실'에서 카메라를 끄면(혹은 나가면) 공부시간이 누적됩니다.
    - 23시 59분에 하루공부시간이 공개됩니다.
    - 금요일마다 주(week) 공부시간이 공개됩니다.
- 휴식
    - 특별한 사정이 생겨 공부하기 힘들면 미리 공지만 해주시면 됩니다.
    - 그렇지 않고, 하루 공부시간이 없을 경우 퇴출합니다. (주말/공휴일 제외)

## 기상챌린지

- 초기화:
    - 매월 초에 `등록`채널에 글을 올려 자신의 기상시간을 설정합니다.
    - 설정가능한 유효한 기상시간 범위: 0500 ~ 0900
    - 작성방법(등록채널): yyyymm HHmm (e.g. `202404 0700 등록합니다`)

- 체크인 & 체크아웃:
    - check-in: (설정한 기상시간) 전(front) 30분 후(back) 10분 안으로 타임스탬프 사진을 찍어 `체크인체크아웃` 채널에 올림으로써 check-in 합니다
    - check-out: (설정한 기상시간) 한시간 뒤 전후 10분 안으로 타임스탬프 사진을 찍어 `체크인체크아웃` 채널에 올림으로써 check-out 합니다
- 출석결과
    - 오전 11시에 출석결과가 공지됩니다.

- 지각&결석
    - 지각은 설정한 기상시간 전후 30분안으로 인정됩니다
        - check-in, check-out 둘 다 성공하여야 출석으로 인정됩니다
        - check-in, check-out 중 하나라도 하지않으면 결석으로 됩니다
            - 3회 결석 초과시 퇴출됩니다 (삼진아웃)
- 휴식&휴가
    - 휴식을 취하고 싶거나 휴가를 가는 경우 미리 '잡담' 채널에 알려주세요.
- 공휴일 & 주말
    - 공휴일과 주말은 모두 지각, 결석을 카운트 하지 않고 출석결과도 공지하지 않습니다
    - 하지만 평일과 똑같이 check-in/ check-out 기능은 동작합니다
    
## 기상챌린지-명령어

- `/check-in`
    - 명령을 요청한 시간을 기록한다
    - 요청한 시간의 유효성에 따라 `출석/지각` 값을 데이터베이스에 저장한다
- `/check-out`
    - 명령을 요청한 시간을 기록한다
    - 요청한 시간의 유효성에 따라 `출석/지각` 값을 데이터베이스에 저장한다
- `/register <memberId> <yearMonth> <time>`
    - 월별 기상시간을 설정한다
    - 관리자에게만 허용한다

## 시스템

- 배포
    - Amazon EC2
    - pm2
- 데이터베이스
    - sqlite3
- 라이브러리
    - sequelize (데이터 접근 기술, ORM)
    - winston, winston-daily-rotate-file (logging)