import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../lib/api";
import { buildTableCards, filterSessionOrders, orderPreview, sortByCreatedDesc } from "../../lib/calc";
import { ORDER_STATUS_LABEL, nextStatus, type Order, type SalesSummary, type TableCard } from "../../lib/types";
import { formatTime, formatWon } from "../../lib/format";
import { useOrdersRealtime, type RealtimeStatus } from "../../lib/useRealtimeOrders";
import { Modal } from "./components/Modal";

export function DashboardPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [tables, setTables] = useState<{ id: string; tableNumber: number }[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessionByTable, setSessionByTable] = useState<Record<string, string | null>>({});
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTableIds, setNewTableIds] = useState<Set<string>>(new Set());
  const [filterTableId, setFilterTableId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setTables(data.tables);
      setOrders(data.orders);
      setSessionByTable(data.activeSessionByTableId);
      setError(null);
      if (isOwner) {
        try {
          setSummary(await api.getSalesSummary());
        } catch {
          /* 요약 실패는 치명적 아님 */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "주문을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  // 실시간 구독 (디바운스 재조회)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(), 400);
  }, [load]);

  const handleInsert = useCallback((tableId: string) => {
    setNewTableIds((prev) => new Set(prev).add(tableId));
    setTimeout(() => {
      setNewTableIds((prev) => {
        const n = new Set(prev);
        n.delete(tableId);
        return n;
      });
    }, 6000);
  }, []);

  const { status, retryCount } = useOrdersRealtime({ onOrderInsert: handleInsert, onChange: scheduleReload });

  const cards = buildTableCards(tables, orders, sessionByTable);
  const visibleCards = filterTableId ? cards.filter((c) => c.table.id === filterTableId) : cards;

  const selectedCard = selectedTableId ? cards.find((c) => c.table.id === selectedTableId) ?? null : null;

  return (
    <div>
      <h1 className="admin-page-title">주문 대시보드</h1>

      <ConnectionBanner status={status} retryCount={retryCount} />

      {isOwner && summary && (
        <div className="summary-bar">
          <div className="summary-card">
            <div className="label">오늘 총 매출액</div>
            <div className="value">{formatWon(summary.totalSales)}</div>
          </div>
          <div className="summary-card">
            <div className="label">오늘 총 주문 건수</div>
            <div className="value">{summary.orderCount}건</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <span className="muted">테이블 필터:</span>
        <button className={`chip ${filterTableId === null ? "active" : ""}`} onClick={() => setFilterTableId(null)}>
          전체
        </button>
        {tables.map((t) => (
          <button
            key={t.id}
            className={`chip ${filterTableId === t.id ? "active" : ""}`}
            onClick={() => setFilterTableId(t.id)}
          >
            {t.tableNumber}번
          </button>
        ))}
        <label style={{ marginLeft: 12, fontSize: 13 }}>
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> 완료 숨기기
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <div className="admin-loading">불러오는 중…</div>
      ) : (
        <div className="table-grid">
          {visibleCards.map((card) => (
            <TableCardView
              key={card.table.id}
              card={card}
              isNew={newTableIds.has(card.table.id)}
              onClick={() => !card.isEmpty && setSelectedTableId(card.table.id)}
            />
          ))}
        </div>
      )}

      {selectedCard && (
        <OrderDetailModal
          card={selectedCard}
          orders={filterSessionOrders(orders, selectedCard.sessionId)}
          hideDone={hideDone}
          onClose={() => setSelectedTableId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function ConnectionBanner({ status, retryCount }: { status: RealtimeStatus; retryCount: number }) {
  if (status === "connected") return null;
  if (status === "connecting") {
    return <div className="conn-banner warn">실시간 연결 중…</div>;
  }
  // disconnected
  if (retryCount >= 3) {
    return (
      <div className="conn-banner error">
        실시간 연결이 반복적으로 끊어졌습니다. 페이지를 새로고침해 주세요.
      </div>
    );
  }
  return <div className="conn-banner warn">실시간 연결이 끊어졌습니다. 재연결 중…</div>;
}

function TableCardView({ card, isNew, onClick }: { card: TableCard; isNew: boolean; onClick: () => void }) {
  const cls = ["table-card"];
  if (card.isEmpty) cls.push("empty");
  if (isNew) cls.push("new-order");
  return (
    <div className={cls.join(" ")} onClick={onClick} role="button" tabIndex={0}>
      <div className="tnum">{card.table.tableNumber}번 테이블</div>
      {card.isEmpty ? (
        <div className="tpreview" style={{ marginTop: 8 }}>
          비어있음
        </div>
      ) : (
        <>
          <div className="ttotal">{formatWon(card.totalAmount)}</div>
          <div className="tpreview">{orderPreview(card.latestOrder)}</div>
          <div className="badge-count" style={{ marginTop: 6 }}>
            주문 {card.orderCount}건
          </div>
        </>
      )}
    </div>
  );
}

function OrderDetailModal({
  card,
  orders,
  hideDone,
  onClose,
  onChanged,
}: {
  card: TableCard;
  orders: Order[];
  hideDone: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sorted = sortByCreatedDesc(orders).filter((o) => (hideDone ? o.status !== "done" : true));

  const advance = async (order: Order) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setBusyId(order.id);
    setError(null);
    try {
      await api.updateOrderStatus(order.id, next);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경 실패");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title={`${card.table.tableNumber}번 테이블 주문 상세`} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}
      <div style={{ marginBottom: 12 }}>
        총 주문액 <strong>{formatWon(card.totalAmount)}</strong> · {card.orderCount}건
      </div>
      {sorted.length === 0 && <p className="muted">표시할 주문이 없습니다.</p>}
      {sorted.map((order) => {
        const next = nextStatus(order.status);
        return (
          <div
            key={order.id}
            className={`order-row ${order.status === "done" ? "done" : ""}`}
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                <strong>주문 #{order.orderNumber}</strong> · {formatTime(order.createdAt)}
              </span>
              <span className={`status-badge ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
            </div>
            <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
              {order.items.map((it) => (
                <li key={it.id}>
                  {it.menuName} × {it.quantity} ({formatWon(it.unitPrice * it.quantity)})
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{formatWon(order.totalAmount)}</strong>
              {next && (
                <button className="btn btn-sm btn-primary" onClick={() => advance(order)} disabled={busyId === order.id}>
                  {busyId === order.id ? "변경 중…" : `${ORDER_STATUS_LABEL[next]}(으)로`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}
