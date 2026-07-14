import { ApiError, assertMethod, sendJson } from "../../_lib/http.js";
import { withTable } from "../../_lib/middleware.js";
import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";

// GET /api/customer/menus — 노출 메뉴(비노출 제외) + 카테고리 + 옵션.
export default withTable(async (req, res, { table }) => {
  assertMethod(req, ["GET"]);
  const db = supabaseAdmin();

  const { data: categories, error: cErr } = await db
    .from("categories")
    .select("id, name, sort_order")
    .eq("store_id", table.storeId)
    .order("sort_order");
  if (cErr) throw new ApiError(500, "INTERNAL", "카테고리 조회 실패");

  const { data: menus, error: mErr } = await db
    .from("menus")
    .select("id, category_id, name, price, description, image_url, sort_order, is_sold_out, is_recommended, categories(name)")
    .eq("store_id", table.storeId)
    .eq("is_hidden", false)
    .order("sort_order");
  if (mErr) throw new ApiError(500, "INTERNAL", "메뉴 조회 실패");

  const menuIds = (menus ?? []).map((m) => m.id as string);

  // 옵션 그룹 + 항목
  const groupsByMenu = new Map<string, Map<string, OptionGroupAcc>>();
  if (menuIds.length > 0) {
    const { data: groups, error: gErr } = await db
      .from("menu_option_groups")
      .select("id, menu_id, name, is_required, min_select, max_select, sort_order")
      .in("menu_id", menuIds)
      .order("sort_order");
    if (gErr) throw new ApiError(500, "INTERNAL", "옵션 그룹 조회 실패");

    const groupIds = (groups ?? []).map((g) => g.id as string);
    const itemsByGroup = new Map<string, { id: string; name: string; extraPrice: number; isDefault: boolean }[]>();
    if (groupIds.length > 0) {
      const { data: items, error: iErr } = await db
        .from("menu_option_items")
        .select("id, group_id, name, extra_price, is_default, sort_order")
        .in("group_id", groupIds)
        .order("sort_order");
      if (iErr) throw new ApiError(500, "INTERNAL", "옵션 항목 조회 실패");
      for (const it of items ?? []) {
        const arr = itemsByGroup.get(it.group_id as string) ?? [];
        arr.push({
          id: it.id as string,
          name: it.name as string,
          extraPrice: it.extra_price as number,
          isDefault: it.is_default as boolean,
        });
        itemsByGroup.set(it.group_id as string, arr);
      }
    }

    for (const g of groups ?? []) {
      const menuId = g.menu_id as string;
      const gm = groupsByMenu.get(menuId) ?? new Map<string, OptionGroupAcc>();
      gm.set(g.id as string, {
        id: g.id as string,
        name: g.name as string,
        isRequired: g.is_required as boolean,
        minSelect: g.min_select as number,
        maxSelect: g.max_select as number,
        items: itemsByGroup.get(g.id as string) ?? [],
      });
      groupsByMenu.set(menuId, gm);
    }
  }

  const result = (menus ?? []).map((m) => {
    const cat = m.categories as unknown as { name: string } | { name: string }[] | null;
    const categoryName = (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? "";
    const gm = groupsByMenu.get(m.id as string);
    return {
      id: m.id,
      categoryId: m.category_id,
      categoryName,
      name: m.name,
      price: m.price,
      description: m.description,
      imageUrl: m.image_url,
      isSoldOut: m.is_sold_out,
      isRecommended: m.is_recommended,
      options: gm ? [...gm.values()] : [],
    };
  });

  sendJson(res, 200, {
    categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order })),
    menus: result,
  });
});

interface OptionGroupAcc {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  items: { id: string; name: string; extraPrice: number; isDefault: boolean }[];
}
