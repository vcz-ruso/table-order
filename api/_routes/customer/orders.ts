import { ApiError, assertMethod, sendJson } from "../../_lib/http";
import { withTable } from "../../_lib/middleware";
import { mapOrder, type DbOrder } from "../../_lib/mappers";
import { supabaseAdmin } from "../../_lib/supabaseAdmin";
import { asObject } from "../../_lib/validation";

const ORDER_SELECT =
  "id, order_number, table_id, table_session_id, status, total_amount, created_at, order_items(id, menu_id, menu_name, unit_price, quantity, options)";

interface LineInput {
  menuId: string;
  quantity: number;
  optionItemIds: string[];
}

function parseItems(raw: unknown): LineInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ApiError(422, "VALIDATION", "주문 항목이 비어 있습니다.");
  }
  return raw.map((item, idx) => {
    if (typeof item !== "object" || item === null) throw new ApiError(422, "VALIDATION", `items[${idx}] 형식 오류`);
    const o = item as Record<string, unknown>;
    if (typeof o.menuId !== "string") throw new ApiError(422, "VALIDATION", `items[${idx}].menuId 필요`);
    if (typeof o.quantity !== "number" || !Number.isInteger(o.quantity) || o.quantity < 1) {
      throw new ApiError(422, "VALIDATION", `items[${idx}].quantity 는 1 이상의 정수여야 합니다.`);
    }
    const ids = o.optionItemIds;
    if (ids !== undefined && (!Array.isArray(ids) || ids.some((v) => typeof v !== "string"))) {
      throw new ApiError(422, "VALIDATION", `items[${idx}].optionItemIds 형식 오류`);
    }
    return { menuId: o.menuId, quantity: o.quantity, optionItemIds: (ids as string[]) ?? [] };
  });
}

