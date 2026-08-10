import { useMemo, useState } from "react";
import { useIdentity } from "../context/IdentityContext";
import { useChainData } from "../context/ChainDataContext";
import { useSendTx } from "../lib/useSendTx";
import { getProgram } from "../lib/program";
import { joinQueue, leaveQueue, executeResale } from "../lib/instructions";
import { formatUsdc, shortAddr, toBaseUnits } from "../lib/format";
import { resalePolicyCapBps, resalePolicyLabel } from "../lib/types";

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-brand-teal";
const buttonClass =
  "rounded-lg bg-brand-teal px-3 py-2 text-sm font-semibold text-[#05201d] transition hover:bg-brand-teal-light disabled:cursor-not-allowed disabled:opacity-50";

export function ResalePage() {
  const { selected } = useIdentity();
  const { seatTiers, seats, bidQueues, selectedEvent, selectedSeatTier, setSelectedSeatTier, refresh } =
    useChainData();
  const { send, pending } = useSendTx();
  const program = useMemo(() => getProgram(selected.keypair), [selected]);

  const [bidAmount, setBidAmount] = useState("10");
  const [rejected, setRejected] = useState(false);

  const tiersForEvent = seatTiers.filter((t) => t.account.event.toBase58() === selectedEvent);
  const tier = seatTiers.find((t) => t.publicKey.toBase58() === selectedSeatTier);
  const queue = bidQueues.find((q) => q.account.seatTier.toBase58() === selectedSeatTier);
  const bids = queue ? queue.account.bids.slice(0, queue.account.count) : [];
  const front = bids[0];

  const mySeats = seats.filter(
    (s) =>
      s.account.seatTier.toBase58() === selectedSeatTier &&
      "sold" in s.account.status &&
      s.account.owner.equals(selected.keypair.publicKey),
  );
  const myBid = bids.find((b) => b.buyer.equals(selected.keypair.publicKey));

  const capBps = tier ? resalePolicyCapBps(tier.account.resalePolicy) : null;
  const capAmount =
    tier && capBps !== null
      ? (BigInt(tier.account.faceValue.toString()) * BigInt(capBps)) / 10_000n
      : null;

  async function handleJoinQueue() {
    if (!tier) return;
    setRejected(false);
    const result = await send("대기줄 참여", () =>
      joinQueue(program, selected.keypair, tier.publicKey, tier.account.paymentMint, toBaseUnits(bidAmount)),
    );
    if (result.ok) {
      await refresh();
    } else if (result.error?.code === "BidExceedsCap") {
      setRejected(true);
      setTimeout(() => setRejected(false), 600);
    }
  }

  async function handleLeaveQueue() {
    if (!tier) return;
    const result = await send("대기줄 이탈", () =>
      leaveQueue(program, selected.keypair, tier.publicKey, tier.account.paymentMint),
    );
    if (result.ok) await refresh();
  }

  async function handleExecuteResale(seatPk: string) {
    if (!tier || !front) return;
    const seat = seats.find((s) => s.publicKey.toBase58() === seatPk);
    if (!seat) return;
    setRejected(false);
    const result = await send("재판매 체결", () =>
      executeResale(
        program,
        selected.keypair,
        front.buyer,
        tier.publicKey,
        seat.publicKey,
        tier.account.ticketMint,
        tier.account.paymentMint,
      ),
    );
    if (result.ok) {
      await refresh();
    } else if (
      result.error?.code === "ResalePriceExceedsCap" ||
      result.error?.code === "QueueEmpty"
    ) {
      setRejected(true);
      setTimeout(() => setRejected(false), 600);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-text">좌석 등급 선택</h2>
        <div className="flex flex-wrap gap-2">
          {tiersForEvent.length === 0 && (
            <p className="text-sm text-text-muted">먼저 고객 탭에서 이벤트를 선택하세요.</p>
          )}
          {tiersForEvent.map((t) => (
            <button
              key={t.publicKey.toBase58()}
              onClick={() => setSelectedSeatTier(t.publicKey.toBase58())}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                selectedSeatTier === t.publicKey.toBase58()
                  ? "border-brand-teal text-text"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              {t.account.tierName}
            </button>
          ))}
        </div>
      </section>

      {tier && (
        <>
          <section
            className={`rounded-xl border p-4 ${rejected ? "animate-shake border-danger" : "border-border"} bg-surface`}
          >
            <h2 className="mb-1 text-sm font-semibold text-text">
              {tier.account.tierName} · {resalePolicyLabel(tier.account.resalePolicy)}
            </h2>
            {capAmount !== null && (
              <p className="mb-3 text-xs text-text-muted">
                재판매 상한: {formatUsdc(capAmount)} (정가의 {(Number(capBps) / 100).toFixed(1)}%)
              </p>
            )}
            {capBps === null && (
              <p className="mb-3 text-xs text-danger">이 등급은 재판매가 불가능합니다.</p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="mb-1 text-xs text-text-muted">입찰가 (USDC)</p>
                <input
                  className={inputClass}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                />
              </div>
              <button
                className={buttonClass}
                disabled={pending || capBps === null || !!myBid}
                onClick={handleJoinQueue}
              >
                대기줄 참여
              </button>
              {myBid && (
                <button
                  className="rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-surface-hover"
                  disabled={pending}
                  onClick={handleLeaveQueue}
                >
                  대기줄 이탈
                </button>
              )}
            </div>
            {rejected && (
              <p className="mt-2 text-sm font-semibold text-danger">
                ⛔ 재판매 상한을 초과하여 프로그램이 트랜잭션을 거부했습니다.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text">
              대기줄 ({bids.length}/{queue?.account.bids.length ?? 20})
            </h2>
            {bids.length === 0 ? (
              <p className="text-sm text-text-muted">대기 중인 입찰이 없습니다.</p>
            ) : (
              <ol className="flex flex-col gap-1">
                {bids.map((b, i) => (
                  <li
                    key={`${b.buyer.toBase58()}-${i}`}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      i === 0 ? "border-brand-teal text-text" : "border-border text-text-muted"
                    }`}
                  >
                    <span>
                      {i === 0 ? "맨 앞" : `${i + 1}번째`} · {shortAddr(b.buyer)}
                    </span>
                    <span>{formatUsdc(BigInt(b.amount.toString()))}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text">내 좌석 재판매</h2>
            {mySeats.length === 0 ? (
              <p className="text-sm text-text-muted">
                현재 선택된 지갑({shortAddr(selected.keypair.publicKey)})이 이 등급에서 보유한 좌석이
                없습니다.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {mySeats.map((s) => (
                  <li
                    key={s.publicKey.toBase58()}
                    className="flex items-center justify-between rounded-lg border border-border p-2"
                  >
                    <span className="text-sm text-text">{s.account.displayName}</span>
                    <button
                      className={buttonClass}
                      disabled={pending || !front}
                      onClick={() => handleExecuteResale(s.publicKey.toBase58())}
                    >
                      맨 앞 구매자에게 재판매 체결
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
