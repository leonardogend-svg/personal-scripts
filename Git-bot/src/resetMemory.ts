import * as fs from "fs";
import { LEDGER_PATH, LEARNINGS_PATH } from "./memory";

const LEDGER_HEADER = "timestamp,symbol,action,price,quantity,reason,mode,outcome,pnl";

fs.writeFileSync(LEDGER_PATH, LEDGER_HEADER + "\n", "utf-8");
fs.writeFileSync(
  LEARNINGS_PATH,
  "# Learnings\n\nNessuna lezione ancora registrata. Verrà popolato solo con perdite reali osservate da replay:raw o da trade paper reali.\n",
  "utf-8"
);

console.log("Memoria resettata: data/ledger.csv e data/learnings.md tornati allo stato vuoto.");
