import { CustomerProvider, useCustomer } from "../../customer/CustomerContext";
import { SetupPage } from "./SetupPage";
import { CustomerApp } from "./CustomerApp";
import "./customer.css";

function CustomerGate() {
  const { table } = useCustomer();
  // 저장된 테이블 토큰이 없으면 초기 설정, 있으면 자동 로그인되어 앱으로 진입
  return table ? <CustomerApp /> : <SetupPage />;
}

export function CustomerHome() {
  return (
    <CustomerProvider>
      <CustomerGate />
    </CustomerProvider>
  );
}
