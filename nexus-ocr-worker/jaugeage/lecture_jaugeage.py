#!/usr/bin/env python3
"""
NEXUS : traduction d'une photo d'écran Veeder-Root (TLS4B) en volumes par cuve.

Usage :
  python3 lecture_jaugeage.py <photo>          lit la photo avec ./lecteur-vision
  python3 lecture_jaugeage.py --json <fichier>  relit une lecture Vision déjà faite

Rien n'est envoyé nulle part : le script affiche un tableau et un JSON.
Toute valeur reste une PROPOSITION à valider par un humain avant
enregistrement dans NEXUS.

Méthode (version 2, 04/11/2026) : on ne suppose plus que la photo est prise
de face. L'écran est découpé par sa structure : deux colonnes de cuves, et
dans chaque colonne la pile des valeurs à droite des libellés. Les valeurs
sont réparties entre les cuves aux grands écarts verticaux, puis attribuées
aux champs dans l'ordre de l'écran (volume, hauteur, espace vide,
température, eau). Une inclinaison de la photo ne change pas cet ordre.

Une cuve passe « a_valider » seulement si TOUS les contrôles passent :
  - exactement 5 valeurs, chacune lue une seule fois ;
  - le format de l'écran : volumes entiers, mesures à une décimale ;
  - des bornes de vraisemblance (température 10 à 45 °C, eau inférieure à
    la hauteur produit, volume dans la contenance…) ;
  - volume + espace vide proche de la contenance annoncée (± 7 %) ;
  - le volume du dessin de la cuve, s'il est lu, égal au volume du tableau.
Sinon elle passe « a_verifier », avec la raison.
"""

from __future__ import annotations

import json
import re
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path

LECTEUR = Path(__file__).resolve().parent / "lecteur-vision"
TOLERANCE_CONTENANCE = 0.07
SAUT_MIN = 1.8
# Contenance réelle de chaque cuve selon la console (volume + espace vide),
# relevée sur les photos validées par Frédéric le 04/11/2026. La console
# calcule l'espace vide à partir du volume : la somme est constante à
# l'arrondi près. Une erreur de lecture d'un seul chiffre la fait sauter.
REFERENCE = Path(__file__).resolve().parent / "reference_cuves.json"
TOLERANCE_SOMME_L = 1   # arrondi de la console ; mesuré exact sur 7 photos (21/10 et 04/11)

RE_RESERVOIR = re.compile(
    r"RESERVOIR\s*(\d+)\s*[:;]\s*(R\d+)\s+(\d+(?:[.,]\d+)?)\s*M3\s+([A-Z0-9]+)", re.I
)
RE_NOMBRE = re.compile(r"^-?\d+(?:\.\d+)?$")
RE_DATE = re.compile(r"(\d{2})/(\d{2})/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)?", re.I)

CHAMPS = ["volume_l", "hauteur_mm", "espace_vide_l", "temperature_c", "eau_mm"]
DECIMALES = {"volume_l": 0, "hauteur_mm": 1, "espace_vide_l": 0, "temperature_c": 1, "eau_mm": 1}


class LectureImpossible(RuntimeError):
    pass


def lire_vision(photo: str) -> dict:
    # Lève une exception (et non sys.exit) : le service distingue ainsi une
    # photo illisible d'un arrêt demandé (Ctrl+C, arrêt de l'iMac).
    if not LECTEUR.exists():
        raise LectureImpossible(f"Lecteur introuvable : {LECTEUR} (compiler lecteur.swift d'abord)")
    sortie = subprocess.run([str(LECTEUR), photo], capture_output=True, text=True, timeout=60)
    if sortie.returncode != 0:
        raise LectureImpossible(f"Lecture Vision impossible : {sortie.stderr.strip()}")
    return json.loads(sortie.stdout)


def normaliser(texte: str) -> str:
    return texte.strip().replace(" ", "").replace(",", ".")


def nombre(texte: str) -> float | None:
    t = normaliser(texte)
    return float(t) if RE_NOMBRE.match(t) else None


def decimales(texte: str) -> int:
    t = normaliser(texte)
    return len(t.split(".")[1]) if "." in t else 0


def est_libelle(texte: str) -> bool:
    t = texte.lower()
    return any(k in t for k in ("volu", "hauteur", "haut", "espace", "temp", "eau"))


