// 서버(서버리스) 환경변수 접근 헬퍼. 없으면 명확히 실패한다(fail-closed).
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다.`);
  }
  return v;
}

export const env = {
  get supabaseUrl(): string {
    // 클라이언트/서버 공용으로 동일 프로젝트 URL 사용
    return required("VITE_SUPABASE_URL");
  },
  get serviceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get jwtSecret(): string {
    return required("JWT_SECRET");
  },
};
