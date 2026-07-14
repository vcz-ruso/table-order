-- =============================================================================
-- 테이블오더 — 초기 스키마 (관리자 기능 포함)
-- 적용 방법: Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하거나,
--            psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
--
-- 설계 메모:
--  - 관리자 인증은 커스텀 JWT(별도 서버리스 함수)로 처리하며, 모든 관리 API는
--    service_role 키로 접근하여 RLS 를 우회하고 API 레벨에서 역할(Owner/Staff)을 검증한다.
--  - 프론트 대시보드는 anon 키로 Supabase Realtime 을 직접 구독하므로, 구독 대상
--    테이블에는 anon SELECT 정책을 부여한다(단일 매장 MVP).
--  - 민감 테이블(admin_users, admin_sessions, order_deletion_logs, ingredients,
--    inventory_records)은 anon 접근을 차단하고 service_role 로만 접근한다.
-- =============================================================================

-- 확장: gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 공통: updated_at 자동 갱신 트리거 함수
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 주문 번호 시퀀스 (매장 전역 순번)
create sequence if not exists order_number_seq start 1;

-- ----------------------------------------------------------------------------
-- 매장
-- ----------------------------------------------------------------------------
create table if not exists stores (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,               -- 영문 매장 식별자 (로그인 시 입력)
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 관리자 계정 (Owner / Staff)
-- ----------------------------------------------------------------------------
create table if not exists admin_users (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references stores(id) on delete cascade,
  username           text not null,
  password_hash      text not null,               -- bcrypt 해시
  role               text not null check (role in ('owner', 'staff')),
  failed_attempts    int  not null default 0,
  is_locked          boolean not null default false,
  current_session_id uuid,                         -- 단일 기기 세션 강제용 (최근 로그인 세션)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (store_id, username)
);
create trigger trg_admin_users_updated before update on admin_users
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 관리자 세션 (Refresh Token) — 단일 기기 정책상 계정당 1개만 유지
-- ----------------------------------------------------------------------------
create table if not exists admin_sessions (
  id                 uuid primary key default gen_random_uuid(),
  admin_user_id      uuid not null references admin_users(id) on delete cascade,
  refresh_token_hash text not null,               -- refresh token 의 sha-256 해시
  user_agent         text,
  created_at         timestamptz not null default now(),
  refresh_expires_at timestamptz not null
);
create index if not exists idx_admin_sessions_user on admin_sessions(admin_user_id);

-- ----------------------------------------------------------------------------
-- 테이블(좌석) — MVP 5개 이하, 추가/삭제는 DB 직접 수정
-- ----------------------------------------------------------------------------
create table if not exists dining_tables (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  table_number  int  not null,
  password_hash text not null,                     -- 태블릿 초기 설정용(고객 미인지)
  created_at    timestamptz not null default now(),
  unique (store_id, table_number)
);

-- ----------------------------------------------------------------------------
-- 테이블 세션 (첫 주문 ~ 이용 완료)
-- ----------------------------------------------------------------------------
create table if not exists table_sessions (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  table_id   uuid not null references dining_tables(id) on delete cascade,
  status     text not null default 'active' check (status in ('active', 'closed')),
  started_at timestamptz not null default now(),
  closed_at  timestamptz
);
-- 테이블당 active 세션은 최대 1개
create unique index if not exists uniq_active_session_per_table
  on table_sessions(table_id) where (status = 'active');
create index if not exists idx_table_sessions_table on table_sessions(table_id);

-- ----------------------------------------------------------------------------
-- 카테고리 (시드 데이터)
-- ----------------------------------------------------------------------------
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_store on categories(store_id, sort_order);

-- ----------------------------------------------------------------------------
-- 메뉴
-- ----------------------------------------------------------------------------
create table if not exists menus (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  name        text not null,
  price       int  not null check (price >= 0),   -- 0원(서비스 메뉴) 허용
  description text not null default '',
  image_url   text not null,                       -- 빈 값이면 등록 불가(앱 레벨 검증)
  sort_order  int  not null default 0,             -- 카테고리 내 노출 순서
  is_hidden   boolean not null default false,      -- 비노출(soft delete)
  is_sold_out boolean not null default false,      -- 품절
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_menus_category on menus(category_id, sort_order);
create index if not exists idx_menus_store on menus(store_id);
create trigger trg_menus_updated before update on menus
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 주문 / 주문 항목
-- ----------------------------------------------------------------------------
create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores(id) on delete cascade,
  table_id         uuid not null references dining_tables(id) on delete cascade,
  table_session_id uuid not null references table_sessions(id) on delete cascade,
  order_number     bigint not null default nextval('order_number_seq'),
  status           text not null default 'pending' check (status in ('pending', 'preparing', 'done')),
  total_amount     int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_orders_session on orders(table_session_id);
create index if not exists idx_orders_table on orders(table_id);
create index if not exists idx_orders_store_created on orders(store_id, created_at);
create index if not exists idx_orders_status on orders(status);
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  menu_id    uuid references menus(id) on delete set null,  -- 메뉴 비노출/삭제되어도 스냅샷 유지
  menu_name  text not null,                        -- 주문 시점 메뉴명 스냅샷
  unit_price int  not null check (unit_price >= 0), -- 주문 시점 단가 스냅샷
  quantity   int  not null check (quantity > 0)
);
create index if not exists idx_order_items_order on order_items(order_id);

-- ----------------------------------------------------------------------------
-- 주문 삭제 로그 (직권 수정 감사 로그 + 매출 취소 금액 산출)
-- ----------------------------------------------------------------------------
create table if not exists order_deletion_logs (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references stores(id) on delete cascade,
  order_id       uuid not null,                    -- 삭제된 주문의 원본 id (FK 아님)
  order_number   bigint not null,
  admin_user_id  uuid references admin_users(id) on delete set null,
  admin_username text not null,
  deleted_amount int  not null,
  order_snapshot jsonb not null,                   -- 삭제 시점 주문 전체 스냅샷
  deleted_at     timestamptz not null default now()
);
create index if not exists idx_deletion_logs_store_date on order_deletion_logs(store_id, deleted_at);

-- ----------------------------------------------------------------------------
-- 재고: 원재료 / 일별 재고 기록
-- ----------------------------------------------------------------------------
create table if not exists ingredients (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  unit       text not null,                        -- g, ml, L, kg, 개 등
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ingredients_store on ingredients(store_id, sort_order);

create table if not exists inventory_records (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  record_date   date not null,
  opening_qty   numeric,                            -- 영업 전 잔량
  closing_qty   numeric,                            -- 마감 잔량
  updated_at    timestamptz not null default now(),
  unique (ingredient_id, record_date)
);
create index if not exists idx_inventory_store_date on inventory_records(store_id, record_date);
create trigger trg_inventory_updated before update on inventory_records
  for each row execute function set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- 모든 테이블 RLS 활성화 (service_role 은 항상 우회)
alter table stores               enable row level security;
alter table admin_users          enable row level security;
alter table admin_sessions       enable row level security;
alter table dining_tables        enable row level security;
alter table table_sessions       enable row level security;
alter table categories           enable row level security;
alter table menus                enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table order_deletion_logs  enable row level security;
alter table ingredients          enable row level security;
alter table inventory_records    enable row level security;

-- anon(브라우저 공개 키) SELECT 허용 — 고객 화면 + 관리자 Realtime 구독 대상
-- (단일 매장 MVP. 민감 테이블에는 정책을 만들지 않아 기본 차단됨)
create policy anon_read_stores          on stores              for select to anon using (true);
create policy anon_read_dining_tables   on dining_tables       for select to anon using (true);
create policy anon_read_table_sessions  on table_sessions      for select to anon using (true);
create policy anon_read_categories      on categories          for select to anon using (true);
-- 메뉴는 고객에게 노출되는 것만 (비노출 메뉴는 관리자 API(service_role)로만 조회)
create policy anon_read_menus           on menus               for select to anon using (is_hidden = false);
create policy anon_read_orders          on orders              for select to anon using (true);
create policy anon_read_order_items     on order_items         for select to anon using (true);

-- =============================================================================
-- Realtime: 대시보드 실시간 구독 대상 테이블을 publication 에 추가
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table orders';
    execute 'alter publication supabase_realtime add table order_items';
    execute 'alter publication supabase_realtime add table table_sessions';
    execute 'alter publication supabase_realtime add table menus';
  end if;
exception
  when duplicate_object then null;  -- 이미 추가된 경우 무시
end;
$$;
