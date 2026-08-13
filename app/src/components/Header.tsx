import { useEffect, useRef, useState } from "react";
import logo from "../assets/logo_doorman_transparent.png";
import { useIdentity } from "../context/IdentityContext";
import { formatSol, formatUsdcAmount, shortAddr } from "../lib/format";
import { identityLabel, type IdentityId } from "../lib/identities";
import { explorerTxUrl } from "../lib/explorer";
import { useResaleNotifications } from "../hooks/useResaleNotifications";
import { T, type Lang } from "../i18n";
import type { Screen } from "../screens";

interface HeaderProps {
  lang: Lang;
  onSetLang: (lang: Lang) => void;
  screen: Screen;
  onGoHome: () => void;
  onGoAdmin: () => void;
  onGoTickets: () => void;
}

export function Header({ lang, onSetLang, screen, onGoHome, onGoAdmin, onGoTickets }: HeaderProps) {
  const { identities, selectedId, setSelectedId, balances, usdcBalances, airdrop, airdropping } =
    useIdentity();
  const t = T[lang];

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [airdropError, setAirdropError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<IdentityId | null>(null);

  async function copyAddress(id: IdentityId, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // Clipboard API unavailable/denied — the full address is still visible via the tooltip.
    }
  }

  const { items: notifications, unreadCount, markAllRead } = useResaleNotifications();

  const settingsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (settingsRef.current && !settingsRef.current.contains(target)) setSettingsOpen(false);
      if (accountRef.current && !accountRef.current.contains(target)) setAccountOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = identities.find((i) => i.id === selectedId)!;
  const balance = balances[selectedId] ?? 0;

  return (
    <header className="sticky top-0 z-50 flex h-[72px] items-center justify-between gap-4 border-b border-header-border/70 bg-header-bg/60 px-8 backdrop-blur-md backdrop-saturate-150">
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="Doorman"
          className="h-[125px] w-[229px] cursor-pointer object-contain"
          onClick={onGoHome}
        />
      </div>

      <nav className="hidden items-center gap-7 md:flex">
        <button
          onClick={onGoHome}
          className={`text-sm font-semibold transition ${
            screen === "home" || screen === "detail"
              ? "text-brand-teal"
              : "text-header-text-muted hover:text-header-text"
          }`}
        >
          {t.navHome}
        </button>
        <button
          onClick={onGoAdmin}
          className={`text-sm font-semibold transition ${
            screen === "admin" ? "text-brand-teal" : "text-header-text-muted hover:text-header-text"
          }`}
        >
          Admin
        </button>
      </nav>

      <div className="flex items-center gap-4">
        {/* TODO: connect to a real test-USDC faucet instruction once one exists in lib/instructions.ts */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-header-border text-header-text-muted transition hover:border-header-surface-2 hover:text-header-text"
            aria-label={lang === "ko" ? "설정" : "Settings"}
          >
            ⚙
          </button>
          {settingsOpen && (
            <div className="absolute right-0 top-11 z-20 min-w-[200px] rounded-lg border border-header-surface-2 bg-header-surface-2 p-1.5 shadow-xl">
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-header-text hover:bg-header-surface"
              >
                {t.issueTestUsdc}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-0.5 rounded-lg bg-header-surface p-[3px]">
          <button
            onClick={() => onSetLang("ko")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              lang === "ko" ? "bg-brand-teal text-[#0c1214]" : "text-header-text-muted"
            }`}
          >
            KO
          </button>
          <button
            onClick={() => onSetLang("en")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              lang === "en" ? "bg-brand-teal text-[#0c1214]" : "text-header-text-muted"
            }`}
          >
            EN
          </button>
        </div>

        <div className="relative" ref={accountRef}>
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-header-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"></path>
            </svg>
            <span className="hidden sm:inline">
              {identityLabel(selected, lang)}
              <span className="ml-1 font-normal text-header-text-muted">
                · {formatUsdcAmount(usdcBalances[selectedId] ?? 0)}
              </span>
            </span>
          </button>
          {accountOpen && (
            <div className="absolute right-0 top-9 z-20 min-w-[220px] rounded-lg border border-border bg-surface p-1.5 shadow-xl">
              {identities.map((identity) => {
                const address = identity.keypair.publicKey.toBase58();
                return (
                  <div
                    key={identity.id}
                    onClick={() => {
                      setSelectedId(identity.id as IdentityId);
                      setAccountOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                      identity.id === selectedId
                        ? "bg-brand-teal/10 text-brand-teal"
                        : "text-text hover:bg-bg"
                    }`}
                  >
                    <span>{identityLabel(identity, lang)}</span>
                    <span className="flex items-center gap-1">
                      <span className="flex flex-col items-end gap-0.5">
                        <span
                          className="font-mono text-xs font-normal text-text-muted"
                          title={address}
                        >
                          {shortAddr(identity.keypair.publicKey)}
                        </span>
                        <span className="text-[11px] font-bold text-brand-teal">
                          {formatUsdcAmount(usdcBalances[identity.id] ?? 0)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void copyAddress(identity.id, address);
                        }}
                        className="shrink-0 rounded p-1 text-sm text-text-faint transition hover:bg-border hover:text-text"
                        aria-label={lang === "ko" ? "주소 복사" : "Copy address"}
                        title={lang === "ko" ? "전체 주소 복사" : "Copy full address"}
                      >
                        {copiedId === identity.id ? "✓" : "⧉"}
                      </button>
                    </span>
                  </div>
                );
              })}
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-border px-3 pt-2.5">
                <span className="text-xs text-text-muted">{formatSol(balance)}</span>
                <button
                  onClick={async () => {
                    setAirdropError(null);
                    try {
                      await airdrop(selectedId);
                    } catch (err) {
                      setAirdropError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                  disabled={airdropping === selectedId}
                  className="rounded-md bg-brand-teal px-2.5 py-1 text-xs font-semibold text-[#0c1214] transition hover:bg-brand-teal-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {airdropping === selectedId ? "지급 중…" : "SOL 받기"}
                </button>
              </div>
              {airdropError && (
                <div className="px-3 pt-1.5 text-[11px] leading-relaxed text-danger">{airdropError}</div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onGoTickets}
          className={`flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition ${
            screen === "tickets" ? "text-brand-teal" : "text-header-text hover:text-brand-teal"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"></path>
          </svg>
          <span className="hidden sm:inline">{t.navMyTickets}</span>
        </button>

        <div className="relative flex items-center" ref={notifRef}>
          <button
            onClick={() => {
              const next = !notifOpen;
              setNotifOpen(next);
              if (next) markAllRead();
            }}
            className="relative flex items-center text-header-text"
            aria-label={t.notifTitle}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-9 z-20 w-[340px] overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
              <div className="border-b border-border px-4 py-3.5 text-sm font-bold text-text">
                {t.notifTitle}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-text-faint">{t.notifEmpty}</div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.map((n) => (
                    <a
                      key={n.signature}
                      href={explorerTxUrl(n.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="block border-b border-border px-4 py-3 text-[13px] leading-relaxed text-text last:border-b-0 hover:bg-bg"
                    >
                      <div>
                        {lang === "ko"
                          ? `재판매가 체결되어 ${n.eventTitle} ${n.seatCode} 티켓을 받았습니다`
                          : `Resale matched — you received the ${n.eventTitle} ${n.seatCode} ticket`}
                      </div>
                      {n.blockTime && (
                        <div className="mt-1 text-[11px] text-text-faint">
                          {new Date(n.blockTime * 1000).toISOString().slice(0, 16).replace("T", " ")}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
