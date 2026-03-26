# 🥯 Bagels Beyond — 운영 의사결정 도구

베이글 매장 운영을 위한 매출 추적, 예측, 생산량 추천 시스템.  
단순 CRUD를 넘어 **실제 매장 운영 판단**에 쓸 수 있는 수준의 예측과 추천을 제공합니다.

---

## 📋 구현 범위

### 데이터 관리
- **DailyRecord** CRUD — 날짜별 매출(매장/Uber/DoorDash/기타), 베이글 생산량/잔량 기록
- **CSV 임포트** — ImportJob / ImportRow 기반 배치 가져오기 (검증 → 확인 → 적용)
- **DailyExternalFactor** — 날씨/공휴일/이벤트/방학/뉴스 외부 요인 자동수집 및 저장

### 예측 및 추천
- **rule_based_v2 예측 엔진** — 기준값(최근 N일/같은 요일 평균) + 외부 요인 조정
- **생산량 추천** — 예측 판매량 + 최근 sold/baked 비율 + 안전 버퍼 기반
- **예측 설명 시스템** — 사람이 읽을 수 있는 bullet-point 근거 생성
- **예측 vs 실제 비교** — 매출/베이글/잔량 오차 계산, 정확도 라벨
- **예측 성과 페이지** — 최근 30건 비교, 평균 오차율, 정확도 추이

### 분석 리포트 (7단계)
- **분석 대시보드** (`/analytics`) — 기간 선택, 요약 카드, 기간 비교, 미니 주별 바차트, 공휴일/방학 하이라이트
- **일별 분석** (`/analytics/daily`) — 일별 매출/판매량/폐기율 바차트, 날짜별 외부요인 아이콘(🎌 공휴일/🌧️ 비/🎉 이벤트/🏫 방학)
- **주별 분석** (`/analytics/weekly`) — 주별 집계표 + 바차트, 전주 대비 변화율, 최고/최저 주 강조
- **월별 분석** (`/analytics/monthly`) — 월별 집계표 + 바차트, 전월 대비 변화율, 최고/최저 월 강조
- **세그먼트 비교** (`/analytics/segments`) — 공휴일 vs 일반 / 학교방학 vs 일반 / 비오는날 vs 맑은날 / 이벤트일 vs 일반 비교 카드, 공휴일 이름별 상세

### UI/UX
- **운영 대시보드** — 내일 예측 카드, 최근 실적 요약, 예측 정확도, 분석 요약(7일/월별 비교), 빠른 액션
- **달력** — 실적(주황) / 예측(파랑) / 모두 있음(보라) 셀 구분
- **가중치 관리** — 카테고리별 그룹화(요일/날씨/공휴일/이벤트/뉴스), 시각적 바 표시
- **예측 상세** — 근거 설명, 요인별 영향, 실적과 비교

---

## 🗂️ 데이터 흐름

