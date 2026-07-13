# 요구사항 명확화 질문

요구사항 문서를 분석했습니다. 아래 질문에 각 [Answer]: 태그 뒤에 선택지 문자를 입력해주세요.
일치하는 옵션이 없으면 마지막 옵션(Other)을 선택하고 설명을 추가해주세요.

---

## Question 1
프로젝트의 기술 스택(백엔드)은 무엇을 사용할 예정인가요?

A) Node.js (Express/Fastify)

B) Python (FastAPI/Django)

C) Java (Spring Boot)

D) Go

E) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
프론트엔드 기술 스택은 무엇을 사용할 예정인가요?

A) React (Next.js)

B) React (Vite + SPA)

C) Vue.js (Nuxt)

D) Vue.js (Vite + SPA)

E) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 3
데이터베이스로 무엇을 사용할 예정인가요?

A) PostgreSQL

B) MySQL

C) Amazon DynamoDB

D) MongoDB

E) Other (please describe after [Answer]: tag below)

[Answer]: X — Supabase (PostgreSQL 기반, 무료 티어). Auth/Realtime/Storage 적극 활용('나' 구조)

## Question 4
배포 환경은 어디를 목표로 하나요?

A) AWS (ECS/EKS/Lambda 등 클라우드 서비스)

B) 로컬 개발 환경 + Docker Compose (배포는 추후 결정)

C) Kubernetes (클라우드 무관)

D) Other (please describe after [Answer]: tag below)

[Answer]: X — Vercel (무료 Hobby 티어). 프론트 SPA + Node.js Serverless Functions 배포, Supabase와 조합

## Question 5
고객용 인터페이스와 관리자용 인터페이스를 하나의 프론트엔드 프로젝트에서 관리할 예정인가요, 별도 프로젝트로 분리할 예정인가요?

A) 하나의 프로젝트에서 라우팅으로 분리 (예: /customer, /admin)

B) 완전히 별도의 프로젝트로 분리

C) 모노레포 구조에서 별도 앱으로 관리

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
매장(Store) 데이터는 어떻게 관리되나요? (멀티테넌시 관련)

A) 단일 매장만 지원 (MVP 단계에서 하나의 매장만 운영)

B) 다중 매장 지원 (하나의 시스템에서 여러 매장 관리)

C) Other (please describe after [Answer]: tag below)

[Answer]: A — 단일 매장만 지원 (MVP)

## Question 7
관리자 계정 생성은 어떻게 이루어지나요?

A) 시스템 초기 설정 시 시드(seed) 데이터로 생성

B) 별도의 관리자 회원가입 페이지 제공

C) CLI 또는 스크립트로 생성

D) Other (please describe after [Answer]: tag below)

[Answer]: A — 시스템 초기 설정 시 시드(seed) 데이터로 생성 (Supabase Auth 사용자로 시딩)

## Question 8
메뉴 이미지는 어떻게 관리할 예정인가요?

A) 외부 URL을 직접 입력 (별도 이미지 서버 없음)

B) 로컬 파일 업로드 후 서버에서 정적 파일로 제공

C) S3 등 클라우드 스토리지 업로드

D) Other (please describe after [Answer]: tag below)

[Answer]: X — Supabase Storage 업로드 (무료 티어 1GB). (제안값, 확인 필요)

## Question 9
SSE(Server-Sent Events) 실시간 업데이트의 대상 범위는 어떻게 되나요?

A) 관리자 대시보드에서만 SSE 사용 (고객용은 일반 REST polling 또는 수동 새로고침)

B) 관리자 대시보드 + 고객 주문 상태 조회 모두 SSE 사용

C) Other (please describe after [Answer]: tag below)

[Answer]: X — 직접 구현 SSE 대신 Supabase Realtime으로 실시간 처리. 관리자 대시보드 실시간 모니터링에 사용 (Vercel Serverless가 장시간 연결 부적합하므로). (제안값, 확인 필요)

## Question 10
MVP에서 동시 접속 사용자 규모는 어느 정도를 예상하나요?

A) 소규모 (단일 매장, 동시 20명 이내)

B) 중규모 (2~5개 매장, 동시 100명 이내)

C) 대규모 (10개+ 매장, 동시 500명 이상)

D) Other (please describe after [Answer]: tag below)

[Answer]: A — 소규모 (단일 매장, 동시 20명 이내)

---

## Extension 질문

## Question 11: Security Extensions
이 프로젝트에 보안 확장 규칙을 적용해야 하나요?

A) Yes — 모든 보안 규칙을 blocking 제약으로 적용 (프로덕션 등급 애플리케이션에 권장)

B) No — 모든 보안 규칙 건너뛰기 (PoC, 프로토타입, 실험 프로젝트에 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: X — 워크샵 성격에 맞게 경량 적용. 인증/비밀번호/세션이 있으므로 기본 보안(비밀번호 해싱, 입력 검증, 인증 처리)은 방향성 가이드로 반영하되, blocking 제약으로 개발 속도를 막지는 않음. (Supabase Auth가 핵심 보안 기능 제공)

## Question 12: Resiliency Extensions
이 프로젝트에 복원력(Resiliency) 베이스라인을 적용해야 하나요?

이 확장의 의미: AWS Well-Architected Framework (Reliability Pillar)에서 파생된 설계 시점의 모범 사례 세트를 적용합니다. 장애 허용, 고가용성, 관찰 가능성, 복구 가능성을 위한 15개 실천 영역을 다룹니다.

A) Yes — 복원력 베이스라인을 방향적 모범 사례 및 설계 시점 가이드로 적용 (비즈니스 크리티컬 워크로드에 권장)

B) No — 복원력 베이스라인 건너뛰기 (PoC, 프로토타입, 실험 프로젝트에 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: B — No. 워크샵/MVP 성격이므로 복원력 베이스라인 건너뛰기. (추천값)

## Question 13: Property-Based Testing Extension
이 프로젝트에 Property-Based Testing (PBT) 규칙을 적용해야 하나요?

A) Yes — 모든 PBT 규칙을 blocking 제약으로 적용 (비즈니스 로직, 데이터 변환, 직렬화, 상태 컴포넌트가 있는 프로젝트에 권장)

B) Partial — 순수 함수와 직렬화 round-trip에만 PBT 규칙 적용 (제한된 알고리즘 복잡도 프로젝트에 적합)

C) No — 모든 PBT 규칙 건너뛰기 (단순 CRUD 앱, UI 전용 프로젝트에 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: B — Partial. 대부분 CRUD이지만 장바구니 금액 계산, 주문 총액 재계산, 세션 라이프사이클 등 일부 비즈니스 로직이 있으므로 순수 함수/계산 로직에만 PBT 적용. (추천값)
