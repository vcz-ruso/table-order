import { useCallback, useEffect, useMemo, useState } from "react";
import { customerApi } from "../../lib/api";
import { useCustomer } from "../../customer/CustomerContext";
import type { Category, CustomerMenu } from "../../lib/types";
import { formatWon } from "../../lib/format";
import { MenuDetailModal } from "./MenuDetailModal";

export function MenuPage() {
  const { addToCart } = useCustomer();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<CustomerMenu[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerMenu | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await customerApi.getMenus();
      setCategories(data.categories);
      setMenus(data.menus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "메뉴를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 컨시어지 추천: '컨시어지 추천' 카테고리가 있으면 그 메뉴, 없으면 판매 중 메뉴 일부
  const featured = useMemo(() => {
    const cat = categories.find((c) => c.name.includes("컨시어지"));
    const pool = cat ? menus.filter((m) => m.categoryId === cat.id) : menus.filter((m) => !m.isSoldOut);
    return pool.slice(0, 6);
  }, [categories, menus]);

  const shownCats = activeCat ? categories.filter((c) => c.id === activeCat) : categories;

  const handleAdd = (menu: CustomerMenu, ids: string[], qty: number) => {
    addToCart(menu, ids, qty);
    setDetail(null);
    setToast(`‘${menu.name}’ ${qty}건을 요청 목록에 담았습니다.`);
    setTimeout(() => setToast(null), 2200);
  };

  if (loading) return <div className="c-loading">오늘 밤의 기록을 여는 중…</div>;
  if (error) return <div className="c-error">{error}</div>;

  return (
    <div>
      {toast && <div className="c-ok">{toast}</div>}

      <div className="cust-cats">
        <button className={`cust-cat ${activeCat === null ? "active" : ""}`} onClick={() => setActiveCat(null)}>
          전체 기록
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`cust-cat ${activeCat === c.id ? "active" : ""}`}
            onClick={() => setActiveCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* 컨시어지 추천 (전체 보기에서만) */}
      {activeCat === null && featured.length > 0 && (
        <section>
          <div className="section-head">
            <span className="st-title">오늘의 기록</span>
            <span className="st-line" />
            <span className="st-note">오늘 밤 자주 기록된 메뉴입니다</span>
          </div>
          <div className="concierge">
            {featured.map((menu) => (
              <div
                key={menu.id}
                className="concierge-card"
                onClick={() => !menu.isSoldOut && setDetail(menu)}
                role="button"
                tabIndex={0}
              >
                <img className="cc-img" src={menu.imageUrl} alt="" />
                {menu.isSoldOut && <div className="soldout-veil">오늘 밤은 더 이상 준비할 수 없습니다</div>}
                <div className="cc-body">
                  <div className="cc-name">{menu.name}</div>
                  <div className="cc-price">{formatWon(menu.price)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {shownCats.map((cat) => {
        const list = menus.filter((m) => m.categoryId === cat.id);
        if (list.length === 0) return null;
        return (
          <section key={cat.id}>
            <div className="section-head">
              <span className="st-title">{cat.name}</span>
              <span className="st-line" />
            </div>
            <div className="cust-menu-grid">
              {list.map((menu) => (
                <MenuCard key={menu.id} menu={menu} onOpen={() => setDetail(menu)} />
              ))}
            </div>
          </section>
        );
      })}

      {detail && (
        <MenuDetailModal menu={detail} onClose={() => setDetail(null)} onAdd={(ids, qty) => handleAdd(detail, ids, qty)} />
      )}
    </div>
  );
}

function MenuCard({ menu, onOpen }: { menu: CustomerMenu; onOpen: () => void }) {
  const hasOptions = menu.options.length > 0;
  return (
    <div
      className={`cust-menu-card ${menu.isSoldOut ? "soldout" : ""}`}
      onClick={() => !menu.isSoldOut && onOpen()}
      role="button"
      tabIndex={0}
    >
      <div className="cust-menu-imgwrap">
        <img className="cust-menu-img" src={menu.imageUrl} alt="" />
        {menu.isSoldOut && <div className="soldout-veil">오늘 밤은 더 이상 준비할 수 없습니다</div>}
      </div>
      <div className="cust-menu-info">
        <div className="cust-menu-name">{menu.name}</div>
        <div className="cust-menu-desc">{menu.description}</div>
        <div className="cust-menu-price">{formatWon(menu.price)}</div>
        {hasOptions && !menu.isSoldOut && (
          <div className="tag-line">
            <span className="mini-tag">추가 요청 가능</span>
          </div>
        )}
      </div>
    </div>
  );
}
