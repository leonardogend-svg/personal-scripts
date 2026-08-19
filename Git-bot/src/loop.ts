import { spawn } from "child_process";
import * as dotenv from "dotenv";
import { initFileLogging } from "./logger";

dotenv.config();
initFileLogging();

const INTERVAL_MINUTES = Number(process.env.LOOP_INTERVAL_MINUTES || 5);
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

function runScanOnce(): Promise<void> {
  return new Promise((resolve) => {
    console.log(`\n[LOOP] Avvio npm run scan — ${new Date().toISOString()}`);
    const child = spawn("npm run scan", { stdio: "inherit", shell: true });
    child.on("close", (code) => {
      console.log(`[LOOP] Scan terminato (exit code ${code}).`);
      resolve();
    });
  });
}

async function loop() {
  console.log(`[LOOP] Bot avviato in modalità loop. Scan ogni ${INTERVAL_MINUTES} minuti.`);
  console.log(`[LOOP] Premi CTRL+C in questa finestra per fermarlo in qualsiasi momento.\n`);

  while (true) {
    await runScanOnce();
    console.log(`[LOOP] Prossimo scan tra ${INTERVAL_MINUTES} minuti...`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

loop();
