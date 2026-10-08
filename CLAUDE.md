# Trail Platform — contesto per Claude Code

## Cos'è
Piattaforma curata di gare trail **piccole che costano il giusto** rispetto a UTMB e ai grandi circuiti, con schede pensate per il trail e una community che si mette in contatto e si scambia consigli verificati. Ispirata a nomap.run (Barcellona), ma solo trail e con focus sul prezzo.

Documento completo di progetto: `docs/progetto.md`. Dati di benchmark: `data/gare.csv`.

## Decisioni prese
- **Nicchia:** gare trail che costano il giusto. Nessuna esclusione a priori: anche UTMB qualifier o gare di circuito entrano se rispettano la soglia di prezzo. Una qualifica UTMB a prezzo giusto è un plus (badge).
- **Benchmark da scartare:** Lavaredo Ultra Trail (Italia), Ultra-Trail Snowdonia (Regno Unito).
- **Valuta:** sempre la valuta locale della gara. Mai convertire per confrontare.
- **Lingua dell'interfaccia e dei contenuti:** italiano (inglese in futuro).
- **Community:** forum con meccaniche tipo Reddit (una comunità per gara, etichette, 2 livelli di risposta, solo voto "utile", finisher in evidenza), non un clone di Reddit. Stile sobrio proprio solo per la community; elenco e schede con stile pulito e moderno. Niente messaggi privati per ora. Dettagli in `docs/progetto.md`.

## Metriche
- `km_sforzo = km + dplus / 100`
- `costo_km_sforzo = prezzo / km_sforzo` (valuta locale)
- `indice_benchmark = costo_km_sforzo / costo_km_sforzo_benchmark_nazionale - 1` (es. Adamello 170 = −53% vs Lavaredo 120K)
- `aumento_yoy = prezzo_anno / prezzo_anno_precedente - 1`, confrontando sempre **stesso scaglione** (early con early, pieno con pieno), **stessa base** (IVA e commissioni incluse in entrambi) e **stessa valuta**. Se km o D+ cambiano, confrontare `costo_km_sforzo` ed etichettare "percorso modificato".

## Soglie provvisorie (da ricalibrare con più dati)
- Gare ≥ 30 km: `costo_km_sforzo` ≤ 1,00 → "costa il giusto"
- Gare < 30 km: ≤ 1,20
- Oltre 1,50 → fascia grandi circuiti
- Badge rosso aumento: `aumento_yoy` > +15%
- Fell race e gare di club in categoria separata (abbassano le medie)

## Filtri d'ingresso di una gara
- Costo per km-sforzo sotto soglia
- Almeno 2–3 edizioni alle spalle
- Regolamento pubblico con percorso, cancelli, materiale obbligatorio

## Modello dati (indicativo)
- `races`: id, nome, paese, regione, organizzatore, sito, qualifica_utmb, itra
- `distances`: id, race_id, nome, km, dplus, cancelli, materiale_obbligatorio, gpx_url
- `prices`: id, distance_id, edizione, prezzo, valuta, scaglione (early/standard/last/lotteria), include_iva, include_commissioni, fonte_url, data_rilevazione
- `hidden_costs`: id, race_id, tipo (tesseramento, crew, requisito indice, navetta, alloggio), descrizione, importo
- `users`, `participations` (utente × gara × edizione, "Correrò questa gara"), `reviews` (strutturate, legate a edizione, con flag finisher verificato)

Il prezzo NON è un campo della gara: è uno storico per edizione.

## Stack
Tutto su **Render** (account già esistente):
- Next.js come Web Service Render (hosting)
- Render Postgres (database)
- Auth.js (NextAuth) per il login, con provider Strava; sessioni e utenti nel Postgres di Render
- Persistent Disk di Render montato sul Web Service per GPX e immagini
  - Vincoli: serve un'istanza a pagamento, una sola istanza (niente scaling orizzontale), niente deploy a zero downtime. Se diventa un limite, spostare i file su un object storage S3-compatibile.
- MapLibre o Mapbox per GPX e profilo altimetrico
- Login con Strava per verificare i finisher

## Genuinità delle informazioni
- Dati ufficiali (dal regolamento, con link alla fonte) separati dai consigli della community
- Finisher verificato tramite Strava/GPX o classifiche ufficiali
- Ogni contributo legato a edizione e data
- Recensioni strutturate (segnaletica, ristori, difficoltà vs dichiarato, organizzazione)
- Organizzatori con profilo marcato, non possono recensire la propria gara; contenuti sponsorizzati sempre etichettati

## Prossimi passi MVP
1. Completare i dati italiani con più eventi distinti
2. Ricalibrare le soglie con più dati
3. Template scheda gara
4. Setup Next.js + Postgres + Auth.js su Render
5. Mappa e profilo GPX
6. "Correrò questa gara"
7. Login Strava e badge finisher verificato
