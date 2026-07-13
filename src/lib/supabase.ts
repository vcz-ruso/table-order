import { createClient } from "@supabase/supabase-js";

// 클라이언트(브라우저)용 Supabase 인스턴스.
// anon(public) 키만 사용하며, service_role 키는 절대 클라이언트에 노출하지 않습니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 개발 환경에서 .env 미설정 시 빠르게 인지할 수 있도록 경고
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.example 참고.",
  );
}

export const supabase = createClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
);
