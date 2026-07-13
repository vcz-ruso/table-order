// Vercel Serverless Function (Node.js) — 헬스체크 샘플 엔드포인트.
// GET /api/health -> { status: "ok", ... }
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  res.status(200).json({
    status: "ok",
    service: "table-order-api",
    timestamp: new Date().toISOString(),
  });
}
