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
- **Next.js 16** (App Router, RSC, Server Components)
- **React 19** (with Server Actions)
- **TypeScript 5** (strict)
- **Tailwind CSS 4**
- **Prisma 7** (PostgreSQL adapter via `@prisma/adapter-pg`)
- **PostgreSQL** (`pg` 드라이버)
- **Zod 4** (validation)
- **React Hook Form 7**
- **jose** (JWT)
- **bcryptjs** (password hashing)
- **Vitest 4** (testing)

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
| `SESSION_SECRET` | `openssl rand -base64 32` 출력값 | JWT 세션 서명 키 (서버 재시작 시 기존 세션 무효화됨) | `openssl rand -base64 32` 명령으로 임의의 강력한 시크릿 생성 |

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
| `INTERNAL_JOB_SECRET` | `/api/internal/jobs/daily-order-push` 엔드포인트 보호 | 미설정 시 해당 엔드포인트는 403 반환 (비활성화). `openssl rand -base64 32` 로 생성 |
| `APP_TIMEZONE` | 일별 주문 push 등 cron 작업에서 "오늘" 기준이 되는 타임존 | 미설정 시 `DEFAULT_TIMEZONE`, 없으면 `Pacific/Auckland` 사용 |
| `SEED_DEFAULT_PASSWORD` | 시딩(seed) 시 테스트 계정에 부여할 기본 패스워드 | 개발 환경 전용 — 프로덕션에서는 사용하지 말 것 (기본값: `Dev@12345!`) |

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
│   ├── page.tsx                    # 루트 — 대시보드로 리다이렉트
│   ├── layout.tsx                  # 루트 레이아웃
│   ├── login/page.tsx              # 로그인 페이지
│   ├── signup/page.tsx             # 회원가입 페이지
│   ├── actions/auth.ts             # 인증 Server Actions (login, signup, logout)
│   ├── (admin)/                    # 관리자/스태프 전용 레이아웃 그룹
│   │   ├── layout.tsx              # 사이드바 + 네비게이션 레이아웃
│   │   ├── dashboard/page.tsx      # 운영 대시보드 (작업 상태 + 분석 요약 포함)
│   │   ├── analytics/
│   │   │   ├── layout.tsx          # 분석 레이아웃 (서브 네비게이션)
│   │   │   ├── page.tsx            # 분석 대시보드 (기간 선택, 요약, 비교)
│   │   │   ├── daily/page.tsx      # 일별 분석
│   │   │   ├── weekly/page.tsx     # 주별 분석
│   │   │   ├── monthly/page.tsx    # 월별 분석
│   │   │   └── segments/page.tsx   # 세그먼트 비교
│   │   ├── calendar/page.tsx       # 달력 (실적 + 예측)
│   │   ├── predictions/
│   │   │   ├── page.tsx            # 예측 목록
│   │   │   ├── new/page.tsx        # 새 예측 (내일 자동 제안)
│   │   │   ├── [id]/page.tsx       # 예측 상세 + 근거 + 비교
│   │   │   └── performance/page.tsx # 예측 성과 페이지
│   │   ├── tasks/
│   │   │   ├── page.tsx            # 자동화 작업 목록
│   │   │   └── [id]/page.tsx       # 작업 상세 + TaskLog + 재시도
│   │   ├── sales/
│   │   │   ├── page.tsx            # 매출 목록
│   │   │   ├── new/page.tsx        # 새 매출 기록
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # 매출 상세
│   │   │       └── edit/page.tsx   # 매출 수정
│   │   ├── imports/
│   │   │   ├── page.tsx            # CSV 임포트 목록
│   │   │   ├── new/page.tsx        # 새 임포트 (CSV 업로드 + 검증)
│   │   │   └── [id]/page.tsx       # 임포트 상세 (행 검증 UI)
│   │   ├── external-factors/
│   │   │   ├── page.tsx            # 외부요인 목록 + 날짜 필터
│   │   │   └── [date]/page.tsx     # 특정 날짜 외부요인 수정
│   │   ├── weights/page.tsx        # 예측 가중치 관리
│   │   ├── settings/page.tsx       # 앱 설정 (타임존, 위치, 폐기 목표 등)
│   │   ├── staff/page.tsx          # 스태프 관리
│   │   └── admin/
│   │       ├── page.tsx            # 관리자 대시보드
│   │       └── users/page.tsx      # 사용자 관리 (역할/활성화)
│   ├── (customer)/                 # 고객 전용 레이아웃 그룹
│   │   ├── layout.tsx              # 고객 레이아웃
│   │   └── account/
│   │       ├── page.tsx            # 고객 계정 메인
│   │       ├── profile/page.tsx    # 프로필 수정
│   │       └── security/page.tsx   # 비밀번호 변경
│   └── api/
│       ├── analytics/
│       │   ├── route.ts            # 기간 요약 + 비교
│       │   ├── daily/route.ts      # 일별 분석 API
│       │   ├── weekly/route.ts     # 주별 분석 API
│       │   ├── monthly/route.ts    # 월별 분석 API
│       │   └── segments/route.ts   # 세그먼트 비교 API
│       ├── sales/
│       │   ├── route.ts            # 매출 목록/생성
│       │   └── [id]/
│       │       ├── route.ts        # 매출 상세/수정/삭제
│       │       └── collect-external/route.ts # 특정 날짜 외부요인 수집
│       ├── predictions/
│       │   ├── route.ts            # 예측 목록/생성
│       │   ├── performance/route.ts # 예측 성과 통계
│       │   └── [id]/route.ts       # 예측 상세/삭제
│       ├── imports/
│       │   ├── route.ts            # 임포트 목록/생성
│       │   └── [id]/
│       │       ├── route.ts        # 임포트 상세
│       │       ├── execute/route.ts # 임포트 행 DB 적용
│       │       └── collect-external/route.ts # 임포트된 날짜 외부요인 수집
│       ├── external-factors/
│       │   ├── route.ts            # 외부요인 목록/생성
│       │   └── [date]/route.ts     # 특정 날짜 외부요인 조회/수정
│       ├── weights/
│       │   ├── route.ts            # 가중치 목록
│       │   └── [id]/route.ts       # 가중치 수정
│       ├── settings/route.ts       # 앱 설정 조회/수정
│       ├── tasks/
│       │   ├── route.ts            # 작업 목록/생성
│       │   └── [id]/
│       │       ├── route.ts        # 작업 상세
│       │       └── retry/route.ts  # 재시도
│       ├── cron/run/route.ts       # cron trigger 엔드포인트
│       ├── admin/users/
│       │   ├── route.ts            # 전체 사용자 목록 (ADMIN 전용)
│       │   └── [id]/route.ts       # 사용자 역할/상태 수정 (ADMIN 전용)
│       └── account/
│           ├── profile/route.ts    # 고객 프로필 업데이트
│           └── password/route.ts   # 비밀번호 변경
├── components/
│   ├── navigation/
│   │   ├── Sidebar.tsx             # 사이드바 네비게이션 (admin 전용)
│   │   ├── SidebarSection.tsx      # 접을 수 있는 섹션
│   │   ├── SidebarItem.tsx         # 네비게이션 항목
│   │   └── MobileDrawer.tsx        # 모바일 네비게이션 드로어
│   ├── analytics/
│   │   ├── AnalyticsSubNav.tsx     # 분석 서브 네비게이션 (client)
│   │   ├── TrendBar.tsx            # CSS 비율 바 차트
│   │   ├── ChannelBar.tsx          # 채널 비중 스택 바
│   │   ├── ComparisonCard.tsx      # 세그먼트 비교 카드
│   │   ├── PeriodComparisonSection.tsx # 기간 비교 섹션
│   │   └── DayOfWeekTable.tsx      # 요일별 매출 표
│   ├── customer/
│   │   ├── header.tsx              # 고객 헤더
│   │   ├── customer-layout-inner.tsx # 고객 레이아웃 래퍼
│   │   └── account-nav.tsx         # 계정 네비게이션
│   ├── TaskActionButton.tsx        # 작업 실행 버튼 (client)
│   ├── RetryTaskButton.tsx         # 재시도 버튼 (client)
│   ├── CollectExternalButton.tsx   # 외부요인 수집 버튼 (client)
│   ├── RefreshExternalFactorButton.tsx # 외부요인 갱신 버튼 (client)
│   ├── CalendarView.tsx            # 달력 컴포넌트
│   ├── WeightsManager.tsx          # 가중치 관리 UI
│   ├── SalesForm.tsx               # 매출 입력 폼
│   ├── SettingsForm.tsx            # 설정 폼
│   ├── PageHeader.tsx              # 페이지 제목 + 브레드크럼
│   ├── FilterBar.tsx               # 날짜/필터 바
│   ├── StatCard.tsx                # 요약 통계 카드
│   ├── EmptyState.tsx              # 빈 상태 플레이스홀더
│   ├── ConfirmDeleteDialog.tsx     # 삭제 확인 모달
│   ├── DeleteRecordButton.tsx      # 레코드 삭제 버튼
│   ├── DeletePredictionButton.tsx  # 예측 삭제 버튼
│   └── Navigation.tsx              # 상단 네비게이션 바
├── lib/
│   ├── auth/
│   │   ├── index.ts                # 인증 exports
│   │   ├── session.ts              # 세션 관리 (getSession, setSession)
│   │   ├── session-edge.ts         # Edge 호환 세션 처리
│   │   └── dal.ts                  # 인증 데이터 접근 레이어
│   ├── services/
│   │   ├── analytics/
│   │   │   └── index.ts            # 분석 서비스 레이어 (집계, 비교, 세그먼트)
│   │   ├── predictionService.ts    # 예측 핵심 로직
│   │   ├── externalFactorService.ts # 외부요인 수집
│   │   ├── importService.ts        # CSV 임포트
│   │   ├── taskService.ts          # Task 생명주기 관리
│   │   └── schedulerService.ts     # 고수준 자동화 오케스트레이션
│   ├── providers/
│   │   ├── weather/index.ts        # Open-Meteo 날씨 프로바이더 (+ mock)
│   │   ├── holiday/index.ts        # Nager.at 공휴일 프로바이더 (+ mock)
│   │   ├── school-holiday/index.ts # 규칙 기반 NZ 방학 프로바이더
│   │   ├── events/index.ts         # 지역 이벤트 플레이스홀더
│   │   ├── news/index.ts           # NewsAPI.org 프로바이더 (+ mock)
│   │   └── index.ts                # 프로바이더 팩토리
│   ├── config/
│   │   └── navigation.ts           # 네비게이션 메뉴 구조
│   ├── utils/
│   │   ├── business-date.ts        # 영업일 날짜 유틸
│   │   └── weather-icon.ts         # 날씨 → 이모지 매핑
│   ├── translations/
│   │   └── en.ts                   # 영문 번역
│   ├── analytics-utils.ts          # 분석 유틸 (포맷, 날짜, 변화율)
│   ├── analytics.ts                # 기본 분석 함수
│   ├── task-utils.ts               # Task 유틸 (상태 표시 등)
│   ├── prediction-utils.ts         # 예측 유틸 함수
│   ├── csv-parser.ts               # CSV 파싱 로직
│   ├── validations.ts              # Zod 유효성 스키마
│   ├── useTranslation.ts           # 번역 훅
│   ├── db.ts                       # Prisma 클라이언트
│   └── utils.ts                    # 공통 유틸 (통화/날짜 포맷 등)
├── prisma/
│   ├── schema.prisma               # DB 스키마 (ScheduledTask, TaskLog 포함)
│   └── seed.ts                     # 샘플 데이터 (Task 샘플 포함)
├── types/
│   └── index.ts                    # TypeScript 타입 정의 (TaskStatus 등 포함)
└── docs/                           # 추가 문서
    ├── AUTH.md                     # 인증 흐름
    ├── ADMIN_USER_MANAGEMENT.md    # 관리자 & 사용자 관리
    ├── CUSTOMER_ACCOUNT.md         # 고객 계정 기능
    ├── DOMAIN_DESIGN.md            # 도메인 모델 설계
    └── NAVIGATION.md               # 네비게이션 구조
