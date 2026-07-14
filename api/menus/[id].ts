import type { VercelRequest } from "@vercel/node";
import { ApiError, assertMethod, sendJson } from "../_lib/http";
import { withAuth } from "../_lib/middleware";
import { mapMenu, type DbMenu } from "../_lib/mappers";
import { supabaseAdmin } from "../_lib/supabaseAdmin";
import {
  asObject,
  isValidImageUrl,
  requireInt,
  requireString,
  requireUuid,
} from "../_lib/validation";

const MENU_SELECT =
  "id, category_id, name, price, description, image_url, sort_order, is_hidden, is_sold_out, categories(name)";

function menuId(req: VercelRequest): string {
  const id = req.query.id;
  const v = Array.isArray(id) ? id[0] : id;
  if (!v) throw new ApiError(400, "BAD_REQUEST", "메뉴 id 가 필요합니다.");
  return v;
}

// PATCH  /api/menus/:id — 수정 / 비노출·노출 복원 / 품절 토글 (부분 업데이트)
// DELETE /api/menus/:id — 삭제(비노출 처리, soft delete)
// 모두 Owner 전용.
export default withAuth(
  async (req, res, { user }) => {
    assertMethod(req, ["PATCH", "DELETE"]);
    const db = supabaseAdmin();
    const id = menuId(req);

    // 소유권 확인
    const { data: existing, error: eErr } = await db
      .from("menus")
      .select("id, store_id")
      .eq("id", id)
      .maybeSingle();
    if (eErr) throw new ApiError(500, "INTERNAL", "메뉴 조회 실패");
    if (!existing || existing.store_id !== user.storeId) {
      throw new ApiError(404, "NOT_FOUND", "메뉴를 찾을 수 없습니다.");
    }

    if (req.method === "DELETE") {
      const { error } = await db.from("menus").update({ is_hidden: true }).eq("id", id);
      if (error) throw new ApiError(500, "INTERNAL", "메뉴 비노출 처리 실패");
      sendJson(res, 200, { ok: true, id, isHidden: true });
      return;
    }

    // PATCH — 부분 업데이트
    const body = asObject(req.body);
    const patch: Record<string, unknown> = {};

    if ("name" in body) patch.name = requireString(body, "name", { min: 1, max: 100 });
    if ("price" in body) patch.price = requireInt(body, "price", { min: 0 });
    if ("description" in body) patch.description = requireString(body, "description", { min: 1, max: 1000 });
    if ("imageUrl" in body) {
      const imageUrl = requireString(body, "imageUrl", { min: 1, max: 2000 });
      if (!isValidImageUrl(imageUrl)) {
        throw new ApiError(422, "VALIDATION", "유효한 이미지 URL(http/https) 형식이 아닙니다.");
      }
      patch.image_url = imageUrl;
    }
    if ("categoryId" in body) {
      const categoryId = requireUuid(body, "categoryId");
      const { data: cat } = await db
        .from("categories")
        .select("id, store_id")
        .eq("id", categoryId)
        .maybeSingle();
      if (!cat || cat.store_id !== user.storeId) {
        throw new ApiError(422, "VALIDATION", "존재하지 않는 카테고리입니다.");
      }
      patch.category_id = categoryId;
    }
    if ("isHidden" in body) {
      if (typeof body.isHidden !== "boolean") throw new ApiError(422, "VALIDATION", "isHidden 는 boolean 이어야 합니다.");
      patch.is_hidden = body.isHidden;
    }
    if ("isSoldOut" in body) {
      if (typeof body.isSoldOut !== "boolean") throw new ApiError(422, "VALIDATION", "isSoldOut 는 boolean 이어야 합니다.");
      patch.is_sold_out = body.isSoldOut;
    }

    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, "BAD_REQUEST", "수정할 항목이 없습니다.");
    }

    const { data: updated, error: uErr } = await db
      .from("menus")
      .update(patch)
      .eq("id", id)
      .select(MENU_SELECT)
      .single();
    if (uErr) throw new ApiError(500, "INTERNAL", "메뉴 수정 실패");

    sendJson(res, 200, { menu: mapMenu(updated as unknown as DbMenu) });
  },
  { roles: ["owner"] },
);
