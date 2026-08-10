import { AnchorError, ProgramError } from "@coral-xyz/anchor";

export interface TxErrorInfo {
  code?: string;
  message: string;
  raw: string;
}

const ERROR_MESSAGES_KO: Record<string, string> = {
  InvalidMaxBps: "상한 비율(bps)이 0~10000 범위를 벗어났습니다.",
  SeatNotAvailable: "이미 판매되었거나 구매할 수 없는 좌석입니다.",
  SeatCodeTooLong: "좌석 코드가 너무 깁니다.",
  DisplayNameTooLong: "좌석 표시 이름이 너무 깁니다.",
  TierNameTooLong: "등급 이름이 너무 깁니다.",
  JurisdictionCodeTooLong: "지역 코드가 너무 깁니다.",
  ResalePriceExceedsCap: "재판매 가격이 정책 상한을 초과했습니다.",
  RefundDeadlinePassed: "환불 마감일이 지났습니다.",
  InvalidSeatStatus: "현재 좌석 상태에서는 수행할 수 없는 작업입니다.",
  Unauthorized: "권한이 없는 서명자입니다.",
  QueueFull: "대기열이 가득 찼습니다.",
  QueueEmpty: "대기열이 비어 있어 재판매할 수 없습니다.",
  BidExceedsCap: "입찰 금액이 재판매 정책 상한을 초과했습니다.",
  NotInQueue: "이 대기열에 참여한 내역이 없습니다.",
  QueueFrontMismatch: "지정한 구매자가 대기열 맨 앞이 아닙니다.",
};

export function describeTxError(err: unknown): TxErrorInfo {
  const raw = err instanceof Error ? err.message : String(err);

  const anchorErr = err instanceof AnchorError ? err : AnchorError.parse((err as any)?.logs);
  if (anchorErr) {
    const code = anchorErr.error.errorCode.code;
    return {
      code,
      message: ERROR_MESSAGES_KO[code] ?? anchorErr.error.errorMessage,
      raw,
    };
  }

  if (err instanceof ProgramError) {
    return { message: err.msg ?? raw, raw };
  }

  return { message: raw, raw };
}
