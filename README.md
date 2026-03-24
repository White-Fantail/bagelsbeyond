# 베이글스 비욘드 매출 관리 대장

베이글스 비욘드(Bagels Beyond) 베이커리의 일별 매출 데이터를 기록하고 분석하는 웹 애플리케이션입니다.

## 기능

### Stage 1
- **대시보드**: 최근 7일 매출 요약, 통계 카드, 빠른 이동 메뉴
- **매출 목록**: 일별 매출 기록 조회 (채널별 분류 포함)
- **새 매출 입력**: 매출, 베이글 수량, 외부 요인(날씨·공휴일·이벤트), 뉴스 요약 입력
- **달력 보기**: 월별 매출 현황 캘린더
- **설정**: 상점 이름, 폐기 허용 비율, 생산 버퍼 설정

### Stage 2
- **매출 상세 보기**: 기본 정보, 외부 요인, 파생 지표(판매율·폐기율·채널 비중) 표시
- **매출 수정/삭제**: 기존 기록 수정 및 삭제 확인 다이얼로그
- **매출 목록 필터**: 날짜 범위 및 키워드(메모·이벤트·공휴일)로 검색
- **모바일 카드 뷰**: 소형 화면에서 카드 형태로 매출 목록 표시
- **달력 클릭**: 매출 기록이 있는 날 클릭 시 상세 페이지로 이동
- **예측 가중치 관리**: 요인별 가중치 CRUD (인라인 편집·삭제·추가)
- **대시보드 강화**: 평균 폐기율 카드, 최근 기록 채널 비중, 최근 5건 클릭 가능 링크
- **분석 유틸**: `lib/analytics.ts`에 판매율·폐기율·채널 비중 등 계산 함수
- **단위 테스트**: Vitest로 analytics 함수 테스트

## 기술 스택

- **프레임워크**: Next.js 16 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **ORM**: Prisma
- **데이터베이스**: PostgreSQL
- **폼 검증**: React Hook Form + Zod
- **테스트**: Vitest

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 `.env`로 복사하고 데이터베이스 연결 정보를 입력합니다:

```bash
cp .env.example .env
```

`.env` 파일:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

### 3. 데이터베이스 마이그레이션

```bash
npx prisma migrate dev --name init
```

### 4. 시드 데이터 입력 (선택)

```bash
npx prisma db seed
```

### 5. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

### 6. 테스트 실행

```bash
npm test
```

## 프로덕션 빌드

```bash
npm run build
npm start
```

## 데이터 모델

- **DailyRecord**: 일별 매출 기록 (날짜, 베이글 수량, 채널별 매출)
- **DailyExternalFactor**: 외부 요인 (날씨, 공휴일, 이벤트, 뉴스)
- **PredictionWeight**: 예측 가중치 (날씨·요일·이벤트별 매출 영향 계수)
- **AppSetting**: 앱 설정 (상점명, 폐기율, 생산 버퍼)

## 예측 가중치 키 목록

| 키 | 설명 |
|----|------|
| `monday` ~ `sunday` | 요일별 가중치 |
| `weather_rain` | 비 오는 날 |
| `holiday` | 공휴일 |
| `local_event` | 지역 이벤트 |
| `school_holiday` | 학교 방학 |
| `nz_news` | 뉴질랜드 뉴스 |
| `world_news` | 국제 뉴스 |

