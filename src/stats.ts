import { readLedgerRows } from "./memory";
import { readLearnings } from "./memory";
import { getConfiguredSymbol } from "./market";

function main() {
  const symbol = getConfiguredSymbol();
  const rows = readLedgerRows().filter((r) => r.symbol === symbol);

  console.log(`\n=== STATISTICHE — ${symbol} ===\n`);

  if (rows.length === 0) {
    console.log("Nessun dato ancora presente nel ledger. Esegui npm run scan, npm run loop o npm run replay:raw prima.");
    return;
  }

  const paperRows = rows.filter((r) => r.mode === "paper");
  const replayRows = rows.filter((r) => r.mode === "replay");

  const open = paperRows.filter((r) => r.outcome === "OPEN");
  const closed = paperRows.filter((r) => r.outcome === "WIN" || r.outcome === "LOSS");
  const skips = rows.filter((r) => r.action === "SKIP");

  const wins = closed.filter((r) => r.outcome === "WIN").length;
  const losses = closed.filter((r) => r.outcome === "LOSS").length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
  const totalPnl = closed.reduce((sum, r) => sum + r.pnl, 0);
  const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;

  console.log(`--- Trade PAPER (reali, via npm run scan / loop) ---`);
  console.log(`Aperti ora: ${open.length}`);
  console.log(`Chiusi: ${closed.length} (Vinti: ${wins} | Persi: ${losses})`);
  console.log(`Win rate: ${winRate.toFixed(1)}%`);
  console.log(`PnL cumulato: ${totalPnl.toFixed(2)}% | PnL medio per trade: ${avgPnl.toFixed(2)}%`);
  console.log(`SKIP totali (memoria/rischio/kill switch): ${skips.length}`);

  console.log(`\n--- Trade REPLAY (backtest storico, via npm run replay:raw) ---`);
  console.log(`Setup analizzati: ${replayRows.length}`);

  if (open.length > 0) {
    console.log(`\n--- Posizioni attualmente aperte ---`);
    for (const r of open) {
      console.log(`${r.timestamp} | ${r.action} | entry ${r.price} | qty ${r.quantity}`);
    }
  }

  const learnings = readLearnings();
  const lessonCount = (learnings.match(/^- /gm) || []).length;
  console.log(`\n--- Memoria ---`);
  console.log(`Lezioni registrate in learnings.md: ${lessonCount}`);
}

main();
