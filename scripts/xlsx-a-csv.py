"""Genera data/gare.csv dal file di lavoro Excel e dai riferimenti nazionali.

Uso (dalla cartella del progetto):
    python3 scripts/xlsx-a-csv.py

Ingressi:
    data/trail-gare.xlsx   foglio "Gare": il file di ricerca (fonti, zona, data di verifica)
    data/riferimenti.csv   distanze di riferimento nazionale (Lavaredo, UTS), già nel formato d'uscita
Uscita:
    data/gare.csv          unica fonte dei dati per l'app (letta dall'importazione, passo 5b)

Solo libreria standard: un .xlsx è un archivio zip di file XML.
Lo script è deterministico: rilanciarlo senza cambiare gli ingressi non cambia l'uscita.
Nessun valore viene stimato: le celle vuote restano vuote ("non verificato").
"""

import csv
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
EXCEL = RADICE / "data" / "trail-gare.xlsx"
RIFERIMENTI = RADICE / "data" / "riferimenti.csv"
USCITA = RADICE / "data" / "gare.csv"

COLONNE = [
    "evento", "distanza", "paese", "zona", "categoria", "riferimento_nazionale",
    "edizione", "km", "dplus", "prezzo", "valuta", "scaglione",
    "prezzo_precedente", "edizione_precedente", "include_iva", "include_commissioni",
    "fonte_url", "altre_fonti_url", "fonte_storico_url", "fonte_prezzo_precedente_url",
    "fonte_tipo", "data_verifica", "note",
]

PAESI = {"Italia": "IT", "UK": "UK"}

# tipo_prezzo dell'Excel → scaglione. None = riga esclusa (dato non affidabile, vedi data/da-verificare.csv).
# Un valore non elencato qui ferma lo script: va deciso, non indovinato.
SCAGLIONI = {
    "standard": "standard",
    "standard (solo pre-iscrizione)": "standard",
    "early (Saver)": "early",
    "early (scaglione attuale)": "early",
    "scaglione non identificato": None,
}

CATEGORIE = {"piccola", "grande_circuito", "fell_race", "club"}

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def leggi_foglio(percorso: Path, nome_foglio: str) -> list[dict[str, str]]:
    """Righe del foglio come dizionari intestazione → testo ('' per le celle vuote)."""
    with zipfile.ZipFile(percorso) as z:
        condivise = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
                condivise.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
        relazioni = {
            r.get("Id"): r.get("Target")
            for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        }
        foglio = None
        for s in ET.fromstring(z.read("xl/workbook.xml")).find("m:sheets", NS):
            if s.get("name") == nome_foglio:
                destinazione = relazioni[s.get(f"{{{NS['r']}}}id")].lstrip("/")
                foglio = destinazione if destinazione.startswith("xl/") else "xl/" + destinazione
        if foglio is None:
            sys.exit(f"Foglio '{nome_foglio}' non trovato in {percorso}")

        righe = []
        for riga in ET.fromstring(z.read(foglio)).iter(f"{{{NS['m']}}}row"):
            celle = {}
            for c in riga.findall("m:c", NS):
                v = c.find("m:v", NS)
                if c.get("t") == "s" and v is not None:
                    valore = condivise[int(v.text)]
                elif c.get("t") == "inlineStr":
                    valore = "".join(t.text or "" for t in c.iter(f"{{{NS['m']}}}t"))
                else:
                    valore = v.text if v is not None else ""
                celle[indice_colonna(c.get("r"))] = (valore or "").strip()
            if celle:
                righe.append([celle.get(i, "") for i in range(max(celle) + 1)])

    intestazione, *dati = righe
    return [dict(zip(intestazione, r + [""] * (len(intestazione) - len(r)))) for r in dati]


def indice_colonna(riferimento: str) -> int:
    n = 0
    for lettera in re.match(r"[A-Z]+", riferimento).group(0):
        n = n * 26 + ord(lettera) - 64
    return n - 1


def numero(testo: str, decimali: int) -> str:
    """Arrotonda le conversioni miglia/piedi (es. 80.46720000000001 → 80.47) e toglie gli zeri inutili."""
    if testo == "":
        return ""
    valore = round(float(testo), decimali)
    return str(int(valore)) if valore == int(valore) else f"{valore:.{decimali}f}".rstrip("0")


