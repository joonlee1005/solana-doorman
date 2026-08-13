import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { Lang } from "../i18n";
import { CATEGORIES, CATEGORY_EN, eventImageBackground } from "../mock/events";
import { GRADE_DOT_BG } from "../mock/grades";
import { JURISDICTIONS } from "../mock/jurisdictions";
import { ADMIN_GRADE_COUNTS } from "../mock/adminSeats";
import { useIdentity } from "../context/IdentityContext";
import { useChainData } from "../context/ChainDataContext";
import { useActivity } from "../context/ActivityContext";
import { useSendTx } from "../lib/useSendTx";
import { getProgram } from "../lib/program";
import { createEvent, createJurisdictionRegistry, createSeatTier } from "../lib/instructions";
import { createDemoPaymentMint, getStoredPaymentMint } from "../lib/paymentMint";
import { eventPda, jurisdictionPda } from "../lib/pda";
import { shortAddr, toBaseUnits } from "../lib/format";
import type { ResalePolicy } from "../lib/types";

interface AdminCreateEventFormProps {
  lang: Lang;
  onCancel: () => void;
  onCreated: () => void;
}

const GRADE_NAMES = ["VIP", "R", "S"] as const;
type GradeName = (typeof GRADE_NAMES)[number];

interface GradeForm {
  faceValue: string;
}

const EMPTY_GRADE_FORM: GradeForm = { faceValue: "" };

