// 공유 도메인 타입 (프론트엔드 ↔ API 응답 계약)
// snake_case DB 컬럼은 API 레이어에서 camelCase 로 변환하여 내려준다.

export type Role = "owner" | "staff";
export type OrderStatus = "pending" | "preparing" | "done";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "대기중",
  preparing: "준비중",
  done: "완료",
};

/** 상태 흐름: 대기중 → 준비중 → 완료 (역방향 불가) */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "pending":
      return "preparing";
    case "preparing":
      return "done";
    case "done":
      return null;
  }
}

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  storeId: string;
  storeCode: string;
  storeName: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface OrderItemOption {
  groupName: string;
  name: string;
  extraPrice: number;
}

export interface OrderItem {
  id: string;
  menuId: string | null;
  menuName: string;
  unitPrice: number;
  quantity: number;
  options?: OrderItemOption[];
}

export interface Order {
  id: string;
  orderNumber: number;
  tableId: string;
  tableSessionId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

export interface DiningTable {
  id: string;
  tableNumber: number;
}

/** 대시보드 테이블 카드 뷰 모델 */
export interface TableCard {
  table: DiningTable;
  sessionId: string | null;
  totalAmount: number;
  orderCount: number;
  latestOrder: Order | null;
  isEmpty: boolean;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Menu {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isHidden: boolean;
  isSoldOut: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  sortOrder: number;
}

export interface InventoryRow {
  ingredient: Ingredient;
  openingQty: number | null;
  closingQty: number | null;
  consumption: number | null; // opening - closing (둘 다 있을 때)
  updatedAt: string | null;
}

export interface SalesSummary {
  date: string; // YYYY-MM-DD
  totalSales: number; // 완료 주문 합계
  orderCount: number; // 해당일 주문 건수
}

export interface MenuSalesLine {
  menuId: string | null;
  menuName: string;
  categoryName: string;
  quantity: number;
  revenue: number;
}

export interface CategorySubtotal {
  categoryName: string;
  quantity: number;
  revenue: number;
}

export interface SalesDetail {
  date: string;
  totalSales: number; // 완료 주문 합계
  cancelAmount: number; // 삭제(취소) 주문 합계
  netSales: number; // totalSales - cancelAmount
  orderCount: number;
  menuLines: MenuSalesLine[];
  categorySubtotals: CategorySubtotal[];
}

export interface PastOrderView {
  order: Order;
  tableNumber: number;
  sessionClosedAt: string | null;
}

// ---- 고객(Customer) 도메인 ----

export interface MenuOptionItem {
  id: string;
  name: string;
  extraPrice: number;
  isDefault: boolean;
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  items: MenuOptionItem[];
}

/** 고객 화면용 메뉴 (노출 메뉴만, 옵션 포함) */
export interface CustomerMenu {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  isSoldOut: boolean;
  options: MenuOptionGroup[];
}

/** 장바구니 선택 옵션 */
export interface CartOption {
  groupId: string;
  groupName: string;
  itemId: string;
  name: string;
  extraPrice: number;
}

/** 장바구니 항목 (클라이언트 로컬 저장) */
export interface CartItem {
  key: string; // menuId + 정렬된 옵션 조합 → 동일 조합 병합용
  menuId: string;
  menuName: string;
  imageUrl: string;
  basePrice: number;
  quantity: number;
  options: CartOption[];
}

export interface CustomerTable {
  tableId: string;
  tableNumber: number;
  storeId: string;
  storeCode: string;
  storeName: string;
}
