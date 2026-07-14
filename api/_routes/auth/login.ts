import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  newSessionId,
  refreshExpiryDate,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
} from "../../_lib/auth";
import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { publicHandler } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { asObject, isValidPassword, requireString } from "../../_lib/validation";

const MAX_ATTEMPTS = 3;

export default publicHandler(async (req: VercelRequest, res: VercelResponse) => {
  assertMethod(req, ["POST"]);
  const body = asObject(req.body);
  const storeCode = requireString(body, "storeCode", { min: 1, max: 50 });
  const username = requireString(body, "username", { min: 1, max: 50 });
  const password = requireString(body, "password", { min: 1, max: 200, trim: false });

  const db = supabaseAdmin();

  // 1) 매장 확인
  const { data: store, error: storeErr } = await db
    .from("stores")
    .select("id, code, name")
    .eq("code", storeCode)
    .maybeSingle();
  if (storeErr) throw new ApiError(500, "INTERNAL", "로그인 처리 중 오류가 발생했습니다.");
  if (!store) throw new ApiError(404, "NOT_FOUND", "존재하지 않는 매장 식별자입니다.");

  // 2) 계정 확인
  const { data: user, error: userErr } = await db
    .from("admin_users")
    .select("id, username, password_hash, role, failed_attempts, is_locked")
    .eq("store_id", store.id)
    .eq("username", username)
    .maybeSingle();
  if (userErr) throw new ApiError(500, "INTERNAL", "로그인 처리 중 오류가 발생했습니다.");
  if (!user) {
    throw new ApiError(401, "LOGIN_FAILED", "사용자명 또는 비밀번호가 올바르지 않습니다.");
  }

  // 3) 잠금 확인
  if (user.is_locked) {
    throw new ApiError(423, "LOCKED", "계정이 잠겼습니다. 관리자에게 문의하세요.");
  }

  // 4) 비밀번호 검증
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const attempts = (user.failed_attempts ?? 0) + 1;
    const willLock = attempts >= MAX_ATTEMPTS;
    await db
      .from("admin_users")
      .update({ failed_attempts: attempts, is_locked: willLock })
      .eq("id", user.id);
    if (willLock) {
      throw new ApiError(423, "LOCKED", "계정이 잠겼습니다. 관리자에게 문의하세요.");
    }
    throw new ApiError(
      401,
      "LOGIN_FAILED",
      `로그인 실패. ${attempts}/${MAX_ATTEMPTS}회 시도. ${MAX_ATTEMPTS}회 실패 시 계정이 잠깁니다.`,
      { attempts, maxAttempts: MAX_ATTEMPTS },
    );
  }

  // 참고: 비밀번호 정책은 시드/변경 시점에 강제. 로그인 시엔 형식만 경고 로깅.
  if (!isValidPassword(password)) {
    // 정책 미준수 비밀번호로 저장된 계정 — 로그인은 허용하되 서버 로그로 남긴다.
    console.warn("[auth] 비밀번호 정책 미준수 계정 로그인:", user.id);
  }

  // 5) 로그인 성공 — 새 세션 생성(이전 기기 세션 무효화)
  const sessionId = newSessionId();
  const refreshToken = signRefreshToken({ sub: user.id, sessionId });
  const accessToken = signAccessToken({
    sub: user.id,
    sessionId,
    role: user.role,
    storeId: store.id,
    storeCode: store.code,
  });

  // 이전 세션 제거 → 단일 기기 강제
  await db.from("admin_sessions").delete().eq("admin_user_id", user.id);
  const { error: sessErr } = await db.from("admin_sessions").insert({
    id: sessionId,
    admin_user_id: user.id,
    refresh_token_hash: sha256(refreshToken),
    user_agent: (req.headers["user-agent"] as string) ?? null,
    refresh_expires_at: refreshExpiryDate().toISOString(),
  });
  if (sessErr) throw new ApiError(500, "INTERNAL", "세션 생성에 실패했습니다.");

  await db
    .from("admin_users")
    .update({ failed_attempts: 0, is_locked: false, current_session_id: sessionId })
    .eq("id", user.id);

  sendJson(res, 200, {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
    },
  });
});
