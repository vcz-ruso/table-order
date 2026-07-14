// =============================================================================
// 시드 스크립트 — service_role 키로 PostgREST(Supabase JS)를 통해 초기 데이터 삽입
// 실행: npm run seed   (내부적으로 node --env-file=.env 사용)
//
// 선행 조건: supabase/migrations/0001_init.sql 이 먼저 적용되어 있어야 합니다.
// 비밀번호는 bcrypt 로 해싱하여 저장합니다. 비밀 키/비밀번호 값은 출력하지 않습니다.
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_PW = process.env.SEED_OWNER_PASSWORD || "owner1234";
const STAFF_PW = process.env.SEED_STAFF_PASSWORD || "staff1234";
const TABLE_PW = "0000"; // 태블릿 초기 설정용 (고객 미인지)

if (!url || !serviceKey) {
  console.error("❌ VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env 확인).");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STORE_CODE = "cafe";
const hash = (pw) => bcrypt.hashSync(pw, 10);

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) {
    console.error(`❌ ${label}:`, error.message);
    process.exit(1);
  }
  return data;
}

async function main() {
  console.log("=== 테이블오더 시드 시작 ===");

  // 1) 매장 --------------------------------------------------------------------
  const store = await must(
    db.from("stores").upsert({ code: STORE_CODE, name: "녹턴 호텔" }, { onConflict: "code" }).select().single(),
    "매장 upsert",
  );
  const storeId = store.id;
  console.log(`  ✅ 매장: ${store.name} (code=${store.code})`);

  // 2) 관리자 계정 -------------------------------------------------------------
  await must(
    db.from("admin_users").upsert(
      [
        { store_id: storeId, username: "owner", password_hash: hash(OWNER_PW), role: "owner", failed_attempts: 0, is_locked: false },
        { store_id: storeId, username: "staff", password_hash: hash(STAFF_PW), role: "staff", failed_attempts: 0, is_locked: false },
      ],
      { onConflict: "store_id,username" },
    ),
    "관리자 계정 upsert",
  );
  console.log("  ✅ 관리자 계정: owner(Owner), staff(Staff)");

  // 3) 테이블(5개) -------------------------------------------------------------
  const tableRows = [1, 2, 3, 4, 5].map((n) => ({
    store_id: storeId,
    table_number: n,
    password_hash: hash(TABLE_PW),
  }));
  const tables = await must(
    db.from("dining_tables").upsert(tableRows, { onConflict: "store_id,table_number" }).select(),
    "테이블 upsert",
  );
  console.log(`  ✅ 테이블 ${tables.length}개 (1~5)`);

  // 4) 카테고리 ----------------------------------------------------------------
  const categoryDefs = [
    { name: "체크인 스페셜", sort_order: 1 },
    { name: "객실 정찬", sort_order: 2 },
    { name: "심야 바 카트", sort_order: 3 },
    { name: "야간 디저트 라운지", sort_order: 4 },
    { name: "컨시어지 추천", sort_order: 5 },
    { name: "추가 요청", sort_order: 6 },
  ];
  // categories 는 자연 unique 키가 없으므로 매장 기준으로 기존 데이터 확인 후 없을 때만 삽입
  const existingCats = await must(
    db.from("categories").select("id,name").eq("store_id", storeId),
    "카테고리 조회",
  );
  let categories = existingCats;
  if (existingCats.length === 0) {
    categories = await must(
      db.from("categories").insert(categoryDefs.map((c) => ({ ...c, store_id: storeId }))).select(),
      "카테고리 insert",
    );
  }
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  console.log(`  ✅ 카테고리 ${categories.length}개`);

  // 5) 메뉴 --------------------------------------------------------------------
  // 무드를 위해 흑백(grayscale) 이미지를 사용
  // 음식 사진 (loremflickr — 태그 기반 실제 음식 이미지, lock 으로 고정). 컬러/따뜻한 톤.
  const foodImg = (tag, lock) => `https://loremflickr.com/640/480/${tag}?lock=${lock}`;
  const menuDefs = [
    // 체크인 스페셜
    { category: "체크인 스페셜", name: "체크인 스테이크", price: 24000, description: "오늘 밤 가장 먼저 권해드리는 객실 정찬", sort_order: 1, image_url: foodImg("steak", 101) },
    // 객실 정찬
    { category: "객실 정찬", name: "붉은 커튼 토마토 파스타", price: 16000, description: "복도 끝 붉은 커튼 뒤에서 시작된 시그니처 메뉴", sort_order: 1, image_url: foodImg("pasta,tomato", 102) },
    { category: "객실 정찬", name: "월광 크림 리조또", price: 17000, description: "조용한 밤에 가장 잘 어울리는 부드러운 한 접시", sort_order: 2, image_url: foodImg("risotto", 103) },
    { category: "객실 정찬", name: "검은 복도의 오징어먹물 리조또", price: 18000, description: "호텔의 가장 어두운 복도에서 영감을 받은 시그니처", sort_order: 3, image_url: foodImg("risotto,seafood", 104) },
    { category: "객실 정찬", name: "유령 신사의 비프 스튜", price: 19000, description: "오래된 기록 속에 자주 등장하는 깊고 진한 스튜", sort_order: 4, image_url: foodImg("beef,stew", 105) },
    { category: "객실 정찬", name: "심야 로스트 치킨", price: 21000, description: "늦은 시간 투숙객이 가장 자주 찾는 메뉴", sort_order: 5, image_url: foodImg("roast,chicken", 106) },
    // 심야 바 카트
    { category: "심야 바 카트", name: "블러디 오렌지 에이드", price: 9000, description: "붉게 번지는 색감이 매력적인 심야 시그니처 드링크", sort_order: 1, image_url: foodImg("orange,drink", 107) },
    { category: "심야 바 카트", name: "월광 하이볼", price: 12000, description: "달빛 아래 천천히 즐기는 한 잔", sort_order: 2, image_url: foodImg("cocktail", 108) },
    { category: "심야 바 카트", name: "심야 하우스 레드", price: 13000, description: "늦은 밤을 위한 하우스 레드 와인", sort_order: 3, image_url: foodImg("wine,glass", 109) },
    // 야간 디저트 라운지
    { category: "야간 디저트 라운지", name: "체크아웃 티라미수", price: 9500, description: "오늘 밤의 마지막을 가장 완벽하게 마무리하는 디저트", sort_order: 1, image_url: foodImg("tiramisu", 110) },
    { category: "야간 디저트 라운지", name: "월광 치즈케이크", price: 9000, description: "달빛처럼 조용하게 남는 부드러운 디저트", sort_order: 2, image_url: foodImg("cheesecake", 111) },
    // 컨시어지 추천
    { category: "컨시어지 추천", name: "Room 404 트러플 프라이", price: 11000, description: "이상하게도 늘 먼저 사라지는 객실 스낵", sort_order: 1, image_url: foodImg("fries", 112) },
    // 추가 요청 (곁들임)
    { category: "추가 요청", name: "심야 치즈 플래터", price: 15000, description: "조용한 대화를 위한 곁들임 한 접시", sort_order: 1, image_url: foodImg("cheese,platter", 113) },
    { category: "추가 요청", name: "야식 감자 웨지", price: 7000, description: "부담 없이 더하는 심야의 곁들임", sort_order: 2, image_url: foodImg("potato,wedges", 114) },
  ];
  const existingMenus = await must(
    db.from("menus").select("id,name").eq("store_id", storeId),
    "메뉴 조회",
  );
  let menus = existingMenus;
  if (existingMenus.length === 0) {
    menus = await must(
      db.from("menus").insert(
        menuDefs.map((m) => ({
          store_id: storeId,
          category_id: catByName[m.category],
          name: m.name,
          price: m.price,
          description: m.description,
          image_url: m.image_url,
          sort_order: m.sort_order,
        })),
      ).select(),
      "메뉴 insert",
    );
  }
  const menuByName = Object.fromEntries(menus.map((m) => [m.name, m]));
  console.log(`  ✅ 메뉴 ${menus.length}개`);

  // 5.1) 이미지 URL 최신화 (기존 메뉴도 음식 사진으로 갱신 — 멱등)
  for (const m of menuDefs) {
    await db.from("menus").update({ image_url: m.image_url }).eq("store_id", storeId).eq("name", m.name);
  }
  console.log("  ✅ 메뉴 이미지 음식 사진으로 최신화");

  // 5.5) 메뉴 옵션 (멱등: 기존 그룹 정리 후 재삽입, items 는 cascade 삭제) ------
  const menuIds = menus.map((m) => m.id);
  await must(
    db.from("menu_option_groups").delete().in("menu_id", menuIds),
    "기존 옵션 그룹 정리",
  );
  {
    const addGroup = async (menuName, group, items) => {
      const menu = menuByName[menuName];
      if (!menu) return;
      const g = await must(
        db.from("menu_option_groups").insert({ menu_id: menu.id, ...group }).select().single(),
        `옵션 그룹(${menuName}) insert`,
      );
      await must(
        db.from("menu_option_items").insert(
          items.map((it, i) => ({ group_id: g.id, sort_order: i + 1, is_default: it.is_default ?? false, ...it })),
        ),
        `옵션 항목(${menuName}) insert`,
      );
    };

    // 체크인 스테이크 — 굽기(필수), 소스 추가, 곁들임 추가
    await addGroup("체크인 스테이크", { name: "굽기 정도", is_required: true, min_select: 1, max_select: 1, sort_order: 1 }, [
      { name: "미디엄 레어", extra_price: 0 },
      { name: "미디엄", extra_price: 0, is_default: true },
      { name: "웰던", extra_price: 0 },
    ]);
    await addGroup("체크인 스테이크", { name: "소스 추가", is_required: false, min_select: 0, max_select: 1, sort_order: 2 }, [
      { name: "트러플 소스", extra_price: 2000 },
      { name: "페퍼 소스", extra_price: 1500 },
    ]);
    await addGroup("체크인 스테이크", { name: "곁들임 추가", is_required: false, min_select: 0, max_select: 2, sort_order: 3 }, [
      { name: "구운 채소", extra_price: 3000 },
      { name: "감자 퓨레", extra_price: 3000 },
    ]);

    // 붉은 커튼 토마토 파스타 — 면 선택(필수), 매운맛, 치즈 추가
    await addGroup("붉은 커튼 토마토 파스타", { name: "면 선택", is_required: true, min_select: 1, max_select: 1, sort_order: 1 }, [
      { name: "스파게티", extra_price: 0, is_default: true },
      { name: "펜네", extra_price: 0 },
    ]);
    await addGroup("붉은 커튼 토마토 파스타", { name: "매운맛", is_required: false, min_select: 0, max_select: 1, sort_order: 2 }, [
      { name: "순한 맛", extra_price: 0, is_default: true },
      { name: "매운 맛", extra_price: 0 },
    ]);
    await addGroup("붉은 커튼 토마토 파스타", { name: "치즈 추가", is_required: false, min_select: 0, max_select: 1, sort_order: 3 }, [
      { name: "파르미지아노 추가", extra_price: 1500 },
    ]);

    // 심야 로스트 치킨 — 부위 선택, 소스
    await addGroup("심야 로스트 치킨", { name: "부위 선택", is_required: false, min_select: 0, max_select: 1, sort_order: 1 }, [
      { name: "순살", extra_price: 0, is_default: true },
      { name: "다리살", extra_price: 1000 },
    ]);

    // 블러디 오렌지 에이드 — 얼음 양, 당도
    await addGroup("블러디 오렌지 에이드", { name: "얼음 양", is_required: false, min_select: 0, max_select: 1, sort_order: 1 }, [
      { name: "보통", extra_price: 0, is_default: true },
      { name: "적게", extra_price: 0 },
      { name: "많이", extra_price: 0 },
    ]);
    await addGroup("블러디 오렌지 에이드", { name: "당도 조절", is_required: false, min_select: 0, max_select: 1, sort_order: 2 }, [
      { name: "보통", extra_price: 0, is_default: true },
      { name: "덜 달게", extra_price: 0 },
      { name: "더 달게", extra_price: 0 },
    ]);

    // Room 404 트러플 프라이 — 소스 추가
    await addGroup("Room 404 트러플 프라이", { name: "소스 추가", is_required: false, min_select: 0, max_select: 2, sort_order: 1 }, [
      { name: "트러플 마요", extra_price: 1000 },
      { name: "치즈 소스", extra_price: 1000 },
    ]);

    // 체크아웃 티라미수 — 토핑 추가
    await addGroup("체크아웃 티라미수", { name: "토핑 추가", is_required: false, min_select: 0, max_select: 2, sort_order: 1 }, [
      { name: "베리 콤포트", extra_price: 1500 },
      { name: "다크초콜릿 셰이빙", extra_price: 1000 },
    ]);
    console.log("  ✅ 메뉴 옵션 시드 완료");
  }

  // 6) 원재료 ------------------------------------------------------------------
  const ingredientDefs = [
    { name: "소고기 등심", unit: "g", sort_order: 1 },
    { name: "파스타 면", unit: "g", sort_order: 2 },
    { name: "트러플 오일", unit: "ml", sort_order: 3 },
    { name: "블러드 오렌지", unit: "개", sort_order: 4 },
    { name: "마스카포네", unit: "g", sort_order: 5 },
  ];
  const existingIng = await must(
    db.from("ingredients").select("id").eq("store_id", storeId),
    "원재료 조회",
  );
  if (existingIng.length === 0) {
    await must(
      db.from("ingredients").insert(ingredientDefs.map((i) => ({ ...i, store_id: storeId }))).select(),
      "원재료 insert",
    );
    console.log(`  ✅ 원재료 ${ingredientDefs.length}개`);
  } else {
    console.log(`  ✅ 원재료 이미 존재 (${existingIng.length}개) — 건너뜀`);
  }

  // 7) 샘플 주문 (기존 주문이 없을 때만) ---------------------------------------
  const existingOrders = await must(
    db.from("orders").select("id").eq("store_id", storeId).limit(1),
    "주문 조회",
  );
  if (existingOrders.length === 0) {
    const table1 = tables.find((t) => t.table_number === 1);
    const table2 = tables.find((t) => t.table_number === 2);

    // 테이블 1, 2 에 active 세션 생성
    const sessions = await must(
      db.from("table_sessions").insert([
        { store_id: storeId, table_id: table1.id, status: "active" },
        { store_id: storeId, table_id: table2.id, status: "active" },
      ]).select(),
      "샘플 세션 insert",
    );
    const s1 = sessions[0];
    const s2 = sessions[1];

    const makeOrder = async (session, tableId, status, items) => {
      const total = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
      const order = await must(
        db.from("orders").insert({
          store_id: storeId,
          table_id: tableId,
          table_session_id: session.id,
          status,
          total_amount: total,
        }).select().single(),
        "샘플 주문 insert",
      );
      await must(
        db.from("order_items").insert(
          items.map((it) => ({ order_id: order.id, menu_id: it.menu.id, menu_name: it.menu.name, unit_price: it.unit_price, quantity: it.quantity })),
        ),
        "샘플 주문 항목 insert",
      );
      return order;
    };

    await makeOrder(s1, table1.id, "pending", [
      { menu: menuByName["체크인 스테이크"], unit_price: 24000, quantity: 1 },
      { menu: menuByName["Room 404 트러플 프라이"], unit_price: 11000, quantity: 1 },
    ]);
    await makeOrder(s1, table1.id, "preparing", [
      { menu: menuByName["붉은 커튼 토마토 파스타"], unit_price: 16000, quantity: 1 },
    ]);
    await makeOrder(s2, table2.id, "done", [
      { menu: menuByName["블러디 오렌지 에이드"], unit_price: 9000, quantity: 2 },
      { menu: menuByName["월광 치즈케이크"], unit_price: 9000, quantity: 1 },
    ]);
    console.log("  ✅ 샘플 주문 3건 생성 (객실 1, 2)");
  } else {
    console.log("  ✅ 주문 이미 존재 — 샘플 주문 건너뜀");
  }

  console.log("\n🎉 시드 완료!");
  console.log(`   매장코드: ${STORE_CODE}`);
  console.log("   Owner 로그인: owner / (SEED_OWNER_PASSWORD)");
  console.log("   Staff 로그인: staff / (SEED_STAFF_PASSWORD)");
}

main().catch((e) => {
  console.error("❌ 시드 실패:", e.message);
  process.exit(1);
});
