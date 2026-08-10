import { useMemo } from "react";
import { useIdentity } from "../context/IdentityContext";
import { useChainData } from "../context/ChainDataContext";
import { useSendTx } from "../lib/useSendTx";
import { getProgram } from "../lib/program";
import { buySeat } from "../lib/instructions";
import { formatUsdc, shortAddr } from "../lib/format";
import { resalePolicyLabel, seatStatusLabel } from "../lib/types";

const STATUS_COLOR: Record<string, string> = {
  available: "bg-status-available/20 text-status-available",
  sold: "bg-status-sold/20 text-status-sold",
  refunded: "bg-status-refunded/20 text-status-refunded",
  checkedIn: "bg-status-checkedin/20 text-status-checkedin",
};

function statusKey(status: object): string {
  return Object.keys(status)[0];
}

export function CustomerPage() {
  const { selected } = useIdentity();
  const { events, seatTiers, seats, selectedEvent, setSelectedEvent, selectedSeatTier, setSelectedSeatTier, refresh } =
    useChainData();
  const { send, pending } = useSendTx();
  const program = useMemo(() => getProgram(selected.keypair), [selected]);

  const tiersForEvent = seatTiers.filter(
    (t) => t.account.event.toBase58() === selectedEvent,
  );
  const tier = seatTiers.find((t) => t.publicKey.toBase58() === selectedSeatTier);
  const seatsForTier = seats.filter((s) => s.account.seatTier.toBase58() === selectedSeatTier);
  const event = events.find((e) => e.publicKey.toBase58() === selectedEvent);

  async function handleBuy(seatPk: string) {
    if (!event || !tier) return;
    const seat = seats.find((s) => s.publicKey.toBase58() === seatPk);
    if (!seat) return;
    const result = await send("좌석 구매", () =>
      buySeat(
        program,
        selected.keypair,
        event.publicKey,
        event.account.organizer,
        tier.publicKey,
        seat.publicKey,
        tier.account.ticketMint,
        tier.account.paymentMint,
      ),
    );
    if (result.ok) await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-text">이벤트 선택</h2>
        <div className="flex flex-wrap gap-2">
          {events.length === 0 && (
            <p className="text-sm text-text-muted">아직 생성된 이벤트가 없습니다.</p>
          )}
          {events.map((e) => (
            <button
              key={e.publicKey.toBase58()}
              onClick={() => {
                setSelectedEvent(e.publicKey.toBase58());
                setSelectedSeatTier(null);
              }}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                selectedEvent === e.publicKey.toBase58()
                  ? "border-brand-teal text-text"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              #{e.account.eventId.toString()} · {shortAddr(e.publicKey)}
            </button>
          ))}
        </div>
      </section>

      {event && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text">좌석 등급</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tiersForEvent.length === 0 && (
              <p className="text-sm text-text-muted">등급이 아직 없습니다.</p>
            )}
            {tiersForEvent.map((t) => (
              <button
                key={t.publicKey.toBase58()}
                onClick={() => setSelectedSeatTier(t.publicKey.toBase58())}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedSeatTier === t.publicKey.toBase58()
                    ? "border-brand-teal"
                    : "border-border hover:border-brand-teal/50"
                }`}
              >
                <p className="font-semibold text-text">{t.account.tierName}</p>
                <p className="text-sm text-text-muted">
                  {formatUsdc(BigInt(t.account.faceValue.toString()))}
                </p>
                <p className="text-xs text-text-muted">{resalePolicyLabel(t.account.resalePolicy)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {tier && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text">
            좌석 목록 — {tier.account.tierName}
          </h2>
          {seatsForTier.length === 0 ? (
            <p className="text-sm text-text-muted">아직 생성된 좌석이 없습니다.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {seatsForTier.map((s) => {
                const key = statusKey(s.account.status);
                const isAvailable = key === "available";
                return (
                  <div
                    key={s.publicKey.toBase58()}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-text">{s.account.displayName}</p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[key]}`}
                      >
                        {seatStatusLabel(s.account.status)}
                      </span>
                    </div>
                    {isAvailable && (
                      <button
                        className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-[#05201d] hover:bg-brand-teal-light disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={pending}
                        onClick={() => handleBuy(s.publicKey.toBase58())}
                      >
                        구매
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