def centre_y(l: dict) -> float:
    return l["y"] + l["hauteur"] / 2


def charger_reference() -> tuple[dict, list, dict]:
    """(sommes par réservoir, disposition de l'écran, fiches des cuves).
    Accepte l'ancien format {"1": 28761, …} (sommes seules)."""
    try:
        brut = json.loads(REFERENCE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}, [], {}
    if "cuves" not in brut:
        return {int(k): v for k, v in brut.items()}, [], {}
    fiches = {int(k): v for k, v in brut["cuves"].items()}
    sommes = {k: v["somme_l"] for k, v in fiches.items() if "somme_l" in v}
    return sommes, brut.get("disposition", []), fiches


def controler(lu: dict, textes: dict, contenance: float, somme_ref: float | None = None) -> list[str]:
    pb = []
    for champ in CHAMPS:
        if decimales(textes[champ]) != DECIMALES[champ]:
            pb.append(f"{champ} « {textes[champ]} » n'a pas le format attendu")
    v, h, e, t, eau = (lu[c] for c in CHAMPS)
    if not (0 <= v <= contenance * 1.05):
        pb.append(f"volume {v:g} hors de la contenance")
    if not (0 <= h <= 4000):
        pb.append(f"hauteur produit {h:g} mm invraisemblable")
    if not (10 <= t <= 45):
        pb.append(f"température {t:g} °C invraisemblable")
    if not (0 <= eau <= 200) or (h > 0 and eau >= h):
        pb.append(f"hauteur d'eau {eau:g} mm invraisemblable")
    if (v > 0) != (h > 0):
        pb.append("volume et hauteur produit incohérents")
    if eau > 0:
        pb.append(f"hauteur d'eau {eau:g} mm : présence d'eau à confirmer")
    total = v + e
    if somme_ref is not None:
        if abs(total - somme_ref) > TOLERANCE_SOMME_L:
            pb.append(f"volume + espace vide = {total:g} L au lieu de {somme_ref:g} L")
    elif abs(total - contenance) / contenance > TOLERANCE_CONTENANCE:
        pb.append(f"volume + espace vide = {total:g} L, trop loin de {contenance:g} L")
    return pb


