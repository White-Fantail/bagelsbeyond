# Bagel Choice: Modifier-Based Domain Policy

> Version: 1.0 — Reflects current implementation state

---

## 1. 왜 Bagel choice를 variant가 아닌 modifier로 선택했는가

Loyverse(및 내부 시스템)에서 Bagel Type(Plain / Sesame / Blueberry / Everything)을
**modifier 기준**으로 관리하는 이유는 다음과 같습니다.

| 기준 | Variant | Modifier (채택) |
|------|---------|-----------------|
| 여러 상품 공유 | ✗ (상품별 독립) | ✓ (그룹 공유) |
| 재고 추적 단위 | 상품-변형 조합 | 옵션 단위 (공유) |
| Loyverse 운영 방식 | 비적합 | 적합 |
| 추가 상품 연결 | 매번 새 variant 생성 | 동일 modifier 그룹 재사용 |

**핵심 이유:**

- 하나의 modifier 그룹(예: "Bagel Type")을 Bagel 상품, Sandwich 상품, 기타 베이글 기반 상품에 **공통 연결**할 수 있습니다.
- 동일한 Plain / Sesame / Blueberry / Everything 재고를 여러 상품이 **공유**해야 합니다.
- Loyverse 현재 운영 방식이 modifier 기반입니다.
- variant 방향으로 구현하면 상품마다 옵션을 따로 만들어야 하고, 재고도 분리됩니다.

---

## 2. 하나의 Modifier가 여러 상품에 공유되는 구조

```
ProductOptionGroup (id: "grp-001", name: "Bagel Type")
  ├── ProductOption (id: "opt-001", name: "Plain",       tracksInventory: true)
  ├── ProductOption (id: "opt-002", name: "Sesame",      tracksInventory: true)
  ├── ProductOption (id: "opt-003", name: "Blueberry",   tracksInventory: true)
  └── ProductOption (id: "opt-004", name: "Everything",  tracksInventory: true)

Product A (Bagel)     → optionGroups → [grp-001]  (직접 productId FK)
Product B (Sandwich)  → optionGroupAssignments → [grp-001]  (join table)
Product C (다른 상품) → optionGroupAssignments → [grp-001]  (join table)
```

**두 가지 연결 방식:**

1. **직접 관계 (`productId` FK on `ProductOptionGroup`)**: 기존 방식, 하나의 주 상품과 연결
2. **`ProductOptionGroupAssignment` join table**: 추가적인 상품에 공유 연결 (cross-product sharing)

현재 카탈로그 동기화(catalog sync)는 직접 관계를 생성합니다. 추가 상품 연결은 관리자 UI에서 수동으로 수행하거나 향후 자동화할 수 있습니다.

---

## 3. Shared Modifier Inventory 구조

`tracksInventory = true`인 옵션은 `DailyOptionInventory` 테이블에서 **optionId 기준으로** 재고를 추적합니다.

```
DailyOptionInventory
  optionId: "opt-001" (Plain)
  date: 2026-04-01
  plannedQty: 50
  reservedQty: 12  ← Bagel+Plain 6개 + Sandwich+Plain 6개 합산
  soldQty: 0
```

- `Bagel + Plain` 주문 → `opt-001` reservedQty ++
- `Sandwich + Plain` 주문 → `opt-001` reservedQty ++  (같은 row!)
- 공유 재고가 자연스럽게 작동합니다.

---

## 4. Product / Option / Loyverse Modifier 매핑 관계

```
내부 ProductOption (Plain)
  └── ExternalOptionMap
        source: LOYVERSE
        productOptionId: "opt-001"
        externalOptionId: "loyverse-modifier-opt-id-xxx"
        externalName: "Plain Bagel"
        externalGroupId: "loyverse-modifier-group-id-yyy"
        externalGroupName: "Bagel Type"
        mappingType: "MODIFIER"
```

**매핑 테이블 (`ExternalOptionMap`):**
- `source`: 항상 `LOYVERSE`
- `productOptionId`: 내부 `ProductOption.id`
- `externalOptionId`: Loyverse modifier option ID
- `mappingType`: 항상 `"MODIFIER"` — variant 기반 매핑은 사용하지 않음

---

## 5. 전송 전에 Modifier Mapping이 필요한 이유

