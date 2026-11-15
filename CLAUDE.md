# Fair KM — contesto per Claude Code

## Cos'è
Piattaforma curata di gare trail **piccole che costano il giusto** rispetto a UTMB e ai grandi circuiti, con schede pensate per il trail e dati verificati sulle fonti ufficiali. Niente community né account: l'unico dato personale è l'email della newsletter. Ispirata a nomap.run (Barcellona), ma solo trail e con focus sul prezzo.

Documento completo di progetto: `docs/progetto.md`.

## Dati
- **Postgres su Render è l'unica fonte dei dati delle gare** (deciso il 2026-11-13). Niente Excel né CSV da tenere allineati: l'Excel di partenza è uscito dal progetto, il suo metodo è in `docs/metodo-dati.md`.
- I dati si cambiano passando dalla coda di revisione (`review_queue`) o dalla redazione: gare nuove, correzioni, cambiamenti trovati dal controllo notturno. Fa da solo solo ciò che è certo, secondo la "via di mezzo" (vedi "Controllo notturno").
- Le righe che non avevano ancora fonte primaria o prezzo 2026+ (il vecchio `da-verificare.csv`, 38 righe) sono in coda come proposte `nuova_gara`, con il motivo.
- Il database è chiuso a internet: solo i servizi Render dello stesso account lo raggiungono. Per lavorarci da fuori si aggiunge per il tempo necessario il proprio IP all'`ipAllowList` (in `render.yaml` o dalla dashboard). Per script una tantum: `render jobs create <servizio> --start-command "..."`, che gira dentro Render.
- Migrazioni in `db/migrations/`, applicate da sole prima di ogni deploy (`preDeployCommand` in `render.yaml`).
- Prove in locale, mai sul database di Render: Postgres di Homebrew (`postgresql@18`) usa e getta. I test d'integrazione (`*.db.test.ts`) girano solo con `TEST_DATABASE_URL` e ricreano lo schema da zero; la redazione si prova con `next dev`, `DATABASE_URL` locale e `FAIRKM_ADMIN_LOCALE=<email>` (accesso di prova ignorato in produzione).
- L'app legge i dati a ogni visita (`src/lib/dati.ts`); la landing li prende da `fairkm.com/races/dati.json` quando viene generata (`landing/dati.mjs`). `test/gare-esempio.csv` è una copia ferma solo per test e sviluppo, non una fonte (`test/LEGGIMI.md`).
- Regola che non si rompe: solo fonti primarie e solo prezzi ufficiali dell'edizione 2026 o successive (`fonte_tipo` "primaria…" su ogni prezzo). I dati attuali la rispettano tutti; da ora la controlla l'approvazione in coda, e la landing pubblica solo prezzi che la rispettano (`EDIZIONE_MINIMA` in `landing/dati.mjs`).
- Regole: nessun valore stimato, cella vuota = non verificato; IVA/commissioni "non dichiarate" restano vuote (non significa incluse); miglia/piedi convertiti e arrotondati (km a 2 decimali, D+ al metro).

## Decisioni prese
- **Nome:** Fair KM ("fair" = giusto, "KM" richiama il km-sforzo). Dominio: fairkm.com (da registrare; fairkm.it per proteggere il nome in Italia).
- **Nicchia:** gare trail che costano il giusto. Nessuna esclusione a priori: anche UTMB qualifier o gare di circuito entrano se rispettano la soglia di prezzo. Una qualifica UTMB a prezzo giusto è un plus (badge).
- **Benchmark da scartare:** Lavaredo Ultra Trail (Italia), Ultra-Trail Snowdonia (Regno Unito).
- **Valuta:** sempre la valuta locale della gara. Mai convertire per confrontare.
- **Scaglioni:** l'app mostra lo scaglione in corso e si aggiorna da sola. Scaglioni a date: calcolati dall'app. Scaglioni a esaurimento posti (es. gare UTMB): controllo giornaliero della piattaforma ufficiale d'iscrizione.
- **Controllo notturno, "via di mezzo"** (deciso il 2026-11-15, sostituisce "solo il passaggio di scaglione si pubblica da solo"): automatico dove il dato è certo, coda dove va interpretato.
  1. *Automatico:* la data di verifica dei prezzi dell'edizione in corso, solo se la pagina non è cambiata dalla notte prima **e** ogni prezzo pubblicato con quella fonte compare davvero nella pagina (mai la prima notte, mai per i PDF, mai per i prezzi delle edizioni passate); il passaggio di scaglione per date (calcolato) e da contatore ufficiale; il link rotto dopo più notti di errori, che diventa un avviso in coda (nasconderlo nel sito pubblico è rimandato).
  2. *Automatico con paletti:* i prezzi letti da piattaforme d'iscrizione con dati strutturati, solo quando esiste un estrattore per quella piattaforma, e solo se stessa distanza, valuta e scaglione, edizione uguale o successiva e variazione entro ±30%. Fuori dai paletti va in coda. Finché non c'è un estrattore non si applica nessun prezzo da solo.
  3. *In coda:* tutto il resto (pagine o PDF cambiati, scaglioni ed edizioni nuove, date, regolamento, prezzi non più trovati sulla fonte) e le gare nuove.
  4. *Fiducia per fonte:* una fonte con estrattore parte "in coda"; la redazione la passa ad "automatica" dopo qualche mese di proposte giuste, e torna in coda al primo errore.
  Ciò che si applica da solo si annulla con un clic. Le date di verifica rinnovate si vedono nella pagina Fonti della redazione, non nello storico (sarebbero decine a notte). Il controllo rispetta i siti: robots.txt, una richiesta per fonte a notte, una alla volta per sito. Prima di accenderlo gira qualche notte "di prova", che registra senza toccare né dati né coda.
