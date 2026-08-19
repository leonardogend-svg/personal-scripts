import { Candle, Signal } from "./types";

const FAST_PERIOD = Number(process.env.FAST_MA || 9);
const SLOW_PERIOD = Number(process.env.SLOW_MA || 21);

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Calcola il segnale in base all'ultimo incrocio reale tra MA veloce e MA lenta.
 * Richiede almeno SLOW_PERIOD + 1 candele per rilevare un incrocio "fresco".
 */
export function computeSignal(candles: Candle[]): Signal {
  if (candles.length < SLOW_PERIOD + 1) {
    const last = candles[candles.length - 1];
    return {
      action: "HOLD",
      reason: `Dati insufficienti per calcolare MA${SLOW_PERIOD} (servono almeno ${SLOW_PERIOD + 1} candele, disponibili ${candles.length}).`,
      fastMA: 0,
      slowMA: 0,
      price: last?.close ?? 0,
      timestamp: last?.timestamp ?? new Date().toISOString(),
    };
  }

  const closes = candles.map((c) => c.close);

  const currentFast = sma(closes, FAST_PERIOD)!;
  const currentSlow = sma(closes, SLOW_PERIOD)!;

  const previousCloses = closes.slice(0, closes.length - 1);
  const previousFast = sma(previousCloses, FAST_PERIOD)!;
  const previousSlow = sma(previousCloses, SLOW_PERIOD)!;

  const last = candles[candles.length - 1];

  const wasFastBelow = previousFast <= previousSlow;
  const isFastAbove = currentFast > currentSlow;
  const wasFastAbove = previousFast >= previousSlow;
  const isFastBelow = currentFast < currentSlow;

  if (wasFastBelow && isFastAbove) {
    return {
      action: "BUY",
      reason: `Incrocio rialzista: MA${FAST_PERIOD} (${currentFast.toFixed(2)}) ha superato MA${SLOW_PERIOD} (${currentSlow.toFixed(2)}).`,
      fastMA: currentFast,
      slowMA: currentSlow,
      price: last.close,
      timestamp: last.timestamp,
    };
  }

  if (wasFastAbove && isFastBelow) {
    return {
      action: "SELL",
      reason: `Incrocio ribassista: MA${FAST_PERIOD} (${currentFast.toFixed(2)}) è scesa sotto MA${SLOW_PERIOD} (${currentSlow.toFixed(2)}).`,
      fastMA: currentFast,
      slowMA: currentSlow,
      price: last.close,
      timestamp: last.timestamp,
    };
  }

  return {
    action: "HOLD",
    reason: `Nessun incrocio fresco. MA${FAST_PERIOD}=${currentFast.toFixed(2)}, MA${SLOW_PERIOD}=${currentSlow.toFixed(2)}.`,
    fastMA: currentFast,
    slowMA: currentSlow,
    price: last.close,
    timestamp: last.timestamp,
  };
}

export { FAST_PERIOD, SLOW_PERIOD };
