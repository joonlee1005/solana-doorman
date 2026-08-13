import { useMemo, useState } from "react";
import { T, type Lang } from "../i18n";
import { MY_WALLET_MOCK, WAITLIST_MOCK } from "../mock/grades";
import { RAW_EVENTS } from "../mock/events";
import {
  MOCK_QUEUE_REGISTRATIONS,
  MOCK_TICKETS,
  type MockQueueRegistration,
  type MockTicket,
  type TicketStatus,
} from "../mock/tickets";
import { useMockToast } from "../hooks/useMockToast";
import { MockToast } from "../components/MockToast";
import { ConfirmModal } from "../components/ConfirmModal";
import { useIdentity } from "../context/IdentityContext";
import { useChainData } from "../context/ChainDataContext";
import { useSendTx } from "../lib/useSendTx";
import { getProgram } from "../lib/program";
import { leaveQueue } from "../lib/instructions";
import { getStoredPaymentMint } from "../lib/paymentMint";
import { shortAddr, toDisplayUnits } from "../lib/format";
import { DEMO_EVENT_RAW_IDX } from "../lib/demoEvent";
import { useDemoEventData } from "../hooks/useDemoEventData";

interface MyTicketsPageProps {
  lang: Lang;
  onResell: (ticket: MockTicket) => void;
}

const STATUS_STYLE: Record<TicketStatus, { text: string; bg: string }> = {
  보유중: { text: "text-brand-teal", bg: "bg-brand-teal/[0.14]" },
  재판매완료: { text: "text-grade-r", bg: "bg-grade-r/[0.14]" },
  체크인완료: { text: "text-grade-s", bg: "bg-grade-s/[0.14]" },
  환불됨: { text: "text-text-faint", bg: "bg-transparent" },
};

type ConfirmState =
  | { type: "refund" }
  | { type: "cancelQueue"; regId: string }
  | { type: "transfer" }
  | null;

