-- =============================================================================
-- 테이블오더 — 메뉴 옵션 확장 + 주문 항목 옵션 스냅샷 (고객 기능)
-- 적용: Supabase SQL Editor 에서 0001_init.sql 이후 실행.
--
-- 설계 메모:
--  - 메뉴별 옵션 그룹(필수/선택) + 옵션 항목(추가금액).
--  - 옵션 종류는 MVP 에서 시드/DB 직접 관리(카테고리와 동일 정책).
--  - 주문 항목에는 선택 옵션을 스냅샷(jsonb)으로 저장하여 제조 정보 누락을 방지한다.
-- =============================================================================

-- 옵션 그룹 (예: HOT/ICE, 사이즈, 샷 추가)
create table if not exists menu_option_groups (
  id          uuid primary key default gen_random_uuid(),
  menu_id     uuid not null references menus(id) on delete cascade,
  name        text not null,
  is_required boolean not null default false,      -- 필수 옵션 여부
  min_select  int not null default 0,              -- 최소 선택 수
  max_select  int not null default 1,              -- 최대 선택 수 (1=단일 선택)
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_option_groups_menu on menu_option_groups(menu_id, sort_order);

-- 옵션 항목 (예: HOT, ICE / 톨, 그란데 / 샷 추가 +500)
create table if not exists menu_option_items (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references menu_option_groups(id) on delete cascade,
  name        text not null,
  extra_price int  not null default 0 check (extra_price >= 0),
  is_default  boolean not null default false,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_option_items_group on menu_option_items(group_id, sort_order);

-- 주문 항목 옵션 스냅샷: [{ groupName, name, extraPrice }]
alter table order_items
  add column if not exists options jsonb not null default '[]'::jsonb;

-- RLS + anon SELECT (고객 화면은 API(service_role)로 조회하지만, 일관성/직접구독 대비 허용)
alter table menu_option_groups enable row level security;
alter table menu_option_items  enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'anon_read_option_groups') then
    create policy anon_read_option_groups on menu_option_groups for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_read_option_items') then
    create policy anon_read_option_items on menu_option_items for select to anon using (true);
  end if;
end;
$$;
