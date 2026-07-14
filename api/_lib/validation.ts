import { ApiError } from "./http.js";

// 파라미터 타입/길이/형식 검증 (SECURITY-05). 실패 시 ApiError(422) throw.

export function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "BAD_REQUEST", "요청 본문(JSON 객체)이 필요합니다.");
  }
  return body as Record<string, unknown>;
}

export function requireString(
  obj: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number; trim?: boolean } = {},
): string {
  const raw = obj[key];
  if (typeof raw !== "string") {
    throw new ApiError(422, "VALIDATION", `${key} 는 문자열이어야 합니다.`);
  }
  const v = opts.trim === false ? raw : raw.trim();
  const min = opts.min ?? 1;
  const max = opts.max ?? 1000;
  if (v.length < min) throw new ApiError(422, "VALIDATION", `${key} 는 최소 ${min}자 이상이어야 합니다.`);
  if (v.length > max) throw new ApiError(422, "VALIDATION", `${key} 는 최대 ${max}자까지 가능합니다.`);
  return v;
}

export function optionalString(
  obj: Record<string, unknown>,
  key: string,
  opts: { max?: number } = {},
): string | undefined {
  if (obj[key] === undefined || obj[key] === null) return undefined;
  return requireString(obj, key, { min: 0, max: opts.max ?? 1000 });
}

export function requireInt(
  obj: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number } = {},
): number {
  const raw = obj[key];
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new ApiError(422, "VALIDATION", `${key} 는 정수여야 합니다.`);
  }
  if (opts.min !== undefined && raw < opts.min) {
    throw new ApiError(422, "VALIDATION", `${key} 는 ${opts.min} 이상이어야 합니다.`);
  }
  if (opts.max !== undefined && raw > opts.max) {
    throw new ApiError(422, "VALIDATION", `${key} 는 ${opts.max} 이하여야 합니다.`);
  }
  return raw;
}

export function optionalNumber(
  obj: Record<string, unknown>,
  key: string,
  opts: { min?: number } = {},
): number | null {
  const raw = obj[key];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    throw new ApiError(422, "VALIDATION", `${key} 는 숫자여야 합니다.`);
  }
  if (opts.min !== undefined && raw < opts.min) {
    throw new ApiError(422, "VALIDATION", `${key} 는 ${opts.min} 이상이어야 합니다.`);
  }
  return raw;
}

export function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
  const raw = obj[key];
  if (typeof raw !== "boolean") {
    throw new ApiError(422, "VALIDATION", `${key} 는 boolean 이어야 합니다.`);
  }
  return raw;
}

export function requireEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const raw = obj[key];
  if (typeof raw !== "string" || !allowed.includes(raw as T)) {
    throw new ApiError(422, "VALIDATION", `${key} 는 [${allowed.join(", ")}] 중 하나여야 합니다.`);
  }
  return raw as T;
}

export function requireUuid(obj: Record<string, unknown>, key: string): string {
  const v = requireString(obj, key, { min: 1, max: 100 });
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!re.test(v)) throw new ApiError(422, "VALIDATION", `${key} 는 UUID 형식이어야 합니다.`);
  return v;
}

/** 비밀번호 정책: 최소 8자, 영문+숫자 조합 */
export function isValidPassword(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

/** 이미지 URL 형식 검증 (http/https 절대 URL) */
export function isValidImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** 쿼리스트링 단일 문자열 추출 */
export function queryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
