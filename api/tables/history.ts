import type { VercelRequest } from "@vercel/node";
import { ApiError, assertMethod, sendJson } from "../_lib/http";
import { withAuth } from "../_lib/middleware";
import { mapOrder, type DbOrder } from "../_lib/mappers";
import { supabaseAdmin } from "../_lib/supabaseAdmin";
import { queryString } from "../_lib/validation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateParam(req: VercelRequest, key: string): string | undefined {
  const v = queryString(req.query[key] as string | string[] | undefined);
  if (v && !DATE_RE.test(v)) throw new ApiError(422, "VALIDATION", `${key} 는 YYYY-MM-DD 형식이어야 합니다.`);
  return v;
}

// GET /api/tables/history?tableId&from&to — 종료된 세션의 과거 주문(최근 30일, 시간 역순).
export default withAuth(async (req, res, { user }) => {
  assertMethod(req, ["GET"]);
  const db = supabaseAdmin();

  const tableId = queryString(req.query.tableId as string | string[] | undefined);
  const from = dateParam(req, "from");
  const to = dateParam(req, "to");

  // 기본: 최근 30일
  const now = Date.now();
  const fromISO = from ? new Date(`${from}T00:00:00`).toISOString() : new Date(now - 30 * 864e5).toISOString();
  const toISO = to ? new Date(`${to}T23:59:59.999`).toISOString() : new Date(now).toISOString();

  let sessionQuery = db
    .from("table_sessions")
    .select("id, table_id, closed_at, dining_tables(table_number)")
    .eq("store_id", user.storeId)
    .eq("status", "closed")
    .gte("closed_at", fromISO)
    .lte("closed_at", toISO)
    .order("closed_at", { ascending: false });
  if (tableId) sessionQuery = sessionQuery.eq("table_id", tableId);

  const { data: sessions, error: sErr } = await sessionQuery;
  if (sErr) throw new ApiError(500, "INTERNAL", "과거 세션 조회 실패");
  if (!sessions || sessions.length === 0) {
    sendJson(res, 200, { orders: [] });
    return;
  }

  const sessionMeta = new Map<string, { tableNumber: number; closedAt: string | null }>();
  for (const s of sessions) {
    const dt = s.dining_tables as unknown as { table_number: number } | { table_number: number }[] | null;
    const tableNumber = (Array.isArray(dt) ? dt[0]?.table_number : dt?.table_number) ?? 0;
    sessionMeta.set(s.id as string, { tableNumber, closedAt: s.closed_at as string | null });
  }

  const { data: orderRows, error: oErr } = await db
    .from("orders")
    .select(
      "id, order_number, table_id, table_session_id, status, total_amount, created_at, order_items(id, menu_id, menu_name, unit_price, quantity, options)",
    )
    .in("table_session_id", [...sessionMeta.keys()])
    .order("created_at", { ascending: false });
  if (oErr) throw new ApiError(500, "INTERNAL", "과거 주문 조회 실패");

  const result = (orderRows as unknown as DbOrder[]).map((row) => {
    const meta = sessionMeta.get(row.table_session_id);
    return {
      order: mapOrder(row),
      tableNumber: meta?.tableNumber ?? 0,
      sessionClosedAt: meta?.closedAt ?? null,
    };
  });

  sendJson(res, 200, { orders: result });
});
