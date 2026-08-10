import { useActivity } from "../context/ActivityContext";
import { shortAddr } from "../lib/format";

const KIND_STYLES: Record<string, string> = {
  pending: "border-border bg-surface",
  success: "border-brand-teal/50 bg-surface",
  error: "border-danger/60 bg-surface",
};

const KIND_ICON: Record<string, string> = {
  pending: "⏳",
  success: "✅",
  error: "⛔",
};

export function ActivityToasts() {
  const { items, dismiss } = useActivity();
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto rounded-xl border p-3 shadow-lg shadow-black/30 ${KIND_STYLES[item.kind]}`}
        >
          <div className="flex items-start gap-2">
            <span>{KIND_ICON[item.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">{item.title}</p>
              {item.detail && (
                <p
                  className={`mt-0.5 text-xs ${item.kind === "error" ? "text-danger" : "text-text-muted"}`}
                >
                  {item.detail}
                </p>
              )}
              {item.signature && (
                <a
                  href={`https://explorer.solana.com/tx/${item.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-brand-teal hover:underline"
                >
                  {shortAddr(item.signature, 6)} · Explorer에서 보기 ↗
                </a>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="text-text-muted hover:text-text"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
