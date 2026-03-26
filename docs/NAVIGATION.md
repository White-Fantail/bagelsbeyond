# Navigation Policy

이 문서는 **베이글스 비욘드**의 역할별 네비게이션 구조, 라우트 영역, 모바일 메뉴 UX, 관리자 진입 방식, 향후 확장 원칙을 설명합니다.

---

## 1. 역할별 메뉴 정책

메뉴 구성은 `lib/config/navigation.ts` 한 곳에서 관리됩니다. 각 역할에 맞는 `RoleNavConfig`(또는 공개용 그룹 배열)를 수정하면 Navigation 컴포넌트가 자동으로 반영합니다.

### A. 비로그인(PUBLIC)

| 메뉴 | 경로 |
|------|------|
| 홈 | `/` |
| 주문하기 | `/order` |
| 구독 | `/subscribe` *(예정)* |

- 내부 운영 메뉴 없음
- 헤더 우측에 **로그인** / **회원가입** 버튼 표시

### B. CUSTOMER

| 메뉴 | 경로 |
|------|------|
| 홈 | `/` |
| 주문하기 | `/order` |
| 내 주문 | `/account/orders` |
| 내 구독 | `/subscribe` *(예정)* |
| 내 계정 | `/account` |

- 관리/운영 메뉴 없음
- 모바일 드로어 헤더: "내 계정 →" 빠른 진입 링크
- 역할 배지: 초록색(고객)

### C. STAFF

| 메뉴 | 경로 |
|------|------|
| 운영 대시보드 | `/staff` |
| 주문 관리 | `/admin/orders` |
| 매출 목록 | `/sales` |
| 달력 | `/calendar` |
| 재고 관리 | `/admin/inventory` |
| 예측 | `/predictions` |

- 사용자 관리·설정·분석·가중치 등 관리자 전용 메뉴 없음
- 모바일 드로어 헤더: "운영 대시보드 →"
- 역할 배지: 파란색(직원)

### D. ADMIN

그룹형 구성 (모바일 아코디언, 데스크탑 플랫):

| 그룹 | 메뉴 | 경로 |
|------|------|------|
| **개요** | 관리자 대시보드 | `/admin` |
| | 달력 | `/calendar` |
| | 분석 | `/analytics` |
| | 예측 | `/predictions` |
| **운영** | 주문 관리 | `/admin/orders` |
| | 매출 목록 | `/sales` |
| | 재고 관리 | `/admin/inventory` |
| | 상품 관리 | `/admin/products` |
| | 가져오기 | `/imports` |
| **데이터** | 외부 데이터 | `/external-factors` |
| | 자동화 | `/tasks` |
| | 가중치 | `/weights` |
| | 성과 | `/predictions/performance` |
| **관리** | 사용자 관리 | `/admin/users` |
| | 설정 | `/settings` |

- 모바일 드로어 헤더: "관리자 대시보드 →"
- 역할 배지: 빨간색(관리자)

---

## 2. 라우트 영역(Route Areas)

| 영역 | 경로 패턴 | 접근 권한 |
|------|----------|-----------|
| **공개(Public)** | `/` `/order` `/subscribe` `/login` `/signup` | 모든 사용자 |
| **고객(Customer)** | `/account/**` `/order/**` | CUSTOMER 이상 |
| **직원(Staff)** | `/staff` `/sales/**` `/calendar` `/predictions/**` `/admin/orders` `/admin/inventory` | STAFF 이상 |
| **관리자(Admin)** | `/admin/**` `/analytics/**` `/imports/**` `/external-factors/**` `/tasks/**` `/weights` `/settings` | ADMIN 전용 |

> 라우트 보호는 각 페이지/API에서 `requireAuth()`, `requireStaffOrAdmin()`, `requireAdmin()` 등을 직접 호출하여 처리합니다 (`lib/auth/dal.ts`).

---

## 3. 모바일 메뉴 구조

### 단일 그룹 (PUBLIC / CUSTOMER / STAFF)

- 드로어 헤더 → 메뉴 항목 플랫 리스트 → 로그아웃 버튼
- STAFF 메뉴: 6개 항목으로 간결하게 구성
- CUSTOMER 메뉴: 5개 항목 (주문/계정 중심)

### 다중 그룹 아코디언 (ADMIN)

- 그룹 헤더 버튼을 클릭하면 하위 항목 펼침/접힘
- **현재 페이지가 속한 그룹은 자동으로 펼쳐짐** (`getActiveGroupId` 함수 기반)
- 사용자가 수동으로 다른 그룹도 열거나 닫을 수 있음
- 각 항목 터치 영역: `py-3` (최소 44px) 확보

