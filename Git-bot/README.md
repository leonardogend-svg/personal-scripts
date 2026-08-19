# Paper Trading Bot — BTC/USD su Alpaca

Bot di **paper trading** (nessun denaro reale) in TypeScript/Node.js. Strategia: incrocio di medie mobili (9/21). Dati di mercato reali via Alpaca. Esecuzione ordini **solo** sull'endpoint paper di Alpaca. Impara nel tempo da trade reali, con stop loss automatico e limite di perdita giornaliera.

## ⚠️ Sicurezza — leggi prima di tutto
- Le tue chiavi API vanno SOLO nel file `.env` (mai in `.env.example`, mai committate, mai in chat, mai in screenshot).
- Guardrail hardcoded in `src/execution.ts`: blocca l'esecuzione se l'URL non contiene `paper-api.alpaca.markets`.
- Nessun trade reale viene mai piazzato. Nessuna raccomandazione finanziaria è implicita in questo codice.

## Installazione

```bash
npm install
cp .env.example .env
```

Apri `.env` e inserisci `ALPACA_API_KEY` e `ALPACA_API_SECRET` dalla sezione API Keys del tuo account **Paper Trading** su Alpaca (menu account in alto a sinistra sulla dashboard → API Keys, richiede MFA attivo).

## Comandi disponibili

| Comando | Cosa fa |
|---|---|
| `npm run scan` | Un ciclo completo singolo: chiude posizioni scadute/in stop-loss, calcola il segnale, controlla kill switch/memoria/rischio, esegue un ordine paper se tutto approva. |
| `npm run loop` | Ripete `npm run scan` automaticamente ogni `LOOP_INTERVAL_MINUTES` (default 5), senza bisogno di Task Scheduler o password. CTRL+C per fermare. |
| `npm run replay:raw` | Backtest onesto sui dati storici reali (senza usare memoria). Tabella trade + metriche. |
| `npm run replay:memory` | Come sopra, ma consulta la memoria per decidere se bloccare (SKIP) il segnale attuale. |
| `npm run memory:reset` | Svuota `data/ledger.csv` e `data/learnings.md`. |
| `npm run stats` | Riepilogo: trade aperti/chiusi, win rate, PnL cumulato, numero di SKIP, lezioni registrate. |

## Come impara il bot nel tempo

Ogni volta che gira `npm run scan` (quindi anche ogni ciclo di `npm run loop`):

1. **Chiude le posizioni aperte in precedenza**, se: il prezzo ha toccato lo stop loss (`STOP_LOSS_PCT`, chiusura immediata), OPPURE è passato il tempo massimo configurato (`POSITION_EXIT_MINUTES`). In entrambi i casi usa il prezzo reale attuale — mai inventato.
2. Se un trade si chiude in perdita, scrive automaticamente una lezione in `data/learnings.md`.
3. Controlla il **kill switch giornaliero**: se la perdita cumulata di oggi supera `MAX_DAILY_LOSS_PCT`, blocca ogni nuovo trade fino al giorno dopo.
4. Controlla la **memoria**: se il nuovo segnale somiglia a un setup già andato in perdita, lo trasforma in SKIP.
5. Controlla il **rischio reale**: legge da Alpaca quanto possiedi e quanto saldo hai *in questo momento*, blocca SELL senza possesso (le crypto non si vendono allo scoperto) e BUY che costerebbero più del saldo disponibile.
6. Solo se tutto approva, esegue l'ordine paper.

## Protezioni di rischio attive

| Protezione | Variabile `.env` | Cosa fa |
|---|---|---|
| Dimensione posizione | `QTY`, `MAX_POSITION` | Quantità per trade e limite massimo di esposizione. |
| Stop loss per trade | `STOP_LOSS_PCT` | Chiude subito un trade se la perdita raggiunge questa percentuale. |
| Scadenza tempo | `POSITION_EXIT_MINUTES` | Chiude comunque un trade dopo questo tempo, se lo stop loss non è scattato prima. |
| Kill switch giornaliero | `MAX_DAILY_LOSS_PCT` | Blocca nuovi trade per il resto della giornata se la perdita cumulata li supera. |
| No short su crypto | *(automatico)* | Blocca SELL se non possiedi già l'asset. |
| Controllo saldo | *(automatico)* | Blocca BUY che costerebbero più del saldo disponibile. |
| Guardrail anti-live | *(hardcoded)* | Impossibile eseguire ordini fuori dall'endpoint paper. |

## Dove vivono i dati

- `data/ledger.csv` — ogni trade/skip: `timestamp,symbol,action,price,quantity,reason,mode,outcome,pnl`
- `data/learnings.md` — lezioni in linguaggio semplice da perdite reali osservate
- `logs/bot.log` — cronologia testuale completa di tutto ciò che il bot stampa (utile se chiudi il terminale per errore)

Nessuna perdita, candela o lezione viene mai inventata.

## Configurazione (`.env`)

```
SYMBOL=BTC/USD
TIMEFRAME=5Min
FAST_MA=9
SLOW_MA=21

QTY=0.0004              # ~$25 per trade con BTC a $64k — calibrato per saldi piccoli (es. $100)
MAX_POSITION=0.0004
STOP_LOSS_PCT=2
MAX_DAILY_LOSS_PCT=5

LOOP_INTERVAL_MINUTES=5
POSITION_EXIT_MINUTES=30
```

## Modalità broker: solo paper

- Endpoint trading: `https://paper-api.alpaca.markets` (mai `api.alpaca.markets`, l'endpoint live).
- Endpoint dati: `https://data.alpaca.markets`.
- Guardrail hardcoded in `src/execution.ts`: il bot si rifiuta di eseguire ordini se l'endpoint non è quello paper.

## Limiti e cose da sapere

- Strategia semplice a scopo didattico/sperimentale, non una promessa di profitto.
- Il paper trading non replica perfettamente slippage reale, impatto sugli ordini o code di esecuzione.
- I risultati passati (paper o replay) non garantiscono risultati futuri, specialmente in live.

## Prossimi esperimenti possibili

1. Cambia `SYMBOL` in `ETH/USD` e confronta `replay:raw`.
2. Prova timeframe diversi (`15Min`, `1Hour`).
3. Modifica `FAST_MA`/`SLOW_MA` (es. 5/20) e confronta il win rate.
4. Regola `STOP_LOSS_PCT` e osserva come cambia la frequenza delle chiusure anticipate in `npm run stats`.
