import axios from "axios";
import * as dotenv from "dotenv";
import { RiskDecision, ExecutionResult } from "./types";

dotenv.config();

const TRADING_BASE_URL = process.env.ALPACA_TRADING_BASE_URL || "https://paper-api.alpaca.markets";
const API_KEY = process.env.ALPACA_API_KEY || "";
const API_SECRET = process.env.ALPACA_API_SECRET || "";
const SYMBOL = process.env.SYMBOL || "BTC/USD";

// Guardrail non negoziabile: l'endpoint DEVE contenere "paper-api".
// Se qualcuno cambia ALPACA_TRADING_BASE_URL verso l'endpoint live, il bot si rifiuta di eseguire.
function assertPaperEndpoint() {
  if (!TRADING_BASE_URL.includes("paper-api.alpaca.markets")) {
    throw new Error(
      "GUARDRAIL: ALPACA_TRADING_BASE_URL non è l'endpoint paper di Alpaca. Esecuzione bloccata per sicurezza."
    );
  }
}

/**
 * Simula/esegue un ordine in modalità PAPER su Alpaca.
 * Non viene mai chiamato l'endpoint live: il guardrail sopra blocca qualsiasi configurazione errata.
 */
export async function executeOrder(
  decision: RiskDecision,
  price: number
): Promise<ExecutionResult> {
  assertPaperEndpoint();

  if (!decision.approved || decision.finalAction === "HOLD" || decision.finalAction === "SKIP") {
    return {
      executed: false,
      action: decision.finalAction,
      quantity: 0,
      price,
      reason: decision.reason,
      mode: "paper",
    };
  }

  try {
    const response = await axios.post(
      `${TRADING_BASE_URL}/v2/orders`,
      {
        symbol: SYMBOL.replace("/", ""),
        qty: decision.quantity,
        side: decision.finalAction === "BUY" ? "buy" : "sell",
        type: "market",
        time_in_force: "gtc",
      },
      {
        headers: {
          "APCA-API-KEY-ID": API_KEY,
          "APCA-API-SECRET-KEY": API_SECRET,
        },
      }
    );

    return {
      executed: true,
      action: decision.finalAction,
      quantity: decision.quantity,
      price,
      reason: `Ordine paper inviato con successo: ${decision.reason}`,
      orderId: response.data?.id,
      mode: "paper",
    };
  } catch (err: any) {
    const message = err?.response?.data?.message || err.message || "Errore sconosciuto";
    return {
      executed: false,
      action: decision.finalAction,
      quantity: decision.quantity,
      price,
      reason: `Ordine paper NON eseguito: ${message}`,
      mode: "paper",
    };
  }
}
