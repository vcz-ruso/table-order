import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { buildTableCards, filterSessionOrders, sortByCreatedDesc } from "../../lib/calc";
import { ORDER_STATUS_LABEL, type Order, type PastOrderView, type TableCard } from "../../lib/types";
import { formatDateTime, formatTime, formatWon, todayKst } from "../../lib/format";
import { Modal } from "./components/Modal";
import { ConfirmDialog } from "./components/ConfirmDialog";

export function TableManagePage() {
  const [cards, setCards] = useState<TableCard[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [manageTable, setManageTable] = useState<TableCard | null>(null);
  const [completeTarget, setCompleteTarget] = useState<TableCard | null>(null);
  const [historyTable, setHistoryTable] = useState<{ id: string; number: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setCards(buildTableCards(data.tables, data.orders, data.activeSessionByTableId));
      setOrders(data.orders);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "테이블을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div>
      <h1 className="admin-page-title">테이블 관리</h1>
      {toast && <div className="form-ok">{toast}</div>}
      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">불러오는 중…</div>
      ) : (
        <div className="table-grid">
          {cards.map((card) => (
            <div key={card.table.id} className={`table-card ${card.isEmpty ? "empty" : ""}`} style={{ cursor: "default" }}>
              <div className="tnum">{card.table.tableNumber}번 테이블</div>
              <div className="ttotal">{formatWon(card.totalAmount)}</div>
              <div className="badge-count">주문 {card.orderCount}건 · {card.isEmpty ? "빈 테이블" : "이용 중"}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  className="btn btn-sm"
                  disabled={card.isEmpty}
                  onClick={() => setManageTable(card)}
                >
                  주문 관리
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={card.isEmpty}
                  onClick={() => setCompleteTarget(card)}
                >
                  이용 완료
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setHistoryTable({ id: card.table.id, number: card.table.tableNumber })}
                >
                  과거 내역
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {manageTable && (
        <ManageOrdersModal
          card={manageTable}
          orders={filterSessionOrders(orders, manageTable.sessionId)}
          onClose={() => setManageTable(null)}
          onChanged={async () => {
            await load();
            setManageTable(null);
            flash("주문을 삭제했습니다.");
          }}
        />
      )}

      {completeTarget && (
        <ConfirmDialog
          title="매장 이용 완료"
          message={`${completeTarget.table.tableNumber}번 테이블의 현재 세션을 종료합니다.\n주문 내역은 과거 이력으로 이동하고 현재 주문 목록은 초기화됩니다.\n계속하시겠습니까?`}
          confirmLabel="이용 완료"
          onConfirm={async () => {
            const r = await api.completeTable(completeTarget.table.id);
            setCompleteTarget(null);
            await load();
            flash(`${r.tableNumber}번 테이블 이용 완료 — 매출 ${formatWon(r.sessionTotal)} (${r.orderCount}건)`);
          }}
          onCancel={() => setCompleteTarget(null)}
        />
      )}

      {historyTable && (
        <HistoryModal
          tableId={historyTable.id}
          tableNumber={historyTable.number}
          onClose={() => setHistoryTable(null)}
        />
      )}
    </div>
  );
}

function ManageOrdersModal({
  card,
  orders,
  onClose,
  onChanged,
}: {
  card: TableCard;
  orders: Order[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const sorted = sortByCreatedDesc(orders);

  return (
    <Modal title={`${card.table.tableNumber}번 테이블 주문 관리`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        주문 삭제는 직권 수정이며 삭제 로그가 기록됩니다.
      </p>
      {sorted.length === 0 && <p className="muted">주문이 없습니다.</p>}
      {sorted.map((order) => (
        <div
          key={order.id}
          style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              <strong>주문 #{order.orderNumber}</strong> · {formatTime(order.createdAt)}
            </span>
            <span className={`status-badge ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
          </div>
          <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
            {order.items.map((it) => (
              <li key={it.id}>
                {it.menuName} × {it.quantity}
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{formatWon(order.totalAmount)}</strong>
            <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(order)}>
              삭제
            </button>
          </div>
        </div>
      ))}

      {deleteTarget && (
        <ConfirmDialog
          title="주문 삭제"
          message={`주문 #${deleteTarget.orderNumber} (${formatWon(deleteTarget.totalAmount)})을 삭제합니다.\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`}
          confirmLabel="삭제"
          danger
          onConfirm={async () => {
            await api.deleteOrder(deleteTarget.id);
            setDeleteTarget(null);
            onChanged();
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Modal>
  );
}

function HistoryModal({
  tableId,
  tableNumber,
  onClose,
}: {
  tableId: string;
  tableNumber: number;
  onClose: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayKst());
  const [rows, setRows] = useState<PastOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHistory({ tableId, from: from || undefined, to: to || undefined });
      setRows(data.orders);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "과거 내역 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [tableId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Modal title={`${tableNumber}번 테이블 과거 내역`} onClose={onClose}>
      <div className="filter-bar">
        <label>
          시작 <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          종료 <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <span className="muted">최근 30일 기본</span>
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <div className="admin-loading">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <p className="muted">과거 주문 내역이 없습니다.</p>
      ) : (
        rows.map(({ order, sessionClosedAt }) => (
          <div
            key={order.id}
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>주문 #{order.orderNumber}</strong>
              <span className="muted">{formatDateTime(order.createdAt)}</span>
            </div>
            <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
              {order.items.map((it) => (
                <li key={it.id}>
                  {it.menuName} × {it.quantity}
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{formatWon(order.totalAmount)}</strong>
              <span className="muted">이용완료: {sessionClosedAt ? formatDateTime(sessionClosedAt) : "-"}</span>
            </div>
          </div>
        ))
      )}
    </Modal>
  );
}
