import { Signal } from "./types";
import { findPriorLoss, readLearnings } from "./memory";

export interface MemoryCheck {
  blocked: boolean;
  reason: string;
}

/**
 * Prima di ogni BUY/SELL, controlla la memoria reale (ledger + learnings).
 * Non inventa mai un blocco: se non c'è una perdita reale precedente, non blocca nulla.
 */
export function checkMemory(signal: Signal, symbol: string): MemoryCheck {
  if (signal.action === "HOLD") {
    return { blocked: false, reason: "HOLD: nessun controllo di memoria necessario." };
  }

  const priorLoss = findPriorLoss(symbol);
  const learnings = readLearnings();

  if (!priorLoss) {
    return {
      blocked: false,
      reason: "Nessuna perdita reale precedente trovata in ledger.csv per questo simbolo. Esegui replay:raw per costruire memoria.",
    };
  }

  const mentionsSymbolLoss = learnings.includes(symbol);

  if (mentionsSymbolLoss) {
    return {
      blocked: true,
      reason: `SKIP: trovata una perdita reale precedente su ${symbol} (${priorLoss.timestamp}) e una nota corrispondente in learnings.md.`,
    };
  }

  return {
    blocked: false,
    reason: `Trovata una perdita precedente su ${symbol}, ma nessuna lezione esplicita in learnings.md che vieti questo setup specifico. Procedo con cautela.`,
  };
}
