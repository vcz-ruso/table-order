import { ApiError, assertMethod, sendJson } from "../../_lib/http.js";
import { withAuth } from "../../_lib/middleware.js";
import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import { asObject, requireUuid } from "../../_lib/validation.js";

// POST /api/menus/reorder { categoryId, orderedIds: string[] }
// 같은 카테고리 내 메뉴 노출 순서를 orderedIds 배열 순서대로 저장. (Owner 전용)
export default withAuth(
  async (req, res, { user }) => {
    assertMethod(req, ["POST"]);
    const body = asObject(req.body);
    const categoryId = requireUuid(body, "categoryId");
    const orderedIds = body.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.some((v) => typeof v !== "string")) {
      throw new ApiError(422, "VALIDATION", "orderedIds 는 문자열 배열이어야 합니다.");
    }
    const db = supabaseAdmin();

    // 대상 메뉴들이 모두 이 매장·카테고리 소속인지 확인
    const { data: menus, error: mErr } = await db
      .from("menus")
      .select("id")
      .eq("store_id", user.storeId)
      .eq("category_id", categoryId);
    if (mErr) throw new ApiError(500, "INTERNAL", "메뉴 조회 실패");
    const validIds = new Set((menus ?? []).map((m) => m.id as string));
    for (const id of orderedIds as string[]) {
      if (!validIds.has(id)) {
        throw new ApiError(422, "VALIDATION", "해당 카테고리에 속하지 않는 메뉴가 포함되어 있습니다.");
      }
    }

    // 순서대로 sort_order 갱신 (1부터)
    for (let i = 0; i < (orderedIds as string[]).length; i++) {
      const { error } = await db
        .from("menus")
        .update({ sort_order: i + 1 })
        .eq("id", (orderedIds as string[])[i]);
      if (error) throw new ApiError(500, "INTERNAL", "순서 저장 실패");
    }

    sendJson(res, 200, { ok: true });
  },
  { roles: ["owner"] },
);
