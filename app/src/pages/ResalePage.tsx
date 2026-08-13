import { useState } from "react";
import { T, type Lang } from "../i18n";
import { WAITLIST_MOCK } from "../mock/grades";
import type { MockTicket } from "../mock/tickets";
import { ConfirmModal } from "../components/ConfirmModal";
import { useIdentity } from "../context/IdentityContext";
import { useChainData } from "../context/ChainDataContext";
import { useSendTx } from "../lib/useSendTx";
import { getProgram } from "../lib/program";
import { executeResale } from "../lib/instructions";
import { shortAddr, toDisplayUnits } from "../lib/format";
import { useDemoEventData } from "../hooks/useDemoEventData";

interface ResalePageProps {
  lang: Lang;
  ticket: MockTicket | null;
  onBack: () => void;
  onResaleComplete: () => void;
}

interface QueueEntry {
  position: number;
  wallet: string;
  deposit: number;
}

function gradeFromSeat(seat: string): string {
  return seat[0] === "V" ? "VIP" : seat[0];
}

function sortedQueueFor(grade: string): QueueEntry[] {
  return (WAITLIST_MOCK[grade] ?? [])
    .filter((e) => !e.matched)
    .map((e, i) => ({ ...e, origIndex: i }))
    .sort((a, b) => b.deposit - a.deposit || a.origIndex - b.origIndex)
    .map((e, i) => ({ position: i + 1, wallet: e.wallet, deposit: e.deposit }));
}