```
수동 입력 (/sales/new)
  └→ DailyRecord 생성 + DailyExternalFactor 선택 입력

CSV 임포트 (/imports/new)
  └→ ImportJob 생성 → ImportRow 파싱/검증 → DailyRecord 적용

외부 데이터 자동수집 (/api/imports/[id]/collect-external)
  └→ 날씨/공휴일/이벤트 provider → DailyExternalFactor 저장

예측 생성 (/predictions/new)
  └→ buildPredictionInput()
      ├→ 최근 30일 DailyRecord 조회
      ├→ 같은 요일 기록 필터링
      ├→ PredictionWeight 조회
      └→ AppSetting 조회
  └→ calculateBaselineMetrics()
      ├→ 최근 N일 평균 매출
      ├→ 같은 요일 평균 매출 (가중 60%)
      ├→ 평균 폐기율
      └→ 평균 sold/baked 비율
  └→ applyExternalFactorAdjustments()
      └→ 요일/비/기온/공휴일/이벤트/방학/뉴스 가중치 적용
  └→ calculateRecommendedProduction()
      └→ 예측 판매량 × (1 / sold-baked 비율) + 특이상황 버퍼
  └→ buildPredictionExplanation()
      └→ 사람이 읽을 수 있는 근거 목록 생성
  └→ SalesPrediction + PredictionFactorSnapshot 저장

예측 vs 실제 비교 (/predictions/[id])
  └→ SalesPrediction + DailyRecord 조회
  └→ comparePredictedVsActual() → 오차/오차율/방향/라벨 계산

예측 성과 (/predictions/performance)
  └→ 최근 30건 예측 + 실적 비교
  └→ 평균 절대 오차, 평균 오차율, 정확도율 요약

분석 리포트 (/analytics/*)
  └→ getDailyAnalytics(startDate, endDate)
      ├→ DailyRecord + DailyExternalFactor 조회
      └→ 일별 매출/판매량/폐기율/채널비중/외부요인 배열 반환
  └→ getWeeklyAnalytics(startDate, endDate)
      ├→ DailyRecord 조회 → 월요일 기준 주차별 그룹핑
      └→ 주차별 PeriodSummary (총매출/평균/판매량/폐기율/채널) 배열 반환
  └→ getMonthlyAnalytics(startDate, endDate)
      ├→ DailyRecord 조회 → 연/월별 그룹핑
      └→ 월별 PeriodSummary 배열 반환
  └→ getPeriodComparison(currentStart, currentEnd, previousStart, previousEnd)
      └→ 두 기간 PeriodSummary 비교 → 매출/판매량/폐기율/채널 변화율 반환
  └→ getSegmentComparisons(startDate, endDate)
      ├→ 공휴일 vs 비공휴일 (holidayName 존재 여부)
      ├→ 학교방학 vs 일반 (schoolHoliday=true/false)
      ├→ 비오는날 vs 맑은날 (rainMm > 0)
      └→ 이벤트일 vs 일반 (localEventName 존재 여부)
```

---

## 🧮 예측 로직

### 1. 기준값 계산 (Baseline)
- 최근 30일 평균 매출 (전체 평균)
- 같은 요일 평균 매출 (동일 요일 기록)
- **블렌드**: 같은 요일 데이터 60% + 전체 평균 40%
- 데이터 없을 때 기본값: 매출 ₩300, 판매 60개

### 2. 외부 요인 조정 (Adjustments)
각 요인은 현재 예측값에 가중치 비율로 영향:
```
adjusted = current × (1 + weight)
```
| 요인 | 기본 가중치 | 설명 |
|------|-----------|------|
| 토요일 | +0.22 | 주말 최고 수요 |
| 비/강수 | -0.15 | 방문 고객 감소 |
| 공휴일 | +0.28 | 나들이 수요 증가 |
| 지역 이벤트 | +0.20 | 유동 인구 증가 |
| 학교 방학 | +0.10 | 가족 고객 증가 |
| 월요일 | -0.12 | 주중 최저 수요 |

### 3. 추천 생산량 계산
```
buffer = 1 / (최근 sold/baked 비율)
buffer = clamp(buffer, 1.02, 1.40)

if 공휴일 or 큰이벤트:  buffer += 0.05
if 최근폐기율 > 목표×2: buffer -= 0.05  (과생산 방지)

recommendedBagelsToBake = round(predictedBagelsSold × buffer)
predictedLeftovers       = recommendedBagelsToBake - predictedBagelsSold
projectedWasteRate       = predictedLeftovers / recommendedBagelsToBake
projectedSellThroughRate = 1 - projectedWasteRate
```

---

## 🛠️ 기술 스택
- **Next.js 16** (App Router, RSC)
- **TypeScript** (strict)
- **Tailwind CSS**
- **Prisma 7** (PostgreSQL adapter)
- **PostgreSQL**
- **Zod** (validation)
- **React Hook Form**

---

## ⚙️ 환경 변수

`.env.example`을 복사한 후 아래 표를 참고해 각 값을 채워주세요.

```bash
cp .env.example .env
```

### 필수 변수

