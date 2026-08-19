import * as dotenv from "dotenv";
import { initFileLogging } from "./logger";
import { fetchCandles, getConfiguredSymbol, getConfiguredTimeframe } from "./market";
import { computeSignal } from "./strategy";
import { checkRisk } from "./risk";
import { executeOrder } from "./execution";
import { checkMemory } from "./adaptiveFilter";
import { checkAndCloseOpenPositions } from "./positionTracker";
import { checkDailyLossLimit } from "./dailyLimit";
import { getCurrentPositionQty, getBuyingPower } from "./account";
import { appendLedgerRow } from "./memory";

dotenv.config();
initFileLogging();

function ts(): string {
  return new Date().toISOString();
}

async function scan() {
  const symbol = getConfiguredSymbol();
  const timeframe = getConfiguredTimeframe();

  console.log(`\n[${ts()}] Scanner avviato per ${symbol} su ${timeframe} (modalità PAPER)`);

  // 1. Prima di tutto: controlla e chiude eventuali posizioni aperte (stop loss o scadenza tempo).
  await checkAndCloseOpenPositions();

  // 2. Recupera dati di mercato reali.
  let candles;
  try {
    candles = await fetchCandles(100);
  } catch (err: any) {
    console.error(`[${ts()}] BLOCCATO: impossibile recuperare dati di mercato reali. Motivo: ${err.message}`);
    return;
  }
  console.log(`[${ts()}] Candele reali caricate: ${candles.length}`);

  // 3. Calcola il segnale della strategia.
  const signal = computeSignal(candles);
  console.log(`[${ts()}] Segnale strategia: ${signal.action} — ${signal.reason}`);

  if (signal.action === "HOLD") {
    console.log(`[${ts()}] Scan completato (HOLD, nessuna azione necessaria).`);
    return;
  }

  // 4. Kill switch giornaliero: se già raggiunto, blocca qualsiasi nuovo trade.
  const dailyCheck = checkDailyLossLimit();
  console.log(`[${ts()}] Controllo perdita giornaliera: ${dailyCheck.reason}`);

  if (dailyCheck.reached) {
    appendLedgerRow({
      timestamp: signal.timestamp,
      symbol,
      action: "SKIP",
      price: signal.price,
      quantity: 0,
      reason: dailyCheck.reason,
      mode: "paper",
      outcome: "N/A",
      pnl: 0,
    });
    console.log(`[${ts()}] Decisione finale: SKIP (kill switch giornaliero attivo). Nessun ordine paper inviato.`);
    return;
  }

  // 5. Controllo memoria: blocca setup che hanno già causato una perdita reale nota.
  const memoryCheck = checkMemory(signal, symbol);
  console.log(`[${ts()}] Controllo memoria: ${memoryCheck.reason}`);

  if (memoryCheck.blocked) {
    appendLedgerRow({
      timestamp: signal.timestamp,
      symbol,
      action: "SKIP",
      price: signal.price,
      quantity: 0,
      reason: memoryCheck.reason,
      mode: "paper",
      outcome: "N/A",
      pnl: 0,
    });
    console.log(`[${ts()}] Decisione finale: SKIP (bloccato dalla memoria). Nessun ordine paper inviato.`);
    return;
  }

  // 6. Controllo di rischio: posizione e saldo REALI letti da Alpaca in questo momento.
  const currentPosition = await getCurrentPositionQty();
  const buyingPower = await getBuyingPower();
  console.log(
    `[${ts()}] Posizione attuale reale: ${currentPosition} ${symbol} | Saldo disponibile: $${buyingPower.toFixed(2)}`
  );

  const riskDecision = checkRisk(signal, currentPosition, buyingPower);
  console.log(`[${ts()}] Risk check: ${riskDecision.reason}`);

  // 7. Esecuzione (solo endpoint paper, mai live).
  const execution = await executeOrder(riskDecision, signal.price);
  console.log(
    `[${ts()}] Esecuzione: ${execution.executed ? "ORDINE PAPER INVIATO" : "NESSUN ORDINE"} — ${execution.reason}`
  );

  if (execution.executed) {
    appendLedgerRow({
      timestamp: signal.timestamp,
      symbol,
      action: execution.action,
      price: execution.price,
      quantity: execution.quantity,
      reason: execution.reason,
      mode: "paper",
      outcome: "OPEN",
      pnl: 0,
    });
  }

  console.log(`[${ts()}] Scan completato.`);
}

scan().catch((err) => {
  console.error(`[${ts()}] Errore inatteso:`, err.message);
  process.exit(1);
});