export function ResalePage({ lang, ticket, onBack, onResaleComplete }: ResalePageProps) {
  const t = T[lang];
  const { selected } = useIdentity();
  const { refresh } = useChainData();
  const { send } = useSendTx();
  const { tiers: demoTiers } = useDemoEventData();

  const regGrade = ticket ? gradeFromSeat(ticket.seat) : null;
  // Present only for the real, devnet-backed demo event (ticket.demo set by
  // MyTicketsPage). Everything else stays on WAITLIST_MOCK, unwired.
  const demoTier = ticket?.demo
    ? demoTiers.find((dt) => dt.seatTier.equals(ticket.demo!.seatTier)) ?? null
    : null;

  // Local, mutable copy of the ticket's grade queue so the top entry can
  // animate out on resale.
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>(() => {
    if (demoTier) {
      const bq = demoTier.bidQueueAccount;
      return bq
        ? bq.bids.slice(0, bq.count).map((b, i) => ({
            position: i + 1,
            wallet: shortAddr(b.buyer),
            deposit: parseFloat(toDisplayUnits(BigInt(b.amount.toString()))),
          }))
        : [];
    }
    return regGrade ? sortedQueueFor(regGrade) : [];
  });
  const [removingTop, setRemovingTop] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [receiptTicket, setReceiptTicket] = useState<MockTicket | null>(null);

  const topBidder = queueEntries[0];
  const cap = ticket ? Math.round(ticket.price * 1.2) : 0;
  const overCap = !!(ticket && topBidder && topBidder.deposit > cap);
  const canResell = !!(ticket && topBidder && !overCap && !removingTop);

  let statusText = "";
  let statusClass = "bg-bg text-text-muted";
  if (ticket) {
    if (!topBidder) {
      statusText = t.resaleNoBidders;
      statusClass = "bg-bg text-text-muted";
    } else if (overCap) {
      statusText = t.resaleOverCap;
      statusClass = "bg-danger/10 text-danger";
    } else {
      statusText = t.resaleWithinCap;
      statusClass = "bg-brand-teal/10 text-brand-teal";
    }
  }

  function confirmResell() {
    if (!ticket || !topBidder) return;
    setConfirming(false);
    setRemovingTop(true);
    // Let the top-of-queue row play its exit animation before it actually
    // leaves the list and the receipt appears.
    window.setTimeout(async () => {
      if (demoTier && ticket.demo) {
        // Front-of-queue buyer is a real pubkey we already have from the bid
        // queue account fetched above (topBidder.wallet is shortened for
        // display, so re-read the raw buyer key here instead).
        const buyerPk = demoTier.bidQueueAccount?.bids[0]?.buyer;
        if (!buyerPk) {
          setRemovingTop(false);
          return;
        }
        const customerProgram = getProgram(selected.keypair);
        const r = await send(
          lang === "ko" ? `${ticket.seat} 재판매 체결` : `Execute resale for ${ticket.seat}`,
          () =>
            executeResale(
              customerProgram,
              selected.keypair,
              buyerPk,
              ticket.demo!.seatTier,
              ticket.demo!.seat,
              ticket.demo!.ticketMint,
              ticket.demo!.paymentMint,
            ),
        );
        setQueueEntries((prev) => prev.slice(1).map((e, i) => ({ ...e, position: i + 1 })));
        setRemovingTop(false);
        if (r.ok) {
          await refresh();
          setReceiptTicket({
            ...ticket,
            status: "재판매완료",
            resaleAmount: topBidder.deposit,
            resaleMatchedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
            resaleBuyerWallet: topBidder.wallet,
          });
        }
        return;
      }

      setQueueEntries((prev) => prev.slice(1).map((e, i) => ({ ...e, position: i + 1 })));
      setRemovingTop(false);
      setReceiptTicket({
        ...ticket,
        status: "재판매완료",
        resaleAmount: topBidder.deposit,
        resaleMatchedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        resaleBuyerWallet: topBidder.wallet,
      });
    }, 320);
  }

  function closeReceipt() {
    setReceiptTicket(null);
    onResaleComplete();
    onBack();
  }

  const waitingCountText = `${queueEntries.length}${t.waitlistWaitingLabel}`;

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-12">
      <button
        onClick={onBack}
        className="mb-5 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-text-muted"
      >
        {t.backToTickets}
      </button>
      <div className="mb-7">
        <h1 className="m-0 mb-1.5 text-[28px] font-bold tracking-tight text-text">{t.resaleTitle}</h1>
        <p className="m-0 text-sm text-text-muted">{t.resaleSub}</p>
      </div>

      {!ticket ? (
        <div className="max-w-[560px] py-6 text-[13px] text-text-faint">{t.noResaleTicketSelected}</div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-8">
          {/* left: live queue status for this ticket's grade */}
          <div>
            <div className="mb-3.5 text-[15px] font-bold text-text">{t.waitlistStatusTitle}</div>
            <div className="mb-3.5 text-[13px] text-text-muted">{waitingCountText}</div>
            <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
              {queueEntries.map((e, i) => {
                const isTop = i === 0;
                const fading = isTop && removingTop;
                return (
                  <div
                    key={`${e.wallet}-${e.position}`}
                    className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 transition-all duration-300 ease-in ${
                      fading ? "scale-95 opacity-0" : "opacity-100"
                    } ${
                      isTop
                        ? "border-brand-teal bg-brand-teal/[0.08] ring-1 ring-brand-teal"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-bg text-xs font-bold text-text-muted">
                        {e.position}
                      </div>
                      <div>
                        <div className="font-mono text-[13px] text-text">{e.wallet}</div>
                        <div className="mt-0.5 text-[11px] text-text-muted">{e.deposit} USDC</div>
                      </div>
                    </div>
                    {isTop && (
                      <div className="rounded-md bg-brand-teal/[0.14] px-2 py-0.5 text-[11px] font-bold text-brand-teal">
                        {t.nextMatchBadge}
                      </div>
                    )}
                  </div>
                );
              })}
              {queueEntries.length === 0 && (
                <div className="py-6 text-[13px] text-text-faint">{t.resaleNoBidders}</div>
              )}
            </div>
          </div>

          {/* right: register form */}
          <div>
            <div className="mb-1 text-lg font-bold text-text">{ticket.eventTitle}</div>
            <div className="mb-5 text-[13px] text-text-muted">
              {t.seatLabel} {ticket.seat}
            </div>

            <div className="mb-6 flex gap-6 rounded-xl border border-border bg-surface px-[18px] py-4">
              <div>
                <div className="mb-1 text-[11px] text-text-muted">{t.faceValue}</div>
                <div className="text-[15px] font-bold text-text">{ticket.price} USDC</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-text-muted">{t.cap}</div>
                <div className="text-[15px] font-bold text-text">+20%</div>
                <div className="text-[11px] text-text-faint">
                  {lang === "ko" ? "대한민국 (KOR)" : "South Korea (KOR)"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-text-muted">{t.maxResale}</div>
                <div className="text-[15px] font-bold text-brand-teal">{cap} USDC</div>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-border bg-bg px-[18px] py-4">
              <div className="mb-1 text-xs text-text-muted">{t.topBidderLabel}</div>
              <div className="text-xl font-bold text-text">{topBidder ? `${topBidder.deposit} USDC` : "—"}</div>
            </div>

            <div className={`mb-5 rounded-[10px] px-4 py-3 text-[13px] font-bold ${statusClass}`}>{statusText}</div>

            <button
              onClick={() => setConfirming(true)}
              disabled={!canResell}
              className={`w-full rounded-xl py-3.5 text-center text-[15px] font-bold ${
                canResell ? "bg-brand-teal text-[#0c1214]" : "cursor-not-allowed bg-border text-text-faint"
              }`}
            >
              {t.resellNowBtn}
            </button>
          </div>
        </div>
      )}
      {confirming && ticket && topBidder && (
        <ConfirmModal
          title={t.resaleConfirmTitle}
          lines={[
            lang === "ko"
              ? `${ticket.seat}를 ${topBidder.deposit} USDC에 재판매하시겠습니까?`
              : `Resell ${ticket.seat} for ${topBidder.deposit} USDC?`,
          ]}
          yesLabel={t.confirmYes}
          noLabel={t.confirmNo}
          onYes={confirmResell}
          onNo={() => setConfirming(false)}
        />
      )}

      {receiptTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-[420px] rounded-2xl bg-surface p-7 shadow-2xl">
            <div className="mb-1.5 text-lg font-bold text-text">{t.resaleReceiptTitle}</div>
            <div className="mb-5 text-[13px] text-text-muted">
              {receiptTicket.eventTitle} · {t.seatLabel} {receiptTicket.seat}
            </div>
            <div className="mb-6 flex flex-col gap-2.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">{t.resaleReceiptAmount}</span>
                <span className="font-bold text-text">{receiptTicket.resaleAmount} USDC</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">{t.resaleReceiptAt}</span>
                <span className="text-text">{receiptTicket.resaleMatchedAt}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">{t.resaleReceiptBuyer}</span>
                <span className="font-mono text-text">{receiptTicket.resaleBuyerWallet}</span>
              </div>
            </div>
            <button
              onClick={closeReceipt}
              className="w-full rounded-xl bg-brand-teal py-3.5 text-center text-[15px] font-bold text-[#0c1214]"
            >
              {t.resaleReceiptOk}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
