-- =============================================================================
-- 메뉴 '오늘의 추천' 지정 기능 (Manager가 메뉴 1개를 추천으로 지정/해제)
-- 단일 제약(매장당 최대 1개)은 API 레이어에서 보장한다.
-- =============================================================================
alter table menus add column if not exists is_recommended boolean not null default false;

-- 조회 편의 인덱스 (추천 메뉴 빠른 탐색)
create index if not exists idx_menus_recommended on menus(store_id) where (is_recommended = true);
