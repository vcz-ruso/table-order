import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

interface Handlers {
  tableId: string;
  /** 이 테이블 주문 변경(상태 등) 시 재조회 */
  onOrdersChange: () => void;
  /** 현재 테이블 세션이 종료(closed)되었을 때 */
  onSessionClosed: () => void;
}

/**
 * 고객 태블릿 실시간 구독.
 * - orders: 주문 상태 변경 → 주문 내역 갱신.
 * - table_sessions: 관리자의 이용 완료(세션 종료) 감지 → 장바구니/조회 범위 초기화.
 */
export function useCustomerRealtime({ tableId, onOrdersChange, onSessionClosed }: Handlers): void {
  const ref = useRef({ onOrdersChange, onSessionClosed });
  ref.current = { onOrdersChange, onSessionClosed };

  useEffect(() => {
    const channel = supabase
      .channel(`customer-${tableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `table_id=eq.${tableId}` },
        () => ref.current.onOrdersChange(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "table_sessions", filter: `table_id=eq.${tableId}` },
        (payload) => {
          const status = (payload.new as { status?: string }).status;
          if (status === "closed") ref.current.onSessionClosed();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId]);
}
