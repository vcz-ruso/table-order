import { useCallback, useEffect, useState } from "react";
import { customerApi, ApiClientError } from "../../lib/api";
import { useCustomer } from "../../customer/CustomerContext";
import { useCustomerRealtime } from "../../customer/useCustomerRealtime";
import { cartCount, cartTotal } from "../../lib/calc";
import { formatWon } from "../../lib/format";
import type { Order } from "../../lib/types";
import { MenuPage } from "./MenuPage";
import { OrdersView } from "./OrdersView";
import { CartDrawer } from "./CartDrawer";

export function CustomerApp() {
  const { table, cart, sessionNotice, clearSessionNotice, notifySessionEnded, resetSetup } = useCustomer();
  const [view, setView] = useState<"menu" | "orders">("menu");
  const [cartOpen, setCartOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [authInvalid, setAuthInvalid] = useState(false);

  const tableId = table!.tableId;

  const loadOrders = useCallback(async () => {
    try {
      const data = await customerApi.getOrders();
      setOrders(data.orders);
      setOrdersError(null);
      setAuthInvalid(false);
    } catch (e) {
      if (e instanceof ApiClientError && (e.code === "UNAUTHORIZED" || e.code === "TOKEN_EXPIRED")) {
        setAuthInvalid(true);
      } else {
        setOrdersError(e instanceof ApiClientError ? e.message : "요청 기록을 불러오지 못했습니다.");
      }
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useCustomerRealtime({
    tableId,
    onOrdersChange: loadOrders,
    onSessionClosed: () => {
      notifySessionEnded();
      loadOrders();
    },
  });

  const count = cartCount(cart);

  if (authInvalid) {
    return (
      <div className="setup-wrap">
        <div className="setup-card">
          <div className="kicker">Nocturne Hotel</div>
          <h1>객실 인증이 필요합니다</h1>
          <p className="sub">
            보관된 객실 인증 정보가 더 이상 유효하지 않습니다.
            <br />
            프런트(관리자)에 문의하시거나 체크인을 다시 진행해 주세요.
          </p>
          <div className="c-error">인증되지 않은 단말에서는 룸서비스를 요청할 수 없습니다.</div>
          <button className="cbtn cbtn-primary cbtn-block" onClick={resetSetup}>
            체크인 다시 진행
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cust-root">
      <header className="cust-header">
        <div className="brand-block">
          <div className="brand-mark">
            <span className="kicker">Nocturne · Room Service</span>
            <span className="name">{table!.storeName}</span>
          </div>
        </div>
        <div className="cust-tabs">
          <button className={`cust-tab ${view === "menu" ? "active" : ""}`} onClick={() => setView("menu")}>
            룸서비스
          </button>
          <button
            className={`cust-tab ${view === "orders" ? "active" : ""}`}
            onClick={() => {
              setView("orders");
              loadOrders();
            }}
          >
            요청 현황
          </button>
        </div>
        <div className="room-plate" aria-label={`${table!.tableNumber}번 객실`}>
          <div className="rp-label">Room</div>
          <div className="rp-num">{String(table!.tableNumber).padStart(3, "0")}</div>
        </div>
      </header>

      {view === "menu" && (
        <section className="hero">
          <div className="hero-kicker">Nocturne Hotel · Late-Night Dining</div>
          <h2 className="hero-title">
            <span className="hero-line">늦은 밤에만 열리는 메뉴가 있습니다.</span>
            <span className="hero-line">오늘 밤의 투숙객 전용 룸서비스를 확인해보세요.</span>
          </h2>
          <div className="hero-rule" />
          <p className="hero-sub">조용한 밤에 어울리는 가장 인상적인 한 끼를 준비했습니다.</p>
        </section>
      )}

      <div className="cust-content">
        {sessionNotice && (
          <div className="cust-notice">
            <span>{sessionNotice}</span>
            <button className="cbtn-ghost" onClick={clearSessionNotice}>
              확인
            </button>
          </div>
        )}

        {view === "menu" ? (
          <MenuPage />
        ) : (
          <OrdersView orders={orders} loading={ordersLoading} error={ordersError} />
        )}
      </div>

      {view === "menu" && count > 0 && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          <span className="cf-count">
            요청 목록 <span className="cf-dot">·</span> {count}건
          </span>
          <span>{formatWon(cartTotal(cart))} · 프런트로 전달</span>
        </button>
      )}

      {cartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onOrdered={() => {
            setView("orders");
            loadOrders();
          }}
        />
      )}
    </div>
  );
}
