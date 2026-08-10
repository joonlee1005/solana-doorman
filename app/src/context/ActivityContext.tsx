import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type ActivityKind = "pending" | "success" | "error";

export interface ActivityItem {
  id: number;
  kind: ActivityKind;
  title: string;
  detail?: string;
  signature?: string;
}

interface ActivityContextValue {
  items: ActivityItem[];
  push: (item: Omit<ActivityItem, "id">) => number;
  update: (id: number, patch: Partial<Omit<ActivityItem, "id">>) => void;
  dismiss: (id: number) => void;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

let counter = 0;

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ActivityItem, "id">) => {
      const id = ++counter;
      setItems((prev) => [...prev, { ...item, id }]);
      if (item.kind !== "pending") {
        setTimeout(() => dismiss(id), item.kind === "error" ? 12_000 : 6_000);
      }
      return id;
    },
    [dismiss],
  );

  const update = useCallback(
    (id: number, patch: Partial<Omit<ActivityItem, "id">>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      if (patch.kind && patch.kind !== "pending") {
        setTimeout(() => dismiss(id), patch.kind === "error" ? 12_000 : 6_000);
      }
    },
    [dismiss],
  );

  return (
    <ActivityContext.Provider value={{ items, push, update, dismiss }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
}
