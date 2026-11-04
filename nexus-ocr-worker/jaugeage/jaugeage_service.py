#!/usr/bin/env python3
"""
NEXUS : service de lecture des photos de jaugeage (iMac, Apple Vision).

Ce service est SÉPARÉ du worker des bons (com.nexus.ocr-worker) : il ne
traite que les documents de type `jaugeage_veeder_root` et ne touche à rien
d'autre.

Boucle :
  1. cherche dans `documents_ocr_file` les photos de jaugeage « en_attente »
     du site configuré ;
  2. les réserve (en_attente -> en_cours, seulement si personne ne l'a fait) ;
  3. télécharge la photo, la lit avec ./lecteur-vision, la traduit avec
     lecture_jaugeage.py (contrôles compris) ;
  4. écrit le résultat : `resultat_json` = lecture complète et contrôles,
     `resultat_texte` = texte que l'écran Relevés Piste sait déjà lire
     (nexus-veeder-root.js). Seules les cuves dont TOUS les contrôles passent
     y portent un volume ; les autres apparaissent sans volume, donc
     « illisible » à l'écran, et le pompiste saisit à la main.

Rien n'est enregistré dans Carburants par ce service : le pompiste voit une
lecture proposée, l'utilise ou la corrige, et confirme lui-même.

Sécurité :
  - les clés sont lues dans le fichier .env placé à côté de ce script
    (sur l'iMac : ~/nexus-jaugeage/.env), jamais affichées ;
  - le service REFUSE de démarrer sur la base de Production tant que
    NEXUS_JAUGEAGE_PRODUCTION=oui n'est pas posé (décision de Frédéric).

Lancement manuel (Terminal) :
  ~/.nexus-ocr-worker-venv/bin/python ~/nexus-jaugeage/jaugeage_service.py
  ajouter --une-fois pour traiter ce qui attend puis s'arrêter.
"""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from logging.handlers import RotatingFileHandler
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

import lecture_jaugeage as LJ  # noqa: E402

TYPE_DOCUMENT = "jaugeage_veeder_root"
BUCKET = "documents-a-traiter"
INTERVALLE_S = 8
REF_PRODUCTION = "uzhjpqpctpvxytxpxoqz"
MOTEUR = "apple-vision"
VERSION_SERVICE = 2
BLOCAGE_MAX = timedelta(minutes=10)   # un document « en_cours » plus vieux est remis en file
INTERVALLE_REPRISE_S = 300


def charger_env(chemin: Path) -> None:
    """Lit un .env simple (CLE=valeur) sans dépendance ; n'écrase rien d'existant."""
    if not chemin.exists():
        return
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, val = ligne.split("=", 1)
        os.environ.setdefault(cle.strip(), val.strip().strip('"').strip("'"))


