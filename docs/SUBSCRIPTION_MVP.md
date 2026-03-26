# Subscription MVP

정기 구독 기능의 MVP 구현 문서입니다.

## 개요

고객이 매주 특정 요일에 픽업할 상품을 정기 구독할 수 있는 기능입니다.

## 데이터 모델

### Subscription
- 고객(`userId`)과 연결된 구독 단위
- `pickupWeekday`: 픽업 요일 (0=일, 1=월, ... 6=토)
- `pickupTimeSlot`: 픽업 시간 (선택)
- `startDate` / `endDate`: 구독 기간
- `status`: `ACTIVE` | `PAUSED` | `CANCELLED`

### SubscriptionItem
- 구독에 포함된 상품 및 수량

### SubscriptionOccurrence
- 특정 날짜에 해당 구독이 발생한 기록
- `status`: `SCHEDULED` | `ORDER_CREATED` | `SKIPPED` | `CANCELLED`
- 주문이 생성되면 `orderId`로 연결됨

## 플로우

1. **구독 신청**: 고객이 `/subscribe` 페이지에서 상품/요일/시작일을 선택하여 구독 생성
2. **발생 생성**: 관리자가 `/admin/subscription-occurrences`에서 특정 날짜의 발생 항목을 생성
3. **주문 생성**: 관리자가 발생 항목으로부터 실제 주문을 일괄 생성
4. **발생 관리**: 개별 발생 항목을 건너뛰기(SKIP) 또는 취소(CANCEL) 처리 가능
5. **구독 관리**: 고객 및 관리자가 구독을 일시정지/재개/취소 가능

## 페이지 구조

### 고객 페이지
- `/subscribe` — 신규 구독 신청 폼
- `/account/subscriptions` — 내 구독 목록
- `/account/subscriptions/[id]` — 구독 상세 (발생 내역, 건너뛰기, 취소)

### 관리자 페이지
- `/admin/subscriptions` — 전체 구독 목록 (STAFF 이상)
- `/admin/subscriptions/[id]` — 구독 상세 및 상태 변경 (ADMIN만 상태 변경)
- `/admin/subscription-occurrences` — 날짜별 발생 관리, 발생/주문 일괄 생성

## API 엔드포인트

### 고객 API
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/account/subscriptions` | 내 구독 목록 |
| POST | `/api/account/subscriptions` | 새 구독 생성 |
| GET | `/api/account/subscriptions/[id]` | 구독 상세 |
| PATCH | `/api/account/subscriptions/[id]` | 구독 상태 변경 |

### 관리자 API
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/admin/subscriptions` | 전체 구독 목록 | STAFF+ |
| GET | `/api/admin/subscriptions/[id]` | 구독 상세 | STAFF+ |
| PATCH | `/api/admin/subscriptions/[id]` | 구독 상태 변경 | ADMIN |
| GET | `/api/admin/subscription-occurrences?date=YYYY-MM-DD` | 날짜별 발생 목록 | STAFF+ |
| POST | `/api/admin/subscription-occurrences` | 발생 생성 (+ 선택적 주문 생성) | ADMIN |
| PATCH | `/api/admin/subscription-occurrences/[id]` | 발생 skip/cancel | ADMIN |

## 서비스 함수 (`lib/services/subscriptionService.ts`)

| 함수 | 설명 |
|------|------|
| `createSubscription` | 구독 및 상품 항목 생성 |
| `getUserSubscriptions` | 특정 사용자의 구독 목록 조회 |
| `getSubscriptionById` | 구독 상세 조회 (userId로 접근 제어 가능) |
| `updateSubscriptionStatus` | 구독 상태 변경 |
| `generateOccurrencesForDate` | 특정 날짜에 매칭되는 활성 구독의 발생 항목 생성 |
| `generateOrdersFromOccurrences` | SCHEDULED 발생 항목으로부터 주문 일괄 생성 |
| `skipOccurrence` | 발생 항목 건너뛰기 |
| `cancelOccurrence` | 발생 항목 취소 (ORDER_CREATED면 연관 주문도 취소, 재고 롤백) |
| `getSubscriptionSummaryForDate` | 날짜별 구독 상품 수량 요약 |
| `generateNext7DaysOccurrences` | 향후 7일 발생 항목 일괄 생성 |

## 참고 사항

- `isSubscriptionEligible: true`인 상품만 구독 신청 폼에 노출됩니다
- 발생 항목 생성 시 중복 방지 (`subscriptionId_date` unique constraint)
- 주문 생성 시 `OrderSource.SUBSCRIPTION`으로 표기
- 주문 생성 시 `DailyInventory.reservedQty` 자동 증가
- 취소 시 `reservedQty` 롤백 처리
