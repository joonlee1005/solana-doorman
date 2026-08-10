import { useEffect, useState } from "react";
import { IdentityProvider } from "./context/IdentityContext";
import { ActivityProvider } from "./context/ActivityContext";
import { ChainDataProvider, useChainData } from "./context/ChainDataContext";
import { Header } from "./components/Header";
import { ActivityToasts } from "./components/ActivityToasts";
import { AdminPage } from "./pages/AdminPage";
import { CustomerPage } from "./pages/CustomerPage";
import { ResalePage } from "./pages/ResalePage";

type Tab = "admin" | "customer" | "resale";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "admin", label: "관리자", hint: "이벤트 · 등급 · 좌석 생성" },
  { id: "customer", label: "고객", hint: "좌석 보기 · 구매" },
  { id: "resale", label: "재판매", hint: "대기줄 · 재판매 체결" },
];

function AppShell() {
  const [tab, setTab] = useState<Tab>("admin");
  const { refresh, loading } = useChainData();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <nav className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === t.id
                  ? "border-brand-teal text-text"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {t.label}
              <span className="ml-2 hidden text-xs text-text-muted sm:inline">{t.hint}</span>
            </button>
          ))}
          <button
            onClick={() => refresh()}
            className="ml-auto whitespace-nowrap px-3 py-3 text-xs text-text-muted hover:text-text"
            disabled={loading}
          >
            {loading ? "새로고침 중…" : "↻ 새로고침"}
          </button>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {tab === "admin" && <AdminPage />}
        {tab === "customer" && <CustomerPage />}
        {tab === "resale" && <ResalePage />}
      </main>

      <ActivityToasts />
    </div>
  );
}

function App() {
  return (
    <IdentityProvider>
      <ActivityProvider>
        <ChainDataProvider>
          <AppShell />
        </ChainDataProvider>
      </ActivityProvider>
    </IdentityProvider>
  );
}

export default App;
