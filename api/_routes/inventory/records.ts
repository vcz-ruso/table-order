import { resolveDate } from "../../_lib/dates.js";
import { ApiError, assertMethod, sendJson } from "../../_lib/http.js";
import { withAuth } from "../../_lib/middleware.js";
import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import { asObject } from "../../_lib/validation.js";

interface RecordInput {
  ingredientId: string;
  openingQty: number | null;
  closingQty: number | null;
}

function parseRecords(raw: unknown): RecordInput[] {
  if (!Array.isArray(raw)) throw new ApiError(422, "VALIDATION", "records 는 배열이어야 합니다.");
  return raw.map((item, idx) => {
    if (typeof item !== "object" || item === null) {
      throw new ApiError(422, "VALIDATION", `records[${idx}] 형식 오류`);
    }
    const o = item as Record<string, unknown>;
    if (typeof o.ingredientId !== "string") {
      throw new ApiError(422, "VALIDATION", `records[${idx}].ingredientId 필요`);
    }
    const num = (v: unknown, field: string): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v !== "number" || Number.isNaN(v)) {
        throw new ApiError(422, "VALIDATION", `records[${idx}].${field} 는 숫자여야 합니다.`);
      }
      if (v < 0) throw new ApiError(422, "VALIDATION", `수량은 음수일 수 없습니다.`);
      return v;
    };
    return {
      ingredientId: o.ingredientId,
      openingQty: num(o.openingQty, "openingQty"),
      closingQty: num(o.closingQty, "closingQty"),
    };
  });
}

// POST /api/inventory/records { date?, records: [{ingredientId, openingQty, closingQty}] }
// 일괄 저장(upsert). 음수 검증. (Owner 전용)
export default withAuth(
  async (req, res, { user }) => {
    assertMethod(req, ["POST"]);
    const body = asObject(req.body);
    const date = resolveDate(typeof body.date === "string" ? body.date : undefined);
    const records = parseRecords(body.records);
    if (records.length === 0) {
      sendJson(res, 200, { ok: true, saved: 0 });
      return;
    }
    const db = supabaseAdmin();

    // 원재료 소유권 확인
    const { data: ings, error: iErr } = await db
      .from("ingredients")
      .select("id")
      .eq("store_id", user.storeId);
    if (iErr) throw new ApiError(500, "INTERNAL", "원재료 확인 실패");
    const valid = new Set((ings ?? []).map((i) => i.id as string));
    for (const r of records) {
      if (!valid.has(r.ingredientId)) {
        throw new ApiError(422, "VALIDATION", "존재하지 않는 원재료가 포함되어 있습니다.");
      }
    }

    const rows = records.map((r) => ({
      store_id: user.storeId,
      ingredient_id: r.ingredientId,
      record_date: date,
      opening_qty: r.openingQty,
      closing_qty: r.closingQty,
    }));
    const { error } = await db.from("inventory_records").upsert(rows, { onConflict: "ingredient_id,record_date" });
    if (error) throw new ApiError(500, "INTERNAL", "재고 저장 실패");

    sendJson(res, 200, { ok: true, saved: rows.length, date });
  },
  { roles: ["owner"] },
);