| 변수명 | 예시 값 | 목적 | 발급 방법 |
|--------|---------|------|-----------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/beyond_dev` | Prisma가 PostgreSQL에 연결하는 데 사용하는 DB 접속 URL | 로컬: 직접 PostgreSQL 설치 후 설정. 클라우드: [Supabase](https://supabase.com/), [Neon](https://neon.tech/), [Railway](https://railway.app/) 등에서 Connection String 복사 |

### 뉴스 API (선택 — 없으면 뉴스 수집만 건너뜀)

| 변수명 | 예시 값 | 목적 | 발급 방법 |
|--------|---------|------|-----------|
| `NEWS_API_KEY` | `abc123...` | NewsAPI.org에서 뉴스 헤드라인을 가져와 `DailyExternalFactor.nzNewsSummary` / `worldNewsSummary`에 저장 | [https://newsapi.org/](https://newsapi.org/) 에서 무료 계정 생성 → API 키 발급 (무료 플랜: 과거 1개월 이내 기사만 조회 가능) |

### 기본 위치 설정 (선택 — 기본값: 뉴질랜드 크라이스트처치)

앱 설정 페이지(`/settings`)에서도 변경 가능하며, 환경 변수가 있으면 서버 사이드 기본값으로 사용됩니다.

| 변수명 | 기본값 | 목적 | 참고 |
|--------|--------|------|------|
| `DEFAULT_LATITUDE` | `-43.5321` | 날씨(Open-Meteo) API 호출에 사용할 기본 위도 | [Google Maps](https://maps.google.com) 또는 [latlong.net](https://www.latlong.net/)에서 좌표 확인 |
| `DEFAULT_LONGITUDE` | `172.6362` | 날씨(Open-Meteo) API 호출에 사용할 기본 경도 | 위와 동일 |
| `DEFAULT_TIMEZONE` | `Pacific/Auckland` | 날짜/시간 계산 및 날씨 조회 시 기준 타임존 | [IANA 타임존 목록](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) 참고 |
| `DEFAULT_REGION` | `Canterbury` | 학교 방학(`RuleBasedSchoolHolidayProvider`) 및 이벤트 조회 시 기준 지역 | 뉴질랜드 지역명 사용 (예: `Canterbury`, `Auckland`, `Wellington`) |
| `DEFAULT_COUNTRY_CODE` | `NZ` | Nager.at 공휴일 API 조회 시 사용할 국가 코드 | [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) 코드 (예: `NZ`, `AU`, `US`, `KR`) |

### 프로바이더 모드 전환 (선택 — 테스트/개발용)

각 변수를 `mock`으로 설정하면 외부 API 호출 없이 목(Mock) 데이터를 반환합니다.

| 변수명 | 값 | 목적 |
|--------|-----|------|
| `WEATHER_PROVIDER` | `mock` | Open-Meteo 날씨 API 대신 Mock 반환 (항상 `null` 반환) |
| `HOLIDAY_PROVIDER` | `mock` | Nager.at 공휴일 API 대신 Mock 반환 (NZ 주요 공휴일 정적 목록) |
| `SCHOOL_HOLIDAY_PROVIDER` | `mock` | 학교 방학 룰 기반 계산 대신 Mock 반환 |
| `EVENTS_PROVIDER` | `mock` | 이벤트 Placeholder 대신 Mock 반환 (빈 배열) |
| `NEWS_PROVIDER` | `mock` | NewsAPI 대신 Mock 반환 (`null` — `NEWS_API_KEY` 미설정 시 자동으로 mock 동작) |

### 미래 연동 예정 (현재 미사용)

| 변수명 | 목적 | 참고 |
|--------|------|------|
| `EVENTFINDA_API_KEY` | Eventfinda NZ 이벤트 API 연동 시 사용 예정 | [https://www.eventfinda.co.nz/api/v2/](https://www.eventfinda.co.nz/api/v2/) — 현재 이벤트 프로바이더는 Placeholder로 항상 빈 배열 반환 |

---

## 🚀 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 DATABASE_URL 및 필요한 값 입력 (위 환경 변수 표 참고)

# 3. DB 마이그레이션
npx prisma migrate deploy

# 4. Prisma 클라이언트 생성
npx prisma generate

# 5. 샘플 데이터 시딩 (선택)
npm run db:seed

# 6. 개발 서버 실행
npm run dev
```

---

## 🗄️ DB 작업

```bash
# 새 마이그레이션 생성 (개발 환경)
npx prisma migrate dev --name 변경사항_이름

# 마이그레이션 적용 (프로덕션)
npx prisma migrate deploy

# DB 리셋 + 재시딩
npx prisma migrate reset

# Prisma Studio (GUI)
npx prisma studio
```

