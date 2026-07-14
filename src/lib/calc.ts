// 순수 계산 로직 (부수효과 없음). PBT 대상.
import type {
  CartItem,
  CartOption,
  CategorySubtotal,
  DiningTable,
  MenuOptionGroup,
  MenuSalesLine,
  Order,
  OrderItem,
  SalesDetail,
  TableCard,
} from "./types";

/** 주문 항목들의 총 금액 = Σ(단가 × 수량) */
export function orderTotal(items: readonly OrderItem[]): number {
  return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
}

/** 테이블 총 주문액 재계산 = 남아있는 주문들의 totalAmount 합계 */
export function recalcTableTotal(orders: readonly Order[]): number {
  return orders.reduce((sum, o) => sum + o.totalAmount, 0);
}

/** 현재 세션 주문만 필터링 (개수/순서 보존, 다른 세션 제외) */
export function filterSessionOrders(
  orders: readonly Order[],
  sessionId: string | null,
): Order[] {
  if (!sessionId) return [];
  return orders.filter((o) => o.tableSessionId === sessionId);
}

/** 주문 목록을 생성 시각 역순(최신 우선)으로 정렬한 새 배열 반환 */
export function sortByCreatedDesc(orders: readonly Order[]): Order[] {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * 대시보드 테이블 카드 뷰 모델 생성.
 * - 모든 테이블이 항상 포함된다 (세션 없는 빈 테이블 포함).
 * - active 세션의 주문만 집계한다.
 */
export function buildTableCards(
  tables: readonly DiningTable[],
  orders: readonly Order[],
  activeSessionByTableId: Readonly<Record<string, string | null>>,
): TableCard[] {
  return tables.map((table) => {
    const sessionId = activeSessionByTableId[table.id] ?? null;
    const sessionOrders = filterSessionOrders(orders, sessionId);
    const sorted = sortByCreatedDesc(sessionOrders);
    return {
      table,
      sessionId,
      totalAmount: recalcTableTotal(sessionOrders),
      orderCount: sessionOrders.length,
      latestOrder: sorted[0] ?? null,
      isEmpty: sessionId === null || sessionOrders.length === 0,
    };
  });
}

/** 최근 주문 미리보기 문자열 (메뉴명 + 수량 축약) */
export function orderPreview(order: Order | null): string {
  if (!order || order.items.length === 0) return "주문 없음";
  const [first, ...rest] = order.items;
  const head = `${first.menuName} ${first.quantity}개`;
  return rest.length > 0 ? `${head} 외 ${rest.length}건` : head;
}

/**
 * 완료(done) 주문 기준 메뉴별 판매 집계.
 * 반환: 메뉴별 라인(수량/매출), 카테고리 소계.
 */
export function aggregateMenuSales(
  doneOrders: readonly Order[],
  menuCategory: Readonly<Record<string, string>>, // menuId → categoryName
): { menuLines: MenuSalesLine[]; categorySubtotals: CategorySubtotal[] } {
  const lineMap = new Map<string, MenuSalesLine>();
  for (const order of doneOrders) {
    for (const it of order.items) {
      const catName = (it.menuId && menuCategory[it.menuId]) || "기타";
      const key = `${it.menuId ?? it.menuName}::${catName}`;
      const existing = lineMap.get(key);
      const revenue = it.unitPrice * it.quantity;
      if (existing) {
        existing.quantity += it.quantity;
        existing.revenue += revenue;
      } else {
        lineMap.set(key, {
          menuId: it.menuId,
          menuName: it.menuName,
          categoryName: catName,
          quantity: it.quantity,
          revenue,
        });
      }
    }
  }
  const menuLines = [...lineMap.values()].sort((a, b) => b.revenue - a.revenue);

  const subMap = new Map<string, CategorySubtotal>();
  for (const line of menuLines) {
    const sub = subMap.get(line.categoryName);
    if (sub) {
      sub.quantity += line.quantity;
      sub.revenue += line.revenue;
    } else {
      subMap.set(line.categoryName, {
        categoryName: line.categoryName,
        quantity: line.quantity,
        revenue: line.revenue,
      });
    }
  }
  return { menuLines, categorySubtotals: [...subMap.values()] };
}

/**
 * 매출 상세 총계 구성.
 * totalSales = 완료 주문 합계, cancelAmount = 취소(삭제) 합계, netSales = 총매출 - 취소.
 */
export function buildSalesTotals(
  doneOrders: readonly Order[],
  cancelAmount: number,
): Pick<SalesDetail, "totalSales" | "cancelAmount" | "netSales"> {
  const totalSales = recalcTableTotal(doneOrders);
  return {
    totalSales,
    cancelAmount,
    netSales: totalSales - cancelAmount,
  };
}

// ---- 장바구니 / 옵션 계산 (고객) -------------------------------------------

/** 옵션 조합을 정규화한 병합 키 (동일 메뉴+동일 옵션 조합 = 수량 증가) */
export function cartItemKey(menuId: string, optionItemIds: readonly string[]): string {
  return `${menuId}::${[...optionItemIds].sort().join(",")}`;
}

/** 장바구니 항목 단가 = 기본가 + Σ(옵션 추가금액) */
export function cartUnitPrice(basePrice: number, options: readonly CartOption[]): number {
  return basePrice + options.reduce((s, o) => s + o.extraPrice, 0);
}

/** 장바구니 항목 합계 = 단가 × 수량 */
export function cartLineTotal(item: CartItem): number {
  return cartUnitPrice(item.basePrice, item.options) * item.quantity;
}

/** 장바구니 총 금액 */
export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((s, it) => s + cartLineTotal(it), 0);
}

/** 장바구니 총 수량 */
export function cartCount(items: readonly CartItem[]): number {
  return items.reduce((s, it) => s + it.quantity, 0);
}

/**
 * 필수 옵션 선택 검증.
 * - 필수 그룹은 minSelect 이상 선택되어야 한다.
 * - 어떤 그룹도 maxSelect 를 초과할 수 없다.
 * 반환: { valid, missingGroups } (미충족 필수 그룹명 목록)
 */
export function validateOptionSelection(
  groups: readonly MenuOptionGroup[],
  selectedItemIds: readonly string[],
): { valid: boolean; missingGroups: string[] } {
  const selected = new Set(selectedItemIds);
  const missingGroups: string[] = [];
  for (const g of groups) {
    const count = g.items.filter((it) => selected.has(it.id)).length;
    const min = g.isRequired ? Math.max(1, g.minSelect) : g.minSelect;
    if (count < min) missingGroups.push(g.name);
    if (g.maxSelect > 0 && count > g.maxSelect) missingGroups.push(g.name);
  }
  return { valid: missingGroups.length === 0, missingGroups };
}
