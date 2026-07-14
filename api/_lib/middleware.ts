import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, verifyTableToken, type Role } from "./auth";
import { ApiError, handlePreflight, sendError, setCors } from "./http";
import { supabaseAdmin } from "./supabaseAdmin";

export interface AuthedUser {
  id: string;
  username: string;
  role: Role;
  storeId: string;
  storeCode: string;
  sessionId: string;
}

export interface AuthContext {
  user: AuthedUser;
}

type AuthedHandler = (
  req: VercelRequest,
  res: VercelResponse,
  ctx: AuthContext,
) => void | Promise<void>;

type PublicHandler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

function bearer(req: VercelRequest): string {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header) || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "인증 토큰이 필요합니다.");
  }
  return header.slice("Bearer ".length).trim();
}

async function authenticate(req: VercelRequest): Promise<AuthedUser> {
  const token = bearer(req);
  const payload = verifyAccessToken(token);

  // 단일 기기 세션 + 계정 잠금 검증 (즉시 무효화를 위해 DB 대조)
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("id, username, role, is_locked, current_session_id, store_id, stores(code)")
    .eq("id", payload.sub)
    .maybeSingle();

  if (error) throw new ApiError(500, "INTERNAL", "인증 확인 중 오류가 발생했습니다.");
  if (!data) throw new ApiError(401, "UNAUTHORIZED", "계정을 찾을 수 없습니다.");
  if (data.is_locked) throw new ApiError(423, "LOCKED", "계정이 잠겼습니다. 관리자에게 문의하세요.");
  if (data.current_session_id !== payload.sessionId) {
    throw new ApiError(401, "SESSION_INVALIDATED", "다른 기기에서 로그인되어 로그아웃되었습니다.");
  }

  const store = data.stores as unknown as { code: string } | { code: string }[] | null;
  const storeCode = Array.isArray(store) ? store[0]?.code : store?.code;

  return {
    id: data.id as string,
    username: data.username as string,
    role: data.role as Role,
    storeId: data.store_id as string,
    storeCode: storeCode ?? payload.storeCode,
    sessionId: payload.sessionId,
  };
}

/** 인증 필요 핸들러 래퍼. roles 지정 시 역할 기반 접근 제어(RBAC)를 강제한다. */
export function withAuth(handler: AuthedHandler, opts?: { roles?: Role[] }): PublicHandler {
  return async (req, res) => {
    setCors(req, res);
    if (handlePreflight(req, res)) return;
    try {
      const user = await authenticate(req);
      if (opts?.roles && !opts.roles.includes(user.role)) {
        throw new ApiError(403, "FORBIDDEN", "권한이 없습니다.");
      }
      await handler(req, res, { user });
    } catch (e) {
      sendError(res, e);
    }
  };
}

/** 인증 불필요(공개) 핸들러 래퍼. CORS/프리플라이트/에러 처리만 담당. */
export function publicHandler(handler: PublicHandler): PublicHandler {
  return async (req, res) => {
    setCors(req, res);
    if (handlePreflight(req, res)) return;
    try {
      await handler(req, res);
    } catch (e) {
      sendError(res, e);
    }
  };
}

// ---- 고객(테이블 태블릿) 인증 ----------------------------------------------
export interface TableContext {
  table: {
    tableId: string;
    tableNumber: number;
    storeId: string;
    storeCode: string;
  };
}

type TableHandler = (req: VercelRequest, res: VercelResponse, ctx: TableContext) => void | Promise<void>;

/** 테이블 토큰 인증 래퍼. 태블릿에서 발급받은 table 토큰을 검증한다. */
export function withTable(handler: TableHandler): PublicHandler {
  return async (req, res) => {
    setCors(req, res);
    if (handlePreflight(req, res)) return;
    try {
      const token = bearer(req);
      const payload = verifyTableToken(token);
      // 테이블 존재 확인 (삭제/변경 대비)
      const { data, error } = await supabaseAdmin()
        .from("dining_tables")
        .select("id, table_number, store_id")
        .eq("id", payload.tableId)
        .maybeSingle();
      if (error) throw new ApiError(500, "INTERNAL", "인증 확인 중 오류가 발생했습니다.");
      if (!data) throw new ApiError(401, "UNAUTHORIZED", "테이블 정보를 찾을 수 없습니다. 설정을 확인하세요.");
      await handler(req, res, {
        table: {
          tableId: data.id as string,
          tableNumber: data.table_number as number,
          storeId: data.store_id as string,
          storeCode: payload.storeCode,
        },
      });
    } catch (e) {
      sendError(res, e);
    }
  };
}
