import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signTableToken, verifyPassword } from "../_lib/auth";
import { ApiError, assertMethod, sendJson } from "../_lib/http";
import { publicHandler } from "../_lib/middleware";
import { supabaseAdmin } from "../_lib/supabaseAdmin";
import { asObject, requireInt, requireString } from "../_lib/validation";

// POST /api/customer/table-login { storeCode, tableNumber, tablePassword }
// 관리자가 태블릿 초기 설정 시 1회 수행. 성공 시 장기 table 토큰 발급 → 자동 로그인.
export default publicHandler(async (req: VercelRequest, res: VercelResponse) => {
  assertMethod(req, ["POST"]);
  const body = asObject(req.body);
  const storeCode = requireString(body, "storeCode", { min: 1, max: 50 });
  const tableNumber = requireInt(body, "tableNumber", { min: 1, max: 9999 });
  const tablePassword = requireString(body, "tablePassword", { min: 1, max: 200, trim: false });

  const db = supabaseAdmin();
  const { data: store, error: sErr } = await db
    .from("stores")
    .select("id, code, name")
    .eq("code", storeCode)
    .maybeSingle();
  if (sErr) throw new ApiError(500, "INTERNAL", "로그인 처리 중 오류가 발생했습니다.");
  if (!store) throw new ApiError(404, "NOT_FOUND", "존재하지 않는 매장 식별자입니다.");

  const { data: table, error: tErr } = await db
    .from("dining_tables")
    .select("id, table_number, password_hash")
    .eq("store_id", store.id)
    .eq("table_number", tableNumber)
    .maybeSingle();
  if (tErr) throw new ApiError(500, "INTERNAL", "로그인 처리 중 오류가 발생했습니다.");
  if (!table) throw new ApiError(404, "NOT_FOUND", "존재하지 않는 테이블 번호입니다.");

  const ok = await verifyPassword(tablePassword, table.password_hash);
  if (!ok) throw new ApiError(401, "UNAUTHORIZED", "테이블 인증 정보가 올바르지 않습니다.");

  const token = signTableToken({
    tableId: table.id,
    tableNumber: table.table_number,
    storeId: store.id,
    storeCode: store.code,
  });

  sendJson(res, 200, {
    token,
    table: {
      tableId: table.id,
      tableNumber: table.table_number,
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
    },
  });
});