```


---

## 🥯 Phase 1: Menu Costing Foundation

### Added Routes

| Route | Description |
|-------|-------------|
| `/ingredients` | Ingredient list with search/category/status filters |
| `/ingredients/new` | Create new ingredient |
| `/ingredients/[id]/edit` | Edit ingredient |
| `/ingredient-categories` | Manage ingredient categories |
| `GET /api/admin/ingredients` | List ingredients (supports ?search, ?categoryId, ?isActive) |
| `POST /api/admin/ingredients` | Create ingredient |
| `GET /api/admin/ingredients/[id]` | Get ingredient by ID |
| `PATCH /api/admin/ingredients/[id]` | Update ingredient |
| `DELETE /api/admin/ingredients/[id]` | Archive ingredient (soft disable) |
| `GET /api/admin/ingredient-categories` | List categories |
| `POST /api/admin/ingredient-categories` | Create category |
| `PATCH /api/admin/ingredient-categories/[id]` | Update category |

### Added Prisma Models

**Enum: `UnitType`** — `G`, `KG`, `ML`, `L`, `EA`, `PACK`, `BOX`

**Model: `IngredientCategory`** — `id`, `name` (unique), `slug` (unique), `sortOrder`, `isActive`, timestamps

**Model: `Ingredient`** — `id`, `name`, `categoryId` (nullable FK), `description`, `purchasePrice` (Decimal 10,2), `purchaseQuantity` (Decimal 10,3), `purchaseUnit`, `baseUnit`, `taxIncluded`, `isActive`, `notes`, timestamps

### Next Recommended Step (Phase 2)

- ~~Add unit conversion table (e.g. 1 KG = 1000 G) so cost-per-base-unit can be calculated~~ ✅ Done in Phase 2
- ~~Add `standardCostPerBaseUnit` computed/stored field on `Ingredient`~~ ✅ Done in Phase 2 (derived, not stored)
- Add recipe model linking ingredients to menu items with usage quantities
- Add costing calculation engine: `recipe cost = Σ (usageQty × costPerBaseUnit)`

---

## 🧮 Phase 2: Unit Conversion & Standard Cost

### What Was Added

**Costing utility layer** (`lib/costing/`)

| Module | Purpose |
|--------|---------|
| `unit-groups.ts` | Maps each `UnitType` to a group: `WEIGHT`, `VOLUME`, or `COUNT` |
| `unit-conversion.ts` | Typed conversion helpers: `canConvertUnit`, `convertQuantity`, `getConversionFactor` |
| `ingredient-cost.ts` | Cost calculation: `calculateStandardUnitCost`, `formatStandardUnitCost`, `formatConvertedBaseQuantity` |

**Standard cost formula**: `purchasePrice / convertedBaseQuantity = standardUnitCost`

### Conversion Rules

| From | To | Valid? |
|------|----|--------|
| KG | G | ✅ |
| G | KG | ✅ |
| L | ML | ✅ |
| ML | L | ✅ |
| EA | EA | ✅ |
| PACK | PACK | ✅ |
| BOX | BOX | ✅ |
| PACK | EA | ❌ Not supported yet |
| BOX | EA | ❌ Not supported yet |
| KG | ML | ❌ Cross-group |
| EA | G | ❌ Cross-group |

### Known Limitations (Phase 2)

- **PACK/BOX → EA** is not supported yet. These COUNT units only support same-unit pairings for now. Support for PACK-to-EA conversion (e.g. 12 buns per pack) is deferred to a later phase when a custom conversion table is introduced.
- Standard costs are derived at read time; they are not stored as database columns.

### Validation Updates

`ingredientSchema` now validates that `purchaseUnit` and `baseUnit` form a compatible pair. Invalid combinations (e.g. `KG`/`ML`, `PACK`/`EA`) are rejected with a descriptive error on the `baseUnit` field.

### UI Additions

- **Ingredient list**: Added columns — *Converted Base Qty*, *Standard Cost*, *Conversion Status* (OK / Unsupported)
- **Ingredient form**: Live inline warning when an incompatible unit pair is selected
- **Edit page**: Added *Costing Summary* block showing purchase details, converted base quantity, and standard cost per base unit

---

## 🍽️ Phase 3: Recipe-Based Direct Costing

Phase 3 links menu products to their ingredient recipes so the system can calculate the direct ingredient cost of producing one unit.

### Added Models

| Model | Table | Description |
|-------|-------|-------------|
| `MenuProduct` | `menu_products` | Canonical internal product/menu item |
| `Recipe` | `recipes` | Named recipe belonging to one product; one active recipe per product |
| `RecipeItem` | `recipe_items` | One ingredient line in a recipe with quantity and unit |

**Key constraints:**
- One active recipe per product (enforced at service layer)
- `RecipeItem.unit` must exactly match `ingredient.baseUnit` (Phase 3: no cross-unit conversion)
- `unique(recipeId, ingredientId)` prevents duplicate ingredient rows

### Added Routes

| Path | Description |
|------|-------------|
| `/products` | Product list with recipe status, ingredient count, and recipe cost |
| `/products/new` | Create a new menu product |
| `/products/[productId]/recipe` | Recipe management — create recipe, add/edit/remove ingredients |

### Added API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/admin/products` | List or create products |
| GET/PATCH | `/api/admin/products/[productId]` | Get or update a product |
| GET/PUT | `/api/admin/products/[productId]/recipe` | Get recipe cost summary or upsert recipe |
| POST | `/api/admin/products/[productId]/recipe/items` | Add ingredient to recipe |
| PATCH/DELETE | `/api/admin/products/[productId]/recipe/items/[itemId]` | Edit or remove recipe item |

