# Admin User Management — 사용자 관리 기능

> **접근 권한:** ADMIN 전용. UI·서버·API 세 레이어 모두에서 ADMIN 권한 검증.

---

## 추가된 파일 목록

| 파일 | 설명 |
|------|------|
| `app/admin/users/page.tsx` | 관리자 사용자 목록 페이지 (Server Component) |
| `app/admin/users/UserFilters.tsx` | 검색/필터 바 (Client Component) |
| `app/admin/users/UserTable.tsx` | 사용자 테이블 및 인라인 액션 (Client Component) |
| `app/api/admin/users/route.ts` | `GET /api/admin/users` — 사용자 목록 조회 API |
| `app/api/admin/users/[id]/route.ts` | `PATCH /api/admin/users/:id` — 권한·활성 상태 변경 API |
| `prisma/migrations/20260325000002_add_admin_action_log/migration.sql` | AdminActionLog 테이블 마이그레이션 |
| `docs/ADMIN_USER_MANAGEMENT.md` | 이 문서 |

**수정된 파일:**

| 파일 | 변경 내용 |
|------|-----------|
| `prisma/schema.prisma` | `AdminActionLog` 모델 추가 |
| `components/Navigation.tsx` | ADMIN 메뉴에 "사용자 관리" 링크 추가 |
| `app/admin/page.tsx` | 관리자 대시보드에 사용자 관리 링크 추가 |

---

## 관리자 페이지 경로

| 경로 | 설명 |
|------|------|
| `/admin/users` | 사용자 관리 메인 페이지 |
| `/api/admin/users` | 사용자 목록 조회 (GET) |
| `/api/admin/users/:id` | 권한·활성 상태 변경 (PATCH) |

---

## 검색 / 필터 항목

| 항목 | URL 쿼리 파라미터 | 가능한 값 |
|------|-------------------|-----------|
| 이름/이메일 검색 | `search` | 문자열 |
| 권한 필터 | `role` | `ALL`, `ADMIN`, `STAFF`, `CUSTOMER` |
| 활성 상태 필터 | `isActive` | `ALL`, `ACTIVE`, `INACTIVE` |
| 정렬 | `sort` | `createdAt_desc` (기본), `createdAt_asc`, `email_asc`, `email_desc`, `name_asc` |

검색 조건은 URL 쿼리 파라미터로 유지되므로, 새로고침 후에도 필터가 그대로 적용됩니다.

---

## role 변경 규칙

1. **ADMIN만 가능** — 권한 변경은 ADMIN 계정에서만 수행할 수 있습니다.
2. **자기 자신 권한 강등 불가** — 본인의 role을 ADMIN 아래로 낮출 수 없습니다.
3. **마지막 ADMIN 강등 불가** — 시스템에 ADMIN이 1명만 남아 있을 때 그 계정의 role을 변경할 수 없습니다.
4. **유효한 role 값만 허용** — `ADMIN`, `STAFF`, `CUSTOMER` 외의 값은 400 오류 반환.
5. **감사 로그 기록** — role이 실제로 변경되면 `AdminActionLog`에 `CHANGE_ROLE` 항목이 기록됩니다.

---

## 활성/비활성 정책

1. **ADMIN만 가능** — 활성 상태 변경은 ADMIN 계정에서만 수행할 수 있습니다.
2. **자기 자신 비활성화 불가** — 본인 계정을 비활성화할 수 없습니다.
3. **마지막 활성 ADMIN 비활성화 불가** — 활성 상태인 ADMIN이 1명만 남아 있을 때 비활성화할 수 없습니다.
4. **비활성 계정 로그인** — 비활성 사용자는 로그인이 차단됩니다(로그인 액션에서 `isActive` 검사).
5. **감사 로그 기록** — 상태 변경 시 `AdminActionLog`에 `ACTIVATE_USER` 또는 `DEACTIVATE_USER` 항목이 기록됩니다.

---

## 마지막 ADMIN 보호 로직

`PATCH /api/admin/users/:id` 에서 아래 두 가지 경우를 별도로 검사합니다:

