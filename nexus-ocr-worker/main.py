"""
NEXUS — Worker du moteur documentaire OCR
==========================================

Boucle de polling : tire les documents "en_attente" depuis Supabase
(table documents_ocr_file), les traite avec l'adaptateur configuré
(NEXUS_OCR_MODE), écrit le résultat, et publie un battement de cœur régulier
(table moteur_documentaire_etat) pour que NEXUS puisse avertir dans
l'interface si ce worker devient injoignable.

Ce fichier ne modifie jamais le code métier NEXUS — c'est le seul composant
qui change entre le mode Local (ce fichier, sur l'iMac, V1) et un futur mode
Cloud (V2) : construire_moteur() choisira alors CloudEngine selon
NEXUS_OCR_MODE, sans toucher au reste.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import Client, create_client

from ocr_engine import LocalEngine, OCREngine
from dossier_watcher import scanner_dossier_surveille

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("nexus.ocr.worker")

INTERVALLE_POLLING_S = 8
INTERVALLE_HEARTBEAT_S = 30
BUCKET = "documents-a-traiter"


def construire_moteur() -> OCREngine:
    mode = os.environ.get("NEXUS_OCR_MODE", "local")
    if mode == "local":
        return LocalEngine()
    raise NotImplementedError(
        f"Mode '{mode}' non implémenté dans ce worker — seul 'local' existe en V1. "
        "Le passage en mode 'cloud' (V2) ajoutera un CloudEngine dans ocr_engine.py "
        "sans toucher au reste de ce fichier ni au code métier NEXUS."
    )


def client_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    cle = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, cle)


def traiter_un_document(sb: Client, moteur: OCREngine, doc: dict) -> bool:
    """Retourne True si le document a été traité avec succès — sert à
    horodater dernier_traitement (widget "État du moteur documentaire",
    07/08/2026), distinct du simple battement de cœur."""
    doc_id = doc["id"]
    chemin = doc["fichier_path"]
    logger.info("Traitement du document %s (%s)", doc_id, chemin)

    # Marque immédiatement en_cours pour éviter qu'un deuxième worker (utile
    # en transition V1→V2, voir la note de conception §9) ne traite deux
    # fois le même document.
    sb.table("documents_ocr_file").update({"status": "en_cours"}).eq("id", doc_id).execute()

    try:
        fichier_bytes = sb.storage.from_(BUCKET).download(chemin)
        resultat = moteur.extraire(fichier_bytes, chemin, doc.get("type_document"))
        sb.table("documents_ocr_file").update({
            "status": "traite",
            "moteur_utilise": resultat.moteur,
            "resultat_texte": resultat.texte,
            "resultat_json": resultat.donnees or None,
            "traite_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", doc_id).execute()
        logger.info("Document %s traité avec succès (%s)", doc_id, resultat.moteur)
        return True
    except Exception as exc:  # noqa: BLE001 — on logge puis on continue la boucle
        logger.exception("Échec du traitement de %s", doc_id)
        sb.table("documents_ocr_file").update({
            "status": "erreur",
            "erreur_message": str(exc)[:2000],
            "traite_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", doc_id).execute()
        return False


def publier_heartbeat(sb: Client, moteur: OCREngine, nb_en_attente: int, site: str, dernier_traitement: str | None) -> None:
    hote = os.environ.get("NEXUS_WORKER_HOST", "imac")
    payload = {
        "site": site,
        "dernier_battement": datetime.now(timezone.utc).isoformat(),
        "mode": os.environ.get("NEXUS_OCR_MODE", "local"),
        "hote": hote,
        "moteur_actif": moteur.nom(),
        "documents_en_attente": nb_en_attente,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if dernier_traitement:
        payload["dernier_traitement"] = dernier_traitement
    sb.table("moteur_documentaire_etat").upsert(payload, on_conflict="site").execute()


def boucle_principale() -> None:
    sb = client_supabase()
    moteur = construire_moteur()
    site = os.environ.get("NEXUS_SITE", "vito-sainte-marie")
    logger.info(
        "Worker documentaire NEXUS démarré — mode=%s moteur=%s site=%s",
        os.environ.get("NEXUS_OCR_MODE", "local"), moteur.nom(), site,
    )

    # Dossier surveillé (07/08/2026, demande de Frédéric — "NEXUS peut-il
    # récupérer un fichier importé depuis un dossier où les bons scannés
    # arriveraient ?") : optionnel, désactivé si NEXUS_DOSSIER_SURVEILLE
    # n'est pas défini dans .env. Applique la même règle de tri que la
    # Boîte de réception (voir dossier_watcher.py) — un dépôt manuel dans
    # NEXUS ou un fichier déposé par le scanner produisent le même résultat.
    dossier_surveille = os.environ.get("NEXUS_DOSSIER_SURVEILLE")
    if dossier_surveille:
        logger.info("Dossier surveillé activé : %s", dossier_surveille)
    else:
        logger.info("Dossier surveillé désactivé (NEXUS_DOSSIER_SURVEILLE absent de .env)")

    dernier_heartbeat = 0.0
    dernier_traitement_iso: str | None = None
    while True:
        try:
            if dossier_surveille:
                scanner_dossier_surveille(sb, site, BUCKET, dossier_surveille)

            reponse = (
                sb.table("documents_ocr_file")
                .select("id, fichier_path, type_document")
                .eq("site", site)
                .eq("status", "en_attente")
                .order("deposited_at")
                .limit(5)
                .execute()
            )
            for doc in reponse.data or []:
                if traiter_un_document(sb, moteur, doc):
                    dernier_traitement_iso = datetime.now(timezone.utc).isoformat()

            maintenant = time.time()
            if maintenant - dernier_heartbeat >= INTERVALLE_HEARTBEAT_S:
                compte = (
                    sb.table("documents_ocr_file")
                    .select("id", count="exact")
                    .eq("site", site)
                    .eq("status", "en_attente")
                    .execute()
                )
                publier_heartbeat(sb, moteur, compte.count or 0, site, dernier_traitement_iso)
                dernier_heartbeat = maintenant
        except Exception:  # noqa: BLE001 — le worker ne doit jamais s'arrêter tout seul
            logger.exception("Erreur dans la boucle principale — nouvelle tentative dans %ss", INTERVALLE_POLLING_S)

        time.sleep(INTERVALLE_POLLING_S)


if __name__ == "__main__":
    boucle_principale()
