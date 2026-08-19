import { Signal, RiskDecision } from "./types";

const QTY = Number(process.env.QTY || 0.001);
const MAX_POSITION = Number(process.env.MAX_POSITION || 0.01);

/**
 * Approva o respinge il segnale della strategia in base alle regole di rischio configurate.
 * Ogni decisione include sempre una motivazione in linguaggio semplice.
 */
export function checkRisk(
  signal: Signal,
  currentPosition: number = 0,
  buyingPower: number = Infinity
): RiskDecision {
  if (signal.action === "HOLD") {
    return {
      approved: false,
      finalAction: "HOLD",
      reason: "Nessuna azione richiesta dalla strategia, nessun controllo di rischio necessario.",
      quantity: 0,
    };
  }

  // Le crypto su Alpaca non si possono vendere allo scoperto: serve possedere la quantità.
  if (signal.action === "SELL" && currentPosition < QTY) {
    return {
      approved: false,
      finalAction: "SKIP",
      reason: `SKIP: segnale SELL ma la posizione posseduta (${currentPosition}) è inferiore alla quantità richiesta (${QTY}). Le crypto non si possono vendere allo scoperto.`,
      quantity: 0,
    };
  }

  const estimatedCost = QTY * signal.price;
  if (signal.action === "BUY" && estimatedCost > buyingPower) {
    return {
      approved: false,
      finalAction: "SKIP",
      reason: `SKIP: costo stimato dell'ordine (~$${estimatedCost.toFixed(2)}) supera il saldo disponibile (~$${buyingPower.toFixed(2)}).`,
      quantity: 0,
    };
  }

  const projectedPosition =
    signal.action === "BUY" ? currentPosition + QTY : currentPosition - QTY;

  if (Math.abs(projectedPosition) > MAX_POSITION) {
    return {
      approved: false,
      finalAction: "SKIP",
      reason: `SKIP: la posizione risultante (${projectedPosition.toFixed(4)}) supererebbe il limite massimo configurato (${MAX_POSITION}).`,
      quantity: QTY,
    };
  }

  if (QTY <= 0) {
    return {
      approved: false,
      finalAction: "SKIP",
      reason: "SKIP: quantità configurata non valida (QTY <= 0).",
      quantity: 0,
    };
  }

  return {
    approved: true,
    finalAction: signal.action,
    reason: `Rischio approvato: quantità ${QTY} (~$${estimatedCost.toFixed(2)}), posizione proiettata ${projectedPosition.toFixed(4)} entro il limite ${MAX_POSITION}.`,
    quantity: QTY,
  };
}

export { QTY, MAX_POSITION };
