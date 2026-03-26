# 생산량 추천 엔진 (Production Recommendation Engine)

## 개요

특정 날짜의 확정 주문, 구독, 예측 판매 수요, 안전 버퍼, 기존 재고를 종합하여  
최적 생산량과 상품별 생산 추천 수량을 계산하는 엔진입니다.

---

## 추천 생산량 계산 공식

```
recommendedTotalQty =
  confirmedQty
  + predictedExtraQty
  + safetyBufferQty
  − existingStockQty

(최솟값: 0)
```

---

## 각 항목 정의

### confirmedQty — 확정 수요

- `Order.pickupDate = targetDate` 인 주문 중
- `Order.status != CANCELLED`
- `Order.source IN [INTERNAL, SUBSCRIPTION]`
- 위 조건을 만족하는 `OrderItem.quantity` 합계

> `subscriptionQty`는 `confirmedQty`에 포함된 구독 주문 수량만 따로 표시됩니다.

---

### predictedExtraQty — 예측 추가 수요

기존 예측 엔진(`predictionService.ts`)을 재사용합니다.

- `getPredictedDemand(date)` → 예측 엔진의 `predictedBagelsSold` 반환
- `predictedExtraQty = max(0, predictedBagelsSold − confirmedQty)`

즉, 예측 총 판매량에서 이미 확정된 수량을 제외한 **워크인·추가 수요**만 반영합니다.

---

### safetyBufferQty — 안전 버퍼

예측 추가 수요에 적용하는 완충 수량입니다.

| 조건 | 적용 |
|------|------|
| 기본 버퍼 | `predictedExtraQty × 10%` |
| 주말 (토·일) | 버퍼 × 1.2 (+20%) |
| 비 예보 (rainMm > 0) | 버퍼 × 0.8 (−20%, 방문객 감소) |
| 이벤트 또는 공휴일 | 버퍼 + 5% 추가 |

> 향후 `AppSetting` 또는 `PredictionWeight` 테이블에서 비율을 설정 가능하도록 구조를 남겨 두었습니다.

---

### existingStockQty — 기존 재고

전날 남은 재고입니다.

1. **1차**: 전날 `DailyInventory`에서 `sum(max(0, bakedQty − soldQty))` 계산
2. **Fallback**: `DailyInventory` 데이터가 없으면 `DailyRecord.bagelsLeft` 사용

---

## 상품별 추천 수량 계산 방식

1. 최근 4주(`date − 28일`)의 `OrderItem`에서 상품별 판매 비율 계산
2. `productRatio = historicalQty[product] / totalHistorical`
3. `predictedQty = recommendedTotalQty × productRatio`
4. `recommendedQty = max(confirmedQty, predictedQty)`

> 과거 데이터가 없으면 활성 상품 수로 균등 분배합니다.

---

## 관리자 화면 기능

| 경로 | 기능 |
|------|------|
| `/admin/production` | 날짜 선택 |
| `/admin/production/[date]` | 해당 날짜 생산 추천 결과 조회 |

화면 표시 항목:
- 확정 주문 수량 / 구독 수량
- 예측 추가 수요 / 안전 버퍼
- 기존 재고 (차감)
- 추천 총 생산량
- 상품별 추천 생산량 표 (확정/예측/추천)
- **"추천 생산량 적용"** 버튼 → `DailyInventory.plannedQty` 자동 업데이트

---

## DailyInventory 연결 방식

`POST /api/admin/production/apply` 엔드포인트를 호출하면  
상품별 `recommendedQty` 값이 `DailyInventory.plannedQty`에 upsert됩니다.

```json
{
  "date": "2025-03-26",
  "productRecommendations": [
    { "productId": "...", "recommendedQty": 30 },
    { "productId": "...", "recommendedQty": 20 }
  ]
}
```

---

## 예측과 생산 추천의 차이

| 예측 (Prediction) | 생산 추천 (Production Recommendation) |
|-------------------|---------------------------------------|
| 매출 및 판매량 예측 | 실제 생산 수량 결정 지원 |
| 외부 요인 반영 | 확정 주문 + 예측 + 버퍼 + 재고 통합 |
| `SalesPrediction` 테이블 저장 | `DailyInventory.plannedQty` 업데이트 |
| 단독으로 동작 가능 | 예측 엔진을 내부적으로 재사용 |

---

## 관련 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/admin/production?date=YYYY-MM-DD` | 생산 추천 계산 |
| `POST` | `/api/admin/production/apply` | DailyInventory.plannedQty 업데이트 |

---

## 테스트 시나리오

1. **특정 날짜 추천 계산** → `GET /api/admin/production?date=2025-03-26`
2. **주문이 많아지면** → `confirmedQty` 증가 → `recommendedTotalQty` 증가
3. **외부 요인 반영** → 비 예보 시 `safetyBufferQty` 감소
4. **leftover 많으면** → `existingStockQty` 증가 → `recommendedTotalQty` 감소
5. **상품별 추천 수량** → 과거 판매 비율 기반으로 분배
6. **생산 계획 저장** → "추천 생산량 적용" 버튼 → `DailyInventory.plannedQty` 업데이트 확인
7. **관리자만 접근** → 비로그인 상태에서 `/admin/production` 접근 시 리다이렉트

---

## 향후 개선 아이디어

1. **머신러닝 수요 예측 통합**  
   규칙 기반 예측 엔진을 ML 모델로 교체하거나 보완하여 계절성, 트렌드 패턴을 자동 학습

2. **안전 버퍼 설정 UI**  
   `AppSetting` 또는 `PredictionWeight` 테이블에 버퍼 비율을 저장하고  
   관리자가 화면에서 조정 가능하게 구성

3. **이벤트 모델링 고도화**  
   반복 이벤트(예: 매주 파머스마켓, 특정 달 행사)를 캘린더로 관리하고  
   생산 추천에 이벤트 유형별 가중치를 자동 반영
