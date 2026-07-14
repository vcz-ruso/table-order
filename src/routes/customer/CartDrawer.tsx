import { useState } from "react";
import { customerApi, ApiClientError } from "../../lib/api";
import { useCustomer } from "../../customer/CustomerContext";
import { cartTotal, cartUnitPrice } from "../../lib/calc";
import { formatWon } from "../../lib/format";
import type { Order } from "../../lib/types";
import { CSheet } from "./components/CSheet";

interface Props {
  onClose: () => void;
  onOrdered: () => void;
}

export function CartDrawer({ onClose, onOrdered }: Props) {
  const { cart, setItemQty, removeItem, clearCart } = useCustomer();
  const [phase, setPhase] = useState<"cart" | "success">("cart");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = cartTotal(cart);

  const placeOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      const lines = cart.map((c) => ({
        menuId: c.menuId,
        quantity: c.quantity,
        optionItemIds: c.options.map((o) => o.itemId),
      }));
      const { order } = await customerApi.createOrder(lines);
      clearCart(); // 접수 성공 시 요청 목록 자동 비우기
      setPlacedOrder(order);
      setPhase("success");
    } catch (e) {
      // 실패 시 요청 목록 유지, 재시도 가능
      setError(e instanceof ApiClientError ? e.message : "프런트 전달에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "success" && placedOrder) {
    return (
      <CSheet title="프런트 전달 완료" onClose={onClose}>
        <div className="order-success">
          <div className="os-kicker">Request Received</div>
          <div className="os-title">요청이 접수되었습니다</div>
          <div className="num">No. {String(placedOrder.orderNumber).padStart(3, "0")}</div>
          <p className="os-sub">컨시어지가 메뉴를 준비하고 있습니다. 조용히 기다려 주세요.</p>
        </div>
        <button
          className="cbtn cbtn-primary cbtn-block"
          onClick={() => {
            onOrdered();
            onClose();
          }}
        >
          요청 현황 보기
        </button>
        <button className="cbtn cbtn-ghost cbtn-block" style={{ marginTop: 8 }} onClick={onClose}>
          메뉴로 돌아가기
        </button>
      </CSheet>
    );
  }

  return (
    <CSheet title="요청 목록" onClose={onClose}>
      {error && <div className="c-error">{error}</div>}
      {cart.length === 0 ? (
        <p className="c-muted" style={{ padding: "24px 0", textAlign: "center" }}>
          아직 담긴 요청이 없습니다.
        </p>
      ) : (
        <>
          {cart.map((item) => (
            <div className="cart-row" key={item.key}>
              <img src={item.imageUrl} alt="" />
              <div style={{ flex: 1 }}>
                <div className="ci-name">{item.menuName}</div>
                {item.options.length > 0 && (
                  <div className="opts">{item.options.map((o) => o.name).join(" · ")}</div>
                )}
                <div className="c-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {formatWon(cartUnitPrice(item.basePrice, item.options))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <div className="qty">
                    <button onClick={() => setItemQty(item.key, item.quantity - 1)} aria-label="감소">
                      −
                    </button>
                    <span className="val">{item.quantity}</span>
                    <button onClick={() => setItemQty(item.key, item.quantity + 1)} aria-label="증가">
                      +
                    </button>
                  </div>
                  <button className="cbtn-ghost" onClick={() => removeItem(item.key)}>
                    빼기
                  </button>
                </div>
              </div>
              <div style={{ fontFamily: "var(--serif)", fontWeight: 700, color: "var(--h-gold)" }}>
                {formatWon(cartUnitPrice(item.basePrice, item.options) * item.quantity)}
              </div>
            </div>
          ))}

          <div className="cart-total-row">
            <span>합계</span>
            <span>{formatWon(total)}</span>
          </div>

          <button className="cbtn cbtn-primary cbtn-block" onClick={placeOrder} disabled={busy}>
            {busy ? "프런트로 전달 중…" : `${formatWon(total)} · 프런트로 전달`}
          </button>
          <button className="cbtn cbtn-ghost cbtn-block" style={{ marginTop: 8 }} onClick={clearCart} disabled={busy}>
            요청 목록 비우기
          </button>
        </>
      )}
    </CSheet>
  );
}
