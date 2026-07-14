import type { VercelRequest } from "@vercel/node";
import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { mapOrder, type DbOrder } from "../../_lib/mappers";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { asObject, queryString, requireEnum } from "../../_lib/validation";

type Status = "pending" | "preparing" | "done";
const FORWARD: Record<Status, Status | null> = { pending: "preparing", preparing: "done", done: null };

function orderId(req: VercelRequest): string {
  const id = queryString(req.query.id as string | string[] | undefined);
  if (!id) throw new ApiError(400, "BAD_REQUEST", "주문 id 가 필요합니다.");
  return id;
}

// PATCH /api/orders/:id  { status }  → 상태 전이(대기중→준비중→완료, 역방향 불가)
// DELETE /api/orders/:id             → 직권 삭제 + 로그 기록 (Owner/Staff 모두 가능)
export default withAuth(async (req, res, { user }) => {
  assertMethod(req, ["PATCH", "DELETE"]);
  const db = supabaseAdmin();
  const id = orderId(req);

  // 대상 주문 로드 (매장 소유권 확인 포함)
  const { data: current, error: cErr } = await db
    .from("orders")
    .select(
      "id, order_number, table_id, table_session_id, status, total_amount, created_at, store_id, order_items(id, menu_id, menu_name, unit_price, quantity, options)",
    )
    .eq("id", id)
    .maybeSingle();
  if (cErr) throw new ApiError(500, "INTERNAL", "주문 조회 실패");
  if (!current || current.store_id !== user.storeId) {
    throw new ApiError(404, "NOT_FOUND", "주문을 찾을 수 없습니다.");
  }

  if (req.method === "PATCH") {
    const body = asObject(req.body);
    const target = requireEnum<Status>(body, "status", ["pending", "preparing", "done"]);
    const allowed = FORWARD[current.status as Status];
    if (target !== allowed) {
      throw new ApiError(409, "CONFLICT", "주문 상태는 대기중 → 준비중 → 완료 순서로만 변경할 수 있습니다.");
    }
    const { data: updated, error: uErr } = await db
      .from("orders")
      .update({ status: target })
      .eq("id", id)
      .select(
        "id, order_number, table_id, table_session_id, status, total_amount, created_at, order_items(id, menu_id, menu_name, unit_price, quantity, options)",
      )
      .single();
    if (uErr) throw new ApiError(500, "INTERNAL", "상태 변경 실패");
    sendJson(res, 200, { order: mapOrder(updated as unknown as DbOrder) });
    return;
  }

  // DELETE — 삭제 로그 기록 후 삭제, 테이블 총액 재계산 결과 반환
  const snapshot = mapOrder(current as unknown as DbOrder);
  const { error: logErr } = await db.from("order_deletion_logs").insert({
    store_id: user.storeId,
    order_id: current.id,
    order_number: current.order_number,
    admin_user_id: user.id,
    admin_username: user.username,
    deleted_amount: current.total_amount,
    order_snapshot: snapshot,
  });
  if (logErr) throw new ApiError(500, "INTERNAL", "삭제 로그 기록 실패");

  const { error: delErr } = await db.from("orders").delete().eq("id", id);
  if (delErr) throw new ApiError(500, "INTERNAL", "주문 삭제 실패");

  // 동일 세션의 남은 주문 총액 재계산
  const { data: remaining, error: rErr } = await db
    .from("orders")
    .select("total_amount")
    .eq("table_session_id", current.table_session_id);
  if (rErr) throw new ApiError(500, "INTERNAL", "총액 재계산 실패");
  const newTableTotal = (remaining ?? []).reduce((s, o) => s + (o.total_amount as number), 0);

  sendJson(res, 200, { deletedOrderId: id, tableId: current.table_id, newTableTotal });
});