def converti(riga: dict[str, str], errori: list[str]) -> dict[str, str] | None:
    rif = f"riga Excel id {riga['id']} ({riga['nome']})"
    if riga["tipo_prezzo"] not in SCAGLIONI:
        errori.append(f"{rif}: tipo_prezzo '{riga['tipo_prezzo']}' sconosciuto, aggiungerlo a SCAGLIONI")
        return None
    scaglione = SCAGLIONI[riga["tipo_prezzo"]]
    if scaglione is None:
        print(f"  esclusa {rif}: {riga['tipo_prezzo']}")
        return None
    if riga["paese"] not in PAESI:
        errori.append(f"{rif}: paese '{riga['paese']}' sconosciuto, aggiungerlo a PAESI")
        return None
    # Colonna facoltativa: se un giorno l'Excel ha "categoria", vale quella.
    categoria = riga.get("categoria") or "piccola"
    if categoria not in CATEGORIE:
        errori.append(f"{rif}: categoria '{categoria}' non valida")
        return None

    edizione = int(float(riga["edizione"]))
    prezzo_precedente = numero(riga["prezzo_edizione_precedente"], 2)
    return {
        "evento": riga["evento"],
        "distanza": riga["nome"],
        "paese": PAESI[riga["paese"]],
        "zona": riga["zona"],
        "categoria": categoria,
        "riferimento_nazionale": "no",
        "edizione": str(edizione),
        "km": numero(riga["distanza_km"], 2),
        "dplus": numero(riga["dislivello_m"], 0),
        "prezzo": numero(riga["prezzo"], 2),
        "valuta": riga["valuta"],
        "scaglione": scaglione,
        "prezzo_precedente": prezzo_precedente,
        # L'Excel dichiara: "Edizione immediatamente precedente, medesima categoria di iscrizione".
        "edizione_precedente": str(edizione - 1) if prezzo_precedente else "",
        # "Tassa/commissione non dichiarata non significa zero o inclusa": restano non verificate.
        "include_iva": "",
        "include_commissioni": "",
        "fonte_url": riga["fonte_url"],
        "altre_fonti_url": riga["altre_fonti_url"],
        "fonte_storico_url": riga["fonte_storico_url"],
        "fonte_prezzo_precedente_url": riga["fonte_prezzo_precedente_url"],
        "fonte_tipo": riga["fonte_tipo"],
        "data_verifica": riga["data_verifica"],
        "note": riga["note"],
    }


def main() -> None:
    errori: list[str] = []
    print(f"Lettura {EXCEL.relative_to(RADICE)}")
    excel = leggi_foglio(EXCEL, "Gare")
    righe = [r for r in (converti(riga, errori) for riga in excel) if r is not None]

    with RIFERIMENTI.open(newline="", encoding="utf-8") as f:
        lettore = csv.DictReader(f)
        if lettore.fieldnames != COLONNE:
            errori.append(f"{RIFERIMENTI.name}: colonne diverse da quelle attese")
        riferimenti = list(lettore)

    tutte = righe + riferimenti
    chiavi = [(r["paese"], r["evento"], r["distanza"]) for r in tutte]
    for chiave in sorted({c for c in chiavi if chiavi.count(c) > 1}):
        errori.append(f"distanza duplicata: {chiave}")
    for r in tutte:
        for campo in ("evento", "distanza", "paese", "categoria", "edizione", "km", "dplus", "prezzo", "valuta", "scaglione"):
            if not r[campo]:
                errori.append(f"{r['evento']} / {r['distanza']}: campo '{campo}' vuoto")

    if errori:
        print("\nErrori, data/gare.csv NON aggiornato:")
        for e in errori:
            print(f"  - {e}")
        sys.exit(1)

    with USCITA.open("w", newline="", encoding="utf-8") as f:
        scrittore = csv.DictWriter(f, fieldnames=COLONNE, lineterminator="\n")
        scrittore.writeheader()
        scrittore.writerows(tutte)

    per_paese = {p: sum(1 for r in tutte if r["paese"] == p) for p in sorted({r["paese"] for r in tutte})}
    print(f"\nScritto {USCITA.relative_to(RADICE)}: {len(tutte)} distanze "
          f"({len(righe)} dall'Excel + {len(riferimenti)} riferimenti); per paese: {per_paese}; "
          f"eventi: {len({(r['paese'], r['evento']) for r in tutte})}; "
          f"con prezzo precedente: {sum(1 for r in tutte if r['prezzo_precedente'])}")


if __name__ == "__main__":
    main()
