import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const TRADING_BASE_URL = process.env.ALPACA_TRADING_BASE_URL || "https://paper-api.alpaca.markets";
const API_KEY = process.env.ALPACA_API_KEY || "";
const API_SECRET = process.env.ALPACA_API_SECRET || "";
const SYMBOL = process.env.SYMBOL || "BTC/USD";

function headers() {
  return {
    "APCA-API-KEY-ID": API_KEY,
    "APCA-API-SECRET-KEY": API_SECRET,
  };
}

/**
 * Quantità realmente posseduta del simbolo configurato, letta direttamente da Alpaca.
 * Restituisce 0 se non c'è nessuna posizione aperta (nessun dato inventato).
 */
export async function getCurrentPositionQty(): Promise<number> {
  try {
    const alpacaSymbol = SYMBOL.replace("/", "");
    const response = await axios.get(`${TRADING_BASE_URL}/v2/positions/${alpacaSymbol}`, {
      headers: headers(),
    });
    return Number(response.data?.qty || 0);
  } catch (err: any) {
    // 404 = nessuna posizione aperta, è normale e non un errore
    if (err?.response?.status === 404) return 0;
    console.log(`[ACCOUNT] Avviso: impossibile leggere la posizione attuale (${err.message}). Assumo 0.`);
    return 0;
  }
}

/**
 * Saldo disponibile reale (buying power) letto da Alpaca.
 */
export async function getBuyingPower(): Promise<number> {
  const response = await axios.get(`${TRADING_BASE_URL}/v2/account`, {
    headers: headers(),
  });
  return Number(response.data?.buying_power || 0);
}
