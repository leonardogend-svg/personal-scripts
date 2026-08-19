export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Action = "BUY" | "SELL" | "HOLD" | "SKIP";

export interface Signal {
  action: "BUY" | "SELL" | "HOLD";
  reason: string;
  fastMA: number;
  slowMA: number;
  price: number;
  timestamp: string;
}

export interface RiskDecision {
  approved: boolean;
  finalAction: Action;
  reason: string;
  quantity: number;
}

export interface ExecutionResult {
  executed: boolean;
  action: Action;
  quantity: number;
  price: number;
  reason: string;
  orderId?: string;
  mode: "paper";
}

export interface LedgerRow {
  timestamp: string;
  symbol: string;
  action: Action;
  price: number;
  quantity: number;
  reason: string;
  mode: "paper" | "replay";
  outcome: "WIN" | "LOSS" | "OPEN" | "N/A";
  pnl: number;
}
