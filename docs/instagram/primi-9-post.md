# Instagram: i primi 9 post

Profilo [@fairkm_trail](https://www.instagram.com/fairkm_trail/) (bio e immagine in `docs/social/instagram/profilo.md`). Testi da pubblicare in inglese, lingua principale di Fair KM dal 2026-10-18: scritti per un pubblico internazionale, non solo italiano. Note di lavoro in italiano.

## Regole
- Numeri presi da `data/gare.csv` e calcolati con `src/lib/elenco.ts`, come sul sito. Se il CSV cambia, ricontrollare i numeri prima di pubblicare.
- Solo prezzi ufficiali 2026 o successivi, sempre con l'edizione accanto. Ogni post cita la fonte ufficiale (in didascalia o nell'ultima slide).
- Confronti sempre a parità di edizione: una gara 2026 si confronta con Lavaredo 2026. Il sito usa invece l'ultimo prezzo pubblicato (Lavaredo 2027), quindi alcune percentuali differiscono finché le gare piccole non pubblicano le quote 2027.
- Molte gare 2026 si sono già corse: la slide dice "2026 edition" e la didascalia che aggiorneremo con le quote 2027.
- Termini uguali alla landing in inglese: *km-effort*, *standard fee*, *fair price*, *above threshold*, *big circuits*.
- Escluse dai post anche se economiche: fell race (Don Morrison Edale Skyline, Preseli Beast: categoria a parte) e distanze senza edizioni precedenti accertate (DoppiaW W100, Black Beacon South 50K, Gubbio Ultra Trail 50K).
- Tono: confronto di fatti, mai attacchi agli organizzatori. Il prezzo lo decide chi organizza; noi lo mettiamo in fila.

## Grafica (per i modelli Canva)
- Formato 1080×1350 (4:5), caroselli fino a 6 slide.
- Colori della landing: verde `#1d5a36`, menta `#a8e2bd`, carta `#f4f0e6`, rosso big circuits `#c0392b`. Logo `landing/public/logo/fairkm-verde.svg` / `fairkm-menta.svg`.
- Card tipografiche, niente foto finché non abbiamo foto nostre o con licenza.
- Fascia di colore come sul sito: verde = fair price, giallo = above threshold, rosso = big circuits.

## Ordine di pubblicazione
Il post 1 esce per primo e finisce in basso a destra nella griglia. Ritmo proposto: 2–3 post a settimana. Link in bio: `https://fairkm.com` (come in `profilo.md`): il worker apre la lingua del browser. Niente UTM: il rimando alla lingua (`landing/worker.js`) non conserva i parametri, quindi andrebbero persi.

---

## 1. What Fair KM is (singolo)
**Card:** Trail races *at a fair price.* · Italy and the UK · fairkm.com

**Caption:**
> Race fees keep climbing. Some races are worth every euro, others charge for the brand.
>
> Fair KM puts trail races side by side by what you pay for each kilometre of effort, using official fees only. Small races, real data, and the people who've actually run them.
>
> Race pages coming soon. Link in bio to hear when they're live.

**Alt text:** Fair KM logo on green. Text: Trail races at a fair price. Italy and the UK.

## 2. How we measure (carosello, 4 slide)
1. Climbing counts. So does the price.
2. Every 100 m of climbing counts as 1 km. That's ITRA's **km-effort**.
3. Example: Trail del Drago (2026). 20 km + 1,500 m D+ = **35 km-effort**. €30 ÷ 35 = **€0.86 per km-effort**.
4. Up to €1.00 per km-effort (races of 30 km and over) or €1.20 (shorter races): **fair price**. Over €1.50: **big circuits**. Standard fee, the race's own currency, no conversions.

**Caption:**
> One number to compare any trail race: the fee divided by km-effort (km + D+/100).
>
> We use the standard fee, not the cheapest launch price. Undeclared VAT and fees stay blank: we never assume they're included.
>
> Source for the example: official 2026 rules of Trail del Drago.

**Fonte:** https://sportdolomiti.it/wp-content/uploads/2026/01/traildeldrago26_reg.pdf

## 3. Lavaredo 2027: up to +45% (carosello, 5 slide)
1. Lavaredo Ultra Trail, 2026 → 2027 fees.
2. 20K: €70.85 → €83.50 (**+18%**)
3. 50K: €119.90 → €173.84 (**+45%**)
4. 80K: €190.75 → €224.49 (**+18%**) · 120K: €267.05 → €320.31 (**+20%**)
5. Same basis both years: 22% VAT and 9% platform fee included, as declared by the organiser. Lavaredo is our reference for Italy.