### 드로어 공통 구조

```
┌─────────────────────────────┐
│ [아바타] 이름  [역할 배지]    │  ← 로그인 시
│ 대시보드 이름 →              │
│ ─────────────────────────── │
│ [로그인]  [회원가입]          │  ← 비로그인 시
├─────────────────────────────┤
│ 그룹 헤더 1      ▾           │
│   ├─ 메뉴 항목               │
│   └─ 메뉴 항목               │
│ 그룹 헤더 2      ▸           │
│ ...                          │
├─────────────────────────────┤
│ 로그아웃                      │  ← 로그인 시
└─────────────────────────────┘
```

---

## 4. 관리자 대시보드 진입 방식

| 역할 | 진입점 | 표시 방법 |
|------|--------|-----------|
| ADMIN | `/admin` (관리자 대시보드) | 드로어 헤더의 "관리자 대시보드 →" 링크 및 데스크탑 아바타 클릭 |
| STAFF | `/staff` (운영 대시보드) | 드로어 헤더의 "운영 대시보드 →" 링크 |
| CUSTOMER | `/account` (내 계정) | 드로어 헤더의 "내 계정 →" 링크 |

로그인 후 리다이렉트:
- ADMIN → `/admin`
- STAFF → `/staff`
- CUSTOMER → `/account`

---

## 5. 설정 파일 구조

```
lib/config/navigation.ts
  ├── NavItem       (href, label)
  ├── NavGroup      (id, label, items[])
  ├── RoleNavConfig (dashboardHref, dashboardLabel, groups[])
  ├── PUBLIC_NAV_GROUPS  → 비로그인용
  ├── CUSTOMER_NAV       → CUSTOMER 설정
  ├── STAFF_NAV          → STAFF 설정
  ├── ADMIN_NAV          → ADMIN 설정
  ├── getNavConfig(role) → 역할별 config 반환
  ├── flattenNavGroups() → 데스크탑 플랫 목록
  └── getActiveGroupId() → 현재 라우트의 그룹 ID 반환

components/Navigation.tsx
  └── Navigation({ session })
        ├── 데스크탑: flattenNavGroups() 기반 플랫 링크
        ├── 모바일: groups.length === 1 → 플랫, > 1 → 아코디언
        └── 역할 배지, 드로어 헤더, 로그아웃 버튼
```

---

## 6. 향후 주문/구독/연동 기능 확장 원칙

### 새 메뉴 항목 추가

`lib/config/navigation.ts`의 해당 역할 `groups[].items` 배열에 항목 추가:

```typescript
// 예: CUSTOMER에 '내 구독' 메뉴 추가 (경로 완성 후)
{ href: "/subscribe", label: "내 구독" },
```

### 새 역할 추가

1. `prisma/schema.prisma`의 `Role` enum에 역할 추가
2. `lib/config/navigation.ts`에 `NEWROLE_NAV` 상수 추가
3. `getNavConfig()` 함수에 분기 추가
4. `components/Navigation.tsx`의 `ROLE_LABELS`, `ROLE_BADGE_CLASS` 업데이트

### 구독 메뉴 연결 시

- PUBLIC: `{ href: "/subscribe", label: "구독" }` → 이미 포함됨 (경로만 연결)
- CUSTOMER: `{ href: "/subscribe", label: "내 구독" }` → 이미 포함됨

### 관리자 연동 메뉴 추가

`ADMIN_NAV.groups`의 `management` 그룹에 항목 추가:

```typescript
{ href: "/admin/integrations", label: "연동 관리" },
```

---

## 7. 테스트 시나리오

| 시나리오 | 확인 방법 |
|---------|----------|
| 비로그인 → 공개 메뉴만 보임 | 로그아웃 후 네비게이션 확인 |
| CUSTOMER → 주문/계정 메뉴만 보임 | CUSTOMER 계정으로 로그인 |
| STAFF → 운영 메뉴만 보임 (관리자 메뉴 없음) | STAFF 계정으로 로그인 |
| ADMIN → 그룹형 메뉴 보임 | ADMIN 계정으로 로그인 |
| 모바일 ADMIN → 아코디언 동작 | 브라우저 폭 < 1024px로 좁히기 |
| 현재 페이지 그룹 자동 펼침 | ADMIN으로 `/analytics` 방문 시 "개요" 그룹 자동 열림 확인 |
| 관리자 대시보드 진입점 확인 | 모바일 드로어 헤더의 링크 클릭 |
| CUSTOMER에게 운영 메뉴 미노출 | CUSTOMER 계정으로 네비게이션에서 `/admin`, `/weights` 등 없는지 확인 |
