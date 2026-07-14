import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import type { Category, Menu } from "../../lib/types";
import { formatWon } from "../../lib/format";
import { Modal } from "./components/Modal";
import { ConfirmDialog } from "./components/ConfirmDialog";

export function MenuManagePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null); // null = 전체
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editing, setEditing] = useState<Menu | "new" | null>(null);
  const [hideTarget, setHideTarget] = useState<Menu | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getMenus();
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

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const shown = (activeCat ? menus.filter((m) => m.categoryId === activeCat) : menus).slice().sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const canReorder = activeCat !== null;

  const toggleSoldOut = async (menu: Menu) => {
    try {
      await api.updateMenu(menu.id, { isSoldOut: !menu.isSoldOut });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "품절 처리 실패");
    }
  };

  const restore = async (menu: Menu) => {
    try {
      await api.updateMenu(menu.id, { isHidden: false });
      await load();
      flash("메뉴를 다시 노출했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "복원 실패");
    }
  };

  // 드래그앤드롭 순서 변경 (같은 카테고리 내)
  const onDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId || !activeCat) return;
    const ids = shown.map((m) => m.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    // 낙관적 반영
    setMenus((prev) => {
      const orderMap = new Map(ids.map((id, i) => [id, i + 1]));
      return prev.map((m) => (orderMap.has(m.id) ? { ...m, sortOrder: orderMap.get(m.id)! } : m));
    });
    setDragId(null);
    try {
      await api.reorderMenus(activeCat, ids);
      flash("순서를 저장했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "순서 저장 실패");
      load();
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="admin-page-title">메뉴 관리</h1>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          + 메뉴 등록
        </button>
      </div>

      {toast && <div className="form-ok">{toast}</div>}
      {error && <div className="form-error">{error}</div>}

      <div className="cat-tab">
        <button className={`chip ${activeCat === null ? "active" : ""}`} onClick={() => setActiveCat(null)}>
          전체
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip ${activeCat === c.id ? "active" : ""}`}
            onClick={() => setActiveCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {canReorder && <p className="muted" style={{ fontSize: 13 }}>≡ 핸들을 드래그하여 노출 순서를 변경할 수 있습니다.</p>}

      {loading ? (
        <div className="admin-loading">불러오는 중…</div>
      ) : (
        <ul className="menu-list">
          {shown.map((menu) => (
            <li
              key={menu.id}
              className={`menu-item ${menu.isHidden ? "hidden-menu" : ""} ${dragId === menu.id ? "dragging" : ""}`}
              draggable={canReorder}
              onDragStart={() => canReorder && setDragId(menu.id)}
              onDragOver={(e) => canReorder && e.preventDefault()}
              onDrop={() => onDrop(menu.id)}
            >
              {canReorder && <span className="grip" title="드래그하여 순서 변경">≡</span>}
              <img className="thumb" src={menu.imageUrl} alt="" />
              <div>
                <div className="mname">
                  {menu.name}
                  {menu.isHidden && <span className="label-tag hidden">비노출</span>}
                  {menu.isSoldOut && <span className="label-tag soldout">품절</span>}
                </div>
                <div className="mmeta">
                  {menu.categoryName} · {formatWon(menu.price)}
                </div>
              </div>
              <div className="spacer" />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn btn-sm" onClick={() => setEditing(menu)}>
                  수정
                </button>
                <button className="btn btn-sm" onClick={() => toggleSoldOut(menu)}>
                  {menu.isSoldOut ? "품절 해제" : "품절"}
                </button>
                {menu.isHidden ? (
                  <button className="btn btn-sm" onClick={() => restore(menu)}>
                    노출 복원
                  </button>
                ) : (
                  <button className="btn btn-sm btn-danger" onClick={() => setHideTarget(menu)}>
                    비노출
                  </button>
                )}
              </div>
            </li>
          ))}
          {shown.length === 0 && <p className="muted">메뉴가 없습니다.</p>}
        </ul>
      )}

      {editing && (
        <MenuFormModal
          menu={editing === "new" ? null : editing}
          categories={categories}
          defaultCategoryId={activeCat}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            await load();
            setEditing(null);
            flash(msg);
          }}
        />
      )}

      {hideTarget && (
        <ConfirmDialog
          title="메뉴 비노출"
          message={`"${hideTarget.name}" 메뉴를 비노출 처리합니다.\n고객 화면에서 숨겨지며, 과거 주문 내역은 유지됩니다.\n계속하시겠습니까?`}
          confirmLabel="비노출"
          danger
          onConfirm={async () => {
            await api.hideMenu(hideTarget.id);
            setHideTarget(null);
            await load();
            flash("메뉴를 비노출 처리했습니다.");
          }}
          onCancel={() => setHideTarget(null)}
        />
      )}
    </div>
  );
}

function MenuFormModal({
  menu,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  menu: Menu | null;
  categories: Category[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(menu?.name ?? "");
  const [price, setPrice] = useState(menu ? String(menu.price) : "");
  const [categoryId, setCategoryId] = useState(menu?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(menu?.description ?? "");
  const [imageUrl, setImageUrl] = useState(menu?.imageUrl ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "메뉴명을 입력하세요.";
    const p = Number(price);
    if (price === "" || Number.isNaN(p) || !Number.isInteger(p) || p < 0) e.price = "0원 이상의 정수를 입력하세요.";
    if (!categoryId) e.categoryId = "카테고리를 선택하세요.";
    if (!description.trim()) e.description = "설명을 입력하세요.";
    if (!imageUrl.trim()) e.imageUrl = "이미지 URL은 필수입니다.";
    else {
      try {
        const u = new URL(imageUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") e.imageUrl = "http/https URL을 입력하세요.";
      } catch {
        e.imageUrl = "유효한 URL 형식이 아닙니다.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        price: Number(price),
        categoryId,
        description: description.trim(),
        imageUrl: imageUrl.trim(),
      };
      if (menu) {
        await api.updateMenu(menu.id, payload);
        onSaved("메뉴를 수정했습니다.");
      } else {
        await api.createMenu(payload);
        onSaved("메뉴를 등록했습니다.");
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "저장에 실패했습니다. 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={menu ? "메뉴 수정" : "메뉴 등록"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </>
      }
    >
      {serverError && <div className="form-error">{serverError}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label>메뉴명</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          {errors.name && <div className="err">{errors.name}</div>}
        </div>
        <div className="field">
          <label>가격 (원)</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
          {errors.price && <div className="err">{errors.price}</div>}
        </div>
        <div className="field">
          <label>카테고리</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">선택</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && <div className="err">{errors.categoryId}</div>}
        </div>
        <div className="field">
          <label>설명</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          {errors.description && <div className="err">{errors.description}</div>}
        </div>
        <div className="field">
          <label>이미지 URL</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          {errors.imageUrl && <div className="err">{errors.imageUrl}</div>}
          {imageUrl && !errors.imageUrl && (
            <img
              className="thumb"
              src={imageUrl}
              alt="미리보기"
              style={{ width: 96, height: 72, marginTop: 8 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </form>
    </Modal>
  );
}