```
1. 비활성화 시도:
   - target.role === ADMIN
   - 활성 ADMIN 수 (isActive: true) <= 1
   → 422 "마지막 활성 관리자(ADMIN)는 비활성화할 수 없습니다"

2. 권한 강등 시도:
   - target.role === ADMIN
   - 새 role !== ADMIN
   - 전체 ADMIN 수 <= 1
   → 422 "마지막 관리자(ADMIN)의 권한을 낮출 수 없습니다"
```

---

## 감사 로그 (AdminActionLog)

변경이 실제로 일어날 때마다 `admin_action_logs` 테이블에 기록됩니다.

| 필드 | 설명 |
|------|------|
| `id` | 자동 생성 cuid |
| `adminUserId` | 액션을 수행한 ADMIN의 userId |
| `targetUserId` | 대상 사용자의 userId |
| `actionType` | `CHANGE_ROLE` / `ACTIVATE_USER` / `DEACTIVATE_USER` |
| `previousValue` | 변경 전 값 (role 문자열 또는 "true"/"false") |
| `newValue` | 변경 후 값 |
| `createdAt` | 기록 시각 |

현재 UI는 제공되지 않지만 데이터베이스에서 직접 조회하거나, 향후 `/admin/audit-logs` 페이지로 확장할 수 있습니다.

---

## 로컬에서 테스트하는 방법

### 1. 마이그레이션 적용

```bash
npx prisma migrate dev
# 또는 기존 DB에 직접 적용
npx prisma db push
```

### 2. Prisma Client 재생성

```bash
npx prisma generate
```

### 3. 개발 서버 실행

```bash
npm run dev
```

### 4. 수동 테스트 시나리오

| 시나리오 | 방법 | 기대 결과 |
|----------|------|-----------|
| ADMIN으로 /admin/users 접근 | ADMIN 계정으로 로그인 후 이동 | 사용자 목록 정상 표시 |
| STAFF/CUSTOMER로 /admin/users 접근 | 해당 계정 로그인 후 직접 URL 입력 | /login?error=forbidden 리다이렉트 |
| 사용자 role 변경 | 목록에서 드롭다운 선택 | 즉시 UI 반영 + 감사 로그 기록 |
| 자기 자신 비활성화 시도 | 본인 계정의 "비활성화" 버튼 클릭 | 422 오류 메시지 표시 |
| 마지막 ADMIN 비활성화 시도 | ADMIN 1명만 있을 때 비활성화 | 422 오류 메시지 표시 |
| 마지막 ADMIN role 강등 시도 | ADMIN 1명일 때 STAFF로 변경 | 422 오류 메시지 표시 |
| 검색/필터 | 이름·이메일 검색, role 필터 선택 | URL params 반영 + 새로고침 유지 |

### 5. API 직접 테스트 (curl)

```bash
# 사용자 목록 조회 (인증 쿠키 필요)
curl -b 'session=<JWT>' 'http://localhost:3000/api/admin/users?role=ADMIN'

# role 변경
curl -b 'session=<JWT>' -X PATCH \
  -H 'Content-Type: application/json' \
  -d '{"role":"STAFF"}' \
  'http://localhost:3000/api/admin/users/<userId>'

# 비활성화
curl -b 'session=<JWT>' -X PATCH \
  -H 'Content-Type: application/json' \
  -d '{"isActive":false}' \
  'http://localhost:3000/api/admin/users/<userId>'
```

---

## 향후 확장 포인트

1. **사용자 초대 (Invite)** — `/admin/users/invite` 페이지를 추가하여 이메일로 초대 링크 발송. `UserInvite` 모델과 만료 토큰 기반 온보딩 플로우.

2. **비밀번호 재설정** — ADMIN이 특정 사용자의 임시 비밀번호를 생성하거나 재설정 링크를 이메일로 발송할 수 있는 기능. `PasswordResetToken` 모델 추가 필요.

3. **감사 로그 조회 UI** — `/admin/audit-logs` 페이지를 추가하여 `AdminActionLog` 기록을 시간 순으로 조회. adminUserId·targetUserId·actionType 필터 및 페이지네이션 지원.

4. **마지막 로그인 시각 (lastLoginAt)** — `User` 모델에 `lastLoginAt DateTime?` 필드 추가 후, `loginAction` 성공 시 `prisma.user.update({ data: { lastLoginAt: new Date() } })` 호출.

5. **페이지네이션** — 사용자 수가 많아지면 `findMany`에 `take`/`skip` 추가 및 페이지네이션 UI 구현.
