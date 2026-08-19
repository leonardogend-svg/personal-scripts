import * as dotenv from "dotenv";
import { fetchCandles, getConfiguredSymbol, getConfiguredTimeframe } from "./market";
import { computeSignal, FAST_PERIOD, SLOW_PERIOD } from "./strategy";
import { appendLedgerRow, appendLearning } from "./memory";
import { checkMemory } from "./adaptiveFilter";
import { Candle, LedgerRow } from "./types";

dotenv.config();

const LOOKBACK = Number(process.env.REPLAY_LOOKBACK_CANDLES || 500);
const FORWARD = Number(process.env.REPLAY_FORWARD_CANDLES || 6);
const SYMBOL = getConfiguredSymbol();

interface ReplayTrade {
  timestamp: string;
  action: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  outcome: "WIN" | "LOSS";
}

function detectCrossovers(candles: Candle[]): { index: number; action: "BUY" | "SELL"; price: number; timestamp: string }[] {
  const events: { index: number; action: "BUY" | "SELL"; price: number; timestamp: string }[] = [];

  for (let i = SLOW_PERIOD + 1; i < candles.length; i++) {
    const windowCandles = candles.slice(0, i + 1);
    const signal = computeSignal(windowCandles);
    if (signal.action === "BUY" || signal.action === "SELL") {
      events.push({ index: i, action: signal.action, price: signal.price, timestamp: signal.timestamp });
    }
  }

  return events;
}

function computeForwardOutcome(
  candles: Candle[],
  eventIndex: number,
  action: "BUY" | "SELL",
  entryPrice: number
): { exitPrice: number; pnlPct: number; outcome: "WIN" | "LOSS" } | null {
  const exitIndex = eventIndex + FORWARD;
  if (exitIndex >= candles.length) return null;

  const exitPrice = candles[exitIndex].close;
  const rawPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  const pnlPct = action === "BUY" ? rawPct : -rawPct;
  const outcome: "WIN" | "LOSS" = pnlPct >= 0 ? "WIN" : "LOSS";

  return { exitPrice, pnlPct, outcome };
}

