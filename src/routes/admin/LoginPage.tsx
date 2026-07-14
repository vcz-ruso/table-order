import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiClientError } from "../../lib/api";

const STORE_CODE_KEY = "to_admin_last_store";

export function LoginPage() {
  const { login, sessionMessage, clearSessionMessage, user } = useAuth();
  const navigate = useNavigate();
  const [storeCode, setStoreCode] = useState(() => localStorage.getItem(STORE_CODE_KEY) ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 이미 로그인된 경우 대시보드로
  if (user) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    clearSessionMessage();
    if (!storeCode.trim() || !username.trim() || !password) {
      setError("매장 식별자, 사용자명, 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await login(storeCode.trim(), username.trim(), password);
      localStorage.setItem(STORE_CODE_KEY, storeCode.trim());
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("로그인 처리 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>테이블오더 관리자</h1>
        <p className="sub">매장 관리 시스템에 로그인하세요.</p>

        {sessionMessage && <div className="form-error">{sessionMessage}</div>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="storeCode">매장 식별자</label>
          <input
            id="storeCode"
            list="recent-stores"
            value={storeCode}
            onChange={(e) => setStoreCode(e.target.value)}
            placeholder="예: cafe"
            autoComplete="off"
          />
          <datalist id="recent-stores">
            {localStorage.getItem(STORE_CODE_KEY) && (
              <option value={localStorage.getItem(STORE_CODE_KEY) as string} />
            )}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor="username">사용자명</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
