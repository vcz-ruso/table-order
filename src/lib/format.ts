// 표시용 포맷 헬퍼
export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** YYYY-MM-DD (KST 기준 오늘) */
export function todayKst(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}
