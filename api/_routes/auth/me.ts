import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withAuth } from "../../_lib/middleware";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";

// 현재 로그인 사용자 정보. 앱 로드 시 세션 유효성 확인 + 사용자 복원에 사용.
export default withAuth(async (req, res, { user }) => {
  assertMethod(req, ["GET"]);
  const { data: store, error } = await supabaseAdmin()
    .from("stores")
    .select("name")
    .eq("id", user.storeId)
    .maybeSingle();
  if (error) throw new ApiError(500, "INTERNAL", "사용자 조회 중 오류가 발생했습니다.");
  sendJson(res, 200, {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId,
      storeCode: user.storeCode,
      storeName: store?.name ?? "",
    },
  });
});
