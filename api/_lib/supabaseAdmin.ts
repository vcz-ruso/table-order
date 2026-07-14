import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// 서버 전용 Supabase 클라이언트. service_role 키를 사용하여 RLS 를 우회하며,
// 접근 제어(역할/소유권)는 API 레이어(withAuth)에서 검증한다.
// 이 클라이언트는 절대 클라이언트 번들로 노출되지 않는다(api/ 디렉토리 전용).
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
