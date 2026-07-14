import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  aggregateMenuSales,
  buildSalesTotals,
  buildTableCards,
  cartCount,
  cartItemKey,
  cartLineTotal,
  cartTotal,
  cartUnitPrice,
  filterSessionOrders,
  orderPreview,
  orderTotal,
  recalcTableTotal,
  validateOptionSelection,
} from "./calc";
import { nextStatus } from "./types";
import type { CartItem, CartOption, MenuOptionGroup, Order, OrderItem, OrderStatus } from "./types";

// ---- Arbitraries -----------------------------------------------------------
const itemArb: fc.Arbitrary<OrderItem> = fc.record({
  id: fc.uuid(),
  menuId: fc.option(fc.uuid(), { nil: null }),
  menuName: fc.string({ minLength: 1, maxLength: 10 }),
  unitPrice: fc.integer({ min: 0, max: 100000 }),
  quantity: fc.integer({ min: 1, max: 50 }),
});

function orderArb(sessionId?: string): fc.Arbitrary<Order> {
  return fc
    .record({
      id: fc.uuid(),
      orderNumber: fc.integer({ min: 1, max: 100000 }),
      tableId: fc.uuid(),
      tableSessionId: sessionId ? fc.constant(sessionId) : fc.uuid(),
      status: fc.constantFrom<OrderStatus>("pending", "preparing", "done"),
      createdAt: fc
        .integer({ min: 0, max: 2_000_000_000 })
        .map((s) => new Date(s * 1000).toISOString()),
      items: fc.array(itemArb, { minLength: 0, maxLength: 6 }),
    })
    .map((o) => ({ ...o, totalAmount: orderTotal(o.items) }));
}

