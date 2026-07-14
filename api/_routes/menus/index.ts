import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { mapMenu, type DbMenu } from "../../_lib/mappers";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { asObject, isValidImageUrl, requireInt, requireString, requireUuid } from "../../_lib/validation";

const MENU_SELECT =
  "id, category_id, name, price, description, image_url, sort_order, is_hidden, is_sold_out, categories(name)";

// GET  /api/menus — 관리자용 전체 메뉴(비노출 포함) + 카테고리. (Owner 전용)
// POST /api/menus — 메뉴 등록. 모든 필드 필수, 이미지 URL 필수/형식 검증. (Owner 전용)
export default withAuth(
  async (req, res, { user }) => {
    assertMethod(req, ["GET", "POST"]);
    const db = supabaseAdmin();

    if (req.method === "GET") {
      const { data: categories, error: cErr } = await db
        .from("categories")
        .select("id, name, sort_order")
        .eq("store_id", user.storeId)
        .order("sort_order");
      if (cErr) throw new ApiError(500, "INTERNAL", "카테고리 조회 실패");

      const { data: menus, error: mErr } = await db
        .from("menus")
        .select(MENU_SELECT)
        .eq("store_id", user.storeId)
        .order("sort_order");
      if (mErr) throw new ApiError(500, "INTERNAL", "메뉴 조회 실패");

      sendJson(res, 200, {
        categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order })),
        menus: (menus as unknown as DbMenu[]).map(mapMenu),
      });
      return;
    }

    // POST — 등록
    const body = asObject(req.body);
    const name = requireString(body, "name", { min: 1, max: 100 });
    const price = requireInt(body, "price", { min: 0 });
    const categoryId = requireUuid(body, "categoryId");
    const description = requireString(body, "description", { min: 1, max: 1000 });
    const imageUrl = requireString(body, "imageUrl", { min: 1, max: 2000 });
    if (!isValidImageUrl(imageUrl)) {
      throw new ApiError(422, "VALIDATION", "유효한 이미지 URL(http/https) 형식이 아닙니다.");
    }

    // 카테고리 소유권 확인
    const { data: cat, error: catErr } = await db
      .from("categories")
      .select("id, store_id")
      .eq("id", categoryId)
      .maybeSingle();
    if (catErr) throw new ApiError(500, "INTERNAL", "카테고리 확인 실패");
    if (!cat || cat.store_id !== user.storeId) {
      throw new ApiError(422, "VALIDATION", "존재하지 않는 카테고리입니다.");
    }

    // 카테고리 내 최대 sort_order + 1
    const { data: last } = await db
      .from("menus")
      .select("sort_order")
      .eq("category_id", categoryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (last?.sort_order ?? 0) + 1;

    const { data: created, error: insErr } = await db
      .from("menus")
      .insert({
        store_id: user.storeId,
        category_id: categoryId,
        name,
        price,
        description,
        image_url: imageUrl,
        sort_order: sortOrder,
      })
      .select(MENU_SELECT)
      .single();
    if (insErr) throw new ApiError(500, "INTERNAL", "메뉴 등록 실패");

    sendJson(res, 201, { menu: mapMenu(created as unknown as DbMenu) });
  },
  { roles: ["owner"] },
);
