# Loyverse Sync Policy — Admin Structure Guide

## 왜 상품 / 모디파이어 / 카테고리를 별도 메뉴로 분리했는가

이전 구조에서는 `/admin/products` 화면 상단에 "Modifier 관리 →"와 "카테고리 →" 버튼이 있어,
세 영역이 하나의 흐름으로 묶여 있었습니다.

이를 분리한 이유:
- **관리 책임 분리**: 상품 관리자는 상품 자체(가격·활성·설명)에 집중해야 하고, Modifier나 Category 매핑은 별도 관심사입니다.
- **Loyverse sync 가시성**: Modifier와 Category도 각자 독립적인 sync 상태가 있으며, 각 페이지에서 명확하게 볼 수 있어야 합니다.
- **모바일 UX**: 사이드 메뉴에서 Product / Modifier / Category가 각각 별도 항목으로 노출되면 탐색이 쉬워집니다.

---

## 왜 Modifier / Category도 전부 Loyverse에서 sync해야 하는가

Loyverse는 이 시스템의 **POS source of truth**입니다.
상품 이름·가격·카테고리·모디파이어가 모두 Loyverse에 정의되어 있으므로,
내부에서 수동으로 만든 데이터와 Loyverse 데이터가 불일치하면 주문 전송이 실패합니다.

특히:
- **Modifier**: Loyverse modifier가 내부 `ProductOption`과 매핑되지 않으면 주문 전송 시 차단됩니다.
- **Category**: 상품이 Loyverse에서 올바른 카테고리로 분류되어야 내부 필터·구독 가능 여부 로직이 올바르게 동작합니다.

---

## Loyverse를 Source of Truth로 삼는 정책

| 항목 | 덮어씀 (Loyverse → 내부) | 보호됨 (내부만 관리) |
|------|------------------------|-------------------|
| 상품 이름 | ✓ | |
| 기본 가격 | ✓ | |
| 활성 여부 | ✓ | |
| 카테고리 (매핑) | ✓ | |
| 설명 | ✓ | |
| Modifier 그룹 이름 | ✓ | |
| Modifier 옵션 가격 | ✓ | |
| 슬러그 | | ✓ (생성 시 1회만 설정) |
| 정렬 순서 | | ✓ (운영자가 관리) |
| 구독 가능 여부 | | ✓ (비즈니스 결정) |
| minSelect / maxSelect | | ✓ (생성 후 운영자가 조정) |

---

## 각 관리 페이지 역할

### `/admin/products` — 상품 관리
- 상품 자체(이름·가격·활성 상태·카테고리) 목록 조회
- 개별 상품 수정 (Loyverse sync 항목은 내부 운영 필드만 수정 가능)
- `+ 새 상품 추가`는 Internal-only 상품 생성용 (Loyverse sync 상품이 기본)
- Modifier나 Category 이동 버튼 없음 (각자 별도 메뉴 사용)

### `/admin/modifiers` — 모디파이어 관리
- `ProductOption` 기반 Modifier 목록
- 재고 추적(`tracksInventory`) 설정
- Loyverse sync 출처 badge 표시
- 마지막 Loyverse Modifier sync 시각·상태 표시
- Loyverse Modifier 동기화 refresh 버튼

### `/admin/categories` — 카테고리 관리
- 내부 카테고리(BAGEL · SANDWICH · SPREAD · DRINK · OTHER)별 상품 현황
- Loyverse 카테고리 → 내부 카테고리 매핑 정책 표시
- 마지막 카탈로그 sync 시각 표시
- 카탈로그 동기화 refresh 버튼

---

## Sync Refresh 방식

### 상품 + 카테고리 + Modifier 그룹 전체 동기화
```
POST /api/admin/integrations/loyverse/sync
```
- `syncExternalCatalog()` 실행
- Product, ExternalProductMap, ProductOptionGroup, ProductOption, ExternalOptionGroupMap 전부 upsert

### Modifier 목록만 동기화 (매핑 UI용)
```
POST /api/admin/integrations/loyverse/modifier-sync
```
- Loyverse modifier 목록 fetch → `LoyverseModifierSyncLog` 저장
- 실제 내부 옵션 구조 upsert는 하지 않음 (full catalog sync가 그 역할을 함)
- Modifier 매핑 UI가 최신 Loyverse modifier 목록을 보여주기 위한 용도

### Loyverse 카테고리 목록 확인 (참조용)
```
POST /api/admin/integrations/loyverse/category-sync
```
- Loyverse 카테고리 목록 fetch → 현재 목록 반환 (DB 저장 없음)
- 카테고리 자체의 내부 저장은 상품 catalog sync 시 자동으로 처리됨

---

## Internal-only 항목 정책

- **상품**: `+ 새 상품 추가`로 생성된 상품은 Loyverse 매핑 없이 내부에서만 관리됨. 주문 페이지에 노출은 가능하나 Loyverse POS에 전송 시 `externalProductId`가 없어 item_id가 null로 전송됨.
- **Modifier**: 내부에서 직접 생성된 옵션은 Loyverse 매핑이 없으면 주문 전송 시 modifier 정보가 누락됨. 되도록 Loyverse sync 후 매핑해서 사용할 것.
- **Category**: 내부 카테고리 enum은 고정값 (BAGEL, SANDWICH, SPREAD, DRINK, OTHER). 새 카테고리를 추가하려면 Prisma enum과 `mapExternalCategory()` 로직을 함께 수정해야 함.

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/integrations/services/catalog-sync.ts` | 전체 카탈로그 sync 로직 |
| `lib/integrations/services/catalog-mapper.ts` | Loyverse → 내부 필드 매핑 |
| `lib/integrations/adapters/pos/loyverse.ts` | Loyverse API 어댑터 |
| `app/api/admin/integrations/loyverse/sync/route.ts` | 카탈로그 sync API |
| `app/api/admin/integrations/loyverse/modifier-sync/route.ts` | Modifier sync log API |
| `app/api/admin/integrations/loyverse/category-sync/route.ts` | Category 목록 조회 API |
| `app/admin/products/page.tsx` | 상품 관리 페이지 |
| `app/admin/modifiers/page.tsx` | 모디파이어 관리 페이지 |
| `app/admin/categories/page.tsx` | 카테고리 관리 페이지 |
| `lib/config/navigation.ts` | 관리자 메뉴 구조 설정 |