export function AdminCreateEventForm({ lang, onCancel, onCreated }: AdminCreateEventFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin actions always act as the fixed "organizer" demo identity,
  // regardless of whichever account is selected in the header (that switcher
  // is for browsing/buying as different customers).
  const { identities } = useIdentity();
  const organizer = useMemo(() => identities.find((i) => i.id === "organizer")!, [identities]);
  const { jurisdictions, refresh } = useChainData();
  const { push, update } = useActivity();
  const { send } = useSendTx();
  const program = useMemo(() => getProgram(organizer.keypair), [organizer]);
  const [submitting, setSubmitting] = useState(false);

  const [jurisdictionCode, setJurisdictionCode] = useState(JURISDICTIONS[0].code);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fallbackHue] = useState(() => Math.floor(Math.random() * 360));
  const [eventName, setEventName] = useState("");
  const [eventCategory, setEventCategory] = useState(CATEGORIES[1]);
  const [eventDateTime, setEventDateTime] = useState("");
  const [venue, setVenue] = useState("");
  const [gradeForms, setGradeForms] = useState<Record<GradeName, GradeForm>>({
    VIP: { ...EMPTY_GRADE_FORM },
    R: { ...EMPTY_GRADE_FORM },
    S: { ...EMPTY_GRADE_FORM },
  });
  // Resale policy applies to the whole event (every seat tier created for
  // it), not per grade.
  const [resaleAllowed, setResaleAllowed] = useState(false);
  const [capPercent, setCapPercent] = useState("");

  const jurisdiction = JURISDICTIONS.find((j) => j.code === jurisdictionCode) ?? JURISDICTIONS[0];
  const jurisdictionCapPercent = jurisdiction.capBps / 100;
  const jurisdictionLabel = lang === "ko" ? jurisdiction.labelKo : jurisdiction.labelEn;

  // Keep the resale policy inside the newly selected jurisdiction's legal cap
  // whenever the jurisdiction changes.
  useEffect(() => {
    if (jurisdictionCapPercent === 0) setResaleAllowed(false);
    setCapPercent((prev) => {
      const num = parseFloat(prev);
      return !isNaN(num) && num > jurisdictionCapPercent ? String(jurisdictionCapPercent) : prev;
    });
  }, [jurisdictionCapPercent]);

  function updateGrade(grade: GradeName, patch: Partial<GradeForm>) {
    setGradeForms((prev) => ({ ...prev, [grade]: { ...prev[grade], ...patch } }));
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    // TODO: upload `file` to real image storage (e.g. object storage / CDN)
    // once wired; this is a local object-URL preview only.
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const hasAtLeastOneGrade = GRADE_NAMES.some((g) => Number(gradeForms[g].faceValue) > 0);
  const canSubmit =
    eventName.trim().length > 0 &&
    venue.trim().length > 0 &&
    eventDateTime.length > 0 &&
    hasAtLeastOneGrade &&
    !submitting;

  // NOTE: the on-chain Event account only stores {organizer, eventId,
  // jurisdictionRegistry, refundDeadline, refundBps} — there's no field for
  // eventName/category/venue/image. Those stay UI-only (this form's own
  // state) until a metadata-storage instruction exists; don't expect them to
  // show up on-chain or in an explorer view of the Event account.

  async function ensurePaymentMint() {
    const existing = getStoredPaymentMint();
    if (existing) return existing;
    const id = push({
      kind: "pending",
      title: lang === "ko" ? "테스트 USDC 준비" : "Preparing test USDC",
      detail: lang === "ko" ? "민트 생성 중..." : "Creating mint...",
    });
    try {
      const mint = await createDemoPaymentMint(organizer.keypair);
      update(id, { kind: "success", detail: `${lang === "ko" ? "민트" : "Mint"}: ${shortAddr(mint)}` });
      return mint;
    } catch (err) {
      update(id, { kind: "error", detail: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  async function ensureJurisdiction() {
    const existing = jurisdictions.find((j) => j.account.jurisdictionCode === jurisdiction.code);
    if (existing) return existing.publicKey;
    const result = await send(
      lang === "ko" ? `관할구역 등록 (${jurisdiction.code})` : `Register jurisdiction (${jurisdiction.code})`,
      () => createJurisdictionRegistry(program, organizer.keypair, jurisdiction.code, jurisdiction.capBps),
    );
    if (!result.ok) return null;
    const [pda] = jurisdictionPda(jurisdiction.code);
    return pda;
  }

  async function createEventOnChain(jurisdictionRegistry: PublicKey) {
    const eventId = BigInt(Date.now());
    // Refunds are allowed up until the event starts.
    const refundDeadline = BigInt(Math.floor(new Date(eventDateTime).getTime() / 1000));
    const result = await send(lang === "ko" ? "이벤트 생성" : "Create event", async () => {
      const { signature } = await createEvent(
        program,
        organizer.keypair,
        eventId,
        jurisdictionRegistry,
        refundDeadline,
        10_000, // 100% refund up to the deadline
      );
      return signature;
    });
    if (!result.ok) return null;
    const [eventPk] = eventPda(organizer.keypair.publicKey, eventId);
    return eventPk;
  }

  async function createSeatTiersOnChain(
    eventPk: PublicKey,
    jurisdictionRegistry: PublicKey,
    paymentMint: PublicKey,
  ) {
    const resalePolicy: ResalePolicy = !resaleAllowed
      ? { nonTransferable: {} }
      : { capped: { maxBps: Math.round((Number(capPercent) || 0) * 100) } };

    for (const g of GRADE_NAMES) {
      const fv = gradeForms[g].faceValue;
      if (!fv || Number(fv) <= 0) continue; // grade left blank -> skip, not created
      await send(lang === "ko" ? `${g}석 등급 생성` : `Create ${g} seat tier`, async () => {
        const { signature } = await createSeatTier(
          program,
          organizer.keypair,
          eventPk,
          jurisdictionRegistry,
          paymentMint,
          g,
          toBaseUnits(fv),
          resalePolicy,
          ADMIN_GRADE_COUNTS[g], // fixed beta seat count per grade — see note below
        );
        return signature;
      });
      // Continue with the remaining grades even if one fails; each failure
      // already surfaced its own error toast above.
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const mint = await ensurePaymentMint();
      if (!mint) return;

      const jurisdictionPk = await ensureJurisdiction();
      if (!jurisdictionPk) return;

      const eventPk = await createEventOnChain(jurisdictionPk);
      if (!eventPk) return;

      await createSeatTiersOnChain(eventPk, jurisdictionPk, mint);
      await refresh();
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={onCancel}
        className="mb-6 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-text-muted"
      >
        {lang === "ko" ? "← 뒤로" : "← Back"}
      </button>
      <h1 className="m-0 mb-8 text-2xl font-bold text-text">
        {lang === "ko" ? "+ 이벤트 생성" : "+ Create event"}
      </h1>

      {/* 관할구역 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-text-muted">{lang === "ko" ? "관할구역" : "Jurisdiction"}</h2>
        <select
          value={jurisdictionCode}
          onChange={(e) => setJurisdictionCode(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-brand-teal"
        >
          {JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>
              {lang === "ko" ? j.labelKo : j.labelEn}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-text-muted">
          {jurisdictionCapPercent === 0
            ? lang === "ko"
              ? `${jurisdictionLabel} — 재판매 전면 금지`
              : `${jurisdictionLabel} — resale not permitted`
            : lang === "ko"
              ? `${jurisdictionLabel} — 정가 대비 최대 +${jurisdictionCapPercent}%`
              : `${jurisdictionLabel} — up to +${jurisdictionCapPercent}% over face value`}
        </div>
      </section>

      {/* 재판매 정책 (이벤트 전체에 적용) */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-text-muted">{lang === "ko" ? "재판매 정책" : "Resale policy"}</h2>
        <div className="rounded-xl border border-border bg-surface px-5 py-4">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <div className="mb-1 text-xs text-text-muted">
                {lang === "ko" ? "이 이벤트의 재판매 허용" : "Allow resale for this event"}
              </div>
              <div className="flex gap-1 rounded-lg bg-bg p-1">
                <button
                  type="button"
                  onClick={() => setResaleAllowed(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                    !resaleAllowed ? "bg-brand-teal text-[#0c1214]" : "text-text-muted"
                  }`}
                >
                  {lang === "ko" ? "불가" : "No"}
                </button>
                <button
                  type="button"
                  disabled={jurisdictionCapPercent === 0}
                  onClick={() => setResaleAllowed(true)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                    resaleAllowed ? "bg-brand-teal text-[#0c1214]" : "text-text-muted"
                  } ${jurisdictionCapPercent === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {lang === "ko" ? "허용" : "Yes"}
                </button>
              </div>
            </div>

            {resaleAllowed && (
              <label>
                <div className="mb-1 text-xs text-text-muted">{lang === "ko" ? "최대 상한 (%)" : "Max cap (%)"}</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max={jurisdictionCapPercent}
                    value={capPercent}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = parseFloat(raw);
                      setCapPercent(!isNaN(num) && num > jurisdictionCapPercent ? String(jurisdictionCapPercent) : raw);
                    }}
                    placeholder="0"
                    className="w-20 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-brand-teal"
                  />
                  <span className="text-xs text-text-muted">
                    % ({lang === "ko" ? "최대" : "max"} {jurisdictionCapPercent}%)
                  </span>
                </div>
              </label>
            )}
          </div>
          <div className="mt-3 text-xs text-text-faint">
            {lang === "ko"
              ? "모든 좌석등급(VIP/R/S)에 동일하게 적용됩니다."
              : "Applies the same way to every seat grade (VIP/R/S)."}
          </div>
        </div>
      </section>

      {/* 이벤트 정보 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-text-muted">{lang === "ko" ? "이벤트 정보" : "Event info"}</h2>

        <div className="mb-5">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-surface p-3 transition hover:border-brand-teal"
          >
            {imagePreviewUrl ? (
              <img src={imagePreviewUrl} alt="" className="aspect-video w-full rounded-lg object-cover" />
            ) : (
              <div
                className="flex aspect-video w-full items-center justify-center rounded-lg text-xs text-text-faint"
                style={{ background: eventImageBackground(fallbackHue) }}
              >
                {lang === "ko" ? "미리보기" : "Preview"}
              </div>
            )}
            <div className="mt-3 text-center text-sm text-text-muted">
              {lang === "ko" ? "클릭하거나 이미지를 끌어다 놓으세요" : "Click or drag an image here"}
            </div>
            <div className="mt-1 text-center text-xs text-text-faint">
              {lang === "ko"
                ? "권장 1200×675px (16:9), JPG/WebP, 200KB 이하"
                : "Recommended 1200×675px (16:9), JPG/WebP, under 200KB"}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>
          {imagePreviewUrl && (
            <button
              type="button"
              onClick={clearImage}
              className="mt-2 text-xs font-semibold text-text-muted hover:text-danger"
            >
              {lang === "ko" ? "이미지 제거" : "Remove image"}
            </button>
          )}
        </div>

        <label className="mb-4 block">
          <div className="mb-1 text-xs text-text-muted">{lang === "ko" ? "이벤트 이름" : "Event name"}</div>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder={lang === "ko" ? "이벤트 이름을 입력하세요" : "Enter an event name"}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-brand-teal"
          />
        </label>

        <label className="mb-4 block max-w-xs">
          <div className="mb-1 text-xs text-text-muted">{lang === "ko" ? "이벤트 종류" : "Category"}</div>
          <select
            value={eventCategory}
            onChange={(e) => setEventCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-brand-teal"
          >
            {CATEGORIES.slice(1).map((c) => (
              <option key={c} value={c}>
                {lang === "ko" ? c : CATEGORY_EN[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-4 block max-w-xs">
          <div className="mb-1 text-xs text-text-muted">{lang === "ko" ? "날짜" : "Date"}</div>
          <input
            type="datetime-local"
            value={eventDateTime}
            onChange={(e) => setEventDateTime(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-brand-teal"
          />
        </label>

        <label className="block max-w-md">
          <div className="mb-1 text-xs text-text-muted">{lang === "ko" ? "장소" : "Venue"}</div>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder={lang === "ko" ? "장소를 입력하세요" : "Enter a venue"}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-brand-teal"
          />
        </label>
      </section>

      {/* 좌석 등급 가격 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-text-muted">
          {lang === "ko" ? "좌석 등급 가격" : "Seat grade pricing"}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {GRADE_NAMES.map((g) => {
            const form = gradeForms[g];
            return (
              <div key={g} className="rounded-xl border border-border bg-surface px-5 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${GRADE_DOT_BG[g]}`} />
                  <div className="text-sm font-bold text-text">{g}</div>
                </div>
                <label>
                  <div className="mb-1 text-xs text-text-muted">{lang === "ko" ? "정가 (USDC)" : "Face value (USDC)"}</div>
                  <input
                    type="number"
                    min="0"
                    value={form.faceValue}
                    onChange={(e) => updateGrade(g, { faceValue: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-brand-teal"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* TODO: beta — every event currently uses the same fixed seat layout
          (see mock/adminSeats.ts ADMIN_GRADE_COUNTS / buildAdminEventSeats).
          Per-event custom seat maps aren't exposed in this form yet. */}
      <div className="mb-8 rounded-xl border border-border bg-bg px-5 py-4 text-xs text-text-muted">
        {lang === "ko"
          ? "좌석 배치는 베타 기간 동안 모든 이벤트에 동일하게 자동 적용됩니다."
          : "During the beta, every event automatically uses the same seat layout."}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full max-w-md rounded-xl py-3.5 text-center text-[15px] font-bold ${
          canSubmit ? "bg-brand-teal text-[#0c1214]" : "cursor-not-allowed bg-border text-text-faint"
        }`}
      >
        {submitting
          ? lang === "ko"
            ? "생성 중..."
            : "Creating..."
          : lang === "ko"
            ? "이벤트 생성하기"
            : "Create event"}
      </button>
    </div>
  );
}
