# Fair KM — contesto per Claude Code

## Cos'è
Piattaforma curata di gare trail **piccole che costano il giusto** rispetto a UTMB e ai grandi circuiti, con schede pensate per il trail e dati verificati sulle fonti ufficiali. Niente community né account: l'unico dato personale è l'email della newsletter. Ispirata a nomap.run (Barcellona), ma solo trail e con focus sul prezzo.

Documento completo di progetto: `docs/progetto.md`.

## Dati
- `data/trail-gare.xlsx`: file di lavoro della ricerca (foglio "Gare", con fonti, zona e data di verifica; fogli "Metodo e limiti" e "Fonti").
- `data/riferimenti.csv`: distanze di riferimento nazionale (Lavaredo 20K/50K/80K/120K, UTS 50K/100M), mantenute a mano. Fonti ancora da verificare.
- `data/gare.csv`: **generato**, non modificarlo a mano. Si rigenera con `python3 scripts/xlsx-a-csv.py` (Excel + riferimenti). È l'unica fonte letta dall'app.
- `data/da-verificare.csv`: righe escluse finché non hanno una fonte primaria o un dato certo (colonna `motivo`). Non vengono importate.
- Regola che non si rompe: solo fonti primarie e solo prezzi ufficiali dell'edizione 2026 o successive. Il resto va in `da-verificare.csv` (lo script lo esclude da solo, `EDIZIONE_MINIMA` in `scripts/xlsx-a-csv.py`).
- Regole: nessun valore stimato, cella vuota = non verificato; IVA/commissioni "non dichiarate" restano vuote (non significa incluse); miglia/piedi convertiti e arrotondati (km a 2 decimali, D+ al metro).

## Decisioni prese
- **Nome:** Fair KM ("fair" = giusto, "KM" richiama il km-sforzo). Dominio: fairkm.com (da registrare; fairkm.it per proteggere il nome in Italia).
- **Nicchia:** gare trail che costano il giusto. Nessuna esclusione a priori: anche UTMB qualifier o gare di circuito entrano se rispettano la soglia di prezzo. Una qualifica UTMB a prezzo giusto è un plus (badge).
- **Benchmark da scartare:** Lavaredo Ultra Trail (Italia), Ultra-Trail Snowdonia (Regno Unito).
- **Valuta:** sempre la valuta locale della gara. Mai convertire per confrontare.
- **Scaglioni e controllo giornaliero:** l'app mostra lo scaglione in corso e si aggiorna da sola. Scaglioni a date: calcolati dall'app. Scaglioni a esaurimento posti (es. gare UTMB): controllo giornaliero della piattaforma ufficiale d'iscrizione. Solo il passaggio di scaglione letto dal contatore ufficiale si pubblica in automatico; ogni altro cambiamento (prezzi, scaglioni nuovi, date, regolamento) va nella coda di revisione e si pubblica solo dopo approvazione.
- **Lingue: sempre multilingua.** Interfaccia e contenuti in italiano, inglese, francese, tedesco e spagnolo; l'inglese è la lingua di riferimento (i testi nuovi si scrivono prima in inglese; le altre lingue devono avere le stesse chiavi, `RIFERIMENTO` in `landing/lingue.mjs`). L'inglese sta alla radice della landing (fairkm.com/), le altre lingue in /it/, /fr/, /de/, /es/; i vecchi link /en/ rimandano alla radice. Nessun testo scritto direttamente nei componenti o nelle pagine: ogni testo sta nei file di traduzione, e una traduzione mancante deve bloccare la build. Chi arriva vede la lingua del browser (inglese se non è fra queste), con un selettore per cambiarla. Landing: `landing/testi/<lingua>.json`. Eccezione: il profilo Instagram è solo in inglese (profilo @fairkm_trail in `docs/instagram/profilo.md`, piano in `docs/instagram/primi-9-post.md`).
- **Niente community né account** (deciso il 2026-10-26): niente forum, login, profili, recensioni degli utenti né Strava. Unico dato personale: l'email della newsletter (Brevo, doppia conferma). Di conseguenza: nessun modulo oltre all'iscrizione alla newsletter; nessun contenuto incorporato da terzi (YouTube, Instagram, Strava: solo link); mappe senza fornitori esterni di tile; font ospitati da noi; statistiche solo senza cookie (Cloudflare Web Analytics); unico cookie quello tecnico della lingua. "Le mie gare" si salva solo nel browser (localStorage), mai sul server. Motivi in `docs/progetto.md`.
- **Contenuti di terzi:** prezzi, distanze e date sono fatti e si riportano con il link alla fonte; foto, testi e GPX degli organizzatori solo con il loro permesso. Accanto a ogni prezzo: data di verifica e "fa fede il sito ufficiale".

