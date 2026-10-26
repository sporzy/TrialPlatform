# Fair KM — piattaforma di gare trail (ispirata a nomap)

> **Fair KM** (fairkm.com). Una piattaforma curata di gare trail piccole che costano il giusto rispetto a UTMB e ai grandi circuiti, con schede pensate per il trail e dati verificati sulle fonti ufficiali. Niente community né account: l'unico dato personale è l'email della newsletter.

## 1. Il riferimento: nomap.run

**Cos'è:** piattaforma curata di gare di corsa poco conosciute nel mondo, con un lato social. Claim: *Run. Connect. Remember.*
**Chi c'è dietro:** Sara Forni (runner, giornalista, content creator su YouTube) e Giuseppe Barreca (runner e software engineer), Barcellona.
**Stato:** agli inizi, gare in evidenza quasi tutte spagnole.

### Come funziona
- Schede editoriali: tag, luogo, data, distanze, citazione di un finisher, "Perché è speciale", contesto, link al sito ufficiale.
- Pulsante "Correrò questa gara" per vedere chi altro partecipa.
- Crescita: audience prima e prodotto dopo (Instagram, YouTube).

### Stack (dedotto)
| Componente | Tecnologia | Certezza |
|---|---|---|
| Frontend | Next.js | Alta |
| Storage immagini | Supabase Storage | Alta |
| Database e login | Supabase | Probabile |
| Hosting | Vercel | Ipotesi |

## 2. La versione trail

### Posizionamento
**Gare trail piccole che costano il giusto** rispetto a UTMB e ai grandi circuiti: non solo economiche, ma con un buon rapporto tra prezzo, sforzo e ciò che è incluso. Nessuna esclusione a priori: anche UTMB qualifier o gare di circuito entrano se rispettano la soglia di prezzo (la qualifica UTMB a prezzo giusto è un plus da evidenziare con un badge).

### Scheda gara
**Base:** luogo, data, distanze, tag e foto, "Perché è speciale" (testo della redazione), link ufficiale.
**Specifico trail:** D+/D−, quota massima, GPX con mappa e profilo, cancelli orari e ristori, materiale obbligatorio, punti ITRA e Running Stones UTMB, apertura iscrizioni/lotteria, logistica, terreno, prezzo con €/km-sforzo e cosa include, aumento % rispetto all'edizione precedente.

### Stack
**Contenuti di terzi:** prezzi, distanze e date sono fatti e si riportano con il link alla fonte; foto, testi e GPX degli organizzatori solo con il loro permesso. Accanto a ogni prezzo: data di verifica e "fa fede il sito ufficiale".

### Stack
Next.js (Web Service) su Render e Render Postgres per i dati delle gare, Persistent Disk per GPX e immagini. MapLibre con mappa di base ospitata da noi (file PMTiles), così l'IP dei visitatori non va a fornitori di mappe. Nessun login: il database non contiene dati degli utenti. "Le mie gare" si salva solo nel browser (localStorage).

### Niente community né account (decisione del 2026-10-26)
Fair KM non ha community, forum, login, profili né recensioni degli utenti. Prima era previsto un forum con meccaniche tipo Reddit e login Strava per i finisher; è stato tolto per tre motivi:
- **Privacy al minimo.** L'unico dato personale è l'email di chi si iscrive alla newsletter (Brevo, doppia conferma). Niente account, niente dati Strava (attività, tracce GPS, frequenza cardiaca, che è un dato sanitario), niente richieste di accesso o cancellazione da gestire oltre a quelle della newsletter.
- **Niente moderazione.** I contenuti scritti dagli utenti porterebbero gli obblighi del Digital Services Act (segnalazione e rimozione), il rischio di diffamazione verso gli organizzatori e moderazione quotidiana.
- **Fuoco sul valore distintivo:** prezzi ufficiali verificati e confronto per km-sforzo.