def analyser(vision: dict) -> dict:
    lignes = vision.get("lignes", [])
    reference, disposition, fiches = charger_reference()
    titres = []
    for l in lignes:
        m = RE_RESERVOIR.search(l["texte"])
        if m:
            titres.append({
                "ligne": l,
                "numero": int(m.group(1)),
                "repere": m.group(2).upper(),
                "contenance_l": float(m.group(3).replace(",", ".")) * 1000,
                "produit": m.group(4).upper(),
            })

    # 1. Deux colonnes de cuves, séparées au plus grand écart horizontal des titres.
    xs = sorted(t["ligne"]["x"] for t in titres)
    coupure = None
    if len(xs) >= 2:
        ecarts = [(xs[i + 1] - xs[i], i) for i in range(len(xs) - 1)]
        e, i = max(ecarts)
        if e > 0.1:
            coupure = (xs[i] + xs[i + 1]) / 2
    colonnes = [[t for t in titres if coupure is None or t["ligne"]["x"] < coupure]] if titres else []
    if coupure is not None:
        colonnes.append([t for t in titres if t["ligne"]["x"] >= coupure])

    cuves = []
    vus = {t["numero"] for t in titres}
    # Titre de cuve illisible (version 3, 04/11/2026) : l'écran de la station
    # a une disposition fixe (reference_cuves.json, « disposition »). Dans une
    # colonne où un titre manque, on le reconstitue à sa place, à condition
    # que la cuve ait une somme de référence : le contrôle exact
    # volume + espace vide empêche alors tout mauvais rattachement.
    for col in colonnes:
        col.sort(key=lambda t: -t["ligne"]["y"])
        if coupure is None or not disposition:
            continue
        attendu = next((c for c in disposition if col[0]["numero"] in c), None)
        if not attendu or [t["numero"] for t in col] != [n for n in attendu if n in vus]:
            continue  # ordre lu différent de la disposition : on ne reconstitue rien
        par_num = {t["numero"]: t for t in col}
        nouveau = []
        for n in attendu:
            if n in par_num:
                nouveau.append(par_num[n])
            elif n in fiches and n in reference:
                f = fiches[n]
                nouveau.append({"ligne": None, "numero": n, "repere": f["repere"],
                                "contenance_l": float(f["contenance_m3"]) * 1000,
                                "produit": f["produit"], "deduit": True})
                vus.add(n)
        col[:] = nouveau
    for n, f in sorted(fiches.items()):
        if n not in vus:  # colonne entière illisible : la cuve est signalée, sans valeur
            cuves.append(cuve_vide({"numero": n, "repere": f["repere"], "contenance_l": float(f["contenance_m3"]) * 1000,
                                    "produit": f["produit"]}, "titre de la cuve non lu"))

    for idx, col in enumerate(colonnes):
        reels = [t for t in col if t["ligne"] is not None]
        x_min = min(t["ligne"]["x"] for t in reels) - 0.03
        # La colonne de gauche s'arrête où commencent les titres de droite.
        x_max = (min(t["ligne"]["x"] for t in colonnes[1] if t["ligne"] is not None) - 0.005
                 if (idx == 0 and coupure is not None) else 1.0)
        # Titre du haut reconstitué : on cherche plus haut que le premier titre lu.
        y_haut = max(centre_y(t["ligne"]) for t in reels) + (0.30 if col[0]["ligne"] is None else 0.01)

        dans_col = [l for l in lignes if x_min <= l["x"] < x_max and l["y"] < y_haut]
        libelles = [l for l in dans_col if est_libelle(l["texte"]) and not RE_RESERVOIR.search(l["texte"])]
        if not libelles:
            for t in col:
                cuves.append(cuve_vide(t, "libellés du tableau non lus"))
            continue
        bord_libelles = statistics.median(l["x"] + l["largeur"] for l in libelles)
        x_libelles = statistics.median(l["x"] for l in libelles)
        y_bas = min(l["y"] for l in libelles) - 0.03

        # 2. Pile des valeurs : nombres à droite des libellés.
        valeurs = [l for l in dans_col
                   if l["x"] > bord_libelles - 0.01 and l["y"] > y_bas and nombre(l["texte"]) is not None]
        valeurs.sort(key=lambda l: -centre_y(l))

        # 3. Découpe de la pile entre les cuves, aux k-1 plus grands écarts.
        k = len(col)
        groupes, raison = decouper(valeurs, k)

        for n, t in enumerate(col):
            volume_dessin = None
            if t["ligne"] is not None:
                # Dessin de la cuve : entier entre le titre et les libellés, sous ce titre.
                y_t = centre_y(t["ligne"])
                suivant = col[n + 1] if n + 1 < len(col) else None
                if suivant is None:
                    y_suivant = y_bas
                elif suivant["ligne"] is not None:
                    y_suivant = centre_y(suivant["ligne"])
                else:
                    y_suivant = y_t - 0.07  # titre suivant reconstitué : on reste près du sien
                dessin = [nombre(l["texte"]) for l in dans_col
                          if t["ligne"]["x"] - 0.03 <= l["x"] < x_libelles - 0.01
                          and y_suivant < centre_y(l) < y_t
                          and nombre(l["texte"]) is not None and decimales(l["texte"]) == 0]
                volume_dessin = max(dessin) if dessin else None

            if groupes is None:
                cuves.append(cuve_vide(t, raison, volume_dessin))
                continue
            groupe = groupes[n]
            if len(groupe) != len(CHAMPS):
                cuves.append(cuve_vide(t, f"{len(groupe)} valeur(s) lue(s) au lieu de 5", volume_dessin))
                continue
            textes = {c: g["texte"] for c, g in zip(CHAMPS, groupe)}
            lu = {c: nombre(textes[c]) for c in CHAMPS}
            controles = controler(lu, textes, t["contenance_l"], reference.get(t["numero"]))
            remarques = []
            if t.get("deduit"):
                remarques.append("titre de la cuve non lu : rattachée par la disposition de l'écran")
            if volume_dessin is None:
                remarques.append("volume du dessin non lu (contrôle par la contenance seul)")
            elif volume_dessin != lu["volume_l"]:
                controles.append(f"volume dessin {volume_dessin:g} ≠ tableau {lu['volume_l']:g}")
            cuves.append({
                **entete(t), **lu,
                "volume_dessin_l": volume_dessin,
                "volume_plus_espace_l": lu["volume_l"] + lu["espace_vide_l"],
                "controles": controles,
                "remarques": remarques,
                "statut": "a_verifier" if controles else "a_valider",
            })

    horodatage = None
    for l in lignes:
        m = RE_DATE.search(l["texte"].replace("\\/", "/"))
        if m:
            j, mo, a, h, mi, ampm = m.groups()
            h = int(h)
            if ampm:
                h = h % 12 + (12 if ampm.upper() == "PM" else 0)
            horodatage = datetime(int(a), int(mo), int(j), h, int(mi)).strftime("%Y-%m-%dT%H:%M")
            break

    alertes = [l["texte"] for l in lignes
               if re.search(r"livraison|alarme|avertissement|niveau|alarm|warning", l["texte"], re.I)
               and not RE_RESERVOIR.search(l["texte"])]

    statut = "a_valider"
    if not cuves or any(c["statut"] == "a_verifier" for c in cuves) or not horodatage:
        statut = "a_verifier"
    return {
        "moteur": "apple-vision",
        "version_traducteur": 3,
        "horodatage_ecran": horodatage,
        "nb_cuves": len(cuves),
        "cuves": sorted(cuves, key=lambda c: c["reservoir"]),
        "alertes_ecran": alertes,
        "statut": statut,
    }


