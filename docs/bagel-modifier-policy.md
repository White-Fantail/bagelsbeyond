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
- Loyverse Modifier Mapping 관리 UI (`/admin/integrations/loyverse/modifiers`)
  - 내부 옵션 목록 + 매핑 상태 표시
  - Loyverse modifier 목록 드롭다운
  - 매핑 저장 / 수정 / 해제
  - 필터: unmapped만 보기, 재고추적 옵션만, 상품별 보기, 검색
- 상품 상세 페이지(`/admin/products/[id]`) modifier mapping 상태 표시
- 관리자 사이드바에 "Loyverse Modifier 매핑" 링크
- Loyverse 연동 페이지에 modifier 매핑 섹션 추가

### 🔜 남은 작업 (후속 권장)

1. **Full modifier sync 고도화**
   - Loyverse에서 modifier 전체를 자동으로 동기화하고 매핑 제안 기능 추가
   - 현재는 수동 매핑 + UI에서 Loyverse modifier 목록 조회만 지원

2. **매핑 자동 제안 (name matching)**
   - 내부 옵션 이름과 Loyverse modifier option 이름이 동일할 경우 자동 매핑 제안

3. **Option 기반 품절 자동 차단 고도화**
   - `DailyOptionInventory.isSoldOut = true`인 옵션을 주문 생성 단계에서 자동으로 차단
   - 현재는 `reservedQty` 흐름만 지원, 실제 품절 차단 로직은 미구현

4. **`ProductOptionGroupAssignment` 관리 UI**
   - 현재는 join table만 존재, admin UI에서 "이 그룹을 다른 상품에도 연결" 기능 미구현

5. **구독 발생 Order 생성 시 `productOptionId` 전달**
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
| `app/api/admin/integrations/loyverse/external-modifiers/route.ts` | Loyverse modifier 조회 API |
| `app/admin/integrations/loyverse/modifiers/page.tsx` | Modifier 매핑 UI |
| `app/admin/integrations/loyverse/modifiers/ModifierMappingManager.tsx` | 매핑 관리 클라이언트 컴포넌트 |
| `app/admin/products/[id]/page.tsx` | 상품 상세 (modifier 매핑 상태 포함) |
| `app/actions/order.ts` | 주문 생성 액션 (productOptionId 저장) |
