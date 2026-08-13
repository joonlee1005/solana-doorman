import type { MockToastState } from "../hooks/useMockToast";

export function MockToast({ toast }: { toast: MockToastState | null }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-[100px] left-1/2 z-[70] -translate-x-1/2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-lg ${
        toast.kind === "error" ? "bg-danger text-white" : "bg-brand-teal text-[#0c1214]"
      }`}
    >
      {toast.message}
    </div>
  );
}