### Cost Calculation

For each recipe item (Phase 4):
```
directLineCost   = quantity × ingredient.standardUnitCost
effectiveQty     = quantity / (yieldPercent / 100)
adjustedLineCost = effectiveQty × ingredient.standardUnitCost
```

For the recipe total:
```
directTotalCost  = Σ directLineCost (all items)
adjustedTotalCost = Σ adjustedLineCost (all items)
```

- All costs are derived at read time — not stored in the database
- If any ingredient has no standard unit cost, totals are `null` and the recipe is flagged as *incomplete*
- Pure calculation helpers live in `lib/costing/recipe-cost.ts` (importable from tests)
- Packaging items use yieldPercent=100 and are added through the same ingredient flow

### Phase 4 Schema Changes

**Ingredient model** now includes:
- `yieldPercent Decimal(5,2) @default(100.00)` — ingredient-level yield percentage
  - 100.00 = no loss
  - 85.00 = only 85% usable after trimming/prep
  - Must be > 0 and ≤ 100

**New derived fields per RecipeItem:**
- `yieldPercent` — ingredient yield from master
- `effectiveQuantity` — quantity adjusted for yield loss
- `directLineCost` — quantity × standardUnitCost (no yield)
- `adjustedLineCost` — effectiveQuantity × standardUnitCost (yield-adjusted)