---

## 📊 분석 리포트 시스템 (7단계)

### 분석 페이지 목록

| 경로 | 설명 |
|------|------|
| `/analytics` | 분석 대시보드 — 기간 선택, 요약 카드, 기간 비교, 미니 차트 |
| `/analytics/daily` | 일별 흐름 — 매출/판매량/폐기율 바차트 + 상세 표 |
| `/analytics/weekly` | 주별 집계 — 전주 대비 변화율, 최고/최저 주 |
| `/analytics/monthly` | 월별 집계 — 전월 대비 변화율, 최고/최저 월 |
| `/analytics/segments` | 세그먼트 비교 — 공휴일/방학/비/이벤트 vs 일반 |

### 기간 비교 기능

**자동 비교**: 선택한 기간과 동일 길이의 직전 기간을 자동으로 계산해 비교합니다.
- 최근 7일 → 그 전 7일 비교
- 이번 달 → 지난달 비교
- 임의 날짜 범위 → 동일 길이 직전 기간 비교

**비교 지표**:
- 총매출 변화 (금액 + %)
- 평균 일매출 변화
- 총 판매 베이글 수 변화
- 폐기율 변화
- 채널별 매출 비중 변화 (매장/Uber/DoorDash/기타)

**UI**: ▲/▼ 방향 표시, 녹색/적색 색상, % 변화율 표시

### 세그먼트 비교 분석

`DailyExternalFactor` 데이터를 기반으로 아래 4가지 세그먼트를 비교합니다:

| 세그먼트 | 기준 필드 | 설명 |
|--------|----------|------|
| 공휴일 vs 일반 | `holidayName` 존재 여부 | 공휴일 기간 매출 영향 |
| 학교방학 vs 일반 | `schoolHoliday = true` | 방학 기간 가족 고객 영향 |
| 비오는날 vs 맑은날 | `rainMm > 0` | 날씨 영향 분석 |
| 이벤트일 vs 일반 | `localEventName` 존재 여부 | 지역 이벤트 영향 |

각 세그먼트별로 평균 매출, 평균 판매량, 평균 폐기율, 채널 비중을 비교합니다.  
공휴일 이름별(예: Christmas, Easter, Waitangi Day 등) 세부 분석도 제공합니다.

### 분석 서비스 레이어

`lib/services/analytics/index.ts` 에서 다음 함수를 제공합니다:

```typescript
getDailyAnalytics(startDate, endDate)       // 일별 상세 배열
getWeeklyAnalytics(startDate, endDate)      // 주별 집계 배열
getMonthlyAnalytics(startDate, endDate)     // 월별 집계 배열
getPeriodSummary(startDate, endDate)        // 기간 요약 단일 객체
getPeriodComparison(...)                    // 두 기간 비교 객체
getHolidaySegmentComparison(...)            // 공휴일 세그먼트
getSchoolHolidaySegmentComparison(...)      // 방학 세그먼트
getRainSegmentComparison(...)               // 비/날씨 세그먼트
getEventSegmentComparison(...)              // 이벤트 세그먼트
getHolidayNameBreakdown(...)               // 공휴일 이름별 분석
```

### 분석 유틸 함수 (`lib/analytics-utils.ts`)

```typescript
formatCurrencyNZD(amount)              // NZD 통화 포맷
formatPercentage(value, decimals)      // % 포맷
getPercentageChange(current, previous) // 변화율 계산
getTrendLabel(current, previous)       // "▲ +12.3%" 형태
getTrendColorClass(...)                // 녹색/적색 Tailwind 클래스
safeDivide(numerator, denominator)     // 0 나누기 안전 처리
startOfWeek(date) / endOfWeek(date)    // 주 시작/끝 (월~일)
startOfMonth(date) / endOfMonth(date)  // 월 시작/끝
buildComparablePreviousPeriod(...)     // 직전 동일 길이 기간 계산
```

---

## 🤖 자동화 작업 / 스케줄링 시스템 (6단계)

### 개요

외부요인 수집과 예측 생성이 **자동으로 실행**되도록 `ScheduledTask` / `TaskLog` 기반의 백그라운드 작업 시스템이 구현되어 있습니다.

### Task 상태 정의