**Caption:**
> Lavaredo has published its 2027 fees. Same distances, same basis (VAT and platform fee included in both years), single fee per distance.
>
> The 50K goes up by 45%. At €173.84 for 76 km-effort, that's €2.29 per km-effort.
>
> Lavaredo is the yardstick we measure Italian races against. Next post: what the same money gets you elsewhere.
>
> Source: official registration page (2027) and archived copy of the same page (2026).

**Fonti:** https://lavaredo.utmb.world/registration · http://web.archive.org/web/20260420064508/https://lavaredo.utmb.world/registration

## 4. 40 km more, €112 less (carosello, 3 slide)
1. Lavaredo 120K vs 100 Miglia Monviso M160K · 2026 editions
2. Lavaredo 120K (2026): 120 km, 5,800 m D+, €267.05 → **€1.50 per km-effort** · reference
3. Monviso M160K (2026): 160 km, 9,000 m D+, €155 → **€0.62 per km-effort** · fair price · **−59% vs Lavaredo 120K**

**Caption:**
> Same edition, side by side: 40 km more, 3,200 m more climbing, €112 less.
>
> 100 Miglia Monviso, Saluzzo and Valle Varaita (Piedmont), 5th edition in 2026. Standard fee €155 (launch €135, from May €175). Tracker rental included.
>
> Not in the fee: medical certificate and membership card (FIDAL/EPS/Runcard or foreign federation), costs not stated.
>
> For 2027, Lavaredo 120K has gone up to €320.31. We'll redo the comparison when Monviso publishes its 2027 fees.
>
> Sources: official 2026 rules of Monviso, Lavaredo registration page (archived 2026 copy).

**Fonti:** https://www.100migliamonviso.eu/wp-content/uploads/2026/05/M160K-2026-15.5.pdf · http://web.archive.org/web/20260420064508/https://lavaredo.utmb.world/registration

## 5. Italy: 5 long races at a fair price (carosello, 6 slide)
1. 5 Italian races of 30 km+ at €1 or less per km-effort · 2026 editions
2. **Long Trail dei Monti Simbruini** · Lazio · 48 km, 3,000 m · €50 · **€0.64**
3. **Trans D'Havet Ultra 80K** · Veneto · 83 km, 5,500 m · €105 · **€0.76**
4. **Porte di Pietra** · Piedmont · 73 km, 4,200 m · €90 · **€0.78**
5. **Ultra Trail dei Castelli Bruciati 100K** · Piedmont · 100 km, 3,750 m · €120 · **€0.87**
6. **Sciacchetrail 100K** · Cinque Terre, Liguria · 100 km, 5,000 m · €150, same as 2025 · **€1.00** · For comparison, Lavaredo 2026: 50K €1.58, 80K €1.51.

**Caption:**
> Five Italian ultras with several editions behind them, all at €1 or less per km-effort at the standard fee.
>
> Fees are from each race's official 2026 rules. We'll update them as the 2027 fees are published.
>
> Which one would you add? Tell us in the comments: we check every race against its official sources before it goes in.

**Fonti:** http://www.traildeimontisimbruini.it/wp-content/uploads/2026/04/REGOLAMENTO-TMS-2026.pdf · https://www.transdhavet.it/iscrizioni · https://www.portedipietra.it/wp-content/uploads/2026/05/REGOLAMENTO-porte-di-piera-2026.pdf · https://utcb.altervista.org/iscrizioni/ · https://www.sciacchetrail.com/regolamento-100k-2026/ · http://web.archive.org/web/20260420064508/https://lavaredo.utmb.world/registration

## 6. UK: 5 ultras at a fair price (carosello, 6 slide)
1. UK reference: UTS 50K, full fee £189 (2026, unchanged for 2027) for 90 km-effort = **£2.10 per km-effort**
2. **Total Coastal 50K** · South Devon · 50 km, 2,134 m · £52 (2027) · **£0.73**
3. **Gower Ultra Bach** · Wales · 54.7 km, 1,450 m · £55 (2026) · **£0.79**
4. **Pembrokeshire Coastal Path 50K** · Wales · 50 km, 1,850 m · £60 (2026) · **£0.88**
5. **Cateran Trail Ultramarathon** · Perthshire · 90 km, 2,250 m · £105 (2027) + 4% booking fee · **£0.93**
6. **Cairngorm Ultra Trail 60K** · Highlands · 60 km, 1,006 m · £67 (2026) + 4% online fee · **£0.96**

