# 고객 계정(Customer Account) 시스템 가이드

## 1. 개요

이 문서는 베이글스 비욘드의 **고객용 계정(Account) 시스템** 구조와 정책을 설명합니다.  
CUSTOMER 역할 사용자가 직접 사용하는 `/signup`, `/account` 하위 페이지를 다룹니다.

---

## 2. 회원가입 흐름

```
브라우저 → GET /signup (회원가입 페이지)
  → 이름 / 이메일 / 비밀번호 / 비밀번호 확인 입력
  → POST (Server Action: signupAction)
     ├─ Zod 유효성 검사 (이름, 이메일, 비밀번호 형식, 일치 여부)
     ├─ 이메일 중복 확인 (prisma.user.findUnique)
     ├─ bcrypt 해시(12 rounds)
     ├─ role = CUSTOMER 고정 (클라이언트 값 무시)
     ├─ prisma.user.create
     ├─ createSession() → HTTP-only 쿠키 발급
     └─ redirect("/account")
```

### 회원가입 정책

| 항목 | 정책 |
|------|------|
| 기본 role | 항상 `CUSTOMER` (서버에서 강제, 클라이언트 값 무시) |
| 이메일 중복 | 이미 존재하는 이메일이면 가입 불가 (활성/비활성 무관) |
| 비밀번호 조건 | 8자 이상, 영문자 포함, 숫자 포함 |
| 가입 후 동작 | 자동 로그인 → `/account`로 리다이렉트 |
| ADMIN/STAFF 생성 | 이 경로로는 생성 불가. 관리자가 `/admin/users`에서만 role 변경 가능 |

---

## 3. 기본 CUSTOMER 계정 구조

```
User (prisma model)
├─ id, name, email, passwordHash
├─ role = CUSTOMER
├─ isActive = true
├─ createdAt, updatedAt
└─ customerProfile? (1:1 관계, 향후 확장용)

CustomerProfile (prisma model, 선택적)
├─ userId (User 참조)
├─ phone
├─ preferredPickupNote
├─ marketingOptIn
├─ createdAt, updatedAt
```

`CustomerProfile`은 향후 주문/구독/픽업 메모/마케팅 동의 등을 저장하기 위한 확장 포인트입니다.  
현재는 모델 구조만 정의되어 있으며, UI는 추후 단계에서 연결됩니다.

---

## 4. `/account` 하위 페이지 설명

| 경로 | 파일 | 설명 |
|------|------|------|
| `/account` | `app/account/page.tsx` | 계정 메인 — 기본 정보 표시 + 확장 섹션 placeholder |
| `/account/profile` | `app/account/profile/page.tsx` | 이름 수정 (이메일은 읽기 전용) |
| `/account/security` | `app/account/security/page.tsx` | 비밀번호 변경 |

### 확장 섹션 (현재 placeholder)

- 📦 **내 주문** — 향후 주문 내역 연결 예정
- 🔄 **내 구독** — 향후 정기 구독 플랜 연결 예정
- 📍 **픽업 정보** — 향후 CustomerProfile.preferredPickupNote 연결 예정
- 💳 **결제 수단** — 향후 결제 시스템 연결 예정

---

## 5. 본인 계정만 접근 가능한 정책

### 서버 레벨 보호 (2중 검증)

1. **Proxy (Edge Middleware, `proxy.ts`)**  
   `/account/**` 경로는 비로그인 상태이면 `/login`으로 리다이렉트.  
   *이는 선제적(optimistic) 차단이며, DB 조회 없이 JWT 쿠키만 확인.*

2. **Page/Route Handler (Server Component / API Route)**  
   모든 `/account` 페이지는 `requireAuth()` 또는 `apiRequireAuth()`를 호출하여 세션을 재검증.  
   데이터 조회/수정 시 **항상 `session.userId`** 기준으로만 처리 — URL 파라미터, body의 userId는 신뢰하지 않음.

### 설계 원칙

- **URL 파라미터 기반 다른 사용자 접근 구조 없음**: `/account/[userId]` 같은 경로 없음
- **ADMIN도 `/account`에서 타인 계정 수정 불가**: 관리자 기능은 `/admin/users`에서 분리
- **클라이언트 신뢰 금지**: role, userId 등 민감 값은 서버 세션에서만 읽음

---

## 6. API 엔드포인트 요약

| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| `PATCH` | `/api/account/profile` | 이름 수정 | 로그인 필수 (본인만) |
| `POST` | `/api/account/password` | 비밀번호 변경 | 로그인 필수 (본인만) |

---

## 7. 비밀번호 변경 정책

| 항목 | 정책 |
|------|------|
| 현재 비밀번호 확인 | 필수 (bcrypt 비교) |
| 새 비밀번호 조건 | 8자 이상, 영문자 포함, 숫자 포함 |
| 동일 비밀번호 재사용 | 차단 |
| 변경 후 세션 | 기존 세션 유지 (재로그인 불필요) |
| 에러 메시지 | 정보 노출 최소화 ("현재 비밀번호가 올바르지 않습니다" 등 간결하게) |

---

## 8. 향후 주문/구독 기능 연결 방안

```
# 주문 기능 추가 시
model Order {
  id         String   @id @default(cuid())
  userId     String
  ...
  user       User     @relation(fields: [userId], references: [id])
}

# 구독 기능 추가 시
model Subscription {
  id         String   @id @default(cuid())
  userId     String
  ...
  user       User     @relation(fields: [userId], references: [id])
}
```

- `/account` 페이지의 "내 주문", "내 구독" 카드에 실제 링크 연결
- `CustomerProfile`에 픽업 메모, 연락처 등 추가
- 각 기능은 `userId = session.userId` 기준으로만 데이터 접근

---

## 9. 로컬 테스트 시나리오

| 시나리오 | 방법 |
|----------|------|
| 비로그인 → `/account` 접근 | 브라우저에서 쿠키 삭제 후 `/account` 접근 → `/login` 리다이렉트 확인 |
| 신규 CUSTOMER 가입 | `/signup`에서 이름/이메일/비밀번호 입력 후 가입 → `/account`로 이동 확인 |
| 중복 이메일 차단 | 동일 이메일로 재가입 시도 → "이미 사용 중인 이메일" 오류 확인 |
| 자기 정보 조회 | `/account`에서 이름, 이메일, role, 가입일 표시 확인 |
| 이름 수정 | `/account/profile`에서 이름 변경 → 저장 성공 메시지 확인 |
| 비밀번호 변경 | `/account/security`에서 현재/새 비밀번호 입력 → 변경 후 새 비밀번호로 재로그인 확인 |
| 잘못된 현재 비밀번호 | 틀린 현재 비밀번호 입력 → 오류 메시지 확인 |

---

## 10. 후속 추천 작업

1. **이메일 인증 추가** — 회원가입 시 이메일 인증 링크 발송 (`isEmailVerified` 필드)
2. **CustomerProfile UI 연결** — 전화번호, 픽업 메모, 마케팅 동의 수정 기능
3. **주문 내역 페이지** — `Order` 모델 추가 후 `/account` 주문 섹션 연결
