import { useMemo, useState } from "react";
import type { CustomerMenu } from "../../lib/types";
import { validateOptionSelection } from "../../lib/calc";
import { formatWon } from "../../lib/format";
import { CSheet } from "./components/CSheet";

interface Props {
  menu: CustomerMenu;
  onClose: () => void;
  onAdd: (selectedItemIds: string[], quantity: number) => void;
}

// 메뉴 상세 + 추가 요청(옵션) 선택 + 수량 + 실시간 금액. 필수 항목 미선택 시 담기 불가.
export function MenuDetailModal({ menu, onClose, onAdd }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const g of menu.options) {
      for (const it of g.items) if (it.isDefault) init.add(it.id);
    }
    return init;
  });
  const [quantity, setQuantity] = useState(1);

  const selectedIds = useMemo(() => [...selected], [selected]);
  const { valid, missingGroups } = validateOptionSelection(menu.options, selectedIds);

  const extra = menu.options
    .flatMap((g) => g.items)
    .filter((it) => selected.has(it.id))
    .reduce((s, it) => s + it.extraPrice, 0);
  const unitPrice = menu.price + extra;

  const toggle = (groupId: string, itemId: string, maxSelect: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        return next;
      }
      const group = menu.options.find((g) => g.id === groupId)!;
      const inGroup = group.items.filter((it) => next.has(it.id));
      if (maxSelect === 1) {
        for (const it of inGroup) next.delete(it.id);
      } else if (maxSelect > 0 && inGroup.length >= maxSelect) {
        return prev;
      }
      next.add(itemId);
      return next;
    });
  };

  return (
    <CSheet title={menu.name} onClose={onClose}>
      <img className="c-detail-img" src={menu.imageUrl} alt="" />
      <p className="c-muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
        {menu.description}
      </p>
      <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: 18, color: "var(--h-gold)", margin: "6px 0 20px" }}>
        {formatWon(menu.price)}
      </div>

      {menu.options.length > 0 && (
        <div className="section-head" style={{ margin: "0 0 14px" }}>
          <span className="st-title" style={{ fontSize: 15 }}>추가 요청</span>
          <span className="st-line" />
        </div>
      )}

      {menu.options.map((group) => (
        <div className="opt-group" key={group.id}>
          <div className="opt-group-title">
            {group.name}
            {group.isRequired && <span className="opt-req">필수</span>}
            {group.maxSelect > 1 && (
              <span className="c-muted" style={{ fontSize: 12 }}>
                최대 {group.maxSelect}가지
              </span>
            )}
          </div>
          <div className="opt-items">
            {group.items.map((it) => (
              <button
                key={it.id}
                className={`opt-chip ${selected.has(it.id) ? "selected" : ""}`}
                onClick={() => toggle(group.id, it.id, group.maxSelect)}
              >
                {it.name}
                {it.extraPrice > 0 && <span className="opt-extra"> +{formatWon(it.extraPrice)}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      {!valid && <div className="c-error">다음 항목을 선택해 주세요 — {missingGroups.join(", ")}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <div className="qty">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="수량 감소">
            −
          </button>
          <span className="val">{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)} aria-label="수량 증가">
            +
          </button>
        </div>
        <div style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: 18, color: "var(--h-ivory)" }}>
          {formatWon(unitPrice * quantity)}
        </div>
      </div>

      <button
        className="cbtn cbtn-primary cbtn-block"
        style={{ marginTop: 16 }}
        disabled={!valid || menu.isSoldOut}
        onClick={() => onAdd(selectedIds, quantity)}
      >
        {menu.isSoldOut ? "오늘 밤은 준비할 수 없습니다" : "요청 목록에 담기"}
      </button>
    </CSheet>
  );
}
