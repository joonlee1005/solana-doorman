import { useCallback, useState } from "react";
import { useActivity } from "../context/ActivityContext";
import { useIdentity } from "../context/IdentityContext";
import { describeTxError, type TxErrorInfo } from "./txError";

export interface SendTxResult {
  ok: boolean;
  signature?: string;
  error?: TxErrorInfo;
}

/**
 * Wraps an async tx-sending function with a global pending/success/error
 * activity toast, and returns a parsed error on failure instead of throwing
 * (callers decide how prominently to surface it, e.g. the resale cap demo).
 * On success, also refreshes every identity's SOL/USDC balances so the
 * header's account switcher reflects the real post-tx state immediately
 * instead of waiting on its 15s poll.
 */
export function useSendTx() {
  const { push, update } = useActivity();
  const { refreshBalances, refreshUsdcBalances } = useIdentity();
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (title: string, fn: () => Promise<string>): Promise<SendTxResult> => {
      setPending(true);
      const id = push({ kind: "pending", title, detail: "전송 중..." });
      try {
        const signature = await fn();
        update(id, { kind: "success", detail: "체결 완료", signature });
        void refreshBalances();
        void refreshUsdcBalances();
        return { ok: true, signature };
      } catch (err) {
        const info = describeTxError(err);
        update(id, { kind: "error", detail: info.message });
        return { ok: false, error: info };
      } finally {
        setPending(false);
      }
    },
    [push, update, refreshBalances, refreshUsdcBalances],
  );

  return { send, pending };
}
