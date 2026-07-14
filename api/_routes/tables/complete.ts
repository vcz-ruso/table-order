import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { asObject, requireUuid } from "../../_lib/validation";

// POST /api/tables/complete { tableId } — 매장 이용 완료: active 세션 종료.
// 종료된 세션의 주문은 자동으로 '과거 내역'이 되며, 현재 주문 목록/총액은 0으로 리셋된다
// (다음 주문 시 새 세션 자동 생성).
export default withAuth(async (req, res, { user }) => {
  assertMethod(req, ["POST"]);
  const body = asObject(req.body);
  const tableId = requireUuid(body, "tableId");
  const db = supabaseAdmin();

  // 소유권 확인
  const { data: table, error: tErr } = await db
    .from("dining_tables")
    .select("id, table_number, store_id")
    .eq("id", tableId)
    .maybeSingle();
  if (tErr) throw new ApiError(500, "INTERNAL", "테이블 조회 실패");
  if (!table || table.store_id !== user.storeId) {
    throw new ApiError(404, "NOT_FOUND", "테이블을 찾을 수 없습니다.");
  }

  const { data: session, error: sErr } = await db
    .from("table_sessions")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "active")
    .maybeSingle();
  if (sErr) throw new ApiError(500, "INTERNAL", "세션 조회 실패");
  if (!session) {
    throw new ApiError(409, "CONFLICT", "이미 종료되었거나 진행 중인 세션이 없습니다.");
  }

  // 종료 직전 총 매출 요약(선택 기능)
  const { data: orders } = await db
    .from("orders")
    .select("total_amount")
    .eq("table_session_id", session.id);
  const sessionTotal = (orders ?? []).reduce((s, o) => s + (o.total_amount as number), 0);

  const closedAt = new Date().toISOString();
  const { error: uErr } = await db
    .from("table_sessions")
    .update({ status: "closed", closed_at: closedAt })
    .eq("id", session.id)
    .eq("status", "active"); // 동시성: active 인 경우에만 종료
  if (uErr) throw new ApiError(500, "INTERNAL", "세션 종료 실패");

  sendJson(res, 200, {
    ok: true,
    tableId,
    tableNumber: table.table_number,
    closedSessionId: session.id,
    sessionTotal,
    orderCount: (orders ?? []).length,
    closedAt,
  });
});
