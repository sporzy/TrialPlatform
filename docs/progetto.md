# Idea: piattaforma di gare trail (ispirata a nomap)

> Una piattaforma curata di gare trail piccole che costano il giusto rispetto a UTMB e ai grandi circuiti, con schede pensate per il trail e una community che si mette in contatto e si scambia consigli verificati.

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
**Base:** luogo, data, distanze, tag e foto, "Perché è speciale", citazione di un finisher, link ufficiale.
**Specifico trail:** D+/D−, quota massima, GPX con mappa e profilo, cancelli orari e ristori, materiale obbligatorio, punti ITRA e Running Stones UTMB, apertura iscrizioni/lotteria, logistica, terreno, prezzo con €/km-sforzo e cosa include, aumento % rispetto all'edizione precedente.

### Stack
Tutto su Render: Next.js (Web Service), Render Postgres, Auth.js con login Strava, Persistent Disk per GPX e immagini; MapLibre/Mapbox per i GPX. "Correrò questa gara" = tabella utenti × gare.

### Community utile nel trail
Condivisione auto/alloggio, ricognizioni del percorso insieme, ricerca di un pacer per gli ultra.

### Community: forum con meccaniche tipo Reddit
Le meccaniche di Reddit si usano **solo per il forum e la comunicazione tra utenti**, senza clonarne aspetto e cultura. Il resto del sito (schede, prezzi, recensioni) segue le sue regole.
- **Una comunità per gara**, attaccata alla scheda gara: la discussione sta accanto ai dati ufficiali. È ciò che Reddit (r/ultrarunning, r/trailrunning) non può offrire.
- **Etichette sui post:** consiglio, passaggio auto, ricognizione, cerco pacer, domanda; più l'edizione (es. 2026).
- **Risposte su massimo 2 livelli** (risposta e risposta alla risposta), per restare leggibili su telefono.
- **Solo voto "utile"**, niente voto negativo. Ordine cronologico finché la community è piccola; il voto pesa quando i numeri crescono. I post legati al tempo (passaggi, ricognizioni) sempre per data.
- **Identità e fiducia:** identità legata a Strava, finisher verificati dell'edizione in evidenza, organizzatori con etichetta (rispondono, non recensiscono la propria gara).
- **Recensioni separate:** restano un modulo strutturato, non post del forum.
- **Stile:** visivo proprio, sobrio e centrato sul testo, solo per la parte community. Elenco e schede gara restano con uno stile pulito e moderno.
- **Messaggi privati:** non per ora, da decidere più avanti.

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
1. Verifica della partecipazione (Strava/GPX, classifiche ufficiali) → badge "Finisher verificato".
2. Dati ufficiali separati dalle opinioni.
3. Edizione e data su ogni contributo.
4. Recensioni strutturate.
5. Reputazione nel tempo.
6. Conflitti d'interesse: organizzatori con profilo marcato, non recensiscono la propria gara; sponsorizzazioni etichettate.
7. Moderazione: segnalazioni e revisione manuale.

## 5. Monetizzazione
Principio: nessuna fonte di guadagno deve mettere a rischio la fiducia.

| Fonte | Come | Quando |
|---|---|---|
| Affiliazioni | Alloggi, assicurazioni, iscrizioni | Da subito, rende poco |
| Servizi per organizzatori | Scheda arricchita, newsletter, statistiche | Qualche migliaio di utenti |
| Brand di attrezzatura | Newsletter e contenuti sponsorizzati | Qualche migliaio di utenti attivi |
| Premium | Avvisi iscrizioni/lotterie, calendario con punti ITRA, filtri, GPX | Community solida |
| Viaggi ed esperienze | Pacchetti di gruppo con operatori locali | Fase matura |
| Contenuti | Guide a pagamento, YouTube | In parallelo |

Regole: tutto il pagato è etichettato; chi paga non influenza recensioni né dati ufficiali.

## 6. Piano MVP
- [x] Definire la nicchia
- [x] Benchmark Lavaredo
- [x] Raccolta prezzi 20 gare Italia + 20 UK e soglie provvisorie
- [ ] Completare i dati italiani con più eventi distinti
- [ ] Ricalibrare le soglie
- [ ] Template della scheda gara
- [ ] Scrivere a mano 30–50 schede
- [ ] Setup Next.js + Postgres + Auth.js su Render
- [ ] Mappa e profilo GPX
- [ ] "Correrò questa gara"
- [ ] Login Strava e badge "Finisher verificato"
- [ ] Storico prezzi per edizione con aumento % e badge
- [ ] Separare dati ufficiali e consigli della community
- [ ] Profilo Instagram
