import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "node:crypto";
import { env } from "./env.js";
import { ApiError } from "./http.js";

export type Role = "owner" | "staff";

export const ACCESS_TTL_SECONDS = 60 * 60; // 1시간
export const REFRESH_TTL_SECONDS = 16 * 60 * 60; // 16시간

export interface AccessPayload {
  sub: string; // admin_user_id
  sessionId: string;
  role: Role;
  storeId: string;
  storeCode: string;
  type: "access";
}

export interface RefreshPayload {
  sub: string;
  sessionId: string;
  type: "refresh";
}

export interface TablePayload {
  tableId: string;
  tableNumber: number;
  storeId: string;
  storeCode: string;
  type: "table";
}

// 태블릿은 지속 로그인(재부팅/재실행 후에도 유지)이므로 장기 토큰을 발급한다.
export const TABLE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1년

// ---- 비밀번호 --------------------------------------------------------------
export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// ---- 세션/토큰 -------------------------------------------------------------
export function newSessionId(): string {
  return randomUUID();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function signAccessToken(p: Omit<AccessPayload, "type">): string {
  return jwt.sign({ ...p, type: "access" }, env.jwtSecret, { expiresIn: ACCESS_TTL_SECONDS });
}

export function signRefreshToken(p: Omit<RefreshPayload, "type">): string {
  return jwt.sign({ ...p, type: "refresh" }, env.jwtSecret, { expiresIn: REFRESH_TTL_SECONDS });
}

export function refreshExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
}

function verify<T>(token: string, expectedType: "access" | "refresh" | "table"): T {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "TOKEN_EXPIRED", "토큰이 만료되었습니다.");
    }
    throw new ApiError(401, "UNAUTHORIZED", "유효하지 않은 토큰입니다.");
  }
  if (typeof decoded !== "object" || decoded === null || (decoded as { type?: string }).type !== expectedType) {
    throw new ApiError(401, "UNAUTHORIZED", "토큰 유형이 올바르지 않습니다.");
  }
  return decoded as T;
}

export function verifyAccessToken(token: string): AccessPayload {
  return verify<AccessPayload>(token, "access");
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return verify<RefreshPayload>(token, "refresh");
}

export function signTableToken(p: Omit<TablePayload, "type">): string {
  return jwt.sign({ ...p, type: "table" }, env.jwtSecret, { expiresIn: TABLE_TTL_SECONDS });
}

export function verifyTableToken(token: string): TablePayload {
  return verify<TablePayload>(token, "table");
}
