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
│   └── health.ts         # 헬스체크 샘플
├── src/                  # React SPA
│   ├── main.tsx          # 진입점
│   ├── App.tsx           # 라우팅
│   ├── lib/supabase.ts   # Supabase 클라이언트
│   ├── routes/
│   │   ├── customer/     # 고객용 화면
│   │   └── admin/        # 관리자용 화면
│   └── test/             # 테스트 (툴체인 sanity 포함)
├── aidlc-docs/           # AI-DLC 문서 (요구사항/설계/감사 로그)
└── requirements/         # 원본 요구사항 문서
```
