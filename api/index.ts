import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ApiError, handlePreflight, sendError, setCors } from "./_lib/http";

// 인증
import authLogin from "./_routes/auth/login";
import authRefresh from "./_routes/auth/refresh";
import authLogout from "./_routes/auth/logout";
import authMe from "./_routes/auth/me";
// 주문 / 테이블
import ordersIndex from "./_routes/orders/index";
import ordersById from "./_routes/orders/by-id";
import tablesIndex from "./_routes/tables/index";
import tablesComplete from "./_routes/tables/complete";
import tablesHistory from "./_routes/tables/history";
// 메뉴
import menusIndex from "./_routes/menus/index";
import menusById from "./_routes/menus/by-id";
import menusReorder from "./_routes/menus/reorder";
// 매출 / 재고
import salesSummary from "./_routes/sales/summary";
import salesDetail from "./_routes/sales/detail";
import inventoryIndex from "./_routes/inventory/index";
import inventoryRecords from "./_routes/inventory/records";
// 고객
import customerTableLogin from "./_routes/customer/table-login";
import customerMenus from "./_routes/customer/menus";
import customerSession from "./_routes/customer/session";
import customerOrders from "./_routes/customer/orders";

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

/**
 * Vercel Hobby(무료) 플랜의 서버리스 함수 12개 제한을 지키기 위해,
 * 모든 /api/* 요청을 이 단일 함수(api/index.ts)에서 내부 라우팅한다.
 * vercel.json 의 rewrite 가 /api/(.*) → /api?__apipath=$1 로 전달하며(멀티세그먼트 보존),
 * 실제 핸들러는 api/_routes/ 아래에 있다(언더스코어 → 함수로 배포되지 않음).
 */
function resolve(segs: string[]): { handler?: Handler; id?: string } {
  const [a, b] = segs;
  switch (a) {
    case "auth":
      if (b === "login") return { handler: authLogin };
      if (b === "refresh") return { handler: authRefresh };
      if (b === "logout") return { handler: authLogout };
      if (b === "me") return { handler: authMe };
      return {};
    case "orders":
      if (!b) return { handler: ordersIndex };
      return { handler: ordersById, id: b };
    case "tables":
      if (!b) return { handler: tablesIndex };
      if (b === "complete") return { handler: tablesComplete };
      if (b === "history") return { handler: tablesHistory };
      return {};
    case "menus":
      if (!b) return { handler: menusIndex };
      if (b === "reorder") return { handler: menusReorder };
      return { handler: menusById, id: b };
    case "sales":
      if (b === "summary") return { handler: salesSummary };
      if (b === "detail") return { handler: salesDetail };
      return {};
    case "inventory":
      if (!b) return { handler: inventoryIndex };
      if (b === "records") return { handler: inventoryRecords };
      return {};
    case "customer":
      if (b === "table-login") return { handler: customerTableLogin };
      if (b === "menus") return { handler: customerMenus };
      if (b === "session") return { handler: customerSession };
      if (b === "orders") return { handler: customerOrders };
      return {};
    default:
      return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 경로 파싱:
  // - 프로덕션: vercel.json rewrite 가 /api/(.*) → /api?__apipath=$1 로 전달 (멀티세그먼트 보존)
  // - 로컬(vite 프록시)/직접호출: req.url 에서 파싱
  const rawPath = Array.isArray(req.query.__apipath) ? req.query.__apipath[0] : req.query.__apipath;
  let segs: string[];
  if (typeof rawPath === "string") {
    segs = rawPath.split("/").filter(Boolean);
  } else {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    segs = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  }

  const { handler: h, id } = resolve(segs);

  if (!h) {
    setCors(req, res);
    if (handlePreflight(req, res)) return;
    sendError(res, new ApiError(404, "NOT_FOUND", "존재하지 않는 API 경로입니다."));
    return;
  }

  // 동적 세그먼트(:id)를 하위 핸들러가 읽는 req.query.id 로 주입
  if (id !== undefined) {
    req.query = { ...req.query, id };
  }

  return h(req, res);
}
