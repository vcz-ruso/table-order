# 테이블오더 (Table Order)

단일 매장용 테이블오더 서비스. 무료 스택(Vercel + Supabase)으로 구축합니다.

> 현재 상태: **개발환경 스캐폴딩만 완료.** 실제 기능은 AI-DLC 설계 문서 기반으로 추가됩니다.

## 기술 스택

| 영역 | 스택 |
|------|------|
| 프론트엔드 | React 19 + Vite + TypeScript (SPA) |
| 라우팅 | react-router-dom (`/customer`, `/admin`) |
| 백엔드 | Node.js — Vercel Serverless Functions (`api/`) |
| 데이터/인증/실시간/스토리지 | Supabase (PostgreSQL / Auth / Realtime / Storage) |
| 테스트 | Vitest + fast-check(PBT) + Testing Library |
| 배포 | Vercel (Hobby, 무료) |

## 사전 준비

- Node.js 24 이상 (`.nvmrc` 참고)
- Supabase 프로젝트 (무료 티어)

## 환경 변수

`.env.example` 를 복사해 `.env` 를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: 클라이언트에서 사용하는 공개 값
- `SUPABASE_SERVICE_ROLE_KEY`: 서버(서버리스 함수) 전용 비밀 키 — 클라이언트에 노출 금지

## 개발 명령어

```bash
npm install       # 의존성 설치
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 타입체크 + 프로덕션 빌드
npm run preview   # 빌드 결과 미리보기
npm test          # 테스트 1회 실행
npm run test:watch # 테스트 watch 모드
npm run typecheck # 타입 검사만
```

## 디렉토리 구조

```
table-order/
├── api/                  # Vercel Serverless Functions (Node.js)
│   ├── [...path].ts      # 단일 catch-all 함수 — 모든 /api/* 요청을 내부 라우팅
│   │                     #   (Hobby 무료 플랜의 함수 12개 제한 대응: 함수 1개로 통합)
│   ├── _routes/          # 실제 엔드포인트 핸들러 (언더스코어 → 함수로 배포 안 됨)
│   │   ├── auth/  orders/  tables/  menus/  sales/  inventory/  customer/
│   └── _lib/             # 공통 라이브러리(인증/검증/미들웨어/매퍼 등)
├── src/                  # React SPA
│   ├── main.tsx          # 진입점
│   ├── App.tsx           # 라우팅
│   ├── lib/              # supabase 클라이언트, api 클라이언트, 타입, 계산 로직
│   ├── auth/             # 관리자 인증 컨텍스트/가드
│   ├── customer/         # 고객 컨텍스트/실시간 훅
│   ├── routes/
│   │   ├── customer/     # 고객(투숙객) 룸서비스 화면
│   │   └── admin/        # 관리자용 화면
│   └── test/             # 테스트 (툴체인 sanity 포함)
├── supabase/             # 마이그레이션 SQL / 시드 / 마이그레이션 러너
├── aidlc-docs/           # AI-DLC 문서 (요구사항/설계/감사 로그)
└── requirements/         # 원본 요구사항 문서
```

> **무료(Hobby) 배포 주의**: Vercel Hobby 플랜은 배포당 서버리스 함수 최대 12개입니다.
> 엔드포인트가 20개이므로, 단일 catch-all 함수(`api/[...path].ts`)에서 내부 라우팅하여
> **함수 1개**로 배포합니다. 새 엔드포인트는 `api/_routes/`에 추가하고 `api/[...path].ts`의
> 라우팅 테이블에만 등록하면 됩니다(함수 수는 그대로 1개).

## 관리자(Admin) 기능
매장 관리자(Owner/Staff)용 풀스택 기능이 구현되어 있습니다.

- **인증**: 매장코드 + 사용자명 + 비밀번호. 커스텀 JWT(Access 1h / Refresh 16h), bcrypt 해싱,
  단일 기기 세션(다른 기기 로그인 시 기존 세션 즉시 무효화), 로그인 3회 실패 시 계정 잠금.
- **주문 대시보드**: 테이블 카드 그리드, 신규 주문 강조(애니메이션), 상세 모달 상태 변경(대기중→준비중→완료),
  Supabase Realtime 실시간 반영 + 자동 재연결.
- **테이블 관리**: 매장 이용 완료(세션 종료), 주문 직권 삭제(+로그), 과거 내역(최근 30일/날짜 필터).
- **메뉴 관리(Owner)**: 등록/수정, 비노출(soft delete)/복원, 드래그 순서 변경, 품절 토글.
- **매출(Owner)**: 오늘 요약, 날짜별 메뉴/카테고리별 판매, 취소 금액/순매출.
- **재고(Owner)**: 원재료 잔량 입력(일괄 저장), 소모량 자동 계산.

### 아키텍처 결정 메모

- **실시간(SSE 요구사항)**: Vercel 서버리스는 장시간 SSE 연결에 부적합하여 **Supabase Realtime**으로
  구현했습니다(요구사항의 실시간 2초 이내 반영·자동 재연결·연결 안내 UX 충족).
- **인증**: 매장코드+사용자명+역할(Owner/Staff)+단일기기+계정잠금 모델이 Supabase Auth와 맞지 않아,
  Supabase Postgres를 저장소로 하는 커스텀 JWT 인증으로 구현했습니다. 모든 관리 API는 서버에서
  service_role로 접근하며(RLS 우회) API 레이어에서 역할 기반 접근 제어를 검증합니다.

