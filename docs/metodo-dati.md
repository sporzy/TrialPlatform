# Metodo della ricerca dati

Fino al 13 novembre 2026 i dati delle gare nascevano nel file Excel `data/trail-gare.xlsx`; da quel giorno la fonte è Postgres e l'Excel è uscito dal progetto (resta nella storia di git, ultimo commit che lo contiene: `5886e7e`). Qui sotto c'è il suo foglio **"Metodo e limiti"**, trascritto senza cambiamenti di contenuto: sono le regole con cui sono stati raccolti i dati iniziali e valgono anche per le gare nuove.

## Metodo e limiti (verifica dell'8 ottobre 2026)

- **Gare trail Italia/UK:** 99 righe. 99 righe/distanze, non 99 manifestazioni distinte. Richiesta: 50 per paese; consegnate 49 Italia e 50 UK (vedi Copertura).
- **Copertura:** 49 Italia / 50 UK. Italia: 19 / 16 / 14 (<30 / 30-80 / >80 km); UK: 17 / 17 / 16. Massimo 2 righe/evento. Il tetto di 50 per paese non è stato raggiunto in Italia: oltre ai 49 inclusi, non è emersa una sola gara in più con distanza, dislivello, quota ufficiale e 2 edizioni verificabili. Nessuna riga debole inserita per fare numero.
- **Prezzo:** valuta locale, mai convertita. Standard non affiliati per UK se pubblicato; quote affiliati in note. Se il sito non etichetta lo standard, usato lo scaglione online ordinario/pre-last-minute e riportati gli altri scaglioni.
- **Edizione:** ultima con numeri pubblicati o prossima. Annuncio 2027 senza quota non sostituisce una quota verificabile 2026.
- **Unità:** conversione distanza/dislivello ammessa e dichiarata: 1 mi = 1,609344 km; 1 ft = 0,3048 m. Valori dell'organizzatore in km/m conservati anche se arrotondati e discordanti.
- **Campi vuoti:** nessun valore stimato. Prezzo precedente vuoto quando non verificato da fonte primaria. Tassa/commissione non dichiarata non significa zero o inclusa.
- **Extra:** quote tessera/certificato/navetta e obblighi di qualifica nelle note. Materiale obbligatorio segnalato dove reperito; non stimato il costo del kit.
- **Discrepanze:** nessuna media fra fonti. La fonte specifica dell'edizione/regolamento prevale sulla homepage generica, ma la differenza è riportata. GTC esclusa per D+ internamente contraddittorio; Copper SkyTrail/Exmoor esclusi per prezzo solo da marketplace.
- **Caveat inclusione:** Preseli, Devil, Hardmoors e Bowland hanno distanze/D+ discordanti tra fonti ufficiali. I dati sono trascrizioni verificabili, non misure certificate indipendenti.
- **Accesso:** file privato; nessuna iscrizione effettuata e nessun contatto con organizzatori.
- **Fonti:** ogni riga porta URL principale, fonti integrative e fonte del prezzo precedente dove verificato. Registro fonti nel terzo foglio. Solo primarie per i numeri.
- **Bowland:** risultati separati della distanza Half 2025 e 2026, pubblicati da Open Tracking.
- **Nuove righe 8 ottobre:** Italia: Trail dei Nebrodi, Long Trail Simbruini, San Fermo Trail, Maunìk Trail, UTGS100, Alpe Adria 120 e Campo dei Fiori 50K hanno caveat espliciti in nota (fonte secondaria, dati 2025, discrepanze ufficiali o scaglione non identificato). Gubbio ha 2 righe (25K e 50K): la 10K è stata esclusa per il tetto di 2.
- **Edizioni:** per molte righe la storicità è provata a livello di evento, non della singola distanza: la nota lo dice dove la distanza è nuova o non provata.

## Dove sono finiti i dati

| Nell'Excel / nei CSV | In Postgres |
|---|---|
| Righe pubblicabili (fonte primaria, prezzo 2026+), più i 6 riferimenti nazionali di `riferimenti.csv` | `races`, `distances`, `prices` (75 gare, 102 distanze, 122 prezzi) |
| `fonte_url`, `fonte_prezzo_precedente_url` | `prices.fonte_url` del prezzo attuale e di quello precedente |
| `altre_fonti_url` | `distances.altre_fonti_url` |
| `fonte_storico_url` | `races.fonte_storico_url` |
| `fonte_tipo` | `prices.fonte_tipo` |
| `zona`, `note`, `data_verifica` | `races.regione`, `distances.note`, `prices.data_rilevazione` |
| `prezzo_precedente_note` ("Non verificato: cella vuota." oppure "Edizione immediatamente precedente, medesima categoria di iscrizione") | Implicito: prezzo precedente assente, oppure stesso scaglione dell'edizione prima |
| `data/da-verificare.csv` (38 righe, tra cui le 3 escluse dall'Excel: Campo dei Fiori 50K, Trail dei Nebrodi 55K, UTGS100) | `review_queue`, origine `nuova_gara`, con il motivo dell'esclusione |
| Foglio **"Fonti"** (152 URL con tipo e righe che documentano) | Ogni URL è già nella colonna della riga che documenta (tabella sopra). Le uniche due fonti "Secondaria" erano di righe escluse, ora in coda |

Copia ferma dei dati del 13 novembre 2026, solo per test e sviluppo: `test/gare-esempio.csv` (vedi `test/LEGGIMI.md`).