async function runRaw() {
  console.log(`\n=== REPLAY:RAW — baseline onesta, senza memoria ===`);
  console.log(`Simbolo: ${SYMBOL} | Timeframe: ${getConfiguredTimeframe()} | Lookback: ${LOOKBACK} candele | Forward: ${FORWARD} candele\n`);

  let candles: Candle[];
  try {
    candles = await fetchCandles(LOOKBACK);
  } catch (err: any) {
    console.error(`BLOCCATO: impossibile recuperare candele reali. Motivo: ${err.message}`);
    return;
  }

  console.log(`Candele reali caricate: ${candles.length}\n`);

  const events = detectCrossovers(candles);

  if (events.length === 0) {
    console.log("Nessun incrocio MA rilevato nel lookback configurato. Nessuna metrica da calcolare.");
    return;
  }

  const trades: ReplayTrade[] = [];

  for (const event of events) {
    const outcome = computeForwardOutcome(candles, event.index, event.action, event.price);
    if (!outcome) continue; // non abbastanza candele future per chiudere il trade

    trades.push({
      timestamp: event.timestamp,
      action: event.action,
      entryPrice: event.price,
      exitPrice: outcome.exitPrice,
      pnlPct: outcome.pnlPct,
      outcome: outcome.outcome,
    });

    appendLedgerRow({
      timestamp: event.timestamp,
      symbol: SYMBOL,
      action: event.action,
      price: event.price,
      quantity: 0,
      reason: `Replay raw: incrocio ${event.action}, uscita dopo ${FORWARD} candele.`,
      mode: "replay",
      outcome: outcome.outcome,
      pnl: Number(outcome.pnlPct.toFixed(4)),
    });
  }

  if (trades.length === 0) {
    console.log("Trovati incroci, ma nessuno ha abbastanza candele future per calcolare l'esito. Aumenta REPLAY_LOOKBACK_CANDLES.");
    return;
  }

  console.log("Timestamp                | Azione | Entry     | Exit      | PnL%    | Esito");
  console.log("--------------------------|--------|-----------|-----------|---------|------");
  for (const t of trades) {
    console.log(
      `${t.timestamp.padEnd(25)} | ${t.action.padEnd(6)} | ${t.entryPrice.toFixed(2).padEnd(9)} | ${t.exitPrice.toFixed(2).padEnd(9)} | ${t.pnlPct.toFixed(2).padStart(6)}% | ${t.outcome}`
    );
  }

  const wins = trades.filter((t) => t.outcome === "WIN").length;
  const losses = trades.filter((t) => t.outcome === "LOSS").length;
  const winRate = (wins / trades.length) * 100;
  const avgPnl = trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length;
  const best = trades.reduce((a, b) => (a.pnlPct > b.pnlPct ? a : b));
  const worst = trades.reduce((a, b) => (a.pnlPct < b.pnlPct ? a : b));

  console.log("\n--- Riepilogo replay:raw ---");
  console.log(`Setup totali: ${trades.length}`);
  console.log(`Vincite: ${wins} | Perdite: ${losses} | Win rate: ${winRate.toFixed(1)}%`);
  console.log(`PnL medio: ${avgPnl.toFixed(2)}%`);
  console.log(`Miglior trade: ${best.pnlPct.toFixed(2)}% (${best.timestamp})`);
  console.log(`Peggior trade: ${worst.pnlPct.toFixed(2)}% (${worst.timestamp})`);

  if (losses > 0) {
    const lastLoss = trades.filter((t) => t.outcome === "LOSS").slice(-1)[0];
    appendLearning(
      `${SYMBOL}: setup ${lastLoss.action} del ${lastLoss.timestamp} ha chiuso in perdita (${lastLoss.pnlPct.toFixed(2)}%) dopo ${FORWARD} candele su dati reali.`
    );
    console.log(`\nLezione registrata in learnings.md per il setup perdente più recente.`);
  } else {
    console.log(`\nNessuna perdita reale in questo lookback: nessuna lezione inventata o forzata.`);
  }
}

async function runMemory() {
  console.log(`\n=== REPLAY:MEMORY — usa ledger.csv e learnings.md prima di ogni decisione ===\n`);

  let candles: Candle[];
  try {
    candles = await fetchCandles(LOOKBACK);
  } catch (err: any) {
    console.error(`BLOCCATO: impossibile recuperare candele reali. Motivo: ${err.message}`);
    return;
  }

  const signal = computeSignal(candles);
  console.log(`Segnale attuale: ${signal.action} — ${signal.reason}`);

  if (signal.action === "HOLD") {
    console.log("Decisione: HOLD (nessun incrocio fresco). Nessun controllo di memoria necessario.");
    return;
  }

  const memoryCheck = checkMemory(signal, SYMBOL);
  console.log(`Controllo memoria: ${memoryCheck.reason}`);

  if (memoryCheck.blocked) {
    appendLedgerRow({
      timestamp: signal.timestamp,
      symbol: SYMBOL,
      action: signal.action,
      price: signal.price,
      quantity: 0,
      reason: memoryCheck.reason,
      mode: "replay",
      outcome: "N/A",
      pnl: 0,
    });
    console.log(`Decisione finale: SKIP. Nessun ordine paper simulato.`);
  } else {
    console.log(`Decisione finale: ${signal.action} (memoria non ha trovato motivo di blocco). In modalità memory reale useresti bot.ts per eseguire davvero.`);
  }
}

async function main() {
  const mode = process.argv[2] || "raw";
  if (mode === "memory") {
    await runMemory();
  } else {
    await runRaw();
  }
}

main().catch((err) => {
  console.error("Errore inatteso:", err.message);
  process.exit(1);
});
