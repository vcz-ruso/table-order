import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";

// GET /api/tables — 테이블 관리 화면용. 각 테이블의 active 세션/주문건수/총액.
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

  const sessionByTable = new Map<string, string>();
  const sessionIds: string[] = [];
  for (const s of sessions ?? []) {
    sessionByTable.set(s.table_id as string, s.id as string);
    sessionIds.push(s.id as string);
  }

  const totals = new Map<string, { count: number; amount: number }>();
  if (sessionIds.length > 0) {
    const { data: orders, error: oErr } = await db
      .from("orders")
      .select("table_session_id, total_amount")
      .in("table_session_id", sessionIds);
    if (oErr) throw new ApiError(500, "INTERNAL", "주문 집계 실패");
    for (const o of orders ?? []) {
      const key = o.table_session_id as string;
      const acc = totals.get(key) ?? { count: 0, amount: 0 };
      acc.count += 1;
      acc.amount += o.total_amount as number;
      totals.set(key, acc);
    }
  }

  const result = (tables ?? []).map((t) => {
    const sessionId = sessionByTable.get(t.id as string) ?? null;
    const agg = sessionId ? totals.get(sessionId) : undefined;
    return {
      id: t.id,
      tableNumber: t.table_number,
      sessionId,
      orderCount: agg?.count ?? 0,
      totalAmount: agg?.amount ?? 0,
    };
  });

  sendJson(res, 200, { tables: result });
});