**New derived fields per Recipe:**
- `directTotalCost` — sum of direct line costs
- `adjustedTotalCost` — sum of yield-adjusted line costs

### Packaging and Consumables

Packaging items (e.g., paper bag, sandwich wrap, cup, sticker) are added through the standard Ingredient flow with `yieldPercent = 100`. No separate packaging model needed at this stage. Use existing `IngredientCategory` entries such as "Packaging" or "Consumables" to organise them.

### Phase 4 Limitations (deferred to Phase 5+)

- No recipe-level yield overrides yet
- No prepared component / sub-recipe support yet
- ~~No selling price recommendations yet~~ → Implemented in Phase 5
- No channel-specific profitability yet
- No supplier sync yet
- No price history yet

### Next Recommended Step (Phase 5)

- ~~Add margin targets per product~~ → Implemented in Phase 5
- ~~Calculate recommended selling price based on adjustedTotalCost + target margin~~ → Implemented in Phase 5
- Add channel-specific profitability analysis
- Consider recipe versioning for cost history tracking

---

## 💰 Phase 5: Pricing Targets & Recommended Selling Price

### Overview

Phase 5 adds pricing target logic so the system can compare each product's current selling price against its adjusted recipe cost, calculate actual cost and margin percentages, and recommend a selling price based on either a target cost percentage or a target margin percentage.