## Metriche
- `km_sforzo = km + dplus / 100`
- `costo_km_sforzo = prezzo / km_sforzo` (valuta locale)
- `indice_benchmark = costo_km_sforzo / costo_km_sforzo_benchmark_nazionale - 1` (es. Adamello 170 = −53% vs Lavaredo 120K)
- **Riferimento nazionale, regola "distanza più simile"** (uguale per tutti i paesi, un solo metro di misura): ogni distanza si confronta con la distanza di riferimento dello stesso paese e della stessa valuta più vicina in km-sforzo. Riferimenti: Italia = Lavaredo 20K/50K/80K/120K, Regno Unito = UTS 50K/100M. Motivo: anche il costo per km-sforzo cala con la lunghezza, quindi confrontare taglie simili isola l'effetto prezzo. In tabella si indica sempre contro cosa (es. "−59% vs Lavaredo 50K").
- Tutte le metriche stanno in `src/lib/metriche.ts` (con test in `metriche.test.ts`), le soglie in `src/lib/soglie.ts`. Mai calcolarle nei componenti.
- `aumento_yoy = prezzo_anno / prezzo_anno_precedente - 1`, confrontando sempre **stesso scaglione** (early con early, pieno con pieno), **stessa base** (IVA e commissioni incluse in entrambi) e **stessa valuta**. Se km o D+ cambiano, confrontare `costo_km_sforzo` ed etichettare "percorso modificato".

## Soglie provvisorie (da ricalibrare con più dati)
- Gare ≥ 30 km (km reali, non km-sforzo): `costo_km_sforzo` ≤ 1,00 → "costa il giusto" (badge verde)
- Gare < 30 km: ≤ 1,20 (badge verde)
- Tra la soglia e 1,50 (incluso) → "sopra soglia" (badge giallo)
- Oltre 1,50 → fascia grandi circuiti (badge rosso)
- Stesse soglie numeriche per ogni valuta locale, senza conversioni
- Badge rosso aumento: `aumento_yoy` > +15%
- Fell race e gare di club in categoria separata (abbassano le medie): badge grigio "categoria a parte"
- Le distanze di riferimento nazionale hanno l'etichetta "riferimento"

## Filtri d'ingresso di una gara
- Costo per km-sforzo sotto soglia
- Almeno 2–3 edizioni alle spalle
- Regolamento pubblico con percorso, cancelli, materiale obbligatorio

## Modello dati (indicativo)
- `races`: id, nome, paese, regione, organizzatore, sito, qualifica_utmb, itra
- `distances`: id, race_id, nome, km, dplus, cancelli, materiale_obbligatorio, gpx_url
- `prices`: id, distance_id, edizione, prezzo, valuta, scaglione (early/standard/last/lotteria), ordine (early 1, early 2), valido_dal, valido_fino, fino_a_iscritti, include_iva, include_commissioni, fonte_url, data_rilevazione
- `editions`: race_id, anno, data_gara, data_gara_fine, iscrizioni_apertura/chiusura, lotteria_apertura/chiusura/esito, url_iscrizione, posti_max, stato_manuale (sold_out/annullata/rinviata, solo da fonte), fonte_url, data_verifica. Date tutte facoltative; lo stato delle iscrizioni si calcola dalle date, non si salva
- `sources` (pagine/PDF ufficiali controllati dal job notturno) e `review_queue` (cambi di fonte, link rotti, nuove gare, segnalazioni): niente si pubblica senza approvazione
- `hidden_costs`: id, race_id, tipo (tesseramento, crew, requisito indice, navetta, alloggio), descrizione, importo
- Nessuna tabella di utenti, partecipazioni o recensioni: il database contiene solo dati delle gare. Gli iscritti alla newsletter stanno solo in Brevo.

Il prezzo NON è un campo della gara: è uno storico per edizione. Il prezzo usato per badge e indice benchmark è lo scaglione standard; quello dello scaglione in corso si mostra accanto. Se una distanza non ha un prezzo standard (es. solo early) si mostra quel prezzo con il suo scaglione, senza costo/km-sforzo, fascia, indice né aumento (regola in `src/lib/elenco.ts`).

## Stack
Tutto su **Render** (account già esistente):
- Next.js come Web Service Render (hosting)
- Render Postgres (database, solo dati delle gare)
- Nessun login (niente Auth.js né Strava)
- Persistent Disk di Render montato sul Web Service per GPX e immagini
  - Vincoli: serve un'istanza a pagamento, una sola istanza (niente scaling orizzontale), niente deploy a zero downtime. Se diventa un limite, spostare i file su un object storage S3-compatibile.
- MapLibre per GPX e profilo altimetrico, con mappa di base ospitata da noi (file PMTiles), così l'IP dei visitatori non va a fornitori di mappe
- Landing su Cloudflare (Worker e pagine statiche), newsletter con Brevo

## Genuinità delle informazioni
- Solo fonti primarie, con link e data di verifica su ogni dato
- Testi della redazione ("Perché è speciale") separati dai dati ufficiali
- Chi paga (sponsor, organizzatori, enti del turismo) non cambia prezzi, soglie, fasce né ordine; tutto il pagato è etichettato
- Segnalazioni di errori via email (fair@fairkm.com), controllate a mano nella coda di revisione prima di correggere

## Prossimi passi MVP
1. Completare i dati italiani con più eventi distinti
2. Ricalibrare le soglie con più dati
3. Template scheda gara
4. Setup Next.js + Postgres su Render (senza login)
5. Mappa e profilo GPX
6. "Le mie gare", salvate solo nel browser
7. Calendario .ics delle gare da abbonare

Fase successiva: PWA (sito installabile su telefono, senza notifiche push: gli avvisi su iscrizioni e lotterie passano da newsletter e calendario .ics). Fino ad allora il sito è responsive, desktop e mobile nel browser. Dettagli in `docs/progetto.md`.
