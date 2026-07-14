import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withTable } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";

// GET /api/customer/session — 현재 테이블의 active 세션 id (없으면 null).
// 세션 종료 감지(장바구니/조회 범위 초기화) 및 자동 로그인 유효성 확인에 사용.
export default withTable(async (req, res, { table }) => {
  assertMethod(req, ["GET"]);
  const { data, error } = await supabaseAdmin()
    .from("table_sessions")
    .select("id, started_at")
    .eq("table_id", table.tableId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new ApiError(500, "INTERNAL", "세션 조회 실패");
  sendJson(res, 200, {
    sessionId: data?.id ?? null,
    startedAt: data?.started_at ?? null,
    table: { tableNumber: table.tableNumber, storeCode: table.storeCode },
  });
});
