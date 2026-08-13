import { useEffect, useState } from "react";
import { IdentityProvider } from "./context/IdentityContext";
import { ActivityProvider } from "./context/ActivityContext";
import { ChainDataProvider, useChainData } from "./context/ChainDataContext";
import { Header } from "./components/Header";
import { ActivityToasts } from "./components/ActivityToasts";
import { HomePage } from "./pages/HomePage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";
import { ResalePage } from "./pages/ResalePage";
import { AdminPage } from "./pages/AdminPage";
import type { Lang } from "./i18n";
import type { Screen } from "./screens";
import type { MockTicket } from "./mock/tickets";

function AppShell() {
  const [screen, setScreen] = useState<Screen>("home");
  const [lang, setLang] = useState<Lang>("ko");
  const [selectedEventIdx, setSelectedEventIdx] = useState<number | null>(null);
  const [resellTicket, setResellTicket] = useState<MockTicket | null>(null);
  const { refresh, loading } = useChainData();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToDetail(eventIdx: number) {
    setSelectedEventIdx(eventIdx);
    setScreen("detail");
  }

  function goToResell(ticket: MockTicket) {
    setResellTicket(ticket);
    setScreen("resale");
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Header
        lang={lang}
        onSetLang={setLang}
        screen={screen}
        onGoHome={() => setScreen("home")}
        onGoAdmin={() => setScreen("admin")}
        onGoTickets={() => setScreen("tickets")}
      />

      <div className="flex-1">
        {screen === "home" && <HomePage lang={lang} onSelectEvent={goToDetail} />}
        {screen === "detail" && selectedEventIdx !== null && (
          <EventDetailPage lang={lang} eventIdx={selectedEventIdx} onBack={() => setScreen("home")} />
        )}
        {screen === "tickets" && <MyTicketsPage lang={lang} onResell={goToResell} />}
        {screen === "resale" && (
          <ResalePage
            lang={lang}
            ticket={resellTicket}
            onBack={() => setScreen("tickets")}
            onResaleComplete={() => setResellTicket(null)}
          />
        )}
        {screen === "admin" && <AdminPage lang={lang} />}
      </div>

      <button
        onClick={() => refresh()}
        disabled={loading}
        className="fixed bottom-4 left-4 z-40 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-muted shadow-sm hover:text-text"
      >
        {loading ? "새로고침 중…" : "↻ 새로고침"}
      </button>

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
