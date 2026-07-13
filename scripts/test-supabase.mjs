// Supabase 연결 테스트 스크립트.
// 실행: npm run test:supabase  (내부적으로 node --env-file=.env 사용)
// 비밀 키 값은 절대 출력하지 않습니다.

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => {
  console.log(`  ❌ ${msg}`);
  failures += 1;
};

function checkEnv() {
  console.log("1) 환경 변수 확인");
  if (url && /^https:\/\/.+\.supabase\.co(\/.*)?$/.test(url)) {
    if (/\/.+/.test(new URL(url).pathname)) {
      console.log("  ⚠️  URL에 경로(/rest/v1 등)가 포함됨 — 베이스 URL만 권장하지만 테스트는 진행합니다");
    }
    pass("VITE_SUPABASE_URL 형식 정상");
  } else {
    fail(`VITE_SUPABASE_URL 형식 이상 (값: ${url ? "설정됨(형식확인필요)" : "없음"})`);
  }
  if (anonKey && anonKey.length > 20) pass("VITE_SUPABASE_ANON_KEY 존재");
  else fail("VITE_SUPABASE_ANON_KEY 없음/이상");
  if (serviceKey && serviceKey.length > 20) pass("SUPABASE_SERVICE_ROLE_KEY 존재");
  else fail("SUPABASE_SERVICE_ROLE_KEY 없음/이상");
}

async function checkAuthHealth() {
  console.log("2) Auth 서비스 헬스체크 (GET /auth/v1/health)");
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    if (res.ok) pass(`Auth 응답 정상 (HTTP ${res.status})`);
    else fail(`Auth 응답 실패 (HTTP ${res.status})`);
  } catch (e) {
    fail(`Auth 연결 실패: ${e.message}`);
  }
}

async function checkAnonKey() {
  console.log("3) anon 키 유효성 (GET /auth/v1/settings)");
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (res.status === 200) pass(`anon 키 유효 (HTTP ${res.status})`);
    else if (res.status === 401) fail("anon 키 인증 실패 (HTTP 401) — 키를 다시 확인하세요");
    else fail(`예상치 못한 응답 (HTTP ${res.status})`);
  } catch (e) {
    fail(`anon 키 확인 연결 실패: ${e.message}`);
  }
}

async function checkStorageService() {
  console.log("4) service_role 키 유효성 - Storage 버킷 목록 (GET /storage/v1/bucket)");
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/storage/v1/bucket`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (res.status === 200) {
      const buckets = await res.json();
      pass(`service_role 키 유효 (버킷 ${Array.isArray(buckets) ? buckets.length : "?"}개)`);
    } else if (res.status === 401 || res.status === 403) {
      fail(`service_role 키 인증 실패 (HTTP ${res.status}) — 키를 다시 확인하세요`);
    } else {
      fail(`예상치 못한 응답 (HTTP ${res.status})`);
    }
  } catch (e) {
    fail(`Storage 연결 실패: ${e.message}`);
  }
}

async function main() {
  console.log("=== Supabase 연결 테스트 ===\n");
  checkEnv();
  if (failures > 0) {
    console.log("\n환경 변수에 문제가 있어 네트워크 테스트를 건너뜁니다.");
    process.exit(1);
  }
  await checkAuthHealth();
  await checkAnonKey();
  await checkStorageService();

  console.log("");
  if (failures === 0) {
    console.log("🎉 모든 연결 테스트 통과!");
    process.exit(0);
  } else {
    console.log(`⚠️  ${failures}개 항목 실패. 위 메시지를 확인하세요.`);
    process.exit(1);
  }
}

main();
