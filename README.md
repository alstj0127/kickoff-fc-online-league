# KICKOFF

친구들과 FC 온라인 일대일 경기를 실제 리그처럼 운영하는 웹앱입니다.

## 주요 기능

- 3~9개 팀으로 팀별 1회 또는 2회 대결 리그 생성
- 직전 경기 참가자의 연속 출전을 최소화하는 랜덤 일정
- 드래그 앤 드롭으로 일정을 조정한 뒤 최종 확정
- 공유 링크와 관리 PIN을 통한 여러 기기 공동 운영
- 경기별 스코어 기록과 5초 주기 자동 동기화
- 승점, 득실차, 다득점, 최근 5경기를 반영한 실시간 순위
- PC와 모바일에 맞춘 반응형 화면

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

배포용 빌드와 테스트:

```bash
npm test
```

## 데이터

리그, 팀, 경기 결과는 Supabase의 클라우드 PostgreSQL 데이터베이스에
저장됩니다. `supabase/schema.sql`을 Supabase SQL Editor에서 한 번 실행한
뒤, `.env.example`을 참고하여 서버 환경변수를 설정합니다.

- `SUPABASE_URL`: 프로젝트 API 주소
- `SUPABASE_SECRET_KEY`: 서버 전용 Secret key

Secret key는 브라우저 코드나 GitHub 저장소에 올리지 않습니다.

## 배포

GitHub 저장소를 Vercel 프로젝트와 연결하면 `main` 브랜치 변경 사항이
자동으로 배포됩니다. 위의 Supabase 환경변수는 Vercel 프로젝트 설정에
추가해야 합니다.

## 운영 방식

리그를 만든 사람은 공유 링크와 별도로 관리 PIN을 친구들에게 전달할 수
있습니다. 링크를 가진 사람은 순위와 일정을 볼 수 있고, PIN을 아는 사람만
스코어를 저장하거나 수정할 수 있습니다.
