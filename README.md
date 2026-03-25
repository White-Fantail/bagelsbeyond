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

### Stage 3
- **매출 예측**: 규칙 기반 예측 엔진 (`rule_based_v1`) — 요일·날씨·공휴일·이벤트·방학 가중치 적용
- **예측 목록/상세** (`/predictions`, `/predictions/[id]`): 예측 결과 목록, 요인별 기여도 상세, 실제 데이터와 비교
- **예측 생성** (`/predictions/new`): 날짜 선택 → 외부 데이터 자동 수집 → 예측 실행 → DB 저장
- **내부 데이터 CSV 가져오기** (`/imports`, `/imports/new`, `/imports/[id]`): CSV 파일 업로드 → 검증 → 임포트
- **외부 데이터 자동수집 프로바이더**: 날씨·공휴일·이벤트·뉴스·학교방학 Mock 프로바이더 (실제 API 연동 구조 준비)
- **대시보드 강화**: 최근 예측 카드, 최근 CSV 가져오기 카드, 빠른 액션 버튼
- **신규 DB 모델**: `SalesPrediction`, `PredictionFactorSnapshot`, `ImportJob`, `ImportRow`

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

### 3. Prisma 클라이언트 생성

```bash
npx prisma generate
```

### 4. 데이터베이스 마이그레이션

```bash
npx prisma migrate dev --name init
```

### 5. 시드 데이터 입력 (선택)

```bash
npx prisma db seed
```

### 6. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

### 7. 테스트 실행

```bash
npm test
```

## 프로덕션 빌드

```bash
npm run build
npm start
```

## 데이터 모델

| 모델 | 설명 |
|------|------|
| `DailyRecord` | 일별 매출 기록 (날짜, 베이글 수량, 채널별 매출) |
| `DailyExternalFactor` | 외부 요인 (날씨, 공휴일, 이벤트, 뉴스, 방학 여부) |
| `PredictionWeight` | 예측 가중치 (요인별 매출 영향 계수) |
| `AppSetting` | 앱 설정 (상점명, 폐기율, 생산 버퍼) |
| `SalesPrediction` | 예측 결과 (날짜, 예측 매출/판매량/생산량, 신뢰도) |
| `PredictionFactorSnapshot` | 예측에 사용된 요인별 기여도 스냅샷 |
| `ImportJob` | CSV 임포트 작업 (파일명, 상태, 행 수 통계) |
| `ImportRow` | CSV 임포트 개별 행 (파싱 결과, 검증 오류, 연결된 DailyRecord) |

## 예측 흐름

```
1. /predictions/new 에서 날짜 선택
2. [선택] 외부 데이터 자동 수집 버튼 클릭
   → collectExternalFactors(date) 호출
   → 날씨·공휴일·이벤트·뉴스·방학 데이터 수집 (Mock → 실제 API 교체 가능)
   → DailyExternalFactor에 upsert
3. 예측 실행 버튼 클릭
   → buildPredictionInput(date): 최근 30일 DailyRecord, PredictionWeight, 외부 데이터 조회
   → calculateRuleBasedPrediction(input): 요일·날씨·공휴일·이벤트·방학 가중치 적용
   → savePredictionResult(result): SalesPrediction + PredictionFactorSnapshot DB 저장
4. 상세 페이지 /predictions/[id] 로 이동
   → 예측 결과 카드 + 요인 기여도 목록
   → 실제 DailyRecord가 있으면 예측 vs 실제 비교 카드 표시
```

## 내부 데이터 CSV 임포트 흐름

```
1. /imports/new 에서 CSV 파일 업로드 (또는 템플릿 다운로드)
2. parseCsvContent(csvText): 컬럼 파싱 + 유효성 검사
   → 각 행을 ImportRow로 저장 (status: valid / invalid)
3. ImportJob 상태: pending → ready (또는 failed)
4. /imports/[id] 에서 유효한 행 확인 후 임포트 실행
   → 같은 날짜 DailyRecord가 있으면 기본 skip (overwrite 옵션 제공)
   → ImportRow status: valid → imported / skipped
5. [선택] 임포트 완료 후 "외부 데이터 수집" 버튼
   → 해당 날짜 범위에 대해 collectExternalFactorsForDateRange 호출
```

### CSV 파일 형식

```csv
date,bagelsBaked,bagelsLeft,storeSales,uberSales,doordashSales,otherSales,notes
2024-01-15,80,5,250.00,80.00,50.00,10.00,평일 보통
2024-01-20,100,3,320.00,110.00,70.00,15.00,토요일 많음
```

- `date` 필드는 필수 (YYYY-MM-DD 형식 권장, DD-MM-YYYY도 지원)
- 컬럼명은 대소문자 구분 없이 인식 (예: `doordashSales` / `doordash_sales` 모두 허용)
- 템플릿 다운로드: `/imports/new` 페이지에서 📥 버튼 클릭

## 외부 데이터 자동수집 구조

외부 데이터(날씨·공휴일·이벤트·뉴스·방학)는 사용자가 직접 입력하지 않고
시스템이 날짜 기준으로 자동 수집합니다.

```
lib/providers/
├── weather/index.ts        WeatherProvider, MockWeatherProvider
├── holiday/index.ts        HolidayProvider, MockHolidayProvider (NZ 공휴일 내장)
├── events/index.ts         EventsProvider, MockEventsProvider
├── news/index.ts           NewsProvider, MockNewsProvider
├── school-holiday/index.ts SchoolHolidayProvider, MockSchoolHolidayProvider (NZ 방학 내장)
└── index.ts                collectExternalFactors / collectExternalFactorsForDateRange / refreshExternalFactorsForRecord
```

### 실제 API 연동 포인트 (TODO)

| 프로바이더 | 파일 | 교체 방법 |
|-----------|------|-----------|
| 날씨 | `lib/providers/weather/index.ts` | `WEATHER_API_KEY` 설정 후 `RealWeatherProvider` 구현 |
| 공휴일 | `lib/providers/holiday/index.ts` | `https://date.nager.at/api/v3/PublicHolidays` 연동 |
| 이벤트 | `lib/providers/events/index.ts` | 내부 이벤트 DB 테이블 또는 외부 API 연동 |
| 뉴스 | `lib/providers/news/index.ts` | `NEWS_API_KEY` 설정 후 NewsAPI / GNews 연동 |
| 학교방학 | `lib/providers/school-holiday/index.ts` | 교육부 공식 캘린더 또는 수동 DB 테이블 연동 |

각 파일의 `TODO` 주석에 연동 포인트가 명시되어 있습니다.

현재 Mock 프로바이더는 `null` 또는 빈 배열을 반환합니다.  
(단, `MockHolidayProvider`와 `MockSchoolHolidayProvider`는 NZ 기준 정적 데이터 내장)

## 예측 가중치 키 목록

| 키 | 설명 |
|----|------|
| `monday` ~ `sunday` | 요일별 가중치 |
| `weather_rain` | 비 오는 날 |
| `weather_hot` | 더운 날 (28°C 이상) |
| `holiday` | 공휴일 |
| `local_event` | 지역 이벤트 |
| `school_holiday` | 학교 방학 |
| `nz_news` | 뉴질랜드 뉴스 |
| `world_news` | 국제 뉴스 |
