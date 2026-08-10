import { useCallback, useState } from "react";
import { useActivity } from "../context/ActivityContext";
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
 */
export function useSendTx() {
  const { push, update } = useActivity();
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (title: string, fn: () => Promise<string>): Promise<SendTxResult> => {
      setPending(true);
      const id = push({ kind: "pending", title, detail: "전송 중..." });
      try {
        const signature = await fn();
        update(id, { kind: "success", detail: "체결 완료", signature });
        return { ok: true, signature };
      } catch (err) {
        const info = describeTxError(err);
        update(id, { kind: "error", detail: info.message });
        return { ok: false, error: info };
      } finally {
        setPending(false);
      }
    },
    [push, update],
  );

  return { send, pending };
}
