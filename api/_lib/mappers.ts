// DB(snake_case) → API 응답(camelCase) 매퍼. 프론트 src/lib/types.ts 계약과 일치.

export interface DbOrderItem {
  id: string;
  menu_id: string | null;
  menu_name: string;
  unit_price: number;
  quantity: number;
  options?: unknown;
}

export interface DbOrder {
  id: string;
  order_number: number;
  table_id: string;
  table_session_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  order_items?: DbOrderItem[] | null;
}

export function mapOrderItem(row: DbOrderItem) {
  const opts = Array.isArray(row.options)
    ? (row.options as { groupName?: string; name?: string; extraPrice?: number }[]).map((o) => ({
        groupName: o.groupName ?? "",
        name: o.name ?? "",
        extraPrice: o.extraPrice ?? 0,
      }))
    : [];
  return {
    id: row.id,
    menuId: row.menu_id,
    menuName: row.menu_name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    options: opts,
  };
}

export function mapOrder(row: DbOrder) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    tableId: row.table_id,
    tableSessionId: row.table_session_id,
    status: row.status as "pending" | "preparing" | "done",
    totalAmount: row.total_amount,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map(mapOrderItem),
  };
}

export interface DbMenu {
  id: string;
  category_id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  sort_order: number;
  is_hidden: boolean;
  is_sold_out: boolean;
  categories?: { name: string } | { name: string }[] | null;
}

export function mapMenu(row: DbMenu) {
  const cat = row.categories;
  const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName,
    name: row.name,
    price: row.price,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isHidden: row.is_hidden,
    isSoldOut: row.is_sold_out,
  };
}
