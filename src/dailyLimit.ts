import * as dotenv from "dotenv";
import { readLedgerRows } from "./memory";

dotenv.config();

const MAX_DAILY_LOSS_PCT = Number(process.env.MAX_DAILY_LOSS_PCT || 5);

export interface DailyLimitCheck {
  reached: boolean;
  totalPnlToday: number;
  reason: string;
}

/**
 * Somma il PnL reale (%) di tutti i trade paper chiusi oggi.
 * Se la perdita cumulata supera il limite configurato, blocca nuovi trade
 * fino al giorno successivo. Nessuna perdita viene inventata: si basa
 * solo su righe realmente chiuse (WIN/LOSS) nel ledger.
 */
export function checkDailyLossLimit(): DailyLimitCheck {
  const todayStr = new Date().toISOString().slice(0, 10);

  const closedToday = readLedgerRows().filter(
    (r) =>
      r.mode === "paper" &&
      (r.outcome === "WIN" || r.outcome === "LOSS") &&
      r.timestamp.slice(0, 10) === todayStr
  );

  const totalPnlToday = closedToday.reduce((sum, r) => sum + r.pnl, 0);
  const reached = totalPnlToday <= -MAX_DAILY_LOSS_PCT;

  return {
    reached,
    totalPnlToday,
    reason: reached
      ? `Limite di perdita giornaliera raggiunto: ${totalPnlToday.toFixed(2)}% (limite -${MAX_DAILY_LOSS_PCT}%). Nuovi trade bloccati per oggi.`
      : `PnL cumulato reale di oggi: ${totalPnlToday.toFixed(2)}% (limite -${MAX_DAILY_LOSS_PCT}%). Sotto la soglia, trading permesso.`,
  };
}
