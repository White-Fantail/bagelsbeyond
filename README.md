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

### UI/UX
- **운영 대시보드** — 내일 예측 카드, 최근 실적 요약, 예측 정확도, 빠른 액션
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

```env
DATABASE_URL=postgresql://user:password@host:5432/beyond
```

---

## 🚀 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# DATABASE_URL 설정

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

## 🔮 향후 개선 아이디어

- **자동 예측 생성**: cron job으로 매일 자정에 내일 예측 자동 생성
- **ML 모델 고도화**: 실제 과거 데이터 기반 회귀/시계열 모델
- **외부 데이터 자동수집**: Weather API, 공공 공휴일 API cron 연동
- **고급 리포트**: 월별/분기별 성과 리포트, 채널 분석
- **알림**: 폐기율 경고, 예측 신뢰도 낮을 때 알림
- **다중 매장**: 매장별 설정/가중치 분리
- **모바일 앱**: React Native 또는 PWA
- **자동 가중치 학습**: 예측 오차를 기반으로 가중치 점진 조정

---

## 📁 주요 파일 구조

```
├── app/
│   ├── page.tsx                    # 운영 대시보드
│   ├── calendar/                   # 달력 (실적 + 예측)
│   ├── predictions/
│   │   ├── page.tsx                # 예측 목록
│   │   ├── new/                    # 새 예측 (내일 자동 제안)
│   │   ├── [id]/                   # 예측 상세 + 근거 + 비교
│   │   └── performance/            # 예측 성과 페이지
│   ├── sales/                      # 매출 CRUD
│   ├── imports/                    # CSV 임포트
│   ├── weights/                    # 가중치 관리
│   └── settings/                   # 앱 설정
├── lib/
│   ├── services/predictionService.ts  # 예측 핵심 로직
│   ├── prediction-utils.ts            # 예측 유틸 함수
│   ├── analytics.ts                   # 분석 함수
│   └── utils.ts                       # 공통 유틸
├── components/
│   ├── CalendarView.tsx            # 달력 컴포넌트
│   └── WeightsManager.tsx          # 가중치 관리 UI
├── prisma/
│   ├── schema.prisma               # DB 스키마
│   └── seed.ts                     # 샘플 데이터
└── types/
    └── index.ts                    # TypeScript 타입 정의
```
