import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "bot.log");

let initialized = false;

/**
 * Attiva la scrittura su file di tutto ciò che passa da console.log/console.error,
 * mantenendo comunque l'output normale a schermo. Va chiamata una sola volta,
 * il prima possibile nell'entry point (bot.ts, loop.ts).
 */
export function initFileLogging() {
  if (initialized) return;
  initialized = true;

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const originalLog = console.log;
  const originalError = console.error;

  function toFile(prefix: string, args: any[]) {
    const text = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    try {
      fs.appendFileSync(LOG_FILE, `${prefix} ${text}\n`, "utf-8");
    } catch {
      // Se la scrittura su file fallisce, non blocchiamo mai il bot per questo.
    }
  }

  console.log = (...args: any[]) => {
    originalLog(...args);
    toFile("[LOG]", args);
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    toFile("[ERROR]", args);
  };
}

export { LOG_FILE };
