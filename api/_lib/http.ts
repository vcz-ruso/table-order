import type { VercelRequest, VercelResponse } from "@vercel/node";

// 표준 에러 코드 (프론트에서 분기 처리)
export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "SESSION_INVALIDATED"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "LOCKED"
  | "LOGIN_FAILED"
  | "CONFLICT"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL";

export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  extra?: Record<string, unknown>;

  constructor(status: number, code: ErrorCode, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function setCors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string) || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function sendError(res: VercelResponse, err: unknown): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
    return;
  }
  // 예상치 못한 오류는 일반화된 메시지로 응답 (내부 정보 노출 금지)
  console.error("[api] unhandled error:", err);
  res.status(500).json({ error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } });
}

/** OPTIONS 프리플라이트를 처리하고 true 를 반환하면 호출부는 즉시 종료해야 한다. */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

/** 허용 메서드가 아니면 ApiError(405) 를 던진다. */
export function assertMethod(req: VercelRequest, allowed: string[]): void {
  if (!allowed.includes(req.method ?? "")) {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", `허용되지 않은 메서드입니다: ${req.method}`);
  }
}
