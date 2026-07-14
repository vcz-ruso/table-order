import { dayRangeIso, resolveDate } from "../../_lib/dates";
import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { queryString } from "../../_lib/validation";

interface ItemRow {
  menu_id: string | null;
  menu_name: string;
  unit_price: number;
  quantity: number;
  menus?: { categories?: { name: string } | { name: string }[] | null } | { categories?: unknown }[] | null;
}

function categoryOf(item: ItemRow): string {
  const menus = Array.isArray(item.menus) ? item.menus[0] : item.menus;
  const cat = (menus as { categories?: { name: string } | { name: string }[] } | undefined)?.categories;
  const name = Array.isArray(cat) ? cat[0]?.name : cat?.name;
  return name ?? "기타";
}

// GET /api/sales/detail?date=YYYY-MM-DD — 메뉴별/카테고리별 판매 + 취소 금액. (Owner 전용)
export default withAuth(
  async (req, res, { user }) => {
    assertMethod(req, ["GET"]);
    const date = resolveDate(queryString(req.query.date as string | string[] | undefined));
    const { startIso, endIso } = dayRangeIso(date);
    const db = supabaseAdmin();

    const { data: orders, error: oErr } = await db
      .from("orders")
      .select(
        "id, total_amount, order_items(menu_id, menu_name, unit_price, quantity, menus(categories(name)))",
      )
      .eq("store_id", user.storeId)
      .eq("status", "done")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (oErr) throw new ApiError(500, "INTERNAL", "매출 상세 조회 실패");

    const totalSales = (orders ?? []).reduce((s, o) => s + (o.total_amount as number), 0);
    const orderCount = (orders ?? []).length;

    // 메뉴별 집계
    const lineMap = new Map<
      string,
      { menuId: string | null; menuName: string; categoryName: string; quantity: number; revenue: number }
    >();
    for (const o of orders ?? []) {
      const items = (o.order_items ?? []) as unknown as ItemRow[];
      for (const it of items) {
        const categoryName = categoryOf(it);
        const key = `${it.menu_id ?? it.menu_name}::${categoryName}`;
        const revenue = it.unit_price * it.quantity;
        const cur = lineMap.get(key);
        if (cur) {
          cur.quantity += it.quantity;
          cur.revenue += revenue;
        } else {
          lineMap.set(key, {
            menuId: it.menu_id,
            menuName: it.menu_name,
            categoryName,
            quantity: it.quantity,
            revenue,
          });
        }
      }
    }
    const menuLines = [...lineMap.values()].sort((a, b) => b.revenue - a.revenue);

    const subMap = new Map<string, { categoryName: string; quantity: number; revenue: number }>();
    for (const l of menuLines) {
      const sub = subMap.get(l.categoryName) ?? { categoryName: l.categoryName, quantity: 0, revenue: 0 };
      sub.quantity += l.quantity;
      sub.revenue += l.revenue;
      subMap.set(l.categoryName, sub);
    }

    // 취소(삭제) 금액
    const { data: logs, error: lErr } = await db
      .from("order_deletion_logs")
      .select("deleted_amount")
      .eq("store_id", user.storeId)
      .gte("deleted_at", startIso)
      .lt("deleted_at", endIso);
    if (lErr) throw new ApiError(500, "INTERNAL", "취소 금액 조회 실패");
    const cancelAmount = (logs ?? []).reduce((s, l) => s + (l.deleted_amount as number), 0);

    sendJson(res, 200, {
      date,
      totalSales,
      cancelAmount,
      netSales: totalSales - cancelAmount,
      orderCount,
      menuLines,
      categorySubtotals: [...subMap.values()],
    });
  },
  { roles: ["owner"] },
);