- **Lingue: sempre multilingua.** Interfaccia e contenuti in italiano, inglese, francese, tedesco e spagnolo; l'inglese è la lingua di riferimento (i testi nuovi si scrivono prima in inglese; le altre lingue devono avere le stesse chiavi, `RIFERIMENTO` in `landing/lingue.mjs`). L'inglese sta alla radice della landing (fairkm.com/), le altre lingue in /it/, /fr/, /de/, /es/; i vecchi link /en/ rimandano alla radice. Nessun testo scritto direttamente nei componenti o nelle pagine: ogni testo sta nei file di traduzione, e una traduzione mancante deve bloccare la build. Chi arriva vede la lingua del browser (inglese se non è fra queste), con un selettore per cambiarla. Landing: `landing/testi/<lingua>.json`. App: `src/testi/<lingua>.json` (stesse regole: inglese in fairkm.com/races/, le altre lingue in /it/races/, /fr/races/, ... con `src/proxy.ts`; il controllo delle traduzioni è in `src/lib/testi.ts`). Eccezioni: il profilo Instagram è solo in inglese (profilo @fairkm_trail in `docs/instagram/profilo.md`, piano in `docs/instagram/primi-9-post.md`); la redazione `/admin/` è solo in italiano (deciso il 2026-11-13: la usa solo la redazione), con i testi comunque fuori dai componenti, in `src/app/admin/testi.ts`.
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
- `sources` (pagine/PDF ufficiali controllati dal job notturno) e `review_queue` (cambi di fonte, link rotti, nuove gare, segnalazioni, modifiche a mano): si pubblica dopo approvazione, salvo ciò che la "via di mezzo" applica da solo (vedi "Controllo notturno")
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
- Un solo dominio: il Worker della landing inoltra a Render solo /races/, /<lingua>/races/, /admin/ e /_next/ (`APP_ORIGIN` in `landing/wrangler.jsonc`, servizio in `render.yaml`); tutto il resto resta alla landing
- Redazione in `/admin/` (coda di revisione, modifica dei dati, nuova gara), protetta tre volte: Cloudflare Access su fairkm.com/admin (policy con l'email della redazione, che non sta nel repository pubblico), il proxy dell'app e il controllo in ogni pagina e azione (`richiediRedattore()` in `src/lib/admin/redattore.ts`). L'app verifica la firma del token di Access (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`): senza configurazione o senza token valido risponde 404, anche chiamata direttamente su .onrender.com

## Genuinità delle informazioni
- Solo fonti primarie, con link e data di verifica su ogni dato
- Testi della redazione ("Perché è speciale") separati dai dati ufficiali
- Chi paga (sponsor, organizzatori, enti del turismo) non cambia prezzi, soglie, fasce né ordine; tutto il pagato è etichettato
- Segnalazioni di errori via email (fair@fairkm.com), controllate a mano nella coda di revisione prima di correggere

## Prossimi passi MVP
1. Completare i dati italiani con più eventi distinti
2. Ricalibrare le soglie con più dati
3. Template scheda gara
4. ~~Setup Next.js + Postgres su Render (senza login)~~ fatto il 2026-11-13: app su fairkm.com/races/, Postgres unica fonte dei dati
5. Mappa e profilo GPX
6. "Le mie gare", salvate solo nel browser
7. Calendario .ics delle gare da abbonare

Fase successiva: PWA (sito installabile su telefono, senza notifiche push: gli avvisi su iscrizioni e lotterie passano da newsletter e calendario .ics). Fino ad allora il sito è responsive, desktop e mobile nel browser. Dettagli in `docs/progetto.md`.
