import logo from "../assets/doorman-logo.png";
import { useIdentity } from "../context/IdentityContext";
import { formatSol, shortAddr } from "../lib/format";
import type { IdentityId } from "../lib/identities";

export function Header() {
  const { identities, selectedId, setSelectedId, balances, airdrop, airdropping } =
    useIdentity();
  const selected = identities.find((i) => i.id === selectedId)!;
  const balance = balances[selectedId] ?? 0;
  const isLow = balance < 100_000_000; // < 0.1 SOL

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="DOORMAN" className="h-7 w-auto" />
          <span className="hidden rounded-full border border-border px-2 py-0.5 text-xs font-medium text-text-muted sm:inline">
            devnet
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value as IdentityId)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-brand-teal"
          >
            {identities.map((identity) => (
              <option key={identity.id} value={identity.id}>
                {identity.label}
              </option>
            ))}
          </select>

          <span
            className={`hidden text-xs tabular-nums sm:inline ${isLow ? "text-danger" : "text-text-muted"}`}
            title={selected.keypair.publicKey.toBase58()}
          >
            {shortAddr(selected.keypair.publicKey)} · {formatSol(balance)}
          </span>

          <button
            onClick={() => airdrop(selectedId)}
            disabled={airdropping === selectedId}
            className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-[#05201d] transition hover:bg-brand-teal-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {airdropping === selectedId ? "지급 중…" : "SOL 받기"}
          </button>
        </div>
      </div>
    </header>
  );
}