### Schema Changes

**New enums** added to `schema.prisma`:
- `PricingTargetType`: `COST_PERCENT` | `MARGIN_PERCENT`
- `RecommendedPriceRounding`: `NONE` | `NEAREST_0_10` | `NEAREST_0_50` | `NEAREST_1_00`

**`MenuProduct` model** — new optional fields:
| Field | Type | Purpose |
|-------|------|---------|
| `sellingPrice` | `Decimal?` | Current retail selling price |
| `pricingTargetType` | `PricingTargetType?` | Product-level override target type |
| `pricingTargetPercent` | `Decimal?` | Product-level override target percent (0–100 exclusive) |

**`AppSetting` model** — new fields with defaults:
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `defaultPricingTargetType` | `PricingTargetType` | `COST_PERCENT` | Global default target type |
| `defaultPricingTargetPercent` | `Decimal` | `30.00` | Global default target percent |
| `defaultPriceRounding` | `RecommendedPriceRounding` | `NONE` | Global default price rounding |

Migration: `prisma/migrations/20260415200000_phase5_pricing_targets/`

### Pricing Calculations

```
actualCostPercent   = adjustedCost / sellingPrice × 100
actualMarginPercent = (sellingPrice − adjustedCost) / sellingPrice × 100

if targetType = COST_PERCENT:
  recommendedPrice = adjustedCost / (targetPercent / 100)

if targetType = MARGIN_PERCENT:
  recommendedPrice = adjustedCost / (1 − targetPercent / 100)

priceGap = sellingPrice − recommendedPrice
```