| 상태 | 설명 |
|------|------|
| `pending` | 대기 중 (아직 실행 안 됨) |
| `running` | 현재 실행 중 |
| `success` | 성공적으로 완료 |
| `partial` | 일부 provider 실패 (데이터는 저장됨) |
| `failed` | 전체 실패 |
| `skipped` | 이미 데이터 존재하여 건너뜀 |

### 외부요인 자동수집 흐름

```
scheduleExternalFactorCollection(date)
    ↓ ScheduledTask 생성 (pending)
runExternalFactorCollectionTask(taskId)
    ↓ status → running
    ↓ 모든 provider 동시 호출 (weather, holiday, schoolHoliday, events, news)
    ↓ 부분 실패 → partial, 전체 실패 → failed, 모두 성공 → success
    ↓ TaskLog 기록
    ↓ DailyExternalFactor upsert
```

### 예측 자동생성 흐름

```
schedulePredictionGeneration(date)
    ↓ ScheduledTask 생성 (pending)
runPredictionGenerationTask(taskId)
    ↓ status → running
    ↓ 기존 예측 존재? → skipped
    ↓ 외부요인 없으면 자동 수집 시도
    ↓ buildPredictionInput() → calculateRuleBasedPrediction() → savePredictionResult()
    ↓ TaskLog 기록
    ↓ SalesPrediction 저장
```

### Import → External Factors → Prediction 자동 파이프라인

CSV import 완료 시 자동으로 다음 파이프라인이 실행됩니다:

```
ImportJob (execute)
    ↓ triggerPostImportTasks(importJobId)
    ↓ import된 날짜 범위 계산
    ↓ 각 날짜에 대해 scheduleExternalFactorCollection(date) 등록
        ↓ [나중에 cron/manual 실행]
        ↓ runExternalFactorCollectionTask()
        ↓ 수집 완료 → ensurePredictionForDate(date)
        ↓ runPredictionGenerationTask()
```

### API 엔드포인트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `POST /api/cron/run` | POST/GET | cron trigger (action 파라미터로 제어) |
| `GET /api/tasks` | GET | 작업 목록 조회 |
| `POST /api/tasks` | POST | 새 작업 생성 (+ runNow 옵션) |
| `GET /api/tasks/[id]` | GET | 작업 상세 + 로그 |
| `POST /api/tasks/[id]/retry` | POST | 실패 작업 재시도 |

#### /api/cron/run action 옵션

```json
{ "action": "run_pending" }           // 대기 중 작업 모두 실행
{ "action": "ensure_external_factors" } // 오늘~모레 외부요인 수집
{ "action": "schedule_tomorrow_prediction" } // 내일 예측 생성
{ "action": "all" }                   // 위 세 가지 모두 실행
```

### cron / 외부 스케줄러 연결 방법

#### 옵션 1: GitHub Actions

```yaml
# .github/workflows/cron.yml
on:
  schedule:
    - cron: '0 20 * * *'  # 매일 오전 9시 NZT (UTC+13)
jobs:
  run-tasks:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger cron endpoint
        run: |
          curl -X POST https://your-domain.com/api/cron/run \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{"action":"all"}'
```

#### 옵션 2: AWS EventBridge / CloudWatch

AWS Lambda 또는 EventBridge Scheduler를 사용해 매일 정해진 시간에 `/api/cron/run`을 POST 호출합니다.

#### 옵션 3: Vercel Cron Jobs

`vercel.json`에 cron 설정을 추가합니다:

```json
{
  "crons": [
    { "path": "/api/cron/run", "schedule": "0 20 * * *" }
  ]
}
```

#### 보안 설정

`.env`에 `CRON_SECRET=your-random-secret`을 추가하면 인증되지 않은 요청을 거부합니다.

```env
CRON_SECRET=your-random-secret-here
```

### UI 페이지

- **/** (대시보드): 작업 상태 요약, 최근 5개 작업, 빠른 액션 버튼
- **/tasks**: 전체 작업 목록, 상태별 필터, 빠른 실행 버튼
- **/tasks/[id]**: 작업 상세 정보, TaskLog 목록, 재시도 버튼

---

## 🔌 Loyverse POS 연동 (Phase 5)

