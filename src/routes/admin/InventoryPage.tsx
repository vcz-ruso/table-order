import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { InventoryRow } from "../../lib/types";
import { formatDateTime, todayKst } from "../../lib/format";

interface EditRow {
  ingredientId: string;
  name: string;
  unit: string;
  opening: string;
  closing: string;
  consumption: number | null;
  updatedAt: string | null;
}

function toEdit(rows: InventoryRow[]): EditRow[] {
  return rows.map((r) => ({
    ingredientId: r.ingredient.id,
    name: r.ingredient.name,
    unit: r.ingredient.unit,
    opening: r.openingQty !== null ? String(r.openingQty) : "",
    closing: r.closingQty !== null ? String(r.closingQty) : "",
    consumption: r.consumption,
    updatedAt: r.updatedAt,
  }));
}

export function InventoryPage() {
  const [date, setDate] = useState(todayKst());
  const [rows, setRows] = useState<EditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getInventory(date);
      setRows(toEdit(data.rows));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "재고 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (id: string, field: "opening" | "closing", value: string) => {
    setRows((prev) => prev.map((r) => (r.ingredientId === id ? { ...r, [field]: value } : r)));
  };

  const parseQty = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? NaN : n;
  };

  const save = async () => {
    setError(null);
    // 음수/형식 검증
    for (const r of rows) {
      for (const [label, v] of [["영업 전", r.opening], ["마감", r.closing]] as const) {
        const n = parseQty(v);
        if (n !== null && (Number.isNaN(n) || n < 0)) {
          setError(`${r.name}의 ${label} 잔량은 0 이상의 숫자여야 합니다.`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const records = rows.map((r) => ({
        ingredientId: r.ingredientId,
        openingQty: parseQty(r.opening),
        closingQty: parseQty(r.closing),
      }));
      await api.saveInventory(date, records);
      setToast("재고를 저장했습니다.");
      setTimeout(() => setToast(null), 3000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다. 입력값은 유지됩니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="admin-page-title">재고 관리</h1>

      <div className="filter-bar">
        <label>
          날짜 <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayKst()} />
        </label>
        <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
          {saving ? "저장 중…" : "일괄 저장"}
        </button>
      </div>

      {toast && <div className="form-ok">{toast}</div>}
      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <p className="muted">등록된 원재료가 없습니다. (DB에서 직접 추가)</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>원재료</th>
              <th>단위</th>
              <th className="text-right">영업 전 잔량</th>
              <th className="text-right">마감 잔량</th>
              <th className="text-right">소모량</th>
              <th>마지막 입력</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ingredientId}>
                <td>{r.name}</td>
                <td>{r.unit}</td>
                <td className="text-right">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={r.opening}
                    onChange={(e) => setField(r.ingredientId, "opening", e.target.value)}
                    style={{ width: 100, textAlign: "right" }}
                  />
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={r.closing}
                    onChange={(e) => setField(r.ingredientId, "closing", e.target.value)}
                    style={{ width: 100, textAlign: "right" }}
                  />
                </td>
                <td className="text-right">{r.consumption !== null ? `${r.consumption} ${r.unit}` : "-"}</td>
                <td className="muted">{r.updatedAt ? formatDateTime(r.updatedAt) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