Loyverse의 `/receipts` API는 line item의 modifier를 전송할 때 Loyverse 자체의 modifier option ID를 요구합니다. 내부 이름(snapshot)만으로는 Loyverse가 어떤 modifier인지 인식하지 못합니다.

매핑 없이 전송하면:
- Loyverse가 **HTTP 400** 오류를 반환합니다.
- 영수증이 생성되지 않습니다.
- 재고 추적/매출 기록이 누락됩니다.

---

## 6. 매핑 없는 옵션이 왜 Loyverse 400 원인이 되는가

```json
// 잘못된 전송 예 (modifier ID 없이)
{
  "line_items": [
    {
      "item_id": "loyverse-item-xxx",
      "modifiers": [{ "name": "Plain" }]  // ← ID 없음 → 400
    }
  ]
}
```

Loyverse는 `modifier_id`를 요구합니다. 내부에서 `ExternalOptionMap`을 통해 `externalOptionId`를 조회하고, 이를 `modifier_id`로 전송해야 합니다.

현재 구현에서는 `order-sync.ts`의 preflight validation이 `ExternalOptionMap`이 없는 옵션을 발견하면 **전송을 차단**하고 명확한 오류 메시지를 기록합니다.

---

## 7. Variant 방향을 사용하지 않는 이유

`ProductVariant` 모델은 현재 스키마에 존재하지만, **Bagel choice 구현에는 사용하지 않습니다**.

- `ProductVariant`는 상품별로 독립적인 가격/SKU 변형(예: Small/Large 사이즈)에 적합합니다.
- Bagel Type 선택은 여러 상품이 공유하는 modifier이기 때문에 variant로 관리하면 각 상품마다 동일한 옵션을 중복으로 만들어야 합니다.
- `ExternalVariantMap` 같은 구조는 현재 미구현이며, 향후에도 bagel choice용으로 사용하지 않습니다.

---

## 8. 현재 구현 범위 vs 남은 범위

### ✅ 구현된 기능

- `ExternalOptionMap` 모델 (modifier-based mapping)
- `ProductOptionGroupAssignment` join table (shared modifier group 지원)
- `OrderItemOption.productOptionId` FK (option 추적 가능)
- Order 생성 시 `productOptionId` 저장
- 주문 전송 preflight validation (`order-sync.ts`)
  - product mapping 검증
  - modifier mapping 검증 (누락 시 전송 차단)
- (구) Loyverse Modifier Mapping 관리 UI (삭제됨)
  - 내부 옵션 목록 + 매핑 상태 표시
  - Loyverse modifier 목록 드롭다운
  - 매핑 저장 / 수정 / 해제
  - 필터: unmapped만 보기, 재고추적 옵션만, 상품별 보기, 검색
- 상품 상세 페이지(`/admin/products/[id]`) modifier mapping 상태 표시
- 관리자 사이드바에 "Loyverse Modifier 매핑" 링크
- Loyverse 연동 페이지에 modifier 매핑 섹션 추가

### 핵심 운영 정책

> **Loyverse에서 sync된 modifier만 내부에서 사용합니다.**
>
> - 내부에서 임의로 생성한 옵션을 Loyverse와 매핑하는 방향을 사용하지 않습니다.
> - 모든 modifier group / modifier option은 Loyverse catalog sync를 통해 내부에 가져온 것만 사용합니다.
> - sync되지 않은 옵션은 주문/구독/재고/Loyverse 전송 대상이 아닙니다.
> - 이름 기반 자동 매핑 제안은 사용하지 않습니다. 잘못된 연결 가능성을 방지합니다.

### 🔜 남은 작업 (후속 권장)

1. **Loyverse modifier sync 안정화**
   - sync된 modifier group / option 목록을 내부에서 확인 가능하게
   - 관리자 화면에서 어떤 modifier가 Loyverse sync 출처인지 표시
   - sync refresh 기능 추가
   - 현재는 수동 매핑 + UI에서 Loyverse modifier 목록 조회만 지원

2. **Option 기반 품절 자동 차단 고도화**
   - `DailyOptionInventory.isSoldOut = true`인 옵션을 주문 생성 단계에서 자동으로 차단
   - 현재는 `reservedQty` 흐름만 지원, 실제 품절 차단 로직은 미구현
   - 주문 화면/구독 화면에도 sold out 표시 추가

3. **`ProductOptionGroupAssignment` 관리 UI**
   - 현재는 join table만 존재, admin UI에서 "이 그룹을 다른 상품에도 연결" 기능 미구현
   - sync된 modifier group만 product에 연결하는 정책 적용

