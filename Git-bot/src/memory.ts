import * as fs from "fs";
import * as path from "path";
import { LedgerRow } from "./types";

const LEDGER_PATH = path.join(__dirname, "..", "data", "ledger.csv");
const LEARNINGS_PATH = path.join(__dirname, "..", "data", "learnings.md");
const LEDGER_HEADER = "timestamp,symbol,action,price,quantity,reason,mode,outcome,pnl";

function ensureFiles() {
  if (!fs.existsSync(LEDGER_PATH)) {
    fs.writeFileSync(LEDGER_PATH, LEDGER_HEADER + "\n", "utf-8");
  }
  if (!fs.existsSync(LEARNINGS_PATH)) {
    fs.writeFileSync(
      LEARNINGS_PATH,
      "# Learnings\n\nNessuna lezione ancora registrata. Verrà popolato solo con perdite reali osservate da replay:raw o da trade paper reali.\n",
      "utf-8"
    );
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function appendLedgerRow(row: LedgerRow) {
  ensureFiles();
  const line = [
    row.timestamp,
    row.symbol,
    row.action,
    row.price.toString(),
    row.quantity.toString(),
    csvEscape(row.reason),
    row.mode,
    row.outcome,
    row.pnl.toString(),
  ].join(",");
  fs.appendFileSync(LEDGER_PATH, line + "\n", "utf-8");
}

export function readLedgerRows(): LedgerRow[] {
  ensureFiles();
  const content = fs.readFileSync(LEDGER_PATH, "utf-8").trim();
  const lines = content.split("\n").slice(1); // salta header
  return lines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const parts = line.split(",");
      return {
        timestamp: parts[0],
        symbol: parts[1],
        action: parts[2] as LedgerRow["action"],
        price: Number(parts[3]),
        quantity: Number(parts[4]),
        reason: parts[5],
        mode: parts[6] as LedgerRow["mode"],
        outcome: parts[7] as LedgerRow["outcome"],
        pnl: Number(parts[8]),
      };
    });
}

function rowToCsvLine(row: LedgerRow): string {
  return [
    row.timestamp,
    row.symbol,
    row.action,
    row.price.toString(),
    row.quantity.toString(),
    csvEscape(row.reason),
    row.mode,
    row.outcome,
    row.pnl.toString(),
  ].join(",");
}

/**
 * Aggiorna una riga OPEN esistente a WIN/LOSS con il PnL reale osservato.
 * Riscrive l'intero file preservando tutte le altre righe invariate.
 * Restituisce false se non trova nessuna riga OPEN corrispondente (nessun dato inventato).
 */
export function closeLedgerRow(
  timestamp: string,
  symbol: string,
  action: LedgerRow["action"],
  outcome: "WIN" | "LOSS",
  pnl: number,
  newReason?: string
): boolean {
  const rows = readLedgerRows();
  const idx = rows.findIndex(
    (r) => r.timestamp === timestamp && r.symbol === symbol && r.action === action && r.outcome === "OPEN"
  );

  if (idx === -1) return false;

  rows[idx] = { ...rows[idx], outcome, pnl, reason: newReason ?? rows[idx].reason };

  const lines = [LEDGER_HEADER, ...rows.map(rowToCsvLine)];
  fs.writeFileSync(LEDGER_PATH, lines.join("\n") + "\n", "utf-8");

  return true;
}

export function appendLearning(text: string) {
  ensureFiles();
  fs.appendFileSync(LEARNINGS_PATH, `\n- ${text}`, "utf-8");
}

export function readLearnings(): string {
  ensureFiles();
  return fs.readFileSync(LEARNINGS_PATH, "utf-8");
}

/**
 * Controlla se esiste un precedente setup perdente reale per questo simbolo.
 * Restituisce null se non c'è memoria sufficiente (mai inventata).
 */
export function findPriorLoss(symbol: string): LedgerRow | null {
  const rows = readLedgerRows();
  const losses = rows.filter((r) => r.symbol === symbol && r.outcome === "LOSS");
  if (losses.length === 0) return null;
  return losses[losses.length - 1];
}

export { LEDGER_PATH, LEARNINGS_PATH };
