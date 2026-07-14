import { assertMethod, sendJson } from "../_lib/http";
import { withAuth } from "../_lib/middleware";
import { supabaseAdmin } from "../_lib/supabaseAdmin";

// 수동 로그아웃: 현재 세션을 서버에서 무효화한다.
// (Access Token 이 만료된 경우 프론트는 로컬 토큰만 지우고 로그인 화면으로 이동한다.)
export default withAuth(async (req, res, { user }) => {
  assertMethod(req, ["POST"]);
  const db = supabaseAdmin();
  await db.from("admin_sessions").delete().eq("id", user.sessionId);
  await db.from("admin_users").update({ current_session_id: null }).eq("id", user.id);
  sendJson(res, 200, { ok: true });
});
