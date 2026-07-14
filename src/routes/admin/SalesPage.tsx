import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "../../lib/api";
import type { SalesDetail } from "../../lib/types";
import { formatWon, todayKst } from "../../lib/format";

export function SalesPage() {
  const [date, setDate] = useState(todayKst());
  const [detail, setDetail] = useState<SalesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await api.getSalesDetail(date));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "매출 데이터를 불러오지 못했습니다.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const hasData = detail && detail.orderCount > 0;

  return (
    <div>
      <h1 className="admin-page-title">매출 현황</h1>

      <div className="filter-bar">
        <label>
          날짜 <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayKst()} />
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">불러오는 중…</div>
      ) : !hasData ? (
        <p className="muted">해당 날짜의 매출 데이터가 없습니다.</p>
      ) : (
        <>
          <div className="summary-bar">
            <div className="summary-card">
              <div className="label">총 매출액 (완료 주문)</div>
              <div className="value">{formatWon(detail!.totalSales)}</div>
            </div>
            <div className="summary-card">
              <div className="label">취소 금액</div>
              <div className="value cancel">-{formatWon(detail!.cancelAmount)}</div>
            </div>
            <div className="summary-card">
              <div className="label">순 매출</div>
              <div className="value">{formatWon(detail!.netSales)}</div>
            </div>
            <div className="summary-card">
              <div className="label">완료 주문 건수</div>
              <div className="value">{detail!.orderCount}건</div>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>메뉴</th>
                <th>카테고리</th>
                <th className="text-right">판매 수량</th>
                <th className="text-right">매출액</th>
              </tr>
            </thead>
            <tbody>
              {detail!.categorySubtotals.map((sub) => (
                <SubtotalGroup key={sub.categoryName} detail={detail!} categoryName={sub.categoryName} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function SubtotalGroup({ detail, categoryName }: { detail: SalesDetail; categoryName: string }) {
  const lines = detail.menuLines.filter((l) => l.categoryName === categoryName);
  const sub = detail.categorySubtotals.find((s) => s.categoryName === categoryName)!;
  return (
    <>
      {lines.map((l) => (
        <tr key={`${l.menuId ?? l.menuName}-${l.categoryName}`}>
          <td>{l.menuName}</td>
          <td>{l.categoryName}</td>
          <td className="text-right">{l.quantity}</td>
          <td className="text-right">{formatWon(l.revenue)}</td>
        </tr>
      ))}
      <tr className="subtotal">
        <td colSpan={2}>{categoryName} 소계</td>
        <td className="text-right">{sub.quantity}</td>
        <td className="text-right">{formatWon(sub.revenue)}</td>
      </tr>
    </>
  );
}
