import { useState } from "react";
import { T, localizeDate, type Lang } from "../i18n";
import { GRADE_DOT_BG } from "../mock/grades";
import { RAW_EVENTS } from "../mock/events";
import { MOCK_TICKETS } from "../mock/tickets";
import { buildAdminEventSeats, type AdminSeatStatus } from "../mock/adminSeats";
import { useMockToast } from "../hooks/useMockToast";
import { MockToast } from "../components/MockToast";
import { AdminCreateEventForm } from "./AdminCreateEventForm";

interface AdminPageProps {
  lang: Lang;
}

type Screen = "home" | "create" | "eventDetail";
type DetailTab = "seats" | "refunds" | "resale";

const SEAT_STATUS_STYLE: Record<AdminSeatStatus, { text: string; bg: string }> = {
  구매가능: { text: "text-text-faint", bg: "bg-transparent" },
  판매완료: { text: "text-brand-teal", bg: "bg-brand-teal/[0.14]" },
  체크인완료: { text: "text-grade-s", bg: "bg-grade-s/[0.14]" },
  환불됨: { text: "text-text-faint", bg: "bg-transparent" },
};

export function AdminPage({ lang }: AdminPageProps) {
  const t = T[lang];
  const { toast, showToast } = useMockToast();

  function seatStatusLabel(status: AdminSeatStatus): string {
    switch (status) {
      case "구매가능":
        return t.statusAvailable;
      case "판매완료":
        return t.statusSold;
      case "체크인완료":
        return t.statusCheckedIn;
      case "환불됨":
        return t.statusRefunded;
    }
  }

  const [screen, setScreen] = useState<Screen>("home");
  const [eventIdx, setEventIdx] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("seats");
  const [seatOverrides, setSeatOverrides] = useState<Record<string, AdminSeatStatus>>({});
  const [rejectOpenKey, setRejectOpenKey] = useState<string | null>(null);
  const [rejectReasonDrafts, setRejectReasonDrafts] = useState<Record<string, string>>({});

  function openCreateEvent() {
    setScreen("create");
  }

  function backToHome() {
    setScreen("home");
    setEventIdx(null);
  }

  function openEventDetail(idx: number) {
    setEventIdx(idx);
    setDetailTab("seats");
    setScreen("eventDetail");
  }

  function setSeatOverride(key: string, status: AdminSeatStatus, toastMsg?: string) {
    setSeatOverrides((prev) => ({ ...prev, [key]: status }));
    setRejectOpenKey(null);
    if (toastMsg) showToast(toastMsg, "success");
  }

  const adminEvents = RAW_EVENTS.map((event, idx) => {
    const grades = buildAdminEventSeats(idx, seatOverrides);
    const total = grades.reduce((s, g) => s + g.totalCount, 0);
    const sold = grades.reduce((s, g) => s + g.soldCount, 0);
    return {
      idx,
      title: event.title,
      date: event.date,
      venue: event.venue,
      salesStatus: lang === "ko" ? `${sold}/${total}${t.salesStatus}` : `${sold}/${total} ${t.salesStatus}`,
    };
  });

  const selectedEvent = eventIdx !== null ? RAW_EVENTS[eventIdx] : null;
  const grades = eventIdx !== null ? buildAdminEventSeats(eventIdx, seatOverrides) : [];
  const refundCandidates = grades.flatMap((g) => g.seats.filter((s) => s.status === "판매완료"));
  // TODO: replace with real per-event resale history from useChainData() once wired
  const eventResaleListings = selectedEvent
    ? MOCK_TICKETS.filter((tk) => tk.status === "재판매완료" && tk.eventTitle === selectedEvent.title)
    : [];

  const detailTabs: { key: DetailTab; label: string }[] = [
    { key: "seats", label: t.tabSeatStatus },
    { key: "refunds", label: t.tabRefunds },
    { key: "resale", label: t.tabResaleStatus },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-12">
      {screen === "home" && (
        <>
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <h1 className="m-0 mb-1.5 text-[28px] font-bold tracking-tight text-text">{t.adminTitle}</h1>
              <p className="m-0 text-sm text-text-muted">{t.adminSub}</p>
            </div>
            <button
              onClick={openCreateEvent}
              className="whitespace-nowrap rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-[#0c1214]"
            >
              {t.createEventBtn}
            </button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
            {adminEvents.map((ae) => (
              <div
                key={ae.idx}
                onClick={() => openEventDetail(ae.idx)}
                className="cursor-pointer rounded-xl border border-border bg-surface px-5 py-[18px] transition hover:border-brand-teal"
              >
                <div className="mb-2 text-[15px] font-bold leading-tight text-text">{ae.title}</div>
                <div className="mb-0.5 text-xs text-text-muted">{localizeDate(ae.date, lang)}</div>
                <div className="mb-3.5 text-xs text-text-muted">{ae.venue}</div>
                <div className="text-xs font-semibold text-text-muted">{ae.salesStatus}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {screen === "create" && (
        <AdminCreateEventForm lang={lang} onCancel={backToHome} onCreated={backToHome} />
      )}

      {screen === "eventDetail" && selectedEvent && (
        <>
          <button
            onClick={backToHome}
            className="mb-5 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-text-muted"
          >
            {t.back}
          </button>
          <h2 className="m-0 mb-1 text-[22px] font-bold text-text">{selectedEvent.title}</h2>
          <div className="mb-6 text-[13px] text-text-muted">
            {localizeDate(selectedEvent.date, lang)} · {selectedEvent.venue}
          </div>

          <div className="mb-7 flex gap-7 border-b border-border">
            {detailTabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setDetailTab(tb.key)}
                className={`border-b-2 px-0.5 py-3 text-[15px] font-bold transition ${
                  detailTab === tb.key ? "border-brand-teal text-text" : "border-transparent text-text-muted"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {detailTab === "seats" && (
            <>
              <div className="mb-6 flex flex-wrap gap-4">
                {grades.map((g) => (
                  <div
                    key={g.name}
                    className="flex items-center gap-2 rounded-xl border border-border bg-bg px-[18px] py-3"
                  >
                    <div className={`h-2 w-2 rounded-full ${GRADE_DOT_BG[g.name]}`} />
                    <div className="text-[13px] font-bold text-text">
                      {g.name} {g.soldCount}/{g.totalCount}
                    </div>
                  </div>
                ))}
              </div>

              {grades.map((g) => (
                <div key={g.name} className="mb-7">
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${GRADE_DOT_BG[g.name]}`} />
                    <div className="text-sm font-bold text-text">
                      {g.name} · {g.price} USDC
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {g.seats.map((s) => (
                      <div
                        key={s.key}
                        className="grid grid-cols-[90px_140px_1fr_120px_90px] items-center gap-3 rounded-[10px] border border-border bg-surface px-4 py-2.5 text-[13px]"
                      >
                        <div className="font-mono font-bold text-text">{s.code}</div>
                        <div
                          className={`w-fit rounded-md px-2.5 py-0.5 text-[11px] font-bold ${SEAT_STATUS_STYLE[s.status].bg} ${SEAT_STATUS_STYLE[s.status].text}`}
                        >
                          {seatStatusLabel(s.status)}
                        </div>
                        <div className="truncate font-mono text-text-muted">{s.ownerText || t.noOwner}</div>
                        <div className="text-text-muted">{s.purchasedAt}</div>
                        <div className="text-right text-text-muted">
                          {s.status === "구매가능" ? "" : `${s.price} USDC`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {detailTab === "refunds" && (
            <div className="flex max-w-[760px] flex-col gap-2.5">
              {refundCandidates.length === 0 ? (
                <div className="py-6 text-[13px] text-text-faint">{t.noRefunds}</div>
              ) : (
                refundCandidates.map((s) => (
                  <div key={s.key} className="rounded-xl border border-border bg-surface px-[18px] py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-1 font-mono text-[13px] font-bold text-text">{s.code}</div>
                        <div className="font-mono text-xs text-text-muted">{s.ownerText}</div>
                      </div>
                      <div className="text-right">
                        <div className="mb-0.5 text-[11px] text-text-muted">{t.paidLabel}</div>
                        <div className="text-sm font-bold text-text">{s.price} USDC</div>
                      </div>
                      <div className="text-right">
                        <div className="mb-0.5 text-[11px] text-text-muted">{t.refundAmountLabel}</div>
                        <div className="text-sm font-bold text-brand-teal">{s.price} USDC</div>
                      </div>
                      <div className="flex gap-2">
                        {/* TODO: connect refundTicket() from lib/instructions.ts */}
                        <button
                          onClick={() => setSeatOverride(s.key, "환불됨", t.refundedToast)}
                          className="whitespace-nowrap rounded-[10px] bg-brand-teal px-3.5 py-2 text-xs font-bold text-[#0c1214]"
                        >
                          {t.refundApprove}
                        </button>
                        <button
                          onClick={() => setRejectOpenKey(rejectOpenKey === s.key ? null : s.key)}
                          className="whitespace-nowrap rounded-[10px] border border-[#d1d5db] px-3.5 py-2 text-xs font-bold text-text"
                        >
                          {t.refundReject}
                        </button>
                      </div>
                    </div>
                    {rejectOpenKey === s.key && (
                      // NOTE: no on-chain equivalent for "reject a refund request" —
                      // refundTicket() either executes or doesn't. This reason is
                      // an off-chain-only record until there's somewhere to store it.
                      <div className="mt-3 flex gap-2 border-t border-border pt-3">
                        <input
                          type="text"
                          placeholder={t.rejectReasonPlaceholder}
                          value={rejectReasonDrafts[s.key] ?? ""}
                          onChange={(e) =>
                            setRejectReasonDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))
                          }
                          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text outline-none"
                        />
                        <button
                          onClick={() => {
                            setRejectOpenKey(null);
                            showToast(t.rejectedToast, "success");
                          }}
                          className="whitespace-nowrap rounded-lg bg-danger px-3.5 py-2 text-xs font-bold text-white"
                        >
                          {t.rejectSubmit}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {detailTab === "resale" && (
            <div className="flex max-w-[720px] flex-col gap-2.5">
              {eventResaleListings.length === 0 ? (
                <div className="py-6 text-[13px] text-text-faint">{t.noResaleForEvent}</div>
              ) : (
                eventResaleListings.map((tk) => (
                  <div
                    key={tk.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-[18px] py-3.5"
                  >
                    <div className="flex-1">
                      <div className="mb-1 font-mono text-[13px] font-bold text-text">{tk.seat}</div>
                      <div className="font-mono text-xs text-text-muted">{tk.resaleBuyerWallet}</div>
                    </div>
                    <div className="text-sm font-bold text-text">{tk.resaleAmount} USDC</div>
                    <div className="rounded-md bg-brand-teal/[0.14] px-2.5 py-0.5 text-[11px] font-bold text-brand-teal">
                      {t.statusReselling}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      <MockToast toast={toast} />
    </div>
  );
}