### 개요

Loyverse POS의 상품 카탈로그를 내부 Product 구조로 자동 동기화하고, 내부 주문을 Loyverse 영수증으로 전송하며, Loyverse 영수증 내역으로부터 일별 판매 수량을 가져오는 기능이 구현되어 있습니다.

### 구현 범위

| 기능 | 상태 | 파일 |
|------|------|------|
| 카탈로그 동기화 (Loyverse → Product) | ✅ Phase 5A | `lib/integrations/services/catalog-sync.ts` |
| 카탈로그 매퍼 (Raw → ExternalProduct) | ✅ Phase 5A | `lib/integrations/services/catalog-mapper.ts` |
| 주문 POS 전송 (POST /receipts) | ✅ Phase 5B | `lib/integrations/adapters/pos/loyverse.ts` |
| 일별 판매 수량 동기화 (GET /receipts) | ✅ Phase 5B | `lib/integrations/adapters/pos/loyverse.ts` |
| 모디파이어 그룹 이름 변경 안전성 | ✅ Phase 5B | `ExternalOptionGroupMap` 모델 |
| 관리자 UI (`/admin/integrations/loyverse`) | ✅ Phase 5A | `app/admin/integrations/loyverse/` |

### ExternalOptionGroupMap (Phase 5B 신규)

Phase 5A에서는 모디파이어 그룹을 `(productId, name)` 으로 식별했기 때문에, Loyverse에서 그룹 이름을 변경하면 기존 그룹이 유지된 채 새 그룹이 추가되는 문제가 있었습니다.

Phase 5B에서 `ExternalOptionGroupMap` 테이블을 추가하여 `(source, externalOptionGroupId)` 기반으로 그룹을 식별하도록 개선했습니다.

- 기존(Phase 5A 이전) 그룹: 이름 매칭으로 채택 후 매핑 생성 (마이그레이션 호환)
- 이후 sync: `externalId` 기반 lookup → 이름 변경 시에도 기존 그룹 갱신

### Loyverse 어댑터 메서드

| 메서드 | 설명 |
|--------|------|
| `fetchExternalCatalog()` | 전체 카탈로그 fetch + 정규화 |
| `pushOrderToExternalPos(order)` | 내부 주문 → Loyverse POST /receipts |
| `syncInventoryFromExternal(date)` | 특정 날짜 Loyverse 영수증 → 판매 수량 집계 |

**Mock 모드 (`LOYVERSE_MOCK=true` 또는 토큰 미설정):**
- `fetchExternalCatalog` → 내장 목 데이터 반환
- `pushOrderToExternalPos` → `MOCK-{orderNumber}` 반환
- `syncInventoryFromExternal` → 빈 객체 반환

### 동기화 정책

```
외부 상품 1개 → 내부 Product 1개
덮어쓰는 필드: name, description, basePrice, isActive, category
보호되는 필드: slug, sortOrder, isSubscriptionEligible

모디파이어 그룹:
  • ExternalOptionGroupMap(source, externalId) 기반 lookup (rename-safe)
  • minSelect / maxSelect / isRequired: 첫 생성 시만 기본값 적용 (이후 sync에서 보호)
  • Option.priceDelta: 매 sync마다 POS 값으로 덮어씀
```

### 관련 API 엔드포인트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `GET /api/admin/integrations/loyverse/status` | GET | 연동 상태 + 매핑된 상품 수 |
| `POST /api/admin/integrations/loyverse/sync` | POST | 카탈로그 즉시 동기화 트리거 |

---

## 🔮 향후 개선 아이디어

- ~~**자동 예측 생성**: cron job으로 매일 자정에 내일 예측 자동 생성~~ ✅ 6단계에서 구현
- **ML 모델 고도화**: 실제 과거 데이터 기반 회귀/시계열 모델
- ~~**외부 데이터 자동수집**: Weather API, 공공 공휴일 API cron 연동~~ ✅ 6단계에서 구현
- ~~**고급 리포트**: 월별/분기별 성과 리포트, 채널 분석~~ ✅ 7단계에서 구현
- **알림**: 폐기율 경고, 예측 신뢰도 낮을 때 알림
- **다중 매장**: 매장별 설정/가중치 분리
- **모바일 앱**: React Native 또는 PWA
- **자동 가중치 학습**: 예측 오차를 기반으로 가중치 점진 조정
- **Task 큐**: Redis/BullMQ 기반 실제 비동기 작업 큐로 전환
- **알림 연동**: Task 실패 시 Slack/Email 알림