// ---- orderTotal ------------------------------------------------------------
describe("orderTotal", () => {
  it("빈 항목은 0", () => {
    expect(orderTotal([])).toBe(0);
  });

  it("Σ(단가×수량) 과 항상 일치한다", () => {
    fc.assert(
      fc.property(fc.array(itemArb), (items) => {
        const manual = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
        expect(orderTotal(items)).toBe(manual);
      }),
    );
  });

  it("항목이 모두 음수가 아니면 결과도 음수가 아니다", () => {
    fc.assert(
      fc.property(fc.array(itemArb), (items) => {
        expect(orderTotal(items)).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

// ---- recalcTableTotal (주문 삭제 후 재계산 불변식) --------------------------
describe("recalcTableTotal", () => {
  it("주문 하나를 삭제하면 재계산 총액 = 기존총액 - 삭제주문액", () => {
    fc.assert(
      fc.property(
        fc.array(orderArb(), { minLength: 1, maxLength: 8 }),
        fc.nat(),
        (orders, idx) => {
          const removeAt = idx % orders.length;
          const before = recalcTableTotal(orders);
          const removed = orders[removeAt];
          const after = recalcTableTotal(orders.filter((_, i) => i !== removeAt));
          expect(after).toBe(before - removed.totalAmount);
        },
      ),
    );
  });
});

// ---- filterSessionOrders ---------------------------------------------------
describe("filterSessionOrders", () => {
  it("null 세션은 빈 배열", () => {
    fc.assert(
      fc.property(fc.array(orderArb()), (orders) => {
        expect(filterSessionOrders(orders, null)).toEqual([]);
      }),
    );
  });

  it("반환된 주문은 모두 해당 세션이며 개수가 보존된다", () => {
    const SID = "11111111-1111-1111-1111-111111111111";
    fc.assert(
      fc.property(
        fc.array(orderArb(SID), { maxLength: 5 }),
        fc.array(orderArb(), { maxLength: 5 }),
        (matching, others) => {
          // others 는 우연히 SID 와 같지 않도록 필터
          const mixed = [...matching, ...others.filter((o) => o.tableSessionId !== SID)];
          const result = filterSessionOrders(mixed, SID);
          expect(result.every((o) => o.tableSessionId === SID)).toBe(true);
          expect(result.length).toBe(matching.length);
        },
      ),
    );
  });
});

// ---- buildTableCards -------------------------------------------------------
describe("buildTableCards", () => {
  it("모든 테이블이 카드로 포함되고, 세션 없는 테이블은 비어있음 처리", () => {
    const tables = [
      { id: "t1", tableNumber: 1 },
      { id: "t2", tableNumber: 2 },
    ];
    const SID = "aaaa";
    fc.assert(
      fc.property(fc.array(orderArb(SID), { maxLength: 5 }), (orders) => {
        const cards = buildTableCards(tables, orders, { t1: SID, t2: null });
        expect(cards.length).toBe(2);
        const c1 = cards.find((c) => c.table.id === "t1")!;
        const c2 = cards.find((c) => c.table.id === "t2")!;
        expect(c1.totalAmount).toBe(recalcTableTotal(orders));
        expect(c1.orderCount).toBe(orders.length);
        expect(c2.isEmpty).toBe(true);
        expect(c2.orderCount).toBe(0);
      }),
    );
  });
});

// ---- aggregateMenuSales ----------------------------------------------------
describe("aggregateMenuSales", () => {
  it("메뉴별 매출 합계 = 전체 주문 항목 매출 합계, 카테고리 소계도 일치", () => {
    fc.assert(
      fc.property(fc.array(orderArb(), { maxLength: 8 }), (orders) => {
        const done = orders.map((o) => ({ ...o, status: "done" as const }));
        const expected = done.reduce(
          (s, o) => s + o.items.reduce((si, it) => si + it.unitPrice * it.quantity, 0),
          0,
        );
        const { menuLines, categorySubtotals } = aggregateMenuSales(done, {});
        const lineSum = menuLines.reduce((s, l) => s + l.revenue, 0);
        const subSum = categorySubtotals.reduce((s, c) => s + c.revenue, 0);
        expect(lineSum).toBe(expected);
        expect(subSum).toBe(expected);
      }),
    );
  });
});

// ---- buildSalesTotals ------------------------------------------------------
describe("buildSalesTotals", () => {
  it("netSales = totalSales - cancelAmount 불변식", () => {
    fc.assert(
      fc.property(
        fc.array(orderArb(), { maxLength: 8 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (orders, cancel) => {
          const done = orders.map((o) => ({ ...o, status: "done" as const }));
          const t = buildSalesTotals(done, cancel);
          expect(t.totalSales).toBe(recalcTableTotal(done));
          expect(t.netSales).toBe(t.totalSales - cancel);
        },
      ),
    );
  });
});

// ---- 직렬화 round-trip ------------------------------------------------------
describe("주문 직렬화 round-trip", () => {
  it("serialize → deserialize 는 항등(identity)이며 총액이 보존된다", () => {
    fc.assert(
      fc.property(orderArb(), (order) => {
        const round: Order = JSON.parse(JSON.stringify(order));
        expect(round).toEqual(order);
        expect(orderTotal(round.items)).toBe(orderTotal(order.items));
      }),
    );
  });
});

// ---- nextStatus (예제 기반) -------------------------------------------------
describe("nextStatus", () => {
  it("대기중 → 준비중 → 완료 → null (역방향 없음)", () => {
    expect(nextStatus("pending")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("done");
    expect(nextStatus("done")).toBeNull();
  });

  it("현재 상태와 절대 같지 않다", () => {
    fc.assert(
      fc.property(fc.constantFrom<OrderStatus>("pending", "preparing", "done"), (s) => {
        expect(nextStatus(s)).not.toBe(s);
      }),
    );
  });
});

// ---- orderPreview (예제 기반) -----------------------------------------------
describe("orderPreview", () => {
  it("주문 없음/단일/복수 미리보기", () => {
    expect(orderPreview(null)).toBe("주문 없음");
    const base: Order = {
      id: "o1",
      orderNumber: 1,
      tableId: "t1",
      tableSessionId: "s1",
      status: "pending",
      totalAmount: 0,
      createdAt: new Date().toISOString(),
      items: [],
    };
    expect(orderPreview(base)).toBe("주문 없음");
    expect(
      orderPreview({
        ...base,
        items: [{ id: "i1", menuId: null, menuName: "아메리카노", unitPrice: 4000, quantity: 2 }],
      }),
    ).toBe("아메리카노 2개");
    expect(
      orderPreview({
        ...base,
        items: [
          { id: "i1", menuId: null, menuName: "아메리카노", unitPrice: 4000, quantity: 2 },
          { id: "i2", menuId: null, menuName: "라떼", unitPrice: 4500, quantity: 1 },
        ],
      }),
    ).toBe("아메리카노 2개 외 1건");
  });
});

// ---- 장바구니 계산 (고객) ---------------------------------------------------
const cartOptionArb: fc.Arbitrary<CartOption> = fc.record({
  groupId: fc.uuid(),
  groupName: fc.string({ minLength: 1, maxLength: 8 }),
  itemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 8 }),
  extraPrice: fc.integer({ min: 0, max: 5000 }),
});

const cartItemArb: fc.Arbitrary<CartItem> = fc.record({
  key: fc.string(),
  menuId: fc.uuid(),
  menuName: fc.string({ minLength: 1, maxLength: 10 }),
  imageUrl: fc.constant("https://example.com/x.png"),
  basePrice: fc.integer({ min: 0, max: 20000 }),
  quantity: fc.integer({ min: 1, max: 20 }),
  options: fc.array(cartOptionArb, { maxLength: 4 }),
});

describe("장바구니 계산", () => {
  it("단가 = 기본가 + Σ옵션추가금액", () => {
    fc.assert(
      fc.property(cartItemArb, (item) => {
        const expected = item.basePrice + item.options.reduce((s, o) => s + o.extraPrice, 0);
        expect(cartUnitPrice(item.basePrice, item.options)).toBe(expected);
      }),
    );
  });

  it("항목 합계 = 단가 × 수량", () => {
    fc.assert(
      fc.property(cartItemArb, (item) => {
        expect(cartLineTotal(item)).toBe(cartUnitPrice(item.basePrice, item.options) * item.quantity);
      }),
    );
  });

  it("총액 = 항목 합계들의 합, 빈 장바구니는 0", () => {
    expect(cartTotal([])).toBe(0);
    fc.assert(
      fc.property(fc.array(cartItemArb, { maxLength: 8 }), (items) => {
        const manual = items.reduce((s, it) => s + cartLineTotal(it), 0);
        expect(cartTotal(items)).toBe(manual);
        expect(cartCount(items)).toBe(items.reduce((s, it) => s + it.quantity, 0));
      }),
    );
  });

  it("동일 메뉴+동일 옵션 조합은 순서 무관하게 같은 키(병합), 다르면 다른 키", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), (menuId, ids) => {
        const shuffled = [...ids].reverse();
        expect(cartItemKey(menuId, ids)).toBe(cartItemKey(menuId, shuffled));
        expect(cartItemKey(menuId, ids)).not.toBe(cartItemKey(menuId, [...ids, "extra"]));
      }),
    );
  });
});

describe("옵션 선택 검증", () => {
  const groups: MenuOptionGroup[] = [
    {
      id: "g1",
      name: "온도",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      items: [
        { id: "hot", name: "HOT", extraPrice: 0, isDefault: true },
        { id: "ice", name: "ICE", extraPrice: 0, isDefault: false },
      ],
    },
    {
      id: "g2",
      name: "샷",
      isRequired: false,
      minSelect: 0,
      maxSelect: 2,
      items: [{ id: "shot", name: "샷추가", extraPrice: 500, isDefault: false }],
    },
  ];

  it("필수 그룹 미선택 시 invalid + 그룹명 반환", () => {
    const r = validateOptionSelection(groups, []);
    expect(r.valid).toBe(false);
    expect(r.missingGroups).toContain("온도");
  });

  it("필수 그룹 선택 시 valid", () => {
    expect(validateOptionSelection(groups, ["hot"]).valid).toBe(true);
    expect(validateOptionSelection(groups, ["ice", "shot"]).valid).toBe(true);
  });
});