export default withTable(async (req, res, { table }) => {
  assertMethod(req, ["GET", "POST"]);
  const db = supabaseAdmin();

  // ---- GET: 현재 세션 주문 목록 (시간순) ----
  if (req.method === "GET") {
    const { data: session } = await db
      .from("table_sessions")
      .select("id")
      .eq("table_id", table.tableId)
      .eq("status", "active")
      .maybeSingle();
    if (!session) {
      sendJson(res, 200, { sessionId: null, orders: [] });
      return;
    }
    const { data: rows, error } = await db
      .from("orders")
      .select(ORDER_SELECT)
      .eq("table_session_id", session.id)
      .order("created_at", { ascending: true });
    if (error) throw new ApiError(500, "INTERNAL", "주문 조회 실패");
    sendJson(res, 200, { sessionId: session.id, orders: (rows as unknown as DbOrder[]).map(mapOrder) });
    return;
  }

  // ---- POST: 주문 생성 ----
  const body = asObject(req.body);
  const lines = parseItems(body.items);
  const menuIds = [...new Set(lines.map((l) => l.menuId))];

  // 메뉴 로드 (노출 + 소유권), 품절 재검증
  const { data: menus, error: mErr } = await db
    .from("menus")
    .select("id, name, price, is_hidden, is_sold_out")
    .eq("store_id", table.storeId)
    .in("id", menuIds);
  if (mErr) throw new ApiError(500, "INTERNAL", "메뉴 확인 실패");
  const menuById = new Map((menus ?? []).map((m) => [m.id as string, m]));
  for (const id of menuIds) {
    const m = menuById.get(id);
    if (!m || m.is_hidden) throw new ApiError(422, "VALIDATION", "주문할 수 없는 메뉴가 포함되어 있습니다.");
    if (m.is_sold_out) throw new ApiError(409, "CONFLICT", `'${m.name}'은(는) 품절되었습니다.`);
  }

  // 옵션 정보 로드
  const { data: groups } = await db
    .from("menu_option_groups")
    .select("id, menu_id, name, is_required, min_select, max_select")
    .in("menu_id", menuIds);
  const groupById = new Map((groups ?? []).map((g) => [g.id as string, g]));
  const groupIds = (groups ?? []).map((g) => g.id as string);
  const itemById = new Map<string, { groupId: string; name: string; extraPrice: number }>();
  if (groupIds.length > 0) {
    const { data: items } = await db
      .from("menu_option_items")
      .select("id, group_id, name, extra_price")
      .in("group_id", groupIds);
    for (const it of items ?? []) {
      itemById.set(it.id as string, {
        groupId: it.group_id as string,
        name: it.name as string,
        extraPrice: it.extra_price as number,
      });
    }
  }

  // 라인별 검증 + 스냅샷/단가 계산
  const preparedItems: {
    menu_id: string;
    menu_name: string;
    unit_price: number;
    quantity: number;
    options: { groupName: string; name: string; extraPrice: number }[];
  }[] = [];

  for (const line of lines) {
    const menu = menuById.get(line.menuId)!;
    const selectedByGroup = new Map<string, number>();
    let extra = 0;
    const snapshot: { groupName: string; name: string; extraPrice: number }[] = [];

    for (const optId of line.optionItemIds) {
      const opt = itemById.get(optId);
      if (!opt) throw new ApiError(422, "VALIDATION", "유효하지 않은 옵션이 포함되어 있습니다.");
      const grp = groupById.get(opt.groupId);
      if (!grp || (grp.menu_id as string) !== line.menuId) {
        throw new ApiError(422, "VALIDATION", "메뉴에 속하지 않는 옵션이 포함되어 있습니다.");
      }
      extra += opt.extraPrice;
      snapshot.push({ groupName: grp.name as string, name: opt.name, extraPrice: opt.extraPrice });
      selectedByGroup.set(opt.groupId, (selectedByGroup.get(opt.groupId) ?? 0) + 1);
    }

    // 필수/최대 선택 검증
    for (const g of groups ?? []) {
      if ((g.menu_id as string) !== line.menuId) continue;
      const count = selectedByGroup.get(g.id as string) ?? 0;
      const min = g.is_required ? Math.max(1, g.min_select as number) : (g.min_select as number);
      if (count < min) {
        throw new ApiError(422, "VALIDATION", `'${menu.name}'의 필수 옵션 '${g.name}'을(를) 선택해 주세요.`);
      }
      if ((g.max_select as number) > 0 && count > (g.max_select as number)) {
        throw new ApiError(422, "VALIDATION", `'${menu.name}'의 옵션 '${g.name}' 선택 수가 초과되었습니다.`);
      }
    }

    preparedItems.push({
      menu_id: line.menuId,
      menu_name: menu.name as string,
      unit_price: (menu.price as number) + extra,
      quantity: line.quantity,
      options: snapshot,
    });
  }

  const totalAmount = preparedItems.reduce((s, it) => s + it.unit_price * it.quantity, 0);

  // 세션 확보 (없으면 생성, 있으면 유지)
  let sessionId: string;
  const { data: existing } = await db
    .from("table_sessions")
    .select("id")
    .eq("table_id", table.tableId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) {
    sessionId = existing.id as string;
  } else {
    const { data: created, error: csErr } = await db
      .from("table_sessions")
      .insert({ store_id: table.storeId, table_id: table.tableId, status: "active" })
      .select("id")
      .single();
    if (csErr || !created) {
      // 동시성으로 인한 중복 생성 실패 시 재조회
      const { data: retry } = await db
        .from("table_sessions")
        .select("id")
        .eq("table_id", table.tableId)
        .eq("status", "active")
        .maybeSingle();
      if (!retry) throw new ApiError(500, "INTERNAL", "세션 생성 실패");
      sessionId = retry.id as string;
    } else {
      sessionId = created.id as string;
    }
  }

  // 주문 + 항목 생성
  const { data: order, error: oErr } = await db
    .from("orders")
    .insert({
      store_id: table.storeId,
      table_id: table.tableId,
      table_session_id: sessionId,
      status: "pending",
      total_amount: totalAmount,
    })
    .select("id")
    .single();
  if (oErr || !order) throw new ApiError(500, "INTERNAL", "주문 생성 실패");

  const { error: itErr } = await db
    .from("order_items")
    .insert(preparedItems.map((it) => ({ ...it, order_id: order.id })));
  if (itErr) {
    // 주문 항목 삽입 실패 시 주문 롤백(수동)
    await db.from("orders").delete().eq("id", order.id);
    throw new ApiError(500, "INTERNAL", "주문 항목 저장 실패");
  }

  const { data: full } = await db.from("orders").select(ORDER_SELECT).eq("id", order.id).single();
  sendJson(res, 201, { order: mapOrder(full as unknown as DbOrder), sessionId });
});
