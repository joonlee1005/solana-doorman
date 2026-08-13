import { useMemo, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { T, localizeDate, type Lang } from "../i18n";
import { CATEGORY_EN, eventImageBackground, RAW_EVENTS } from "../mock/events";
import {
  GRADE_BORDER,
  GRADE_CHIP_ACTIVE_BG,
  GRADE_DOT_BG,
  GRADE_SEAT_AVAILABLE_BG,
  GRADE_TEXT,
  GRADES,
  WAITLIST_MOCK,
  type MockGrade,
} from "../mock/grades";
import { useMockToast } from "../hooks/useMockToast";
import { MockToast } from "../components/MockToast";
import { ConfirmModal } from "../components/ConfirmModal";
import { useIdentity } from "../context/IdentityContext";
import { useChainData } from "../context/ChainDataContext";
import { useActivity } from "../context/ActivityContext";
import { useSendTx } from "../lib/useSendTx";
import { getProgram } from "../lib/program";
import { buySeat, createEvent, createJurisdictionRegistry, createSeat, createSeatTier, joinQueue } from "../lib/instructions";
import { createDemoPaymentMint, fundWithTestUsdc, getStoredPaymentMint } from "../lib/paymentMint";
import { identityLabel } from "../lib/identities";
import {
  DEMO_EVENT_ID,
  DEMO_EVENT_RAW_IDX,
  DEMO_JURISDICTION_CAP_BPS,
  DEMO_JURISDICTION_CODE,
  DEMO_REFUND_DEADLINE,
} from "../lib/demoEvent";
import { shortAddr, toBaseUnits, toDisplayUnits } from "../lib/format";
import { explorerAddressUrl } from "../lib/explorer";
import { useDemoEventData } from "../hooks/useDemoEventData";

interface EventDetailPageProps {
  lang: Lang;
  eventIdx: number;
  onBack: () => void;
}

interface SeatCell {
  id: string;
  label: string;
  sold: boolean;
  // False only for a demo-event seat whose on-chain Seat account hasn't been
  // created yet (needs "온체인 데모 데이터 준비"). Rendered distinctly from
  // `sold` so "not seeded yet" is never mistaken for "already sold out" —
  // both block selection, but they mean very different things.
  exists: boolean;
  price: number;
  gradeName: string;
  // Present only for the real, devnet-backed demo event (see lib/demoEvent.ts).
  seatPk?: PublicKey;
  seatTierPk?: PublicKey;
  ticketMintPk?: PublicKey;
}

interface SeatSection {
  grade: MockGrade;
  rows: SeatCell[][];
  remaining: number;
  totalSeats: number;
}

interface SelectedSeat {
  label: string;
  price: number;
  grade: string;
  seatPk?: PublicKey;
  seatTierPk?: PublicKey;
  ticketMintPk?: PublicKey;
}

export function EventDetailPage({ lang, eventIdx, onBack }: EventDetailPageProps) {
  const t = T[lang];
  const { toast, showToast } = useMockToast();

  const isDemo = eventIdx === DEMO_EVENT_RAW_IDX;
  const { selected } = useIdentity();
  const { loading, refresh } = useChainData();
  const { push, update } = useActivity();
  const { send, pending } = useSendTx();

  const [paymentMint, setPaymentMint] = useState<PublicKey | null>(() => getStoredPaymentMint());
  const [seeding, setSeeding] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const event = RAW_EVENTS[eventIdx];

  // --- Demo event: PDAs (pure) resolved against live chain data by the shared hook. ---
  const { organizerIdentity, demoPdas, tiers: demoTiersResolved, isFullySeeded: isDemoFullySeeded } =
    useDemoEventData();

  const seatSections: SeatSection[] = useMemo(() => {
    if (isDemo) {
      return demoTiersResolved.map((tier) => {
        // Reuse GRADES for name-keyed styling (dot/border/chip colors), but
        // display DEMO_TIERS' price — the real, currently-configured price —
        // not GRADES' own (which only applies to the other, still-mock events.
        const gradeStyle = GRADES.find((g) => g.name === tier.name)!;
        const grade: MockGrade = { ...gradeStyle, price: tier.price };
        const cells: SeatCell[] = tier.seatsResolved.map((s) => ({
          id: s.seat.toBase58(),
          label: s.code,
          // Not-yet-seeded seats are treated as unavailable so they can't be
          // selected before the underlying Seat account actually exists —
          // but kept visually distinct (exists:false) from a real sellout.
          sold: s.account ? !("available" in s.account.status) : true,
          exists: !!s.account,
          price: tier.price,
          gradeName: tier.name,
          seatPk: s.seat,
          seatTierPk: tier.seatTier,
          ticketMintPk: tier.ticketMint,
        }));
        const totalSeats = cells.length;
        const remaining = totalSeats - cells.filter((c) => c.sold).length;
        return { grade, rows: [cells], remaining, totalSeats };
      });
    }
    // TODO: replace this deterministic mock layout with real seats from
    // useChainData().seats once the other 7 catalog events are chain-backed too.
    return GRADES.map((g) => {
      const rows: SeatCell[][] = [];
      for (let r = 0; r < g.rows; r++) {
        const rowSeats: SeatCell[] = [];
        for (let s = 0; s < g.seatsPerRow; s++) {
          const idx = r * g.seatsPerRow + s;
          const sold = idx !== 0 && idx % 9 === 0;
          rowSeats.push({
            id: `${g.name}-${r}-${s}`,
            label: `${g.name[0]}${r + 1}-${s + 1}`,
            sold,
            exists: true,
            price: g.price,
            gradeName: g.name,
          });
        }
        rows.push(rowSeats);
      }
      const totalSeats = g.rows * g.seatsPerRow;
      const remaining = totalSeats - rows.flat().filter((s) => s.sold).length;
      return { grade: g, rows, remaining, totalSeats };
    });
  }, [isDemo, demoTiersResolved]);

  const [selectedSeats, setSelectedSeats] = useState<Record<string, SelectedSeat>>({});
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);

  const [waitlistGrade, setWaitlistGrade] = useState(GRADES[0].name);
  const [waitlistQty, setWaitlistQtyState] = useState(1);
  const [waitlistDeposit, setWaitlistDeposit] = useState("");
  const [waitlistConfirming, setWaitlistConfirming] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  if (!event) {
    return (
      <div className="mx-auto max-w-[1280px] px-8 py-24 text-center text-sm text-text-muted">
        이벤트를 찾을 수 없습니다.
      </div>
    );
  }

  function toggleSeat(cell: SeatCell) {
    if (cell.sold) return;
    setSelectedSeats((prev) => {
      const next = { ...prev };
      if (next[cell.id]) delete next[cell.id];
      else
        next[cell.id] = {
          label: cell.label,
          price: cell.price,
          grade: cell.gradeName,
          seatPk: cell.seatPk,
          seatTierPk: cell.seatTierPk,
          ticketMintPk: cell.ticketMintPk,
        };
      return next;
    });
  }

  const selectedList = Object.values(selectedSeats);
  const totalPrice = selectedList.reduce((sum, s) => sum + s.price, 0);
  const seatLabels = selectedList.map((s) => s.label);
  const selectedLabelsText =
    lang === "ko"
      ? seatLabels.length > 3
        ? `${seatLabels.slice(0, 3).join(", ")} 외 ${seatLabels.length - 3}석`
        : seatLabels.join(", ")
      : seatLabels.length > 3
        ? `${seatLabels.slice(0, 3).join(", ")} +${seatLabels.length - 3} more`
        : seatLabels.join(", ");
  const selectedSeatsLabel =
    lang === "ko"
      ? `선택한 좌석 ${selectedList.length}석`
      : `${selectedList.length} seat${selectedList.length === 1 ? "" : "s"} selected`;

  const bookingLines = (() => {
    const groups: Record<string, { labels: string[]; price: number }> = {};
    selectedList.forEach((s) => {
      groups[s.grade] ??= { labels: [], price: 0 };
      groups[s.grade].labels.push(s.label);
      groups[s.grade].price += s.price;
    });
    return Object.entries(groups).map(([name, g]) =>
      lang === "ko"
        ? `${name}석 · ${g.labels.join(", ")} · ${g.labels.length}매 · ${g.price} USDC`
        : `${name} · ${g.labels.join(", ")} · ${g.labels.length} tickets · ${g.price} USDC`,
    );
  })();

  async function confirmBooking() {
    const seatsToBuy = selectedList;
    setShowBookingConfirm(false);
    setSelectedSeats({});

    if (!isDemo) {
      showToast(t.toast, "success");
      return;
    }
    if (!paymentMint) {
      showToast(lang === "ko" ? "먼저 테스트 USDC를 발급받으세요" : "Issue test USDC first", "error");
      return;
    }
    setDemoBusy(true);
    try {
      const customerProgram = getProgram(selected.keypair);
      let successCount = 0;
      for (const s of seatsToBuy) {
        if (!s.seatPk || !s.seatTierPk || !s.ticketMintPk) continue;
        const r = await send(lang === "ko" ? `${s.label} 좌석 구매` : `Buy seat ${s.label}`, () =>
          buySeat(
            customerProgram,
            selected.keypair,
            demoPdas.event,
            organizerIdentity.keypair.publicKey,
            s.seatTierPk!,
            s.seatPk!,
            s.ticketMintPk!,
            paymentMint,
          ),
        );
        if (r.ok) successCount++;
      }
      await refresh();
      if (successCount > 0) {
        showToast(
          lang === "ko" ? `${successCount}석 구매가 완료되었습니다` : `${successCount} seat(s) purchased`,
          "success",
        );
      }
    } finally {
      setDemoBusy(false);
    }
  }

  const wlGrade = GRADES.find((g) => g.name === waitlistGrade) ?? GRADES[0];
  const demoTierForWaitlist = isDemo ? demoTiersResolved.find((t) => t.name === waitlistGrade) ?? null : null;
  // Per-seat bounds: join_queue registers one seat per call, so the deposit
  // entered here is per seat, not a total split across waitlistQty. For the
  // demo event, base this on DEMO_TIERS' price (the real, current price),
  // not GRADES' (only applies to the other, still-mock events).
  const wlPrice = demoTierForWaitlist ? demoTierForWaitlist.price : wlGrade.price;
  const wlMin = wlPrice;
  const wlMax = Math.round(wlPrice * 1.2);
  const wlStatusEntries = demoTierForWaitlist
    ? demoTierForWaitlist.bidQueueAccount
      ? demoTierForWaitlist.bidQueueAccount.bids
          .slice(0, demoTierForWaitlist.bidQueueAccount.count)
          .map((b, i) => ({
            position: i + 1,
            wallet: shortAddr(b.buyer),
            deposit: parseFloat(toDisplayUnits(BigInt(b.amount.toString()))),
          }))
      : []
    : (WAITLIST_MOCK[wlGrade.name] ?? [])
        .filter((e) => !e.matched)
        .map((e, i) => ({ ...e, origIndex: i }))
        .sort((a, b) => b.deposit - a.deposit || a.origIndex - b.origIndex)
        .map((e, i) => ({ position: i + 1, wallet: e.wallet, deposit: e.deposit }));
  const wlWaitingCountText = `${wlStatusEntries.length}${t.waitlistWaitingLabel}`;

  function setWaitlistQty(n: number) {
    const qty = Math.max(1, Math.min(4, n));
    setWaitlistQtyState(qty);
    setWaitlistError("");
  }

  function tryWaitlistSubmit() {
    if (isDemo && (!demoTierForWaitlist || !demoTierForWaitlist.account)) {
      setWaitlistError(lang === "ko" ? "먼저 온체인 데모 데이터를 준비하세요" : "Seed the on-chain demo data first");
      return;
    }
    // NOTE: on-chain join_queue only enforces the upper cap (amount <=
    // resalePolicyCapBps-derived cap); this lower bound is a mock UI
    // affordance to dramatize the "structural rejection" demo moment. Both
    // bounds are re-checked on-chain regardless, so this is a UI-side
    // convenience, not the source of truth.
    const val = parseFloat(waitlistDeposit);
    if (isNaN(val) || val < wlMin || val > wlMax) {
      setWaitlistError(
        lang === "ko"
          ? `정가(${wlMin} USDC) 이상, 상한(${wlMax} USDC) 이하로 입력해주세요`
          : `Enter an amount between face value (${wlMin} USDC) and the cap (${wlMax} USDC)`,
      );
      return;
    }
    setWaitlistError("");
    setWaitlistConfirming(true);
  }

  async function confirmWaitlistRegister() {
    setWaitlistConfirming(false);
    const qty = waitlistQty;
    const depositStr = waitlistDeposit;
    setWaitlistDeposit("");
    setWaitlistQtyState(1);

    if (!isDemo) {
      showToast(
        lang === "ko" ? `대기열에 ${qty}건 등록되었습니다` : `Added ${qty} waitlist ${qty === 1 ? "entry" : "entries"}`,
        "success",
      );
      return;
    }
    if (!demoTierForWaitlist || !paymentMint) {
      showToast(lang === "ko" ? "먼저 테스트 USDC를 발급받으세요" : "Issue test USDC first", "error");
      return;
    }
    setDemoBusy(true);
    try {
      // join_queue registers exactly one seat per call, so a qty-N registration
      // is N separate calls with the same per-seat deposit amount each time.
      const customerProgram = getProgram(selected.keypair);
      const amount = toBaseUnits(depositStr);
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < qty; i++) {
        const r = await send(
          lang === "ko"
            ? `${wlGrade.name}석 대기열 등록 (${i + 1}/${qty})`
            : `Join ${wlGrade.name} waitlist (${i + 1}/${qty})`,
          () => joinQueue(customerProgram, selected.keypair, demoTierForWaitlist!.seatTier, paymentMint, amount),
        );
        if (r.ok) ok++;
        else fail++;
      }
      await refresh();
      showToast(
        lang === "ko"
          ? `대기열 등록 ${ok}/${qty}건 완료${fail > 0 ? `, ${fail}건 실패` : ""}`
          : `${ok}/${qty} waitlist entries registered${fail > 0 ? `, ${fail} failed` : ""}`,
        fail > 0 && ok === 0 ? "error" : "success",
      );
    } finally {
      setDemoBusy(false);
    }
  }

  async function seedDemoEvent() {
    setSeeding(true);
    try {
      const organizer = organizerIdentity.keypair;
      const program = getProgram(organizer);

      let mint = paymentMint ?? getStoredPaymentMint();
      if (!mint) {
        const id = push({
          kind: "pending",
          title: lang === "ko" ? "테스트 USDC 준비" : "Preparing test USDC",
          detail: lang === "ko" ? "민트 생성 중..." : "Creating mint...",
        });
        try {
          mint = await createDemoPaymentMint(organizer);
          update(id, { kind: "success", detail: `${lang === "ko" ? "민트" : "Mint"}: ${shortAddr(mint)}` });
          setPaymentMint(mint);
        } catch (err) {
          update(id, { kind: "error", detail: err instanceof Error ? err.message : String(err) });
          return;
        }
      } else if (!paymentMint) {
        setPaymentMint(mint);
      }

      const existingJurisdiction = await program.account.jurisdictionRegistry.fetchNullable(
        demoPdas.jurisdictionRegistry,
      );
      if (!existingJurisdiction) {
        const r = await send(
          lang === "ko" ? `관할구역 등록 (${DEMO_JURISDICTION_CODE})` : `Register jurisdiction (${DEMO_JURISDICTION_CODE})`,
          () => createJurisdictionRegistry(program, organizer, DEMO_JURISDICTION_CODE, DEMO_JURISDICTION_CAP_BPS),
        );
        if (!r.ok) return;
      }

      const existingEvent = await program.account.event.fetchNullable(demoPdas.event);
      if (!existingEvent) {
        const r = await send(lang === "ko" ? "데모 이벤트 생성" : "Create demo event", async () => {
          const { signature } = await createEvent(
            program,
            organizer,
            DEMO_EVENT_ID,
            demoPdas.jurisdictionRegistry,
            DEMO_REFUND_DEADLINE,
            10_000,
          );
          return signature;
        });
        if (!r.ok) return;
      }

      for (const tier of demoPdas.tiers) {
        const existingTier = await program.account.seatTier.fetchNullable(tier.seatTier);
        if (!existingTier) {
          const r = await send(
            lang === "ko" ? `${tier.name}석 등급 생성` : `Create ${tier.name} seat tier`,
            async () => {
              const { signature } = await createSeatTier(
                program,
                organizer,
                demoPdas.event,
                demoPdas.jurisdictionRegistry,
                mint!,
                tier.name,
                toBaseUnits(tier.price),
                { capped: { maxBps: DEMO_JURISDICTION_CAP_BPS } },
                tier.seatCodes.length,
              );
              return signature;
            },
          );
          if (!r.ok) continue; // still try the other tiers
        }

        for (const s of tier.seats) {
          const existingSeat = await program.account.seat.fetchNullable(s.seat);
          if (existingSeat) continue;
          await send(lang === "ko" ? `${s.code} 좌석 생성` : `Create seat ${s.code}`, async () => {
            const { signature } = await createSeat(program, organizer, demoPdas.event, tier.seatTier, s.code, s.code);
            return signature;
          });
        }
      }

      await refresh();
    } finally {
      setSeeding(false);
    }
  }

  async function issueTestUsdc() {
    if (!paymentMint) return;
    setDemoBusy(true);
    try {
      await send(
        lang === "ko" ? `${identityLabel(selected, lang)}에 테스트 USDC 지급` : `Issue test USDC to ${identityLabel(selected, lang)}`,
        () => fundWithTestUsdc(organizerIdentity.keypair, paymentMint, selected.keypair.publicKey, 1_000n * 10n ** 6n),
      );
    } finally {
      setDemoBusy(false);
    }
  }

  const demoActionsDisabled = seeding || demoBusy || pending;

  const gradeCards = seatSections.map(({ grade, remaining, totalSeats }) => ({
    grade,
    remainingText:
      lang === "ko" ? `잔여 ${remaining}/${totalSeats}석` : `${remaining}/${totalSeats} left`,
  }));

  function GradeChips({ size = "md" }: { size?: "sm" | "md" }) {
    return (
      <div className="flex flex-wrap gap-2">
        {GRADES.map((g) => {
          const active = waitlistGrade === g.name;
          return (
            <button
              key={g.name}
              onClick={() => {
                setWaitlistGrade(g.name);
                setWaitlistError("");
              }}
              className={`rounded-full border font-semibold transition ${
                size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-[13px]"
              } ${
                active
                  ? `${GRADE_BORDER[g.name]} ${GRADE_CHIP_ACTIVE_BG[g.name]} ${GRADE_TEXT[g.name]}`
                  : "border-border bg-surface text-text-muted"
              }`}
            >
              {lang === "ko" ? `${g.name}석` : g.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-12">
      <div className="pb-24">
        <button
          onClick={onBack}
          className="mb-6 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-text-muted"
        >
          {t.back}
        </button>

        {isDemo && (
          <div className="mb-8 rounded-xl border border-brand-teal/40 bg-brand-teal/[0.06] p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[13px] font-bold text-brand-teal">
                {lang === "ko" ? "⛓ devnet 실제 체인 데모 이벤트" : "⛓ Live devnet demo event"}
              </div>
              <a
                href={explorerAddressUrl(demoPdas.event)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-teal hover:underline"
              >
                {lang === "ko" ? "이벤트 계정 보기 ↗" : "View event account ↗"}
              </a>
            </div>
            <div className="mb-3 text-xs text-text-muted">
              {lang === "ko"
                ? `현재 계정: ${identityLabel(selected, lang)} (${shortAddr(selected.keypair.publicKey)}) · 결제 민트: ${paymentMint ? shortAddr(paymentMint) : "미생성"}`
                : `Active account: ${identityLabel(selected, lang)} (${shortAddr(selected.keypair.publicKey)}) · Payment mint: ${paymentMint ? shortAddr(paymentMint) : "not created"}`}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isDemoFullySeeded && (
                <button
                  onClick={seedDemoEvent}
                  disabled={seeding}
                  className="rounded-lg bg-brand-teal px-3.5 py-2 text-xs font-bold text-[#0c1214] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {seeding
                    ? lang === "ko"
                      ? "준비 중..."
                      : "Seeding..."
                    : lang === "ko"
                      ? "온체인 데모 데이터 준비"
                      : "Seed demo data on-chain"}
                </button>
              )}
              <button
                onClick={issueTestUsdc}
                disabled={!paymentMint || demoActionsDisabled}
                className="rounded-lg border border-brand-teal px-3.5 py-2 text-xs font-bold text-brand-teal disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lang === "ko" ? `${identityLabel(selected, lang)}에게 테스트 USDC 지급` : `Issue test USDC to ${identityLabel(selected, lang)}`}
              </button>
              <button
                onClick={() => refresh()}
                disabled={loading}
                className="rounded-lg border border-border px-3.5 py-2 text-xs font-bold text-text-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? lang === "ko"
                    ? "새로고침 중..."
                    : "Refreshing..."
                  : lang === "ko"
                    ? "체인 상태 새로고침"
                    : "Refresh chain state"}
              </button>
            </div>
            {!isDemoFullySeeded && (
              <div className="mt-3 text-xs text-text-faint">
                {lang === "ko"
                  ? "좌석을 선택하거나 대기열에 등록하려면 먼저 데모 데이터를 준비하세요 (관할구역 → 이벤트 → 좌석등급 → 좌석 계정, 최대 12개 트랜잭션)."
                  : "Seed the demo data first (jurisdiction → event → seat tiers → seat accounts, up to 12 transactions) before booking or joining the waitlist."}
              </div>
            )}
          </div>
        )}

        <div className="mb-10 grid grid-cols-[570px_1fr] gap-10">
          {event.image ? (
            <img src={event.image} alt="" className="aspect-video rounded-xl object-cover" />
          ) : (
            <div
              className="aspect-video rounded-xl"
              style={{ background: eventImageBackground(event.hue) }}
            />
          )}
          <div>
            <div className="mb-3.5 inline-block rounded-md bg-brand-teal/[0.12] px-2 py-0.5 text-[11px] font-bold text-brand-teal">
              {lang === "ko" ? event.category : CATEGORY_EN[event.category]}
            </div>
            <h1 className="m-0 mb-3.5 text-[28px] font-bold leading-tight text-text">{event.title}</h1>
            <div className="mb-1 text-sm text-text-muted">{localizeDate(event.date, lang)}</div>
            <div className="mb-5 text-sm text-text-muted">
              {lang === "ko" ? `${event.venue} · ${event.countryKo}` : `${event.venue} · ${event.countryEn}`}
            </div>
            <p className="m-0 mb-6 max-w-[520px] text-sm leading-relaxed text-text-muted">
              {t.description}
            </p>
            <div className="flex gap-3">
              {gradeCards.map(({ grade, remainingText }) => (
                <div key={grade.name} className="min-w-[110px] rounded-xl border border-border bg-surface px-[18px] py-3.5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${GRADE_DOT_BG[grade.name]}`} />
                    <div className="text-[13px] font-bold text-text">
                      {lang === "ko" ? `${grade.name}석` : grade.name}
                    </div>
                  </div>
                  <div className="text-base font-bold text-text">{grade.price} USDC</div>
                  <div className="mt-1 text-xs text-text-muted">{remainingText}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-10 h-px bg-border" />

        <div className="flex flex-col items-center">
          <h2 className="m-0 mb-5 w-full max-w-[560px] self-center text-xl font-bold text-text">
            {t.seatBookingSectionTitle}
          </h2>
          <div className="mb-10 w-3/5 max-w-[640px] rounded-lg bg-surface p-3 text-center text-xs font-bold tracking-[0.1em] text-text-muted">
            {t.stage}
          </div>

          {seatSections.map(({ grade, rows }) => (
            <div key={grade.name} className="mb-7">
              <div className="mb-3 flex items-center justify-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${GRADE_DOT_BG[grade.name]}`} />
                <div className="text-[13px] font-bold text-text-muted">
                  {lang === "ko" ? `${grade.name}석 · ${grade.price} USDC` : `${grade.name} · ${grade.price} USDC`}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                {rows.map((row, ri) => (
                  <div key={ri} className="flex gap-1.5">
                    {row.map((cell) => {
                      const selected = !!selectedSeats[cell.id];
                      const className = !cell.exists
                        ? "h-5 w-5 rounded cursor-not-allowed border border-dashed border-[#c7ccd1] bg-transparent opacity-40"
                        : cell.sold
                          ? "h-5 w-5 rounded cursor-not-allowed border border-[#c7ccd1] bg-transparent"
                          : selected
                            ? `h-5 w-5 rounded cursor-pointer bg-text border-2 ${GRADE_BORDER[grade.name]} transition`
                            : `h-5 w-5 rounded cursor-pointer border border-transparent transition ${GRADE_SEAT_AVAILABLE_BG[grade.name]}`;
                      const title = cell.exists
                        ? cell.label
                        : `${cell.label} (${lang === "ko" ? "아직 생성되지 않음 — 온체인 데모 데이터 준비 필요" : "not created yet — seed the demo data first"})`;
                      return (
                        <button
                          key={cell.id}
                          onClick={() => toggleSeat(cell)}
                          className={className}
                          aria-label={cell.label}
                          title={title}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-2 flex gap-5 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-[3px] bg-brand-teal/55" />
              {t.legendAvailable}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-[3px] border border-[#c7ccd1]" />
              {t.legendSold}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-[3px] bg-text" />
              {t.legendSelected}
            </div>
            {isDemo && !isDemoFullySeeded && (
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-[3px] border border-dashed border-[#c7ccd1] opacity-40" />
                {lang === "ko" ? "아직 생성되지 않음" : "Not created yet"}
              </div>
            )}
          </div>
        </div>

        <div className="my-12 h-px bg-border" />

        <div className="mx-auto max-w-[980px]">
          <h2 className="m-0 mb-1.5 text-xl font-bold text-text">{t.waitlistSectionTitle}</h2>
          <p className="m-0 mb-6 text-[13px] text-text-muted">{t.waitlistSectionSub}</p>

          <div className="grid grid-cols-2 items-start gap-8">
            {/* left: waitlist status, sorted by deposit desc then registration order */}
            <div>
              <div className="mb-3.5 text-[15px] font-bold text-text">{t.waitlistStatusTitle}</div>
              <div className="mb-4">
                <GradeChips />
              </div>
              <div className="mb-3.5 text-[13px] text-text-muted">{wlWaitingCountText}</div>
              <div className="flex max-h-[380px] flex-col gap-2 overflow-y-auto">
                {wlStatusEntries.map((e) => (
                  <div
                    key={e.wallet + e.position}
                    className="flex items-center justify-between rounded-[10px] border border-border bg-surface px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-bg text-xs font-bold text-text-muted">
                        {e.position}
                      </div>
                      <div>
                        <div className="font-mono text-[13px] text-text">{e.wallet}</div>
                        <div className="mt-0.5 text-[11px] text-text-muted">{e.deposit} USDC</div>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-text-faint">{t.statusWaiting}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* right: registration form */}
            <div>
              <div className="mb-2 text-[13px] font-bold text-text-muted">{t.waitlistGradeLabel}</div>
              <div className="mb-5">
                <GradeChips />
              </div>

              <div className="mb-2 text-[13px] font-bold text-text-muted">{t.waitlistQtyLabel}</div>
              <div className="mb-5 flex items-center gap-3.5">
                <button
                  onClick={() => setWaitlistQty(waitlistQty - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-base font-bold"
                >
                  −
                </button>
                <div className="min-w-5 text-center text-base font-bold text-text">{waitlistQty}</div>
                <button
                  onClick={() => setWaitlistQty(waitlistQty + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-base font-bold"
                >
                  +
                </button>
              </div>

              <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-bg px-[18px] py-3.5">
                <div className="text-[13px] text-text-muted">{t.waitlistMaxDepositLabel}</div>
                <div className="text-[15px] font-bold text-brand-teal">{wlMax} USDC</div>
              </div>

              <div className="mb-2 text-[13px] font-bold text-text-muted">{t.waitlistDepositLabel}</div>
              <div
                className={`flex items-center gap-2 rounded-xl border bg-surface px-[18px] py-3.5 ${
                  waitlistError ? "border-danger" : "border-border"
                }`}
              >
                <input
                  type="number"
                  placeholder={t.waitlistDepositPlaceholder}
                  value={waitlistDeposit}
                  onChange={(e) => {
                    setWaitlistDeposit(e.target.value);
                    setWaitlistError("");
                  }}
                  className="flex-1 bg-transparent text-base font-bold text-text outline-none"
                />
                <span className="text-sm font-semibold text-text-muted">USDC</span>
              </div>
              {waitlistError && <div className="mt-2 text-xs text-danger">{waitlistError}</div>}

              {waitlistConfirming ? (
                <div className="mt-4 rounded-xl border border-brand-teal bg-surface p-[18px]">
                  <div className="mb-2 text-[13px] font-bold text-text">{t.waitlistConfirmTitle}</div>
                  <div className="mb-4 text-[13px] leading-relaxed text-text-muted">
                    {lang === "ko"
                      ? `${event.title} · ${wlGrade.name}석 ${waitlistQty}매 · 매당 예치금 ${waitlistDeposit} USDC · 총 ${(parseFloat(waitlistDeposit) || 0) * waitlistQty} USDC (개별 등록 ${waitlistQty}건)`
                      : `${event.title} · ${wlGrade.name} × ${waitlistQty} · ${waitlistDeposit} USDC per seat · ${(parseFloat(waitlistDeposit) || 0) * waitlistQty} USDC total (${waitlistQty} separate ${waitlistQty === 1 ? "entry" : "entries"})`}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmWaitlistRegister}
                      disabled={demoActionsDisabled}
                      className="flex-1 rounded-[10px] bg-brand-teal py-3 text-center text-sm font-bold text-[#0c1214] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {demoBusy ? (lang === "ko" ? "처리 중..." : "Processing...") : t.confirmYes}
                    </button>
                    <button
                      onClick={() => setWaitlistConfirming(false)}
                      className="flex-1 rounded-[10px] border border-[#d1d5db] py-3 text-center text-sm font-bold text-text"
                    >
                      {t.confirmNo}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={tryWaitlistSubmit}
                  className="mt-2.5 w-full rounded-xl bg-brand-teal py-3.5 text-center text-[15px] font-bold text-[#0c1214]"
                >
                  {t.waitlistSubmitBtn}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedList.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between border-t border-border bg-bg px-8 py-4.5">
          <div>
            <div className="mb-1 text-[13px] text-text-muted">{selectedSeatsLabel}</div>
            <div className="text-sm font-semibold text-text">{selectedLabelsText}</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-xl font-bold text-brand-teal">{totalPrice} USDC</div>
            <button
              onClick={() => setSelectedSeats({})}
              className="rounded-xl border border-border px-5 py-3.5 text-[15px] font-semibold text-text-muted transition hover:text-text"
            >
              {t.resetSelectionBtn}
            </button>
            <button
              onClick={() => setShowBookingConfirm(true)}
              className="rounded-xl bg-brand-teal px-7 py-3.5 text-[15px] font-bold text-[#0c1214]"
            >
              {t.book}
            </button>
          </div>
        </div>
      )}

      {showBookingConfirm && (
        <ConfirmModal
          title={lang === "ko" ? "구매하시겠습니까?" : "Confirm purchase?"}
          lines={bookingLines}
          yesLabel={demoBusy ? (lang === "ko" ? "처리 중..." : "Processing...") : t.confirmYes}
          noLabel={t.confirmNo}
          onYes={confirmBooking}
          onNo={() => setShowBookingConfirm(false)}
        />
      )}

      <MockToast toast={toast} />
    </div>
  );
}
