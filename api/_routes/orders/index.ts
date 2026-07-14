import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { mapOrder, type DbOrder } from "../../_lib/mappers";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";

// GET /api/orders — 대시보드용 현재(active 세션) 주문 목록 + 테이블/세션 정보.
// Owner/Staff 모두 접근 가능.
export default withAuth(async (req, res, { user }) => {
  assertMethod(req, ["GET"]);
  const db = supabaseAdmin();

  const { data: tables, error: tErr } = await db
    .from("dining_tables")
    .select("id, table_number")
    .eq("store_id", user.storeId)
    .order("table_number");
  if (tErr) throw new ApiError(500, "INTERNAL", "테이블 조회 실패");

  const { data: sessions, error: sErr } = await db
    .from("table_sessions")
    .select("id, table_id")
    .eq("store_id", user.storeId)
    .eq("status", "active");
  if (sErr) throw new ApiError(500, "INTERNAL", "세션 조회 실패");

  const activeSessionByTableId: Record<string, string | null> = {};
  for (const t of tables ?? []) activeSessionByTableId[t.id as string] = null;
  const sessionIds: string[] = [];
  for (const s of sessions ?? []) {
    activeSessionByTableId[s.table_id as string] = s.id as string;
    sessionIds.push(s.id as string);
  }

  let orders: ReturnType<typeof mapOrder>[] = [];
  if (sessionIds.length > 0) {
    const { data: orderRows, error: oErr } = await db
      .from("orders")
      .select(
        "id, order_number, table_id, table_session_id, status, total_amount, created_at, order_items(id, menu_id, menu_name, unit_price, quantity, options)",
      )
      .in("table_session_id", sessionIds)
      .order("created_at", { ascending: false });
    if (oErr) throw new ApiError(500, "INTERNAL", "주문 조회 실패");
    orders = (orderRows as unknown as DbOrder[]).map(mapOrder);
  }

  sendJson(res, 200, {
    tables: (tables ?? []).map((t) => ({ id: t.id, tableNumber: t.table_number })),
    activeSessionByTableId,
    orders,
  });
});