Regole che ne seguono:
- Nessun modulo oltre all'iscrizione alla newsletter; per i contatti basta l'email fair@fairkm.com.
- Nessun contenuto incorporato da terzi (YouTube, Instagram, Strava): solo link.
- Mappe senza fornitori esterni di tile; font ospitati da noi (già così nella landing).
- Statistiche solo senza cookie (Cloudflare Web Analytics); l'unico cookie è quello tecnico della lingua.
- Fair KM non gestisce spazi di discussione: chi vuole confrontarsi con altri runner lo fa altrove (Instagram, gruppi delle gare).

## 3. Criteri di selezione delle gare

### Metrica principale
- Km-sforzo = km + D+/100 (es. 50 km con 3.000 m D+ = 80 km-sforzo)
- Costo per km-sforzo = prezzo / km-sforzo, in valuta locale

### Filtri d'ingresso
- Costo per km-sforzo sotto la soglia
- Almeno 2–3 edizioni alle spalle
- Regolamento pubblico con percorso, cancelli, materiale obbligatorio

### Valore mostrato nella scheda
Cosa include il prezzo (ristori, pacco gara, navette, pasta party, foto, servizio medico, chip) e costi nascosti (certificato medico, tesseramento, alloggio obbligatorio, navetta, crew).

### Gestione dei prezzi
Prezzo salvato per edizione e scaglione. Aggiornato a ogni edizione.

### Aumento rispetto all'anno precedente
- Struttura: storico prezzi per gara, distanza, edizione, valuta, scaglione, cosa include.
- Confronto: stesso scaglione, stessa base (IVA/commissioni), valuta locale; se il percorso cambia si confronta il €/km-sforzo con etichetta "percorso modificato".
- Visualizzazione: badge verde/giallo/rosso (rosso oltre +15%), confronto con l'inflazione (ISTAT/Eurostat), grafico con almeno 3 edizioni.
- Fonti storiche: Wayback Machine, forum, articoli.

### Benchmark da scartare: Lavaredo Ultra Trail
| Gara | D+ | 2026 | 2027 | €/km 2027 | €/km-sf 2027 | Aumento |
|---|---|---|---|---|---|---|
| 120K | 5.800 | 267,05 € | 320,31 € | 2,67 | 1,80 | +20% |
| 80K | 4.600 | 190,75 € | 224,49 € | 2,81 | 1,78 | +18% |
| 50K | 2.600 | 119,90 € | 173,84 € | 3,48 | 2,29 | +45% |
| 20K | 1.000 | 70,85 € | 83,50 € | 4,18 | 2,78 | +18% |
| 10K | n.d. | 38,15 € | 39,70 € | 3,97 | n.d. | +4% |

Il €/km penalizza le gare corte: per questo si usa il km-sforzo e soglie per fascia.

### Ricerca comparativa (40 gare)
Dati completi in `data/gare.csv`.

**Cosa emerge**
- I grandi circuiti costano circa il doppio per km-sforzo (Italia: piccole 0,65–1,05 €, Lavaredo 1,78–2,29 €).
- Nel Regno Unito il divario è minore: le gare commerciali non UTMB stanno a 1,25–1,35 £; le fell race sono un mondo a parte (Borrowdale £16).
- Aumenti diffusi: Lakeland 100 £190→£220, Lakeland 50 £160→£190, Fellsman £100→£110, Adamello early bird +10–20%, Ring of Steall £80 (2017) → £139 (2022).
- Costi nascosti: crew obbligatoria alla West Highland Way Race, UTMB Index per la UTS 100M, tesseramento in Italia.
- Prezzi variabili senza listino fisso (Skyline Scotland).
- Escluse: gare a tappe ed eventi benefici con raccolta fondi obbligatoria.

