import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

interface Handlers {
  /** 신규 주문(INSERT) 발생 시 해당 테이블 강조용 */
  onOrderInsert?: (tableId: string) => void;
  /** 주문/세션 변경 시 데이터 재조회 트리거 */
  onChange: () => void;
}

/**
 * 관리자 대시보드 실시간 구독 (Supabase Realtime).
 * - orders / order_items / table_sessions 변경을 구독한다.
 * - 연결 상태를 반환하여 "연결 끊김/재연결 중" 배너에 사용한다.
 * - 소켓은 supabase-js 가 자동 재연결하며, 재연결(SUBSCRIBED) 시 onChange 로 재동기화한다.
 */
export function useOrdersRealtime({ onOrderInsert, onChange }: Handlers): {
  status: RealtimeStatus;
  retryCount: number;
} {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [retryCount, setRetryCount] = useState(0);
  const handlersRef = useRef<Handlers>({ onOrderInsert, onChange });
  handlersRef.current = { onOrderInsert, onChange };
  const wasConnected = useRef(false);

  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const tableId = (payload.new as { table_id?: string }).table_id;
          if (tableId) handlersRef.current.onOrderInsert?.(tableId);
        }
        handlersRef.current.onChange();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        handlersRef.current.onChange();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, () => {
        handlersRef.current.onChange();
      })
      .subscribe((channelStatus) => {
        if (channelStatus === "SUBSCRIBED") {
          setStatus("connected");
          // 재연결된 경우 최신 상태로 재동기화
          if (wasConnected.current) handlersRef.current.onChange();
          wasConnected.current = true;
        } else if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
          setStatus("disconnected");
          setRetryCount((c) => c + 1);
        } else if (channelStatus === "CLOSED") {
          setStatus("connecting");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { status, retryCount };
}
