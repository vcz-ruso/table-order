import { dayRangeIso, resolveDate } from "../../_lib/dates";
import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { queryString } from "../../_lib/validation";

// GET /api/sales/summary?date=YYYY-MM-DD — 오늘(기본) 총 매출/주문 건수. (Owner 전용)
export default withAuth(
  async (req, res, { user }) => {
    assertMethod(req, ["GET"]);
    const date = resolveDate(queryString(req.query.date as string | string[] | undefined));
    const { startIso, endIso } = dayRangeIso(date);
    const db = supabaseAdmin();

    // 총 매출 = 완료(done) 주문 합계
    const { data: doneOrders, error: dErr } = await db
      .from("orders")
      .select("total_amount")
      .eq("store_id", user.storeId)
      .eq("status", "done")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (dErr) throw new ApiError(500, "INTERNAL", "매출 조회 실패");
    const totalSales = (doneOrders ?? []).reduce((s, o) => s + (o.total_amount as number), 0);

    // 주문 건수 = 해당일 전체 주문 수
    const { count, error: cErr } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", user.storeId)
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (cErr) throw new ApiError(500, "INTERNAL", "주문 건수 조회 실패");

    sendJson(res, 200, { date, totalSales, orderCount: count ?? 0 });
  },
  { roles: ["owner"] },
);