### Parametri proposti
1. Soglia costo per km-sforzo: ≤ 1,00 (≥ 30 km), ≤ 1,20 (< 30 km); oltre 1,50 = grandi circuiti.
2. Indice vs riferimento nazionale (Lavaredo per l'Italia, UTS per il Regno Unito).
3. Allarme aumenti oltre +15% anno su anno.
4. Trasparenza del prezzo: listino fisso = plus, prezzo variabile = minus.
5. Costi obbligatori extra in evidenza.
6. Fell race e gare di club in categoria a parte.

## 4. Genuinità delle informazioni
1. Solo fonti primarie, con link e data di verifica su ogni dato.
2. Nessun valore stimato: cella vuota = non verificato.
3. Testi della redazione ("Perché è speciale") separati dai dati ufficiali.
4. Conflitti d'interesse: chi paga (sponsor, organizzatori, enti del turismo) non cambia prezzi, soglie, fasce né ordine; tutto il pagato è etichettato.
5. Segnalazioni di errori via email, controllate a mano nella coda di revisione prima di correggere.
6. Accanto a ogni prezzo: "verificato il [data], fa fede il sito ufficiale".

## 5. Monetizzazione
Principio: nessuna fonte di guadagno deve mettere a rischio la fiducia, né richiedere dati degli utenti oltre all'email della newsletter.

| Fonte | Come | Quando |
|---|---|---|
| Affiliazioni | Alloggi vicino alla gara, assicurazioni: solo link, il tracciamento avviene sul sito del partner | Da subito, rende poco |
| Enti del turismo e consorzi | Visibilità etichettata per le gare della loro zona (rapporto tra aziende) | Con le prime schede online; la fonte più promettente |
| Brand di attrezzatura | Sponsor dichiarati a cifra fissa, sul sito e nella newsletter, senza tracciamento | Qualche migliaio di visitatori e iscritti |
| Scheda arricchita per organizzatori | Foto e video forniti da loro, con etichetta "contenuto dell'organizzatore"; prezzi e indice restano nostri | Qualche migliaio di visitatori |
| Report e indice prezzi | Analisi annuale dei prezzi del trail per media e aziende del settore | Con lo storico di almeno 2 edizioni |
| Guide a pagamento | PDF venduti tramite una piattaforma che gestisce clienti, pagamenti e IVA (es. Gumroad, Lemon Squeezy) | In parallelo |
| Viaggi ed esperienze | Pacchetti con operatori locali; prenotazioni e dati dei clienti restano all'operatore | Fase matura |

Gratis, per aumentare l'uso: newsletter con aperture di iscrizioni e lotterie, calendario .ics da abbonare, filtri e GPX.

Regole: tutto il pagato è etichettato; chi paga non influenza dati ufficiali, soglie, fasce né ordine.

**Ordine di grandezza (stima, non dato):** con 10.000 visite al mese, 2% di clic su un alloggio e 30% di prenotazioni a 8–10 € di commissione, le affiliazioni rendono 400–600 € al mese. I costi fissi sono bassi (hosting e domini), quindi il progetto va in attivo presto; il costo vero è il tempo per tenere i dati aggiornati. Per diventare un'attività servono decine di migliaia di visite al mese e il mercato europeo (5 lingue). La newsletter è il canale che sponsor ed enti del turismo pagano di più: è l'unico pubblico che non dipende da Google o Instagram.

## 6. Piano MVP
- [x] Definire la nicchia
- [x] Benchmark Lavaredo
- [x] Raccolta prezzi 20 gare Italia + 20 UK e soglie provvisorie
- [ ] Completare i dati italiani con più eventi distinti
- [ ] Ricalibrare le soglie
- [ ] Template della scheda gara
- [ ] Scrivere a mano 30–50 schede
- [ ] Setup Next.js + Postgres su Render (senza login)
- [ ] Mappa e profilo GPX, con mappa di base ospitata da noi
- [ ] "Le mie gare", salvate solo nel browser
- [ ] Calendario .ics delle gare da abbonare
- [ ] Storico prezzi per edizione con aumento % e badge
- [ ] Data di verifica e "fa fede il sito ufficiale" accanto a ogni prezzo
- [x] Profilo Instagram (@fairkm_trail)

### Fase successiva: PWA
Il sito nasce responsive (desktop e mobile nel browser). In una fase successiva diventa una **PWA**: installabile sulla schermata Home di Android e iPhone, con icona propria e avvio senza barra del browser. Niente notifiche push, che richiederebbero di salvare dati del dispositivo: gli avvisi su iscrizioni e lotterie passano dalla newsletter e dal calendario .ics. Next.js la supporta con manifest e service worker, senza riscrivere l'app. Un'app nativa per gli store (es. React Native/Expo) si valuta solo se i lettori chiedono funzioni che il web non offre.