def decouper(valeurs: list[dict], k: int):
    if k == 1:
        return [valeurs], None
    if len(valeurs) < k:
        return None, "valeurs du tableau non lues"
    ys = [centre_y(v) for v in valeurs]
    ecarts = sorted(((ys[i] - ys[i + 1], i) for i in range(len(ys) - 1)), reverse=True)
    coupes = sorted(i for _, i in ecarts[:k - 1])
    petits = [e for e, _ in ecarts[k - 1:]]
    if petits:
        ligne = statistics.median(petits)
        if any(e < SAUT_MIN * ligne for e, _ in ecarts[:k - 1]):
            return None, "séparation entre cuves incertaine"
    groupes, debut = [], 0
    for c in coupes:
        groupes.append(valeurs[debut:c + 1])
        debut = c + 1
    groupes.append(valeurs[debut:])
    return groupes, None


def entete(t: dict) -> dict:
    return {
        "reservoir": t["numero"],
        "repere": t["repere"],
        "produit": t["produit"],
        "contenance_l": t["contenance_l"],
    }


def cuve_vide(t: dict, raison: str, volume_dessin=None) -> dict:
    return {
        **entete(t), **{c: None for c in CHAMPS},
        "volume_dessin_l": volume_dessin,
        "volume_plus_espace_l": None,
        "controles": [raison],
        "statut": "a_verifier",
    }


def afficher(r: dict) -> None:
    print(f"Écran du {r['horodatage_ecran'] or 'heure non lue'}  |  {r['nb_cuves']} cuve(s)  |  statut : {r['statut']}")
    print(f"{'Rés.':<5}{'Produit':<8}{'Volume L':>10}{'Haut. mm':>10}{'Esp. vide L':>13}{'Temp °C':>9}{'Eau':>6}  Contrôle")
    for c in r["cuves"]:
        def f(v):
            return "?" if v is None else f"{v:g}"
        etat = "OK" if not c["controles"] else " ; ".join(c["controles"])
        if c.get("remarques") and not c["controles"]:
            etat += " (" + " ; ".join(c["remarques"]) + ")"
        print(f"{c['reservoir']:<5}{c['produit']:<8}{f(c['volume_l']):>10}{f(c['hauteur_mm']):>10}"
              f"{f(c['espace_vide_l']):>13}{f(c['temperature_c']):>9}{f(c['eau_mm']):>6}  {etat}")
    for a in r["alertes_ecran"]:
        print(f"Alerte écran : {a}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--json":
        vision = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    elif len(sys.argv) == 2:
        try:
            vision = lire_vision(sys.argv[1])
        except LectureImpossible as exc:
            sys.exit(str(exc))
    else:
        sys.exit(__doc__)
    resultat = analyser(vision)
    afficher(resultat)
    print()
    print(json.dumps(resultat, ensure_ascii=False, indent=2))
