import { useState, type FormEvent } from "react";
import { useCustomer } from "../../customer/CustomerContext";
import { ApiClientError } from "../../lib/api";

// 관리자가 태블릿 최초 설치 시 1회 수행하는 '체크인' 설정 화면.
// 성공 후에는 객실 인증 정보가 저장되어 자동 로그인(자동 체크인)된다.
export function SetupPage() {
  const { login } = useCustomer();
  const [storeCode, setStoreCode] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [tablePassword, setTablePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = Number(tableNumber);
    if (!storeCode.trim() || !tableNumber || !Number.isInteger(num) || num < 1) {
      setError("호텔 식별자와 객실 번호를 확인해 주세요.");
      return;
    }
    if (!tablePassword) {
      setError("객실 인증 키를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await login(storeCode.trim(), num, tablePassword);
      // 성공 시 CustomerProvider 가 객실 정보를 세팅 → 룸서비스 화면으로 자동 진입
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
      else setError("체크인에 실패했습니다. 설정을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-wrap">
      <form className="setup-card" onSubmit={onSubmit}>
        <div className="kicker">Nocturne Hotel</div>
        <h1>심야 체크인</h1>
        <p className="sub">
          객실 단말 최초 설정입니다. (프런트 전용)
          <br />
          체크인이 완료되면 이후에는 자동으로 룸서비스 화면이 열립니다.
        </p>

        {error && (
          <div className="c-error" role="alert">
            {error}
          </div>
        )}

        <div className="c-field">
          <label htmlFor="sc">호텔 식별자</label>
          <input id="sc" value={storeCode} onChange={(e) => setStoreCode(e.target.value)} placeholder="예: cafe" />
        </div>
        <div className="c-field">
          <label htmlFor="tn">객실 번호</label>
          <input id="tn" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} inputMode="numeric" placeholder="예: 1" />
        </div>
        <div className="c-field">
          <label htmlFor="tp">객실 인증 키</label>
          <input id="tp" type="password" value={tablePassword} onChange={(e) => setTablePassword(e.target.value)} />
        </div>

        <button className="cbtn cbtn-primary cbtn-block" type="submit" disabled={loading}>
          {loading ? "체크인 중…" : "체크인 완료"}
        </button>
      </form>
    </div>
  );
}