4. **구독 발생 Order 생성 시 `productOptionId` 전달**
   - 현재 `subscriptionService.ts`의 occurrence → order 변환에서 `productOptionId`를 명시적으로 전달하지 않음

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `prisma/schema.prisma` | 도메인 모델 (ExternalOptionMap, ProductOptionGroupAssignment 등) |
| `lib/integrations/services/order-sync.ts` | 주문 전송 + preflight validation |
| `lib/integrations/adapters/pos/loyverse.ts` | Loyverse API adapter (modifier 조회 포함) |
| `lib/integrations/services/catalog-sync.ts` | 카탈로그 동기화 |
| `app/api/admin/integrations/loyverse/option-maps/route.ts` | ExternalOptionMap CRUD API |
| `app/api/admin/integrations/loyverse/external-modifiers/route.ts` | 저장된 modifier sync 결과 조회 API |
| `app/api/admin/integrations/loyverse/modifier-sync/route.ts` | Loyverse modifier 동기화 트리거 + 결과 저장 |
| (구) `app/admin/integrations/loyverse/modifiers/page.tsx` | (삭제됨) Modifier 매핑 UI |
| (구) `app/admin/integrations/loyverse/modifiers/ModifierMappingManager.tsx` | (삭제됨) 매핑 관리 클라이언트 컴포넌트 |
| `app/admin/products/[id]/page.tsx` | 상품 상세 (modifier 매핑 상태 포함) |
| `app/actions/order.ts` | 주문 생성 액션 (productOptionId 저장) |

---

## Loyverse Modifier Sync 상세

### 왜 sync가 필요한가

Modifier 매핑 UI에서 내부 옵션과 Loyverse modifier를 연결하려면 Loyverse modifier 목록이 필요합니다.  
이 데이터를 페이지 로드마다 Loyverse API에서 실시간으로 가져오면 다음 문제가 생깁니다:

- 네트워크 오류 시 UI 전체가 차단됨
- API 토큰 문제 등 실패 원인이 사용자에게 노출되지 않음
- Loyverse API 레이트 리밋 소모

따라서 modifier 데이터는 **별도 sync 액션으로 가져와 DB에 저장**하고, UI는 저장된 데이터를 사용합니다.

### Sync 흐름

```
[관리자] "Loyverse 새로고침" 클릭
    └→ POST /api/admin/integrations/loyverse/modifier-sync
           ├→ LoyverseAdapter.fetchModifiers() (Loyverse API 호출)
           ├→ LoyverseModifierSyncLog 생성 (status, groupCount, optionCount, rawGroups)
           └→ 결과 반환

[Modifier 매핑 페이지 로드]
    └→ GET /api/admin/integrations/loyverse/external-modifiers
           └→ 최신 LoyverseModifierSyncLog 조회 (live API 호출 없음)
```

### 실패 원인 분류

| 원인 | errorCode | 표시 메시지 |
|------|-----------|-------------|
| API 토큰 없음 / 유효하지 않음 | 401 / 403 | "Loyverse 인증 실패 — LOYVERSE_API_TOKEN을 확인하세요." |
| 엔드포인트 없음 | 404 | "Modifier 엔드포인트를 찾을 수 없습니다 (HTTP 404)." |
| 레이트 리밋 | 429 | "Loyverse API 요청 한도 초과 — 잠시 후 다시 시도하세요." |
| 서버 오류 | 5xx | "Loyverse 서버 오류 — 잠시 후 다시 시도하세요." |
| 응답 비어 있음 | — | "Loyverse modifier API 응답이 비어 있습니다. (modifier 0개)" |
| 응답 파싱 실패 | — | "Modifier 응답 파싱에 실패했습니다." |
| 동기화 미실행 | — | "아직 modifier 동기화가 실행된 적 없습니다." |

### 수동 입력 fallback 정책

수동 modifier ID 입력은 **비상 fallback**입니다.  
기본 UX:

1. `POST /modifier-sync` → 동기화 성공
2. 드롭다운에서 modifier 선택 → 매핑 저장

수동 입력은 sync가 실패하거나 empty일 때만 "수동 입력 fallback" 토글로 접근 가능합니다.  
sync가 성공하면 드롭다운 선택이 주 경로이고, 수동 입력 토글은 숨겨집니다.
