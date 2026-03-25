# 인증 및 권한(Role) 시스템 가이드

## 1. 인증 구조 개요

| 레이어 | 파일 | 역할 |
|--------|------|------|
| JWT 세션 | `lib/auth/session.ts` | 토큰 암호화/복호화, 쿠키 관리 |
| 데이터 접근 계층 | `lib/auth/dal.ts` | `requireAuth()`, `requireRole()` 등 가드 함수 |
| 진입점 내보내기 | `lib/auth/index.ts` | 공통 re-export |
| 서버 액션 | `app/actions/auth.ts` | 로그인/로그아웃 처리 |
| 프록시(미들웨어) | `proxy.ts` | 라우트별 선제적(optimistic) 접근 차단 |

### 인증 흐름

```
브라우저 → POST /login (서버 액션)
  → 이메일/비밀번호 검증
  → bcrypt 비밀번호 비교
  → JWT 생성 (userId, email, name, role, expiresAt)
  → HTTP-only 쿠키 'session' 저장 (7일)
  → role에 따라 /admin | /staff | /account 리다이렉트
```

### 라이브러리 선택 이유

- **jose** — Edge Runtime 호환 순수 JS JWT 라이브러리 (Next.js 16 Proxy에서 사용 가능)
- **bcryptjs** — 순수 JS bcrypt 구현 (Node.js API Route / Server Action에서 사용)
- **server-only** — 서버 전용 모듈이 클라이언트 번들에 포함되지 않도록 방지

---

## 2. Role별 접근 권한 표

| 경로 | CUSTOMER | STAFF | ADMIN |
|------|----------|-------|-------|
| `/` (대시보드) | ✅ | ✅ | ✅ |
| `/login` | ✅ (비로그인) | ✅ (비로그인) | ✅ (비로그인) |
| `/account` | ✅ | ✅ | ✅ |
| `/sales` (조회) | ✅ | ✅ | ✅ |
| `/sales` (생성/수정/삭제) | ❌ | ✅ | ✅ |
| `/imports` | ❌ | ✅ | ✅ |
| `/external-factors` | ❌ | ✅ | ✅ |
| `/tasks` | ❌ | ✅ | ✅ |
| `/predictions` | ✅ | ✅ | ✅ |
| `/analytics` | ❌ | ❌ | ✅ |
| `/weights` | ❌ | ❌ | ✅ |
| `/settings` | ❌ | ❌ | ✅ |
| `/admin` | ❌ | ❌ | ✅ |
| `/staff` | ❌ | ✅ | ✅ |

### API 보호 요약

| 엔드포인트 | GET | POST/PUT/DELETE |
|-----------|-----|-----------------|
| `/api/sales` | 공개 | STAFF+ |
| `/api/sales/[id]` | 공개 | STAFF+ |
| `/api/analytics/**` | ADMIN | ADMIN |
| 기타 API | 공개 | 공개 |

> **참고**: 프록시(미들웨어)는 UI 레벨의 선제적 차단이며, 실제 데이터 보호는 API 라우트/서버 액션에서 이중으로 검증합니다.

---

## 3. 필요한 환경변수

```env
# 필수
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/beyond_dev"
SESSION_SECRET="your-random-secret-here"   # openssl rand -base64 32

# 선택
SEED_DEFAULT_PASSWORD="Dev@12345!"         # 시드 계정 기본 비밀번호 (운영 시 반드시 변경)
```

---

## 4. 로컬 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 DATABASE_URL, SESSION_SECRET 설정

# 3. DB 마이그레이션
npx prisma migrate dev

# 4. Prisma 클라이언트 생성
npx prisma generate

# 5. 시드 실행 (테스트 계정 및 기본 데이터 생성)
npm run db:seed

# 6. 개발 서버 시작
npm run dev
```

---

## 5. Seed 실행 방법

```bash
npm run db:seed
```

또는 DB를 초기화하고 싶다면:

```bash
npm run db:reset   # 주의: 모든 데이터 삭제 후 재시드
```

---

## 6. 테스트 계정

시드 실행 후 아래 계정으로 로그인 가능합니다.  
기본 비밀번호: `Dev@12345!` (`.env`의 `SEED_DEFAULT_PASSWORD`로 변경 가능)

| 이메일 | 역할 | 로그인 후 이동 |
|--------|------|----------------|
| admin@example.com | ADMIN | /admin |
| staff@example.com | STAFF | /staff |
| customer@example.com | CUSTOMER | /account |

> ⚠️ **운영 배포 전 반드시 비밀번호를 변경하세요.**

---

## 7. 이후 확장 포인트

### 주문/구독 기능 추가 시

1. `prisma/schema.prisma`에 `Order`, `Subscription` 모델 추가
2. `User` 모델과 관계 연결: `orders Order[]`, `subscriptions Subscription[]`
3. CUSTOMER 전용 API 라우트 생성 (`/api/orders/[userId]`)
4. `requireAuth()` + `userId` 비교로 본인 데이터만 접근 허용

### 이메일 인증 추가 시

1. `User` 모델에 `emailVerified DateTime?` 필드 추가
2. 이메일 발송 라이브러리 (e.g., Resend, Nodemailer) 연동
3. 로그인 시 `emailVerified` 체크 추가

### 소셜 로그인 추가 시

- 현재 구조에 `provider`, `providerAccountId` 필드를 `User` 모델에 추가하거나
- `Account` 모델을 별도로 만들어 NextAuth.js v5로 마이그레이션 가능

### 세분화된 권한(Permission) 시스템

- `Permission` enum 또는 테이블 추가
- `User.role`을 기반으로 권한 매핑 테이블 관리
- `requirePermission("sales:write")` 형태의 세분화된 가드 구현
