// 마이그레이션 실행기 — psql 로 0001, 0002 SQL 을 순서대로 적용한다.
// 실행: npm run db:migrate  (내부적으로 node --env-file=.env 사용)
// 선행: SUPABASE_DB_URL 설정 (.env 또는 환경변수). psql 설치 필요.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl || dbUrl.includes("[YOUR-PASSWORD]") || dbUrl.includes("your-project-ref")) {
  console.error(
    "❌ SUPABASE_DB_URL 이 설정되지 않았습니다.\n" +
      "   Supabase 대시보드 → Project Settings → Database → Connection string(URI) 를 복사해\n" +
      "   .env 또는 환경변수에 설정한 뒤 다시 실행하세요.",
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const files = [join(here, "migrations", "0001_init.sql"), join(here, "migrations", "0002_menu_options.sql")];

const args = ["-v", "ON_ERROR_STOP=1"];
for (const f of files) args.push("-f", f);
args.push(dbUrl);

console.log("=== 마이그레이션 적용 (psql) ===");
const res = spawnSync("psql", args, { stdio: "inherit" });
if (res.error) {
  console.error("❌ psql 실행 실패:", res.error.message, "\n   psql 이 설치되어 있는지 확인하세요.");
  process.exit(1);
}
if (res.status !== 0) {
  console.error(`❌ 마이그레이션 실패 (psql exit ${res.status}).`);
  process.exit(res.status ?? 1);
}
console.log("🎉 마이그레이션 완료!");