**Caption:**
> Same yardstick, in pounds. In the UK we measure against Ultra-Trail Snowdonia: the 50K's full 2026 fee works out at £2.10 per km-effort.
>
> These five ultras come in under £1, even counting the booking fee where there is one. No conversions: pounds stay pounds.
>
> Fell races are a category of their own (club fees, no frills) and we keep them separate, so they don't skew the comparison.

**Fonti:** https://front-api.register-utmb.world/edition/url/ultra-trail-snowdonia-by-utmb-2026-v21741516958553 · https://www.windingpaths.uk/total-coastal/ · https://www.sientries.co.uk/event/gower-ultra-50-ultra-bach-trail-race-2026 · https://www.sientries.co.uk/event/pembrokeshire-coastal-races-2026 · https://www.entrycentral.com/event/130628 · https://www.highterrainevents.co.uk/cairngorm-ultra-trail

## 7. Italy: short races under 30 km (carosello, 6 slide)
1. Under 30 km, fair price is up to €1.20 per km-effort. Lavaredo 20K (2026): €2.36.
2. **Trail dei Monti Ebolitani** · Campania · 21 km, 724 m · €18 · **€0.64**
3. **Doganaccia Trail 27K** · Tuscany · 27 km, 1,650 m · €32 · **€0.74**
4. **Trailaghi Classic** · Piedmont · 25.5 km, 1,050 m · €30 · **€0.83**
5. **Trail del Drago** · Trentino · 20 km, 1,500 m · €30 · **€0.86**
6. **Gubbio Trail 25K** · Umbria · 25 km, 1,500 m · €35 · **€0.88** · All fees: 2026 edition.

**Caption:**
> Short doesn't have to mean expensive per kilometre. Five Italian races under 30 km, all well under the €1.20 threshold, from Campania to Trentino.
>
> 2026 fees from the official rules. Several include a meal, chip timing or a race pack: the full details will be on each race page.

**Fonti:** https://calendario.fidal.it/files/regolamento%20trail%20dei%20monti%20ebolitani.pdf · https://doganaccia2000.it/wp-content/uploads/2026/05/Doganaccia-Trail-2026-REGOLAMENTO-1.pdf · https://www.trailaghi.it/regolamento/regolamento-2026/ · https://sportdolomiti.it/wp-content/uploads/2026/01/traildeldrago26_reg.pdf · https://www.gubbiotrail.it/regolamento/

## 8. What the fee doesn't tell you (carosello, 5 slide)
1. The entry fee isn't always the full price.
2. **Membership cards.** Many Italian races require a card from the Italian athletics federation (FIDAL), a sports body or a Runcard. Trans D'Havet: +€4 ASI card if you don't have one.
3. **Booking fees.** Cateran Trail and Cairngorm Ultra: +4% on top of the fee.
4. **Not declared ≠ included.** Lavaredo states VAT and fees are included. When a race doesn't say, we leave it blank.
5. On every Fair KM race page: what's included, what's extra, what's not stated.

**Caption:**
> Two races with the same fee can cost you different amounts. Membership cards, medical certificates, booking fees, shuttles.
>
> We list every extra cost the organiser publishes, with the source. If something isn't stated, we say so instead of guessing.

**Fonti:** https://www.transdhavet.it/iscrizioni · https://www.entrycentral.com/event/130628 · https://www.highterrainevents.co.uk/cairngorm-ultra-trail · https://lavaredo.utmb.world/registration

## 9. Help us build it (singolo)
**Card:** Know a trail race with a fair fee? Tell us. · fairkm.com

**Caption:**
> Fair KM is starting with Italy and the UK: 90+ distances checked so far, official sources only.
>
> Know a small trail race with a fair fee and a few editions behind it? Drop it in the comments. We'll check the official rules and add it if it fits.
>
> Want the race pages when they're live? Link in bio.

**Alt text:** Green card with the text: Know a trail race with a fair fee? Tell us. fairkm.com

---

## Hashtag (5–8 per post, a rotazione)
`#trailrunning #ultratrail #trailrunner #ultrarunning #trailrace #skyrunning #trailrunningitaly #ukultra #fellrunning` (l'ultimo solo nel post 6)

## Da fare prima di pubblicare
- Ricontrollare i prezzi dei post 3–8 sulle fonti il giorno prima di pubblicare.
