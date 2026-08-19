import axios from "axios";
import * as dotenv from "dotenv";
import { Candle } from "./types";

dotenv.config();

const DATA_BASE_URL = process.env.ALPACA_DATA_BASE_URL || "https://data.alpaca.markets";
const API_KEY = process.env.ALPACA_API_KEY || "";
const API_SECRET = process.env.ALPACA_API_SECRET || "";
const SYMBOL = process.env.SYMBOL || "BTC/USD";
const TIMEFRAME = process.env.TIMEFRAME || "5Min";

function assertCredentials() {
  if (!API_KEY || !API_SECRET) {
    throw new Error(
      "ALPACA_API_KEY / ALPACA_API_SECRET mancanti. Copia .env.example in .env e inserisci le tue chiavi PAPER."
    );
  }
}

/**
 * Recupera le candele storiche reali per il simbolo configurato.
 * Nessun dato generato o fittizio: se la chiamata fallisce, l'errore viene propagato onestamente.
 */
export async function fetchCandles(limit: number = 100): Promise<Candle[]> {
  assertCredentials();

  const url = `${DATA_BASE_URL}/v1beta3/crypto/us/bars`;

  const response = await axios.get(url, {
    headers: {
      "APCA-API-KEY-ID": API_KEY,
      "APCA-API-SECRET-KEY": API_SECRET,
    },
    params: {
      symbols: SYMBOL,
      timeframe: TIMEFRAME,
      limit,
    },
  });

  const bars = response.data?.bars?.[SYMBOL];

  if (!bars || !Array.isArray(bars) || bars.length === 0) {
    throw new Error(
      `Nessuna candela reale ricevuta da Alpaca per ${SYMBOL} (${TIMEFRAME}). Verifica simbolo, timeframe e chiavi API.`
    );
  }

  return bars.map((bar: any) => ({
    timestamp: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}

export function getConfiguredSymbol(): string {
  return SYMBOL;
}

export function getConfiguredTimeframe(): string {
  return TIMEFRAME;
}