Rounding is applied to `recommendedPrice` per the configured rounding mode.

### Pricing Status Values

| Status | Meaning |
|--------|---------|
| `ON_TARGET` | Selling price is within 0.5% of recommended price |
| `ABOVE_TARGET` | Selling price is above recommended price |
| `BELOW_TARGET` | Selling price is below recommended price — consider a price increase |
| `NO_SELLING_PRICE` | No selling price set on the product |
| `NO_TARGET` | No pricing target configured (global or product level) |
| `NO_RECIPE_COST` | Adjusted recipe cost is unavailable |

### Pricing Utility Layer (`lib/costing/pricing.ts`)

Pure, server-free helper functions (importable in tests):

```typescript
getEffectivePricingTarget(product, globalSettings)     // product override > global default
calculateActualCostPercent(adjustedCost, sellingPrice)
calculateActualMarginPercent(adjustedCost, sellingPrice)
calculateRecommendedPrice(adjustedCost, target)
roundRecommendedPrice(price, rounding)
calculatePricingStatus(recommendedPrice, sellingPrice, adjustedCost, target)
buildProductPricingSummary(opts)                       // full summary object
```

Server-side wrapper in `lib/services/pricingService.ts`:
```typescript
getGlobalPricingSettings()                             // reads AppSetting from DB
buildPricingSummaryForProduct(product, adjustedCost, globalSettings)
```

### UI Changes

- **Settings page** (`/settings`) — new "Pricing Target Settings" section for default target type, default percent, and rounding mode
- **Product form** (`/products/new`, `/products/[id]`) — selling price field + optional product-level pricing target override
- **Products list** (`/products`) — new columns: Adjusted Cost, Selling Price, Cost %, Recommended Price, Status badge
- **Recipe page** (`/products/[id]/recipe`) — new "Pricing Summary" section showing all pricing metrics

### Tests (`lib/__tests__/pricing.test.ts`)

48 tests covering:
- `getEffectivePricingTarget` — global default, product override, fallback edge cases
- `calculateActualCostPercent` — normal, null price, zero price, negative price, cost > price
- `calculateActualMarginPercent` — normal, null price, negative margin
- `calculateRecommendedPrice` — COST_PERCENT target, MARGIN_PERCENT target, invalid targets
- `roundRecommendedPrice` — all four rounding modes
- `calculatePricingStatus` — all six status values
- `buildProductPricingSummary` — full happy path, no cost, no price, no target, override, rounding