### DB 설정 (최초 1회)

Supabase 프로젝트에 스키마와 시드를 적용합니다. 두 가지 방법 중 하나를 사용하세요.

**옵션 A — 원커맨드 (psql, 권장):** DB 접속 문자열만 있으면 마이그레이션 + 시드가 한 번에 됩니다.

```bash
# Supabase 대시보드 → Project Settings → Database → Connection string(URI) 복사 후:
export SUPABASE_DB_URL='postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres'
npm run db:setup     # = db:migrate(0001+0002) + seed
```

**옵션 B — SQL Editor 수동:** DB 비밀번호 없이 대시보드에서 직접 실행합니다.

1. **스키마 적용**: Supabase 대시보드 → SQL Editor 에서 순서대로 붙여넣어 실행합니다.
   - `supabase/migrations/0001_init.sql` (테이블/인덱스/RLS/Realtime publication)
   - `supabase/migrations/0002_menu_options.sql` (메뉴 옵션 + 주문 항목 옵션 스냅샷)
2. **시드 데이터**: 아래 명령으로 매장/계정/테이블/메뉴/옵션/원재료/샘플 주문을 삽입합니다.
   ```bash
   npm run seed
   ```

공통 시드 결과:
   - 기본 매장코드: `cafe`
   - Owner: `owner` / `SEED_OWNER_PASSWORD`(.env, 기본 `owner1234`)
   - Staff: `staff` / `SEED_STAFF_PASSWORD`(.env, 기본 `staff1234`)
   - 테이블 태블릿 인증정보: `0000` (테이블 1~5)
   - 비밀번호 정책: 8자 이상 + 영문·숫자 조합. 잠금 해제/비밀번호 변경은 DB에서 직접 수행(MVP).

> `JWT_SECRET`(서버 전용)을 반드시 설정하세요. 예:
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### 로컬 실행 (API 포함)

로컬에서 프론트 + `/api` 함수를 함께 쓰려면 **터미널 2개**를 사용합니다.
`vercel dev` 단독으로 프론트까지 서빙하면, `vercel dev` 프록시가 SPA rewrite(`→ /index.html`)를
Vite의 모듈 요청(`/src/main.tsx` 등)에까지 적용해 *"Failed to parse source for import analysis"*
에러가 납니다(Vercel + Vite의 알려진 이슈). 그래서 프론트는 Vite로, API만 함수 런타임으로 띄웁니다.

```bash
# 터미널 1 — 서버리스 함수 (포트 3000)
npm i -g vercel        # 최초 1회
npm run dev:api        # = vercel dev --listen 3000  (여기서 프론트 창은 열지 않음)

# 터미널 2 — 프론트 (포트 5173). /api 요청은 위 3000 으로 자동 프록시됨
npm run dev            # http://localhost:5173 접속
```

- Vite dev 서버가 SPA 라우팅을 네이티브로 처리하므로 딥링크/새로고침이 정상 동작합니다.
- 함수를 로컬에 안 띄우고 **배포된 API로 붙이려면**: `VITE_API_PROXY=https://<프로젝트>.vercel.app npm run dev`
- 프로덕션 배포에서는 `vercel.json` 의 SPA rewrite 가 딥링크를 index.html 로 폴백합니다(정상).

### 관리자 관련 npm 스크립트

```bash
npm run typecheck:api   # api/ 서버리스 함수 타입 검사
npm run seed            # 초기 데이터 시드 (스키마 적용 후)
npm run db:setup        # 마이그레이션 + 시드 (SUPABASE_DB_URL 필요)
```

## 고객(Customer) 기능

테이블 태블릿용 주문 웹앱입니다. (`/customer`)

- **자동 로그인/세션**: 관리자가 최초 1회 초기 설정(매장코드 + 테이블 번호 + 테이블 인증정보)을 하면
  장기 `table` 토큰이 localStorage에 저장되어, 재실행/재부팅 후에도 자동 로그인됩니다. 인증 실패 시
  주문이 불가하며 설정 확인 안내를 표시합니다.
- **메뉴 조회/탐색**: 카테고리 탭, 카드형 레이아웃(이미지/이름/가격/설명), 품절 표시, 상세 팝업.
- **옵션 선택**: 메뉴별 필수/선택 옵션(HOT·ICE, 사이즈, 샷/토핑 등), 추가금액 즉시 반영, 필수 옵션
  미선택 시 담기 불가. 동일 메뉴라도 옵션이 다르면 별도 항목, 같으면 수량 증가로 병합.
- **장바구니**: 수량 조절/삭제/비우기, 옵션 요약, 실시간 총액, 현재 세션 기준 로컬 저장(새로고침 복구).
- **주문 생성**: 최종 확인 → 확정 → 서버에서 품절/필수옵션/가격 재검증 → 주문번호 표시, 장바구니 자동
  비움. 실패 시 장바구니 유지 후 재시도.
- **주문 내역**: 현재 세션 주문만 시간순 표시(접수됨/준비중/완료). Supabase Realtime으로 상태 자동 갱신.
- **세션 종료 동기화**: 관리자가 이용 완료 처리하면 태블릿이 실시간 감지 → 장바구니/조회 범위를 초기화하여
  다음 고객에게 이전 주문이 노출되지 않습니다.

> 세션은 첫 주문 시 자동 생성되고 추가 주문은 동일 세션에 누적됩니다. 로컬 개발 시 API(`/api`)가 필요하므로
> `vercel dev`로 실행하세요.
