import { useCallback, useRef, useState } from "react";

export type ToastKind = "success" | "error";

export interface MockToastState {
  message: string;
  kind: ToastKind;
}

// Local, UI-only toast for screens that are still on mock data (Doorman.dc.html
// port). TODO: once a screen's actions are wired to lib/instructions.ts, prefer
// useActivity() (context/ActivityContext.tsx) so pending/success/error reflects
// real transactions instead of this.
export function useMockToast() {
  const [toast, setToast] = useState<MockToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    setToast({ message, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  return { toast, showToast };
}
