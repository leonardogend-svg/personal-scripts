import * as dotenv from "dotenv";
import { fetchCandles, getConfiguredSymbol } from "./market";
import { readLedgerRows, closeLedgerRow, appendLearning } from "./memory";

dotenv.config();

// Dopo quanti minuti dall'apertura un trade paper viene valutato e chiuso.
const EXIT_AFTER_MINUTES = Number(process.env.POSITION_EXIT_MINUTES || 30);
// Se la perdita raggiunge questa percentuale, il trade viene chiuso subito, senza aspettare.
const STOP_LOSS_PCT = Number(process.env.STOP_LOSS_PCT || 2);

/**
 * Controlla tutti i trade "OPEN" nel ledger per il simbolo configurato.
 * Se è passato abbastanza tempo, li chiude usando il prezzo reale attuale
 * (mai un prezzo inventato) e, se il risultato è una perdita, registra
 * una lezione reale in learnings.md.
 */
export async function checkAndCloseOpenPositions(): Promise<void> {
  const symbol = getConfiguredSymbol();
  const openRows = readLedgerRows().filter(
    (r) => r.symbol === symbol && r.outcome === "OPEN" && r.mode === "paper"
  );

  if (openRows.length === 0) {
    console.log(`[POSITION] Nessuna posizione paper aperta da verificare.`);
    return;
  }

  let latestCandles;
  try {
    latestCandles = await fetchCandles(1);
  } catch (err: any) {
    console.log(`[POSITION] Impossibile recuperare il prezzo attuale per valutare le posizioni aperte: ${err.message}`);
    return;
  }

  const currentPrice = latestCandles[latestCandles.length - 1].close;
  const now = Date.now();

  for (const row of openRows) {
    const entryTime = new Date(row.timestamp).getTime();
    const elapsedMinutes = (now - entryTime) / 60000;

    const rawPct = ((currentPrice - row.price) / row.price) * 100;
    const pnlPct = row.action === "BUY" ? rawPct : -rawPct;

    const stopLossHit = pnlPct <= -STOP_LOSS_PCT;
    const timeUp = elapsedMinutes >= EXIT_AFTER_MINUTES;

    if (!stopLossHit && !timeUp) {
      console.log(
        `[POSITION] Trade ${row.action} del ${row.timestamp} ancora in corso (${elapsedMinutes.toFixed(0)}/${EXIT_AFTER_MINUTES} min, PnL attuale ${pnlPct.toFixed(2)}%, stop loss a -${STOP_LOSS_PCT}%).`
      );
      continue;
    }

    const outcome: "WIN" | "LOSS" = pnlPct >= 0 ? "WIN" : "LOSS";
    const closeReasonNote = stopLossHit
      ? `Chiuso per STOP LOSS (perdita ${pnlPct.toFixed(2)}% ha superato la soglia -${STOP_LOSS_PCT}%).`
      : `Chiuso per scadenza tempo (${EXIT_AFTER_MINUTES} min).`;

    const closed = closeLedgerRow(
      row.timestamp,
      row.symbol,
      row.action,
      outcome,
      Number(pnlPct.toFixed(4)),
      `${row.reason} | ${closeReasonNote}`
    );

    if (!closed) continue;

    console.log(
      `[POSITION] Trade ${row.action} del ${row.timestamp} chiuso: ${outcome} (${pnlPct.toFixed(2)}%). ${closeReasonNote} Entry ${row.price.toFixed(2)} -> Attuale ${currentPrice.toFixed(2)}.`
    );

    if (outcome === "LOSS") {
      appendLearning(
        `${symbol}: trade paper reale ${row.action} del ${row.timestamp} chiuso in perdita (${pnlPct.toFixed(2)}%). ${closeReasonNote}`
      );
      console.log(`[POSITION] Lezione reale registrata in learnings.md.`);
    }
  }
}
