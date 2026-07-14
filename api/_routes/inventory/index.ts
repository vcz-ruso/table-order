import { resolveDate } from "../../_lib/dates.js";
import { ApiError, assertMethod, sendJson } from "../../_lib/http.js";
import { withAuth } from "../../_lib/middleware.js";
import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import { queryString } from "../../_lib/validation.js";

// GET /api/inventory?date=YYYY-MM-DD — 원재료 목록 + 해당일 재고 기록(잔량/소모량). (Owner 전용)
export default withAuth(
  async (req, res, { user }) => {
    assertMethod(req, ["GET"]);
    const date = resolveDate(queryString(req.query.date as string | string[] | undefined));
    const db = supabaseAdmin();

    const { data: ingredients, error: iErr } = await db
      .from("ingredients")
      .select("id, name, unit, sort_order")
      .eq("store_id", user.storeId)
      .order("sort_order");
    if (iErr) throw new ApiError(500, "INTERNAL", "원재료 조회 실패");

    const { data: records, error: rErr } = await db
      .from("inventory_records")
      .select("ingredient_id, opening_qty, closing_qty, updated_at")
      .eq("store_id", user.storeId)
      .eq("record_date", date);
    if (rErr) throw new ApiError(500, "INTERNAL", "재고 기록 조회 실패");

    const byIngredient = new Map<string, { opening: number | null; closing: number | null; updatedAt: string | null }>();
    for (const r of records ?? []) {
      byIngredient.set(r.ingredient_id as string, {
        opening: (r.opening_qty as number | null) ?? null,
        closing: (r.closing_qty as number | null) ?? null,
        updatedAt: (r.updated_at as string | null) ?? null,
      });
    }

    const rows = (ingredients ?? []).map((ing) => {
      const rec = byIngredient.get(ing.id as string);
      const opening = rec?.opening ?? null;
      const closing = rec?.closing ?? null;
      const consumption = opening !== null && closing !== null ? opening - closing : null;
      return {
        ingredient: { id: ing.id, name: ing.name, unit: ing.unit, sortOrder: ing.sort_order },
        openingQty: opening,
        closingQty: closing,
        consumption,
        updatedAt: rec?.updatedAt ?? null,
      };
    });

    sendJson(res, 200, { date, rows });
  },
  { roles: ["owner"] },
);
