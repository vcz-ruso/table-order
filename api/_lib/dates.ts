import { ApiError } from "./http";

// 매출/재고의 "일자"는 매장 로컬(KST, +09:00) 기준으로 해석한다.
// 서버 타임존(UTC 등)에 무관하게 동작하도록 오프셋을 명시한다.
const KST_OFFSET = "+09:00";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD (KST). 미지정 시 오늘(KST). */
export function resolveDate(input: string | undefined): string {
  if (input) {
    if (!DATE_RE.test(input)) throw new ApiError(422, "VALIDATION", "date 는 YYYY-MM-DD 형식이어야 합니다.");
    return input;
  }
  // 오늘(KST) = UTC + 9h 의 날짜 부분
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  return kstNow.toISOString().slice(0, 10);
}

/** 해당 KST 일자의 [시작, 끝) ISO 범위 반환 */
export function dayRangeIso(date: string): { startIso: string; endIso: string } {
  const startIso = new Date(`${date}T00:00:00.000${KST_OFFSET}`).toISOString();
  // 다음날 0시 미만
  const next = new Date(`${date}T00:00:00.000${KST_OFFSET}`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { startIso, endIso: next.toISOString() };
}
