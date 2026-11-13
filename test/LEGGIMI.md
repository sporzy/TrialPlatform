# Dati d'esempio per test e sviluppo

`gare-esempio.csv` è una **copia ferma** dei dati del 13 novembre 2026, il giorno in cui Postgres è diventato l'unica fonte dei dati delle gare: 75 gare, 102 distanze, 122 prezzi, verificati l'8 e il 12 ottobre 2026.

- Serve solo ai test (`src/lib/*.test.ts`, `landing/landing.test.mjs`) e all'app in locale senza `DATABASE_URL`.
- **Non è una fonte**: non si aggiorna e non si corregge. I dati veri stanno in Postgres e si cambiano solo dalla coda di revisione.
- In produzione l'app non la legge mai: senza `DATABASE_URL` si ferma con un errore.
- Il formato è quello del vecchio `data/gare.csv`, letto da `importaGare()` in `src/lib/importa-csv.ts`.
