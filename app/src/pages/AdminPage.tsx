import { useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useIdentity } from "../context/IdentityContext";
import { useChainData } from "../context/ChainDataContext";
import { useActivity } from "../context/ActivityContext";
import { useSendTx } from "../lib/useSendTx";
import { getProgram } from "../lib/program";
import {
  createJurisdictionRegistry,
  createEvent,
  createSeatTier,
  createSeat,
  refundTicket,
  checkIn,
} from "../lib/instructions";
import { createDemoPaymentMint, fundWithTestUsdc, getStoredPaymentMint } from "../lib/paymentMint";
import { formatUsdc, shortAddr, toBaseUnits } from "../lib/format";
import { resalePolicyLabel, type ResalePolicy } from "../lib/types";
import { JURISDICTION_CODE, JURISDICTION_LEGAL_CAP_BPS } from "../lib/constants";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-brand-teal";
const buttonClass =
  "rounded-lg bg-brand-teal px-3 py-2 text-sm font-semibold text-[#05201d] transition hover:bg-brand-teal-light disabled:cursor-not-allowed disabled:opacity-50";

export function AdminPage() {
  const { identities } = useIdentity();
  const organizer = useMemo(() => identities.find((i) => i.id === "organizer")!, [identities]);
  const { jurisdictions, events, seatTiers, seats, refresh } = useChainData();
  const { send, pending } = useSendTx();
  const { push, update } = useActivity();
  const program = useMemo(() => getProgram(organizer.keypair), [organizer]);

  const [paymentMint, setPaymentMint] = useState<PublicKey | null>(() => getStoredPaymentMint());
  const [fundAmount, setFundAmount] = useState("1000");

  const [refundDeadline, setRefundDeadline] = useState("7");
  const [refundBps, setRefundBps] = useState("10000");

  const [selectedEventPk, setSelectedEventPk] = useState<string>("");
  const [tierName, setTierName] = useState("");
  const [faceValue, setFaceValue] = useState("10");
  const [policyKind, setPolicyKind] = useState<"capped" | "unrestricted" | "nonTransferable">(
    "capped",
  );
  const [capPercent, setCapPercent] = useState("20");
  const [totalSeats, setTotalSeats] = useState("5");

  const [selectedTierPk, setSelectedTierPk] = useState<string>("");
  const [seatLines, setSeatLines] = useState("1\n2\n3\n4\n5");

  const jurisdiction = jurisdictions.find((j) => j.account.jurisdictionCode === JURISDICTION_CODE);

  const eventOptions = events.map((e) => ({
    key: e.publicKey.toBase58(),
    label: `#${e.account.eventId.toString()} · ${shortAddr(e.publicKey)}`,
  }));
  const selectedEvent = events.find((e) => e.publicKey.toBase58() === selectedEventPk);

  const tierOptions = seatTiers
    .filter((t) => !selectedEventPk || t.account.event.toBase58() === selectedEventPk)
    .map((t) => ({ key: t.publicKey.toBase58(), label: t.account.tierName }));
  const selectedTier = seatTiers.find((t) => t.publicKey.toBase58() === selectedTierPk);

  const soldSeats = seats.filter((s) => "sold" in s.account.status);

  async function handleCreateJurisdiction() {
    const result = await send("관할구역 등록", () =>
      createJurisdictionRegistry(
        program,
        organizer.keypair,
        JURISDICTION_CODE,
        JURISDICTION_LEGAL_CAP_BPS,
      ),
    );
    if (result.ok) await refresh();
  }

  async function handleCreatePaymentMint() {
    const id = push({ kind: "pending", title: "테스트 USDC 민트 생성", detail: "전송 중..." });
    try {
      const mint = await createDemoPaymentMint(organizer.keypair);
      setPaymentMint(mint);
      update(id, { kind: "success", detail: `민트: ${shortAddr(mint)}` });
    } catch (err) {
      update(id, { kind: "error", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleFund(customerId: "customer1" | "customer2" | "customer3") {
    if (!paymentMint) return;
    const customer = identities.find((i) => i.id === customerId)!;
    const id = push({
      kind: "pending",
      title: `${customer.label}에게 USDC 지급`,
      detail: "전송 중...",
    });
    try {
      await fundWithTestUsdc(
        organizer.keypair,
        paymentMint,
        customer.keypair.publicKey,
        toBaseUnits(fundAmount),
      );
      update(id, { kind: "success", detail: `${fundAmount} USDC 지급 완료` });
    } catch (err) {
      update(id, { kind: "error", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleCreateEvent() {
    if (!jurisdiction) return;
    const eventId = BigInt(Date.now());
    const days = Number(refundDeadline) || 0;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + days * 86_400);
    const result = await send("이벤트 생성", async () => {
      const { signature } = await createEvent(
        program,
        organizer.keypair,
        eventId,
        jurisdiction.publicKey,
        deadline,
        Number(refundBps),
      );
      return signature;
    });
    if (result.ok) await refresh();
  }

  async function handleCreateSeatTier() {
    if (!selectedEvent || !paymentMint) return;
    const resalePolicy: ResalePolicy =
      policyKind === "capped"
        ? { capped: { maxBps: Math.round(Number(capPercent) * 100) } }
        : policyKind === "unrestricted"
          ? { unrestricted: {} }
          : { nonTransferable: {} };
    const result = await send("좌석 등급 생성", async () => {
      const { signature } = await createSeatTier(
        program,
        organizer.keypair,
        selectedEvent.publicKey,
        selectedEvent.account.jurisdictionRegistry,
        paymentMint,
        tierName,
        toBaseUnits(faceValue),
        resalePolicy,
        Number(totalSeats),
      );
      return signature;
    });
    if (result.ok) {
      setTierName("");
      await refresh();
    }
  }

  async function handleCreateSeats() {
    if (!selectedEvent || !selectedTier) return;
    const lines = seatLines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const id = push({
      kind: "pending",
      title: `좌석 ${lines.length}개 생성`,
      detail: "전송 중...",
    });
    let okCount = 0;
    for (const line of lines) {
      const [code, display] = line.split(",").map((s) => s.trim());
      try {
        await createSeat(
          program,
          organizer.keypair,
          selectedEvent.publicKey,
          selectedTier.publicKey,
          code,
          display || code,
        );
        okCount += 1;
      } catch {
        // continue with remaining seats; summary reflects partial failure
      }
    }
    update(id, {
      kind: okCount === lines.length ? "success" : "error",
      detail: `${okCount}/${lines.length}개 생성 완료`,
    });
    await refresh();
  }

  async function handleCheckIn(seatPk: PublicKey, seatTierPk: PublicKey, tokenAccount: PublicKey) {
    const tier = seatTiers.find((t) => t.publicKey.equals(seatTierPk));
    if (!tier) return;
    const result = await send("체크인", () =>
      checkIn(program, organizer.keypair, tier.account.event, seatTierPk, seatPk, tokenAccount),
    );
    if (result.ok) await refresh();
  }

  async function handleRefund(seatPk: PublicKey, seatTierPk: PublicKey, customer: PublicKey) {
    const tier = seatTiers.find((t) => t.publicKey.equals(seatTierPk));
    if (!tier) return;
    const result = await send("환불", () =>
      refundTicket(
        program,
        organizer.keypair,
        tier.account.event,
        seatTierPk,
        seatPk,
        tier.account.paymentMint,
        customer,
      ),
    );
    if (result.ok) await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="1. 사전 준비">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 rounded-lg border border-border p-3">
            <p className="mb-2 text-xs text-text-muted">관할구역 (jurisdiction)</p>
            {jurisdiction ? (
              <p className="text-sm text-text">
                {jurisdiction.account.jurisdictionCode} · 상한{" "}
                {jurisdiction.account.legalCapBps / 100}%
              </p>
            ) : (
              <button className={buttonClass} disabled={pending} onClick={handleCreateJurisdiction}>
                {JURISDICTION_CODE} 등록 (상한 {JURISDICTION_LEGAL_CAP_BPS / 100}%)
              </button>
            )}
          </div>

          <div className="flex-1 rounded-lg border border-border p-3">
            <p className="mb-2 text-xs text-text-muted">결제 토큰 (테스트 USDC)</p>
            {paymentMint ? (
              <p className="text-sm text-text" title={paymentMint.toBase58()}>
                {shortAddr(paymentMint)}
              </p>
            ) : (
              <button className={buttonClass} onClick={handleCreatePaymentMint}>
                테스트 USDC 민트 생성
              </button>
            )}
          </div>
        </div>

        {paymentMint && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
            <div>
              <p className="mb-1 text-xs text-text-muted">지급액 (USDC)</p>
              <input
                className={inputClass}
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
              />
            </div>
            {(["customer1", "customer2", "customer3"] as const).map((id) => (
              <button
                key={id}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-surface-hover"
                onClick={() => handleFund(id)}
              >
                {identities.find((i) => i.id === id)?.label}에게 지급
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card title="2. 이벤트 생성">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-text-muted">환불 마감 (N일 후)</p>
            <input
              className={inputClass}
              value={refundDeadline}
              onChange={(e) => setRefundDeadline(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-text-muted">환불 비율 (bps, 10000=100%)</p>
            <input
              className={inputClass}
              value={refundBps}
              onChange={(e) => setRefundBps(e.target.value)}
            />
          </div>
          <button
            className={buttonClass}
            disabled={pending || !jurisdiction}
            onClick={handleCreateEvent}
          >
            이벤트 생성
          </button>
          {!jurisdiction && <p className="text-xs text-danger">관할구역을 먼저 등록하세요.</p>}
        </div>

        {events.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-text-muted">
            {events.map((e) => (
              <li key={e.publicKey.toBase58()}>
                #{e.account.eventId.toString()} · {shortAddr(e.publicKey)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="3. 좌석 등급 생성">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-text-muted">이벤트</p>
            <select
              className={inputClass}
              value={selectedEventPk}
              onChange={(e) => setSelectedEventPk(e.target.value)}
            >
              <option value="">선택...</option>
              {eventOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-text-muted">등급 이름</p>
            <input
              className={inputClass}
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
              placeholder="VIP"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-text-muted">가격 (USDC)</p>
            <input
              className={inputClass}
              value={faceValue}
              onChange={(e) => setFaceValue(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-text-muted">총 좌석 수</p>
            <input
              className={inputClass}
              value={totalSeats}
              onChange={(e) => setTotalSeats(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-text-muted">재판매 정책</p>
            <select
              className={inputClass}
              value={policyKind}
              onChange={(e) => setPolicyKind(e.target.value as typeof policyKind)}
            >
              <option value="capped">상한 있음 (Capped)</option>
              <option value="unrestricted">제한 없음</option>
              <option value="nonTransferable">재판매 불가</option>
            </select>
          </div>
          {policyKind === "capped" && (
            <div>
              <p className="mb-1 text-xs text-text-muted">상한 (% of 가격)</p>
              <input
                className={inputClass}
                value={capPercent}
                onChange={(e) => setCapPercent(e.target.value)}
              />
            </div>
          )}
          <button
            className={buttonClass}
            disabled={pending || !selectedEvent || !paymentMint || !tierName}
            onClick={handleCreateSeatTier}
          >
            등급 생성
          </button>
          {!paymentMint && <p className="text-xs text-danger">결제 토큰을 먼저 생성하세요.</p>}
        </div>

        {seatTiers.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-sm text-text-muted">
            {seatTiers.map((t) => (
              <li key={t.publicKey.toBase58()}>
                {t.account.tierName} · {formatUsdc(BigInt(t.account.faceValue.toString()))} ·{" "}
                {resalePolicyLabel(t.account.resalePolicy)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="4. 좌석 생성 (사전 일괄 생성)">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-text-muted">이벤트</p>
            <select
              className={inputClass}
              value={selectedEventPk}
              onChange={(e) => {
                setSelectedEventPk(e.target.value);
                setSelectedTierPk("");
              }}
            >
              <option value="">선택...</option>
              {eventOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-text-muted">좌석 등급</p>
            <select
              className={inputClass}
              value={selectedTierPk}
              onChange={(e) => setSelectedTierPk(e.target.value)}
            >
              <option value="">선택...</option>
              {tierOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs text-text-muted">
            좌석 코드 (한 줄에 하나, "코드,표시명" 형식 가능)
          </p>
          <textarea
            className={`${inputClass} h-28 font-mono`}
            value={seatLines}
            onChange={(e) => setSeatLines(e.target.value)}
          />
        </div>
        <button
          className={`${buttonClass} mt-3`}
          disabled={!selectedEvent || !selectedTier}
          onClick={handleCreateSeats}
        >
          좌석 일괄 생성
        </button>

        {seats.length > 0 && (
          <p className="mt-3 text-sm text-text-muted">현재 총 {seats.length}개 좌석 생성됨</p>
        )}
      </Card>

      <Card title="5. 운영: 체크인 · 환불">
        {soldSeats.length === 0 ? (
          <p className="text-sm text-text-muted">판매된 좌석이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {soldSeats.map((s) => (
              <li
                key={s.publicKey.toBase58()}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2"
              >
                <span className="text-sm text-text">
                  {s.account.displayName} · 소유자 {shortAddr(s.account.owner)}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-hover"
                    onClick={() =>
                      handleCheckIn(s.publicKey, s.account.seatTier, s.account.tokenAccount)
                    }
                  >
                    체크인
                  </button>
                  <button
                    className="rounded-lg border border-danger/50 px-3 py-1.5 text-xs text-danger hover:bg-danger/10"
                    onClick={() => handleRefund(s.publicKey, s.account.seatTier, s.account.owner)}
                  >
                    환불
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
