interface ConfirmModalProps {
  title: string;
  lines: string[];
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
}

export function ConfirmModal({ title, lines, yesLabel, noLabel, onYes, onNo }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="w-[90%] max-w-[420px] rounded-2xl bg-surface p-7 shadow-2xl">
        <div className="mb-4 text-lg font-bold text-text">{title}</div>
        <div className="mb-6 flex flex-col gap-1.5">
          {lines.map((line, i) => (
            <div key={i} className="text-sm leading-relaxed text-text-muted">
              {line}
            </div>
          ))}
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onYes}
            className="flex-1 rounded-xl bg-brand-teal py-3.5 text-center text-[15px] font-bold text-[#0c1214]"
          >
            {yesLabel}
          </button>
          <button
            onClick={onNo}
            className="flex-1 rounded-xl border border-[#d1d5db] py-3.5 text-center text-[15px] font-bold text-text"
          >
            {noLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