---

## 📁 주요 파일 구조

```
├── app/
│   ├── page.tsx                    # 운영 대시보드 (작업 상태 + 분석 요약 포함)
│   ├── analytics/
│   │   ├── layout.tsx              # 분석 레이아웃 (서브 네비게이션)
│   │   ├── page.tsx                # 분석 대시보드 (기간 선택, 요약, 비교)
│   │   ├── daily/page.tsx          # 일별 분석
│   │   ├── weekly/page.tsx         # 주별 분석
│   │   ├── monthly/page.tsx        # 월별 분석
│   │   └── segments/page.tsx       # 세그먼트 비교
│   ├── calendar/                   # 달력 (실적 + 예측)
│   ├── predictions/
│   │   ├── page.tsx                # 예측 목록
│   │   ├── new/                    # 새 예측 (내일 자동 제안)
│   │   ├── [id]/                   # 예측 상세 + 근거 + 비교
│   │   └── performance/            # 예측 성과 페이지
│   ├── tasks/
│   │   ├── page.tsx                # 자동화 작업 목록
│   │   └── [id]/page.tsx           # 작업 상세 + TaskLog + 재시도
│   ├── sales/                      # 매출 CRUD
│   ├── imports/                    # CSV 임포트
│   ├── weights/                    # 가중치 관리
│   └── settings/                   # 앱 설정
├── app/api/
│   ├── analytics/
│   │   ├── route.ts                # 기간 요약 + 비교
│   │   ├── daily/route.ts          # 일별 분석 API
│   │   ├── weekly/route.ts         # 주별 분석 API
│   │   ├── monthly/route.ts        # 월별 분석 API
│   │   └── segments/route.ts       # 세그먼트 비교 API
│   ├── cron/run/route.ts           # cron trigger 엔드포인트
│   └── tasks/
│       ├── route.ts                # 작업 목록/생성
│       └── [id]/
│           ├── route.ts            # 작업 상세
│           └── retry/route.ts      # 재시도
├── lib/
│   ├── services/
│   │   ├── analytics/
│   │   │   └── index.ts            # 분석 서비스 레이어 (집계, 비교, 세그먼트)
│   │   ├── predictionService.ts    # 예측 핵심 로직
│   │   ├── externalFactorService.ts# 외부요인 수집
│   │   ├── importService.ts        # CSV 임포트
│   │   ├── taskService.ts          # Task 생명주기 관리
│   │   └── schedulerService.ts     # 고수준 자동화 오케스트레이션
│   ├── analytics-utils.ts          # 분석 유틸 (포맷, 날짜, 변화율)
│   ├── task-utils.ts               # Task 유틸 (날짜, 상태 표시 등)
│   ├── prediction-utils.ts         # 예측 유틸 함수
│   ├── analytics.ts                # 기본 분석 함수
│   └── utils.ts                    # 공통 유틸
├── components/
│   ├── analytics/
│   │   ├── AnalyticsSubNav.tsx     # 분석 서브 네비게이션 (client)
│   │   ├── TrendBar.tsx            # CSS 비율 바 차트
│   │   ├── ChannelBar.tsx          # 채널 비중 스택 바
│   │   ├── ComparisonCard.tsx      # 세그먼트 비교 카드
│   │   └── PeriodComparisonSection.tsx # 기간 비교 섹션
│   ├── TaskActionButton.tsx        # 작업 실행 버튼 (client)
│   ├── RetryTaskButton.tsx         # 재시도 버튼 (client)
│   ├── CalendarView.tsx            # 달력 컴포넌트
│   └── WeightsManager.tsx          # 가중치 관리 UI
├── prisma/
│   ├── schema.prisma               # DB 스키마 (ScheduledTask, TaskLog 포함)
│   └── seed.ts                     # 샘플 데이터 (Task 샘플 포함)
└── types/
    └── index.ts                    # TypeScript 타입 정의 (TaskStatus 등 포함)
```