def journal() -> logging.Logger:
    log = logging.getLogger("nexus.jaugeage")
    log.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    fichier = RotatingFileHandler(ICI / "jaugeage.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    fichier.setFormatter(fmt)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    log.addHandler(fichier)
    log.addHandler(console)
    # Pas une ligne par requête HTTP (le journal du worker des bons fait 118 Mo).
    for bruyant in ("httpx", "httpcore", "hpack", "postgrest", "storage3"):
        logging.getLogger(bruyant).setLevel(logging.WARNING)
    return log


def texte_pour_releves_piste(resultat: dict) -> str:
    """Texte au format lu par nexus-veeder-root.js. Une cuve sans contrôle
    complet n'a aucun nombre dans son bloc : l'écran affichera « illisible »."""
    lignes = []
    if resultat.get("horodatage_ecran"):
        # Avant le premier en-tête : ignoré par le lecteur de l'écran.
        lignes.append(f"ECRAN {resultat['horodatage_ecran']}")
    for c in resultat.get("cuves", []):
        cap_m3 = int(round(c["contenance_l"] / 1000))
        lignes.append(f"RESERVOIR {c['reservoir']}: {c['repere']} {cap_m3}M3 {c['produit']}")
        complet = all(c.get(k) is not None for k in ("volume_l", "hauteur_mm", "eau_mm"))
        if c["statut"] == "a_valider" and complet:
            vol = int(c["volume_l"])
            lignes.append(f"Volume Produit {vol}")
            lignes.append(f"{vol}")
            lignes.append(f"Hauteur Produi {c['hauteur_mm']:.1f}")
            lignes.append(f"Hauteur eau {c['eau_mm']:.1f}")
        else:
            lignes.append("LECTURE A VERIFIER")
    return "\n".join(lignes)


def traiter(sb, log: logging.Logger, doc: dict) -> None:
    doc_id, chemin = doc["id"], doc["fichier_path"]
    # Réservation : ne passe en_cours que si la ligne est encore en_attente.
    pris = (sb.table("documents_ocr_file").update({"status": "en_cours"})
            .eq("id", doc_id).eq("status", "en_attente").execute())
    if not pris.data:
        log.info("Document %s déjà pris ailleurs, ignoré", doc_id)
        return
    log.info("Lecture du jaugeage %s", doc_id)
    try:
        octets = sb.storage.from_(BUCKET).download(chemin)
        suffixe = Path(chemin).suffix or ".jpg"
        with tempfile.NamedTemporaryFile(suffix=suffixe) as tmp:
            tmp.write(octets)
            tmp.flush()
            resultat = LJ.analyser(LJ.lire_vision(tmp.name))
        texte = texte_pour_releves_piste(resultat)
        sb.table("documents_ocr_file").update({
            "status": "traite",
            "moteur_utilise": MOTEUR,
            "resultat_texte": texte,
            "resultat_json": resultat,
            "traite_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", doc_id).execute()
        resume = ", ".join(f"R{c['reservoir']} {c['statut']}" for c in resultat["cuves"])
        log.info("Jaugeage %s lu (%s) : %s", doc_id, resultat["statut"], resume or "aucune cuve")
    except Exception as exc:  # noqa: BLE001 — photo illisible, réseau… : le document passe en erreur
        # Un arrêt demandé (Ctrl+C, arrêt de l'iMac) n'est PAS attrapé ici : le
        # document reste « en_cours » et remettre_en_file() le reprend au redémarrage.
        log.exception("Échec de lecture du jaugeage %s", doc_id)
        sb.table("documents_ocr_file").update({
            "status": "erreur",
            "moteur_utilise": MOTEUR,
            "erreur_message": f"Lecture du jaugeage impossible : {exc}"[:2000],
            "traite_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", doc_id).execute()


def remettre_en_file(sb, log: logging.Logger, site: str) -> None:
    """Remet « en_attente » une photo restée « en_cours » (coupure pendant la lecture)."""
    limite = (datetime.now(timezone.utc) - BLOCAGE_MAX).isoformat()
    rep = (sb.table("documents_ocr_file").update({"status": "en_attente"})
           .eq("site", site).eq("type_document", TYPE_DOCUMENT).eq("status", "en_cours")
           .lt("deposited_at", limite).is_("traite_at", "null").execute())
    if rep.data:
        log.warning("%d photo(s) de jaugeage bloquée(s) remise(s) en file", len(rep.data))


def est_production(url: str) -> bool:
    return (urlparse(url).hostname or "") == f"{REF_PRODUCTION}.supabase.co"


def main() -> None:
    charger_env(ICI / ".env")
    log = journal()
    url = os.environ.get("SUPABASE_URL", "")
    cle = os.environ.get("SUPABASE_SERVICE_KEY", "")
    site = os.environ.get("NEXUS_SITE", "")
    if not (url and cle and site):
        sys.exit("Configuration incomplète : SUPABASE_URL, SUPABASE_SERVICE_KEY et NEXUS_SITE "
                 "doivent être dans ~/nexus-jaugeage/.env")
    if (est_production(url) or REF_PRODUCTION in url) and os.environ.get("NEXUS_JAUGEAGE_PRODUCTION") != "oui":
        sys.exit("Refus : ce .env vise la base de PRODUCTION. Le service jaugeage tourne sur Test "
                 "tant que Frédéric n'a pas donné son GO (NEXUS_JAUGEAGE_PRODUCTION=oui).")
    if not LJ.LECTEUR.exists():
        sys.exit(f"Lecteur introuvable : {LJ.LECTEUR}")

    from supabase import create_client
    sb = create_client(url, cle)
    base = "PRODUCTION" if est_production(url) else "Test"
    log.info("Service jaugeage v%s démarré : base %s, site %s, moteur %s, traducteur v%s",
             VERSION_SERVICE, base, site, MOTEUR, LJ.analyser({"lignes": []}).get("version_traducteur"))

    une_fois = "--une-fois" in sys.argv
    derniere_reprise = 0.0
    echecs = 0
    while True:
        try:
            if time.time() - derniere_reprise >= INTERVALLE_REPRISE_S:
                remettre_en_file(sb, log, site)
                derniere_reprise = time.time()
            rep = (sb.table("documents_ocr_file")
                   .select("id, fichier_path")
                   .eq("site", site).eq("status", "en_attente").eq("type_document", TYPE_DOCUMENT)
                   .order("deposited_at").limit(3).execute())
            for doc in rep.data or []:
                traiter(sb, log, doc)
            if echecs:
                log.info("Connexion rétablie après %d essai(s) en échec", echecs)
            echecs = 0
        except Exception:  # noqa: BLE001 — le service ne s'arrête pas seul (coupure réseau…)
            echecs += 1
            # Journal sobre : la 1re erreur en détail, puis un rappel toutes les ~10 min.
            if echecs == 1:
                log.exception("Erreur dans la boucle, nouvel essai toutes les %ss", INTERVALLE_S)
            elif echecs % 75 == 0:
                log.warning("Toujours en échec depuis %d essais (~%d min)", echecs, echecs * INTERVALLE_S // 60)
        if une_fois:
            break
        time.sleep(INTERVALLE_S)


if __name__ == "__main__":
    main()
