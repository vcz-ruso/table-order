import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiClientError, setSessionExpiredHandler, tokenStore } from "../lib/api";
import type { AuthUser } from "../lib/types";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** 강제 로그아웃(다른 기기 로그인/세션 만료) 안내 메시지 */
  sessionMessage: string | null;
  login: (storeCode: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSessionMessage: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => tokenStore.getUser());
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const mounted = useRef(true);

  // 강제 로그아웃 핸들러 등록 (api 클라이언트가 세션 무효화 감지 시 호출)
  useEffect(() => {
    setSessionExpiredHandler((message) => {
      if (!mounted.current) return;
      setUser(null);
      setSessionMessage(message);
    });
    return () => {
      mounted.current = false;
      setSessionExpiredHandler(null);
    };
  }, []);

  // 앱 로드 시 세션 복원 + 유효성 검증
  useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const { user: fresh } = await api.me();
        if (active) {
          tokenStore.setUser(fresh);
          setUser(fresh);
        }
      } catch (e) {
        // 세션 무효화/만료는 핸들러가 처리. 그 외 네트워크 오류는 저장된 사용자 유지.
        if (e instanceof ApiClientError && (e.code === "NETWORK" || e.code === "INTERNAL")) {
          // 오프라인 등 — 낙관적으로 저장된 세션 유지
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (storeCode: string, username: string, password: string) => {
    const session = await api.login(storeCode, username, password);
    tokenStore.setSession(session);
    setUser(session.user);
    setSessionMessage(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // 서버 오류가 있어도 로컬 세션은 정리
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, sessionMessage, login, logout, clearSessionMessage }),
    [user, loading, sessionMessage, login, logout, clearSessionMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 내부에서만 사용할 수 있습니다.");
  return ctx;
}
