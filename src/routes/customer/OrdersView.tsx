import type { Order, OrderStatus } from "../../lib/types";
import { formatTime, formatWon } from "../../lib/format";

// 괴담 호텔 세계관 상태 카피
const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "요청 접수",
  preparing: "준비 중",
  done: "전달 완료",
};
const STATUS_SUB: Record<OrderStatus, string> = {
  pending: "요청이 접수되었습니다.",
  preparing: "컨시어지가 메뉴를 준비하고 있습니다.",
  done: "객실로 전달되었습니다.",
};

interface Props {
  orders: Order[];
  loading: boolean;
  error: string | null;
}

export function OrdersView({ orders, loading, error }: Props) {
  return (
    <div>
      <div className="section-head" style={{ marginTop: 12 }}>
        <span className="st-title">요청 현황</span>
        <span className="st-line" />
        <span className="st-note">이번 투숙의 요청 기록</span>
      </div>

      {loading ? (
        <div className="c-loading">기록을 살펴보는 중…</div>
      ) : error ? (
        <div className="c-error">{error}</div>
      ) : orders.length === 0 ? (
        <p className="c-muted" style={{ textAlign: "center", padding: "40px 0" }}>
          아직 접수된 요청이 없습니다.
          <br />
          오늘 밤의 메뉴에서 룸서비스를 요청해 보세요.
        </p>
      ) : (
        orders.map((order) => (
          <div className={`ord-card ${order.status}`} key={order.id}>
            <div className="ord-head">
              <div className="ord-no">
                요청 No. {String(order.orderNumber).padStart(3, "0")}{" "}
                <span className="c-muted" style={{ fontSize: 13 }}>
                  {formatTime(order.createdAt)}
                </span>
              </div>
              <span className={`ord-status ${order.status}`}>{STATUS_BADGE[order.status]}</span>
            </div>
            <ul style={{ margin: "10px 0 6px", paddingLeft: 18 }}>
              {order.items.map((it) => (
                <li key={it.id} style={{ marginBottom: 2 }}>
                  {it.menuName} × {it.quantity}
                  {it.options && it.options.length > 0 && (
                    <span className="c-muted" style={{ fontSize: 13 }}>
                      {" "}
                      ({it.options.map((o) => o.name).join(" · ")})
                    </span>
                  )}
                  <span className="c-muted"> · {formatWon(it.unitPrice * it.quantity)}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <span className="ord-status-sub">{STATUS_SUB[order.status]}</span>
              <span style={{ fontFamily: "var(--serif)", fontWeight: 700, color: "var(--h-gold)" }}>
                {formatWon(order.totalAmount)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