export function MyTicketsPage({ lang, onResell }: MyTicketsPageProps) {
  const t = T[lang];
  const { toast, showToast } = useMockToast();

  function statusLabel(status: TicketStatus): string {
    switch (status) {
      case "보유중":
        return t.statusHeld;
      case "재판매완료":
        return t.statusReselling;
      case "체크인완료":
        return t.statusCheckedIn;
      case "환불됨":
        return t.statusRefunded;
    }
  }

  const { selected } = useIdentity();
  const { refresh } = useChainData();
  const { send } = useSendTx();
  const { tiers: demoTiers } = useDemoEventData();
  const paymentMint = getStoredPaymentMint();
  const demoEventTitle = RAW_EVENTS[DEMO_EVENT_RAW_IDX].title;

  const [view, setView] = useState<"held" | "queue">("held");
  const [tickets, setTickets] = useState<MockTicket[]>(MOCK_TICKETS);
  const [queueRegs, setQueueRegs] = useState<MockQueueRegistration[]>(MOCK_QUEUE_REGISTRATIONS);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(tickets[0]?.id ?? null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAddress, setTransferAddress] = useState("");
  const [resaleReceiptTicketId, setResaleReceiptTicketId] = useState<string | null>(null);
  const [queueDetailRegId, setQueueDetailRegId] = useState<string | null>(null);

  // Tickets/queue registrations backed by the real, devnet-seeded demo event
  // (see lib/demoEvent.ts) — seats/bids owned by the currently selected
  // identity, read live from useChainData(). Merged alongside the 5 static
  // mock rows below so this page still works without a wallet, but reflects
  // real chain state for the one chain-backed event.
  const demoTickets = useMemo<MockTicket[]>(() => {
    if (!paymentMint) return [];
    const list: MockTicket[] = [];
    for (const tier of demoTiers) {
      for (const s of tier.seatsResolved) {
        const acc = s.account;
        if (!acc || !acc.owner.equals(selected.keypair.publicKey)) continue;
        if ("available" in acc.status) continue;
        const status: TicketStatus =
          "checkedIn" in acc.status ? "체크인완료" : "refunded" in acc.status ? "환불됨" : "보유중";
        list.push({
          id: `demo-${s.seat.toBase58()}`,
          eventTitle: demoEventTitle,
          seat: s.code,
          price: tier.price,
          purchasedAt: "-",
          status,
          txHash: shortAddr(s.seat),
          demo: { seatTier: tier.seatTier, seat: s.seat, ticketMint: tier.ticketMint, paymentMint },
        });
      }
    }
    return list;
  }, [demoTiers, selected, paymentMint, demoEventTitle]);

  const demoQueueRegs = useMemo<MockQueueRegistration[]>(() => {
    if (!paymentMint) return [];
    const list: MockQueueRegistration[] = [];
    for (const tier of demoTiers) {
      const bq = tier.bidQueueAccount;
      if (!bq) continue;
      bq.bids.slice(0, bq.count).forEach((bid, i) => {
        if (!bid.buyer.equals(selected.keypair.publicKey)) return;
        list.push({
          id: `demo-queue-${tier.seatTier.toBase58()}-${i}`,
          eventTitle: demoEventTitle,
          grade: tier.name,
          qty: 1,
          deposit: parseFloat(toDisplayUnits(BigInt(bid.amount.toString()))),
          position: i + 1,
          registeredAt: "-",
          demo: { seatTier: tier.seatTier, paymentMint },
        });
      });
    }
    return list;
  }, [demoTiers, selected, paymentMint, demoEventTitle]);

  const allTickets = useMemo(() => [...tickets, ...demoTickets], [tickets, demoTickets]);
  const allQueueRegs = useMemo(() => [...queueRegs, ...demoQueueRegs], [queueRegs, demoQueueRegs]);

  const ticketGroups = Object.values(
    allTickets.reduce<Record<string, { eventTitle: string; tickets: MockTicket[] }>>((acc, tk) => {
      (acc[tk.eventTitle] ??= { eventTitle: tk.eventTitle, tickets: [] }).tickets.push(tk);
      return acc;
    }, {}),
  );

  const selectedTicket = allTickets.find((tk) => tk.id === selectedTicketId) ?? null;
  const isDemoTicket = !!selectedTicket?.demo;
  const canAct = !!selectedTicket && selectedTicket.status === "보유중";
  // Refund/transfer aren't wired to the demo event yet (out of today's scope);
  // resale is, via ResalePage's executeResale().
  const canRefundOrTransfer = canAct && !isDemoTicket;
  const resaleReceiptTicket = allTickets.find((tk) => tk.id === resaleReceiptTicketId) ?? null;

  function requestRefund() {
    if (!canRefundOrTransfer) return;
    setConfirmModal({ type: "refund" });
  }

  function requestTransfer() {
    if (!canRefundOrTransfer) return;
    setTransferAddress("");
    setTransferModalOpen(true);
  }

  function requestResell() {
    if (!canAct || !selectedTicket) return;
    onResell(selectedTicket);
  }

  async function handleConfirmYes() {
    if (!confirmModal) return;
    if (confirmModal.type === "refund") {
      // TODO: connect refundTicket() from lib/instructions.ts (mock-only path;
      // demo-event refunds aren't wired yet, see canRefundOrTransfer above)
      setTickets((prev) =>
        prev.map((tk) => (tk.id === selectedTicketId ? { ...tk, status: "환불됨" as const } : tk)),
      );
      showToast(t.refundedToast, "success");
    } else if (confirmModal.type === "cancelQueue") {
      const reg = allQueueRegs.find((r) => r.id === confirmModal.regId);
      if (reg?.demo) {
        const customerProgram = getProgram(selected.keypair);
        const r = await send(
          lang === "ko" ? `${reg.grade}석 대기열 취소` : `Leave ${reg.grade} waitlist`,
          () => leaveQueue(customerProgram, selected.keypair, reg.demo!.seatTier, reg.demo!.paymentMint),
        );
        if (r.ok) {
          await refresh();
          showToast(
            lang === "ko"
              ? `예치한 ${reg.deposit} USDC가 환급되었습니다`
              : `${reg.deposit} USDC deposit refunded`,
            "success",
          );
        }
      } else {
        setQueueRegs((prev) => prev.filter((r) => r.id !== confirmModal.regId));
        if (reg) {
          showToast(
            lang === "ko"
              ? `예치한 ${reg.deposit} USDC가 환급되었습니다`
              : `${reg.deposit} USDC deposit refunded`,
            "success",
          );
        }
      }
    } else if (confirmModal.type === "transfer") {
      // TODO: connect a real ticket-transfer instruction once one exists
      setTransferModalOpen(false);
      setTransferAddress("");
      showToast(t.transferRequestedToast, "success");
    }
    setConfirmModal(null);
  }

  function handleConfirmNo() {
    if (confirmModal?.type === "transfer") setTransferModalOpen(true);
    setConfirmModal(null);
  }

  const queueDetailReg = allQueueRegs.find((r) => r.id === queueDetailRegId) ?? null;
  const queueDetailTier = queueDetailReg?.demo
    ? demoTiers.find((t) => t.seatTier.equals(queueDetailReg.demo!.seatTier)) ?? null
    : null;
  const queueDetailEntries = queueDetailReg
    ? queueDetailTier
      ? (queueDetailTier.bidQueueAccount
          ? queueDetailTier.bidQueueAccount.bids
              .slice(0, queueDetailTier.bidQueueAccount.count)
              .map((b, i) => ({
                position: i + 1,
                wallet: shortAddr(b.buyer),
                deposit: parseFloat(toDisplayUnits(BigInt(b.amount.toString()))),
                isMine: b.buyer.equals(selected.keypair.publicKey),
              }))
          : [])
      : (WAITLIST_MOCK[queueDetailReg.grade] ?? [])
          .filter((e) => !e.matched)
          .map((e, i) => ({ ...e, origIndex: i }))
          .sort((a, b) => b.deposit - a.deposit || a.origIndex - b.origIndex)
          .map((e, i) => ({
            position: i + 1,
            wallet: e.wallet,
            deposit: e.deposit,
            isMine: e.wallet === MY_WALLET_MOCK,
          }))
    : [];

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-12">
      <div className="mb-8">
        <h1 className="m-0 mb-1.5 text-[28px] font-bold tracking-tight text-text">{t.ticketsTitle}</h1>
        <p className="m-0 text-sm text-text-muted">{t.ticketsSub}</p>
      </div>

      <div className="mb-7 flex justify-center">
        <div className="flex gap-0.5 rounded-[10px] border border-border bg-surface p-1">
          <button
            onClick={() => setView("held")}
            className={`rounded-lg px-[18px] py-2 text-[13px] font-bold transition ${
              view === "held" ? "bg-brand-teal text-[#0c1214]" : "text-text-muted"
            }`}
          >
            {t.ticketsViewHeld}
          </button>
          <button
            onClick={() => setView("queue")}
            className={`rounded-lg px-[18px] py-2 text-[13px] font-bold transition ${
              view === "queue" ? "bg-brand-teal text-[#0c1214]" : "text-text-muted"
            }`}
          >
            {t.ticketsViewQueue}
          </button>
        </div>
      </div>

      {view === "held" ? (
        <div className="grid grid-cols-[1fr_380px] items-start gap-7">
          <div className="flex flex-col gap-6">
            {ticketGroups.map((group) => (
              <div key={group.eventTitle}>
                <div className="mb-2.5 flex items-center gap-2 border-b border-border pb-2.5">
                  <div className="text-base font-bold text-text">{group.eventTitle}</div>
                  {group.tickets.length > 1 && (
                    <div className="rounded-md bg-brand-teal/[0.12] px-2 py-0.5 text-[11px] font-bold text-brand-teal">
                      {lang === "ko" ? `${group.tickets.length}장` : `×${group.tickets.length}`}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {group.tickets.map((tk) => {
                    const st = STATUS_STYLE[tk.status];
                    const selected = tk.id === selectedTicketId;
                    return (
                      <div
                        key={tk.id}
                        onClick={() => setSelectedTicketId(tk.id)}
                        className={`cursor-pointer rounded-xl border bg-surface px-[18px] py-4 transition ${
                          selected ? "border-brand-teal" : "border-border"
                        }`}
                      >
                        <div className="mb-2.5 flex items-center justify-between">
                          <div
                            className={`text-sm font-bold ${tk.status === "보유중" ? "text-text" : "text-text-muted"}`}
                          >
                            {t.seatLabel} {tk.seat}
                          </div>
                          <div className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${st.bg} ${st.text}`}>
                            {statusLabel(tk.status)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div
                            className={`flex gap-4.5 text-[13px] ${tk.status === "보유중" ? "text-text" : "text-text-muted"}`}
                          >
                            <div>{tk.price} USDC</div>
                            <div>{tk.purchasedAt}</div>
                          </div>
                          {tk.status === "재판매완료" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResaleReceiptTicketId(tk.id);
                              }}
                              className="whitespace-nowrap rounded-lg border border-header-surface-2 px-3 py-1.5 text-xs font-bold text-text"
                            >
                              {t.viewResaleReceiptBtn}
                            </button>
                          )}
                          {tk.status === "보유중" && (
                            // Each held ticket resells independently — this button
                            // starts a resale for exactly this seat, not the group.
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onResell(tk);
                              }}
                              className="whitespace-nowrap rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-bold text-[#0c1214]"
                            >
                              {t.resellBtn}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {selectedTicket && (
            <div className="sticky top-24 rounded-xl border border-border bg-surface p-6">
              <div
                className={`mb-3.5 inline-block rounded-md px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[selectedTicket.status].bg} ${STATUS_STYLE[selectedTicket.status].text}`}
              >
                {statusLabel(selectedTicket.status)}
              </div>
              <div className="mb-1 text-lg font-bold text-text">{selectedTicket.eventTitle}</div>
              <div
                className={`mb-5 text-[13px] ${selectedTicket.status === "보유중" ? "text-text" : "text-text-muted"}`}
              >
                {t.seatLabel} {selectedTicket.seat}
              </div>
              <div className="mb-[18px] h-px bg-border" />
              <div className="mb-6 flex flex-col gap-2.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-muted">{t.payAmount}</span>
                  <span className="font-bold text-text">{selectedTicket.price} USDC</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-muted">{t.payDate}</span>
                  <span className="text-text">{selectedTicket.purchasedAt}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-muted">{t.payMethod}</span>
                  <span className="text-text">USDC (Solana)</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-muted">{t.txLabel}</span>
                  <span className="font-mono text-text">{selectedTicket.txHash}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={requestRefund}
                  disabled={!canRefundOrTransfer}
                  className={`rounded-xl border py-3 text-center text-sm font-bold ${
                    canRefundOrTransfer
                      ? "border-[#d1d5db] text-text"
                      : "cursor-not-allowed border-border text-text-faint"
                  }`}
                >
                  {t.refundBtn}
                </button>
                <button
                  onClick={requestResell}
                  disabled={!canAct}
                  className={`rounded-xl py-3 text-center text-sm font-bold ${
                    canAct ? "bg-brand-teal text-[#0c1214]" : "cursor-not-allowed bg-border text-text-faint"
                  }`}
                >
                  {t.resellBtn}
                </button>
                <button
                  onClick={requestTransfer}
                  disabled={!canRefundOrTransfer}
                  className={`rounded-xl border py-3 text-center text-sm font-bold ${
                    canRefundOrTransfer
                      ? "border-header-surface-2 text-text"
                      : "cursor-not-allowed border-border text-text-faint"
                  }`}
                >
                  {t.transferBtn}
                </button>
                {isDemoTicket && (
                  <div className="text-center text-[11px] text-text-faint">
                    {lang === "ko"
                      ? "데모 이벤트는 재판매만 지원합니다 (환불/전송 제외)"
                      : "The demo event only supports resale for now (no refund/transfer)"}
                  </div>
                )}
                {selectedTicket.status === "재판매완료" && (
                  <button
                    onClick={() => setResaleReceiptTicketId(selectedTicket.id)}
                    className="rounded-xl border border-header-surface-2 py-3 text-center text-sm font-bold text-text"
                  >
                    {t.viewResaleReceiptBtn}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex max-w-[640px] flex-col gap-3">
          {allQueueRegs.map((reg) => (
            <div key={reg.id} className="rounded-xl border border-border bg-surface px-[18px] py-4">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-[15px] font-bold text-text">{reg.eventTitle}</div>
                <div
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    reg.matched ? "bg-success/[0.12] text-success" : "bg-brand-teal/[0.12] text-brand-teal"
                  }`}
                >
                  {reg.matched ? t.queueMatchedBadge : lang === "ko" ? `대기 ${reg.position}번` : `#${reg.position} in line`}
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-4.5 text-[13px] text-text-muted">
                <div>
                  {t.queueCardGrade} {reg.grade}
                </div>
                <div>
                  {t.queueCardQty} {reg.qty}
                </div>
                <div>
                  <div>
                    {t.queueCardDeposit} {reg.deposit} USDC
                  </div>
                  {reg.matched && (
                    <div className="mt-0.5 font-bold text-success">
                      {lang === "ko" ? `구매금액 ${reg.deposit} USDC` : `Paid ${reg.deposit} USDC`}
                    </div>
                  )}
                </div>
                <div>
                  <div>{reg.registeredAt}</div>
                  {reg.matched && (
                    <div className="mt-0.5 font-bold text-success">
                      {lang === "ko" ? `${reg.matchedAt} 체결` : `Matched ${reg.matchedAt}`}
                    </div>
                  )}
                </div>
              </div>
              {!reg.matched && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmModal({ type: "cancelQueue", regId: reg.id })}
                    className="rounded-lg border border-[#d1d5db] px-3.5 py-2 text-xs font-bold text-text"
                  >
                    {t.queueCancelBtn}
                  </button>
                  <button
                    onClick={() => setQueueDetailRegId(reg.id)}
                    className="rounded-lg border border-brand-teal px-3.5 py-2 text-xs font-bold text-brand-teal"
                  >
                    {t.queueViewBtn}
                  </button>
                </div>
              )}
            </div>
          ))}
          {allQueueRegs.length === 0 && (
            <div className="py-6 text-[13px] text-text-faint">{t.queueNoRegs}</div>
          )}
        </div>
      )}

      {queueDetailReg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setQueueDetailRegId(null)}
        >
          <div
            className="max-h-[80vh] w-[90%] max-w-[420px] overflow-hidden rounded-2xl bg-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="text-base font-bold text-text">{t.waitlistStatusTitle}</div>
              <button onClick={() => setQueueDetailRegId(null)} className="text-lg leading-none text-text-muted">
                ×
              </button>
            </div>
            <div className="mb-3.5 text-xs text-text-muted">
              {lang === "ko"
                ? `${queueDetailReg.eventTitle} · ${queueDetailReg.grade}석`
                : `${queueDetailReg.eventTitle} · ${queueDetailReg.grade}`}
            </div>
            <div className="flex max-h-[340px] flex-col gap-2 overflow-y-auto">
              {queueDetailEntries.map((e) => (
                <div
                  key={e.wallet + e.position}
                  className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 ${
                    e.isMine
                      ? "sticky top-0 z-[5] border-[#2563eb] border-l-4 bg-[#e0ecfb]"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-text-muted">
                      {e.position}
                    </div>
                    <div>
                      <div className="font-mono text-[13px] text-text">
                        {e.wallet}
                        {e.isMine && <> · {t.queueMyEntry}</>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-muted">{e.deposit} USDC</div>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-text-faint">{t.statusWaiting}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {transferModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-[420px] rounded-2xl bg-surface p-7 shadow-2xl">
            <div className="mb-1.5 text-lg font-bold text-text">{t.transferTitle}</div>
            {selectedTicket && (
              <div className="mb-5 text-[13px] text-text-muted">
                {selectedTicket.eventTitle} · {t.seatLabel} {selectedTicket.seat}
              </div>
            )}
            <div className="mb-2 text-[13px] font-bold text-text-muted">{t.transferAddressLabel}</div>
            <div className="mb-5 rounded-xl border border-border bg-bg px-[18px] py-3.5">
              <input
                type="text"
                placeholder={t.transferAddressPlaceholder}
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                className="w-full bg-transparent font-mono text-sm text-text outline-none"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => transferAddress.trim() && setConfirmModal({ type: "transfer" })}
                disabled={!transferAddress.trim()}
                className={`flex-1 rounded-xl py-3.5 text-center text-[15px] font-bold ${
                  transferAddress.trim()
                    ? "bg-brand-teal text-[#0c1214]"
                    : "cursor-not-allowed bg-border text-text-faint"
                }`}
              >
                {t.transferSubmitBtn}
              </button>
              <button
                onClick={() => {
                  setTransferModalOpen(false);
                  setTransferAddress("");
                }}
                className="flex-1 rounded-xl border border-[#d1d5db] py-3.5 text-center text-[15px] font-bold text-text"
              >
                {t.confirmNo}
              </button>
            </div>
          </div>
        </div>
      )}

      {resaleReceiptTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-[90%] max-w-[420px] rounded-2xl bg-surface p-7 shadow-2xl">
            <div className="mb-1.5 text-lg font-bold text-text">{t.resaleReceiptTitle}</div>
            <div className="mb-5 text-[13px] text-text-muted">
              {resaleReceiptTicket.eventTitle} · {t.seatLabel} {resaleReceiptTicket.seat}
            </div>
            <div className="mb-6 flex flex-col gap-2.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">{t.resaleReceiptAmount}</span>
                <span className="font-bold text-text">{resaleReceiptTicket.resaleAmount} USDC</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">{t.resaleReceiptAt}</span>
                <span className="text-text">{resaleReceiptTicket.resaleMatchedAt}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-muted">{t.resaleReceiptBuyer}</span>
                <span className="font-mono text-text">{resaleReceiptTicket.resaleBuyerWallet}</span>
              </div>
            </div>
            <button
              onClick={() => setResaleReceiptTicketId(null)}
              className="w-full rounded-xl bg-brand-teal py-3.5 text-center text-[15px] font-bold text-[#0c1214]"
            >
              {t.resaleReceiptOk}
            </button>
          </div>
        </div>
      )}

      {confirmModal?.type === "refund" && selectedTicket && (
        <ConfirmModal
          title={lang === "ko" ? "환불하시겠습니까?" : "Confirm refund?"}
          lines={[
            lang === "ko"
              ? `${selectedTicket.eventTitle} · 좌석 ${selectedTicket.seat} · ${selectedTicket.price} USDC`
              : `${selectedTicket.eventTitle} · Seat ${selectedTicket.seat} · ${selectedTicket.price} USDC`,
          ]}
          yesLabel={t.confirmYes}
          noLabel={t.confirmNo}
          onYes={handleConfirmYes}
          onNo={handleConfirmNo}
        />
      )}
      {confirmModal?.type === "cancelQueue" &&
        (() => {
          const reg = allQueueRegs.find((r) => r.id === confirmModal.regId);
          if (!reg) return null;
          return (
            <ConfirmModal
              title={lang === "ko" ? "대기열 등록을 취소하시겠습니까?" : "Cancel this waitlist registration?"}
              lines={[
                lang === "ko"
                  ? `${reg.eventTitle} · ${reg.grade}석 ${reg.qty}매 · 예치금 ${reg.deposit} USDC`
                  : `${reg.eventTitle} · ${reg.grade} × ${reg.qty} · Deposit ${reg.deposit} USDC`,
              ]}
              yesLabel={t.confirmYes}
              noLabel={t.confirmNo}
              onYes={handleConfirmYes}
              onNo={handleConfirmNo}
            />
          );
        })()}
      {confirmModal?.type === "transfer" && selectedTicket && (
        <ConfirmModal
          title={lang === "ko" ? "이 지갑으로 티켓을 전송하시겠습니까?" : "Send this ticket to this wallet?"}
          lines={[
            lang === "ko"
              ? `${selectedTicket.eventTitle} · 좌석 ${selectedTicket.seat}`
              : `${selectedTicket.eventTitle} · Seat ${selectedTicket.seat}`,
            lang === "ko" ? `받는 주소: ${transferAddress}` : `Recipient: ${transferAddress}`,
          ]}
          yesLabel={t.confirmYes}
          noLabel={t.confirmNo}
          onYes={handleConfirmYes}
          onNo={handleConfirmNo}
        />
      )}

      <MockToast toast={toast} />
    </div>
  );
}
