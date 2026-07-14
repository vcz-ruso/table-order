import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  refreshExpiryDate,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../_lib/auth";
import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { publicHandler } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { asObject, requireString } from "../../_lib/validation";

export default publicHandler(async (req: VercelRequest, res: VercelResponse) => {
  assertMethod(req, ["POST"]);
  const body = asObject(req.body);
  const refreshToken = requireString(body, "refreshToken", { min: 10, max: 4000, trim: true });

  const payload = verifyRefreshToken(refreshToken); // 만료 시 TOKEN_EXPIRED → 프론트 로그아웃
  const db = supabaseAdmin();

  // 세션 + 사용자 조회
  const { data: session, error: sErr } = await db
    .from("admin_sessions")
    .select("id, admin_user_id, refresh_token_hash, refresh_expires_at")
    .eq("id", payload.sessionId)
    .maybeSingle();
  if (sErr) throw new ApiError(500, "INTERNAL", "토큰 갱신 중 오류가 발생했습니다.");

  // 세션이 없으면 다른 기기 로그인 등으로 무효화된 것
  if (!session) {
    throw new ApiError(401, "SESSION_INVALIDATED", "다른 기기에서 로그인되어 로그아웃되었습니다.");
  }
  if (session.refresh_token_hash !== sha256(refreshToken)) {
    throw new ApiError(401, "SESSION_INVALIDATED", "다른 기기에서 로그인되어 로그아웃되었습니다.");
  }
  if (new Date(session.refresh_expires_at).getTime() < Date.now()) {
    throw new ApiError(401, "TOKEN_EXPIRED", "세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const { data: user, error: uErr } = await db
    .from("admin_users")
    .select("id, role, is_locked, current_session_id, store_id, stores(code)")
    .eq("id", payload.sub)
    .maybeSingle();
  if (uErr) throw new ApiError(500, "INTERNAL", "토큰 갱신 중 오류가 발생했습니다.");
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "계정을 찾을 수 없습니다.");
  if (user.is_locked) throw new ApiError(423, "LOCKED", "계정이 잠겼습니다. 관리자에게 문의하세요.");
  if (user.current_session_id !== payload.sessionId) {
    throw new ApiError(401, "SESSION_INVALIDATED", "다른 기기에서 로그인되어 로그아웃되었습니다.");
  }

  const store = user.stores as unknown as { code: string } | { code: string }[] | null;
  const storeCode = (Array.isArray(store) ? store[0]?.code : store?.code) ?? "";

  // 토큰 회전(rotation): 새 refresh/access 발급, 세션 해시 갱신
  const newRefresh = signRefreshToken({ sub: user.id, sessionId: payload.sessionId });
  const newAccess = signAccessToken({
    sub: user.id,
    sessionId: payload.sessionId,
    role: user.role,
    storeId: user.store_id,
    storeCode,
  });
  await db
    .from("admin_sessions")
    .update({
      refresh_token_hash: sha256(newRefresh),
      refresh_expires_at: refreshExpiryDate().toISOString(),
    })
    .eq("id", payload.sessionId);

  sendJson(res, 200, { accessToken: newAccess, refreshToken: newRefresh });
});
