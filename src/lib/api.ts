// 프론트엔드 API 클라이언트.
// - 토큰은 localStorage 에 저장(요구사항).
// - Access Token 만료 시 Refresh Token 으로 1회 자동 갱신 후 재시도(사용자 비노출).
// - 세션 무효화(다른 기기 로그인) / Refresh 만료 시 강제 로그아웃 콜백 호출.
import type {
  AuthUser,
  Category,
  CustomerMenu,
  CustomerTable,
  Ingredient,
  InventoryRow,
  LoginResponse,
  Menu,
  Order,
  PastOrderView,
  SalesDetail,
  SalesSummary,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "") + "/api";

const ACCESS_KEY = "to_admin_access";
const REFRESH_KEY = "to_admin_refresh";
const USER_KEY = "to_admin_user";

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  setSession(s: LoginResponse): void {
    localStorage.setItem(ACCESS_KEY, s.accessToken);
    localStorage.setItem(REFRESH_KEY, s.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(s.user));
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  setUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export type ClientErrorCode =
  | "NETWORK"
  | "TOKEN_EXPIRED"
  | "SESSION_INVALIDATED"
  | "LOCKED"
  | "LOGIN_FAILED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL";

export class ApiClientError extends Error {
  code: ClientErrorCode;
  status: number;
  extra: Record<string, unknown>;
  constructor(status: number, code: ClientErrorCode, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

// 세션 강제 만료(다른 기기 로그인 / refresh 만료) 시 호출되는 핸들러
let sessionExpiredHandler: ((message: string) => void) | null = null;
export function setSessionExpiredHandler(fn: ((message: string) => void) | null): void {
  sessionExpiredHandler = fn;
}
function triggerSessionExpired(message: string): void {
  tokenStore.clear();
  if (sessionExpiredHandler) sessionExpiredHandler(message);
}

// refresh 단일 실행(single-flight)
let refreshPromise: Promise<boolean> | null = null;
async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = tokenStore.refresh;
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      tokenStore.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // 다음 호출을 위해 초기화 (약간 지연)
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && tokenStore.access) headers["Authorization"] = `Bearer ${tokenStore.access}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", "서버에 연결할 수 없습니다.");
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (res.ok) return payload as T;

  const err = (payload as { error?: { code?: string; message?: string } } | null)?.error;
  const code = (err?.code ?? "INTERNAL") as ClientErrorCode;
  const message = err?.message ?? "요청 처리 중 오류가 발생했습니다.";

  // 다른 기기 로그인 등 → 강제 로그아웃
  if (code === "SESSION_INVALIDATED") {
    triggerSessionExpired(message);
    throw new ApiClientError(res.status, code, message, err ?? {});
  }

  // Access 만료 → 자동 갱신 후 재시도(1회)
  if (code === "TOKEN_EXPIRED" && auth && !isRetry) {
    const ok = await refreshTokens();
    if (ok) return request<T>(path, opts, true);
    triggerSessionExpired("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  throw new ApiClientError(res.status, code, message, err ?? {});
}

// ---- API 메서드 ------------------------------------------------------------
export const api = {
  // auth
  login: (storeCode: string, username: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", auth: false, body: { storeCode, username, password } }),
  me: () => request<{ user: AuthUser }>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // orders / dashboard
  getDashboard: () =>
    request<{
      tables: { id: string; tableNumber: number }[];
      activeSessionByTableId: Record<string, string | null>;
      orders: Order[];
    }>("/orders"),
  updateOrderStatus: (orderId: string, status: Order["status"]) =>
    request<{ order: Order }>(`/orders/${orderId}`, { method: "PATCH", body: { status } }),
  deleteOrder: (orderId: string) =>
    request<{ deletedOrderId: string; tableId: string; newTableTotal: number }>(`/orders/${orderId}`, {
      method: "DELETE",
    }),

  // tables
  getTables: () =>
    request<{ tables: { id: string; tableNumber: number; sessionId: string | null; orderCount: number; totalAmount: number }[] }>(
      "/tables",
    ),
  completeTable: (tableId: string) =>
    request<{ ok: boolean; tableNumber: number; sessionTotal: number; orderCount: number }>("/tables/complete", {
      method: "POST",
      body: { tableId },
    }),
  getHistory: (params: { tableId?: string; from?: string; to?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.tableId) qs.set("tableId", params.tableId);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const q = qs.toString();
    return request<{ orders: PastOrderView[] }>(`/tables/history${q ? `?${q}` : ""}`);
  },

  // menus (owner)
  getMenus: () => request<{ categories: Category[]; menus: Menu[] }>("/menus"),
  createMenu: (input: {
    name: string;
    price: number;
    categoryId: string;
    description: string;
    imageUrl: string;
  }) => request<{ menu: Menu }>("/menus", { method: "POST", body: input }),
  updateMenu: (id: string, patch: Partial<{ name: string; price: number; categoryId: string; description: string; imageUrl: string; isHidden: boolean; isSoldOut: boolean; isRecommended: boolean }>) =>
    request<{ menu: Menu }>(`/menus/${id}`, { method: "PATCH", body: patch }),
  hideMenu: (id: string) => request<{ ok: boolean }>(`/menus/${id}`, { method: "DELETE" }),
  reorderMenus: (categoryId: string, orderedIds: string[]) =>
    request<{ ok: boolean }>("/menus/reorder", { method: "POST", body: { categoryId, orderedIds } }),

  // sales (owner)
  getSalesSummary: (date?: string) =>
    request<SalesSummary>(`/sales/summary${date ? `?date=${date}` : ""}`),
  getSalesDetail: (date?: string) => request<SalesDetail>(`/sales/detail${date ? `?date=${date}` : ""}`),

  // inventory (owner)
  getInventory: (date?: string) =>
    request<{ date: string; rows: InventoryRow[] }>(`/inventory${date ? `?date=${date}` : ""}`),
  saveInventory: (date: string, records: { ingredientId: string; openingQty: number | null; closingQty: number | null }[]) =>
    request<{ ok: boolean; saved: number }>("/inventory/records", { method: "POST", body: { date, records } }),
};

export type { Ingredient };

// =============================================================================
// 고객(테이블 태블릿) — 별도 table 토큰 사용 (장기 지속, 자동 로그인)
// =============================================================================
const TABLE_TOKEN_KEY = "to_table_token";
const TABLE_INFO_KEY = "to_table_info";

export const tableStore = {
  get token(): string | null {
    return localStorage.getItem(TABLE_TOKEN_KEY);
  },
  getTable(): CustomerTable | null {
    const raw = localStorage.getItem(TABLE_INFO_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CustomerTable;
    } catch {
      return null;
    }
  },
  set(token: string, table: CustomerTable): void {
    localStorage.setItem(TABLE_TOKEN_KEY, token);
    localStorage.setItem(TABLE_INFO_KEY, JSON.stringify(table));
  },
  clear(): void {
    localStorage.removeItem(TABLE_TOKEN_KEY);
    localStorage.removeItem(TABLE_INFO_KEY);
  },
};

async function customerRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && tableStore.token) headers["Authorization"] = `Bearer ${tableStore.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", "서버에 연결할 수 없습니다.");
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (res.ok) return payload as T;

  const err = (payload as { error?: { code?: string; message?: string } } | null)?.error;
  const code = (err?.code ?? "INTERNAL") as ClientErrorCode;
  const message = err?.message ?? "요청 처리 중 오류가 발생했습니다.";
  throw new ApiClientError(res.status, code, message, err ?? {});
}

export interface CreateOrderLine {
  menuId: string;
  quantity: number;
  optionItemIds: string[];
}

export const customerApi = {
  tableLogin: (storeCode: string, tableNumber: number, tablePassword: string) =>
    customerRequest<{ token: string; table: CustomerTable }>("/customer/table-login", {
      method: "POST",
      auth: false,
      body: { storeCode, tableNumber, tablePassword },
    }),
  getMenus: () => customerRequest<{ categories: Category[]; menus: CustomerMenu[] }>("/customer/menus"),
  getSession: () =>
    customerRequest<{ sessionId: string | null; startedAt: string | null; table: { tableNumber: number; storeCode: string } }>(
      "/customer/session",
    ),
  getOrders: () => customerRequest<{ sessionId: string | null; orders: Order[] }>("/customer/orders"),
  createOrder: (items: CreateOrderLine[]) =>
    customerRequest<{ order: Order; sessionId: string }>("/customer/orders", { method: "POST", body: { items } }),
};
