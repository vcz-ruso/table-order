import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { customerApi, tableStore } from "../lib/api";
import { cartItemKey } from "../lib/calc";
import type { CartItem, CartOption, CustomerMenu, CustomerTable } from "../lib/types";

interface CustomerState {
  table: CustomerTable | null;
  authError: string | null;
  cart: CartItem[];
  sessionNotice: string | null;
  login: (storeCode: string, tableNumber: number, tablePassword: string) => Promise<void>;
  resetSetup: () => void;
  addToCart: (menu: CustomerMenu, selectedItemIds: string[], quantity: number) => void;
  setItemQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  notifySessionEnded: () => void;
  clearSessionNotice: () => void;
}

const CustomerContext = createContext<CustomerState | null>(null);

function cartKeyFor(table: CustomerTable | null): string | null {
  if (!table) return null;
  return `to_cart_${table.storeCode}_${table.tableNumber}`;
}

function loadCart(table: CustomerTable | null): CartItem[] {
  const key = cartKeyFor(table);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [table, setTable] = useState<CustomerTable | null>(() => tableStore.getTable());
  const [authError, setAuthError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(tableStore.getTable()));
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // 장바구니 로컬 저장 (새로고침 후 복구)
  useEffect(() => {
    const key = cartKeyFor(table);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(cart));
  }, [cart, table]);

  const login = useCallback(async (storeCode: string, tableNumber: number, tablePassword: string) => {
    setAuthError(null);
    const { token, table: t } = await customerApi.tableLogin(storeCode, tableNumber, tablePassword);
    tableStore.set(token, t);
    setTable(t);
    setCart(loadCart(t));
  }, []);

  const resetSetup = useCallback(() => {
    tableStore.clear();
    setTable(null);
    setCart([]);
  }, []);

  const addToCart = useCallback(
    (menu: CustomerMenu, selectedItemIds: string[], quantity: number) => {
      const options: CartOption[] = [];
      for (const group of menu.options) {
        for (const it of group.items) {
          if (selectedItemIds.includes(it.id)) {
            options.push({
              groupId: group.id,
              groupName: group.name,
              itemId: it.id,
              name: it.name,
              extraPrice: it.extraPrice,
            });
          }
        }
      }
      const key = cartItemKey(menu.id, selectedItemIds);
      setCart((prev) => {
        const idx = prev.findIndex((c) => c.key === key);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
          return next;
        }
        return [
          ...prev,
          {
            key,
            menuId: menu.id,
            menuName: menu.name,
            imageUrl: menu.imageUrl,
            basePrice: menu.price,
            quantity,
            options,
          },
        ];
      });
    },
    [],
  );

  const setItemQty = useCallback((key: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, quantity: qty } : c))
        .filter((c) => c.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const notifySessionEnded = useCallback(() => {
    setCart([]);
    setSessionNotice("이용이 종료되었습니다. 새로운 주문을 시작할 수 있습니다.");
  }, []);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  const value = useMemo<CustomerState>(
    () => ({
      table,
      authError,
      cart,
      sessionNotice,
      login,
      resetSetup,
      addToCart,
      setItemQty,
      removeItem,
      clearCart,
      notifySessionEnded,
      clearSessionNotice,
    }),
    [
      table,
      authError,
      cart,
      sessionNotice,
      login,
      resetSetup,
      addToCart,
      setItemQty,
      removeItem,
      clearCart,
      notifySessionEnded,
      clearSessionNotice,
    ],
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerState {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer 는 CustomerProvider 내부에서만 사용할 수 있습니다.");
  return ctx;
}