### Phase 5 Limitations (deferred to Phase 6+)

- No supplier sync / automatic cost updates
- No price history or historical repricing
- No channel-specific profitability
- No prepared components / sub-recipes
- No tax simulations beyond current cost comparison

### Next Recommended Step (Phase 6)

- Add price history tracking (store price change events on `MenuProduct`)
- Add supplier-linked ingredient cost updates (when supplier invoice price changes, flag affected products)
- Add channel-specific profitability (e.g., Uber Eats markup analysis)

---

## Phase 6 — Ingredient Price History Tracking

### Overview

Phase 6 adds append-only price history tracking for ingredients. Every time a costing-relevant field changes (price, quantity, units, tax, yield), a new `IngredientPriceHistory` row is inserted. The `Ingredient` table continues to store the current/live state; the history table provides full traceability.

### New Schema

**`IngredientPriceHistory`** (table: `ingredient_price_history`)

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | Primary key |
| `ingredientId` | String | FK → Ingredient |
| `purchasePrice` | Decimal(10,2) | |
| `purchaseQuantity` | Decimal(10,3) | |
| `purchaseUnit` | UnitType | |
| `baseUnit` | UnitType | |
| `taxIncluded` | Boolean | |
| `yieldPercent` | Decimal(5,2) | |
| `sourceType` | PriceHistorySourceType | MANUAL / CSV_IMPORT / SYSTEM |
| `notes` | String? | Optional change reason |
| `effectiveFrom` | DateTime | When the price became effective |
| `createdAt` | DateTime | Auto-set to now() |
| `createdByUserId` | String? | FK → User |

**New enum:** `PriceHistorySourceType { MANUAL, CSV_IMPORT, SYSTEM }`

### History Creation Triggers

- **Ingredient created** → always inserts an initial history row (source: MANUAL)
- **Ingredient updated with costing change** → inserts a new history row
- **Ingredient updated without costing change** → no history row inserted

Costing-relevant fields: `purchasePrice`, `purchaseQuantity`, `purchaseUnit`, `baseUnit`, `taxIncluded`, `yieldPercent`

### Service Layer (`lib/costing/`)

- **`ingredient-price-history-utils.ts`** — Pure/testable helpers:
  - `detectCostingFieldChanges(current, incoming)` — returns `true` if any costing field changed
  - `computeHistoryDeltas(rows)` — computes price delta, percent delta, and standard cost delta % for each row vs previous
- **`ingredient-price-history.ts`** — Server-only DB access:
  - `createIngredientHistorySnapshot(input, tx?)` — inserts a history row (supports transaction)
  - `listIngredientPriceHistory(ingredientId)` — full history, newest first
  - `getLatestIngredientHistory(ingredientId)` — most recent entry
  - `buildIngredientHistoryViewModel(ingredientId)` — history rows with deltas

### UI Changes

- **Ingredient form** (`/ingredients/new`, `/ingredients/[id]/edit`) — "Price History Record" section appears automatically on create and when costing fields are edited, with optional `effectiveFrom` and `changeNote` fields
- **Edit page** (`/ingredients/[id]/edit`) — new "Price History" section shows full history table with: Effective From, Price, Qty, Units, Tax, Yield %, Standard Cost, Price Δ, Cost Δ%, Source, Note, Recorded At
- **Ingredient list** (`/ingredients`) — new "Last Price Update" and "Price Δ" summary columns

### Tests (`lib/__tests__/ingredient-price-history.test.ts`)

20 tests covering:
- `detectCostingFieldChanges` — no-change cases, all 6 costing field change cases
- Historical standard unit cost calculation
- Delta calculation: price delta, percent delta, standard cost delta percent
- `effectiveFrom` behavior — custom date and default-to-now
- `computeHistoryDeltas` — multi-row deltas, oldest row null-delta, single-row

### Next Recommended Step (Phase 7)

- Supplier mapping: link ingredients to supplier records for invoice-driven price updates
- Bulk/CSV price import: create CSV_IMPORT history rows from supplier invoices
- Repricing alerts: flag recipe costs that have changed significantly due to ingredient price history

