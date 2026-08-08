"""
NEXUS — Surveillance de dossier local (dépôt automatique)
===========================================================

Ajouté le 07/08/2026, demande de Frédéric : "NEXUS peut-il récupérer un
fichier importé depuis un dossier où les bons scannés arriveraient ?"

Ce module ne change rien à la Boîte de réception (NEXUS-Boite-Reception-v1.html)
côté navigateur — il applique exactement la MÊME règle de tri (texte natif
PDF → facture, sinon → bon envoyé à l'OCR) et écrit dans les MÊMES tables
Supabase, pour que les deux points d'entrée (dépôt manuel dans NEXUS, ou
scanner qui dépose un fichier dans un dossier surveillé sur l'iMac)
produisent un résultat identique et indiscernable une fois dans NEXUS.

Fonctionnement :
- Le dossier à surveiller est optionnel (variable NEXUS_DOSSIER_SURVEILLE
  dans .env). Si elle est absente, cette fonctionnalité reste simplement
  inactive — aucun impact sur le reste du worker.
- Chaque fichier repéré (pdf/jpg/jpeg/png, hors fichiers cachés type
  .DS_Store) est traité une seule fois : après succès, il est déplacé dans
  un sous-dossier "Traités" (créé automatiquement) — ce qui évite à la fois
  les doublons et le besoin de mémoriser un état côté base. En cas d'échec,
  le fichier reste sur place et sera retenté au prochain passage.
- Un fichier trop récent (moins de 5 secondes) est ignoré à ce passage —
  évite d'attraper un fichier que le scanner est encore en train d'écrire.
- depose_par reste NULL sur documents_ocr_file pour ces dépôts : ce n'est
  pas un employé qui dépose via NEXUS, mais une importation automatique —
  la colonne est nullable exactement pour ce cas (voir migration
  moteur_documentaire_ocr_file_et_etat).
"""

from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import date, datetime, timezone
from pathlib import Path

from pypdf import PdfReader

logger = logging.getLogger("nexus.ocr.worker.dossier")

EXTENSIONS_ACCEPTEES = {".pdf", ".jpg", ".jpeg", ".png"}
DOSSIER_TRAITES_NOM = "Traités"
SEUIL_CARACTERES_TEXTE_NATIF = 60  # même seuil que Boîte de réception (JS)
AGE_MINIMAL_FICHIER_S = 5  # ignore un fichier trop récent (scanner encore en écriture)
LIMITE_PAGES_TEXTE = 10

REGEX_SIRET = re.compile(r"\b\d{14}\b")
REGEX_EMAIL = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def _hash_sha256(chemin: Path) -> str:
    h = hashlib.sha256()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(65536), b""):
            h.update(bloc)
    return h.hexdigest()


def _extraire_texte_pdf_natif(chemin: Path) -> str:
    """Même principe que extraireTextePdf() côté navigateur (pdf.js) : lit le
    texte déjà présent dans le PDF, sans OCR. Retourne '' si le PDF n'a pas
    de couche de texte exploitable (scan) ou est illisible — jamais une
    exception qui remonterait et bloquerait la boucle du worker."""
    try:
        lecteur = PdfReader(str(chemin))
        morceaux = []
        for page in lecteur.pages[:LIMITE_PAGES_TEXTE]:
            morceaux.append(page.extract_text() or "")
        return "\n".join(morceaux).strip()
    except Exception:
        logger.exception("Extraction texte PDF natif impossible pour %s (probablement scanné/protégé)", chemin.name)
        return ""


def _a_texte_natif(texte: str) -> bool:
    return len(re.sub(r"\s+", "", texte)) >= SEUIL_CARACTERES_TEXTE_NATIF


def _nom_fichier_sur(nom: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", nom)


def _detecter_client(sb, site: str, siret: str | None, email: str | None):
    """Même logique que detecterClient() côté Boîte de réception : SIRET
    exact en priorité, sinon e-mail connu d'un interlocuteur — jamais de
    correspondance approximative sur le nom."""
    if siret:
        r = sb.table("clients").select("id").eq("site", site).eq("actif", True).eq("siret", siret).limit(1).execute()
        if r.data:
            return r.data[0]["id"], "siret", 1
    if email:
        clients = sb.table("clients").select("id").eq("site", site).eq("actif", True).execute()
        ids_clients = [c["id"] for c in (clients.data or [])]
        if ids_clients:
            r = sb.table("client_contacts").select("client_id, email_principal, email_secondaire").in_("client_id", ids_clients).execute()
            email_l = email.lower()
            for c in (r.data or []):
                emails = [e for e in [c.get("email_principal"), c.get("email_secondaire")] if e]
                if email_l in [e.lower() for e in emails]:
                    return c["client_id"], "email", 0.8
    return None, "manuel", None


def _periode_courante_id(sb, site: str) -> str | None:
    aujourdhui = date.today()
    mois, annee = aujourdhui.month, aujourdhui.year
    existante = sb.table("billing_periods").select("id").eq("site", site).eq("mois", mois).eq("annee", annee).maybe_single().execute()
    if existante.data:
        return existante.data["id"]
    creee = sb.table("billing_periods").insert({"site": site, "mois": mois, "annee": annee, "statut": "ouverte"}).select("id").single().execute()
    return creee.data["id"] if creee.data else None


def _uploader(sb, bucket: str, chemin_storage: str, contenu: bytes, content_type: str) -> bool:
    try:
        sb.storage.from_(bucket).upload(chemin_storage, contenu, {"content-type": content_type})
        return True
    except Exception:
        logger.exception("Échec upload storage pour %s", chemin_storage)
        return False


def _traiter_un_fichier(sb, site: str, bucket: str, chemin: Path) -> bool:
    """Retourne True si le fichier a été traité avec succès (et peut donc
    être déplacé vers "Traités"), False sinon (reste en place, retenté au
    prochain passage)."""
    logger.info("Dossier surveillé — nouveau fichier détecté : %s", chemin.name)
    contenu = chemin.read_bytes()
    fichier_hash = hashlib.sha256(contenu).hexdigest()
    est_pdf = chemin.suffix.lower() == ".pdf"

    texte_natif = _extraire_texte_pdf_natif(chemin) if est_pdf else ""
    a_texte = _a_texte_natif(texte_natif)

    horodatage = int(time.time() * 1000)
    nom_sur = _nom_fichier_sur(chemin.name)
    content_type = "application/pdf" if est_pdf else f"image/{chemin.suffix.lower().lstrip('.')}"

    if a_texte:
        # ---- Chemin FACTURE : texte natif, pas d'OCR nécessaire ----
        chemin_storage = f"{site}/factures/{horodatage}-{nom_sur}"
        if not _uploader(sb, bucket, chemin_storage, contenu, content_type):
            return False

        siret_match = REGEX_SIRET.search(texte_natif)
        email_match = REGEX_EMAIL.search(texte_natif)
        siret = siret_match.group(0) if siret_match else None
        email = email_match.group(0) if email_match else None
        client_id, methode, confiance = _detecter_client(sb, site, siret, email)
        periode_id = _periode_courante_id(sb, site)

        try:
            sb.table("invoices").insert({
                "billing_period_id": periode_id, "client_id": client_id, "fichier_path": chemin_storage,
                "fichier_hash": fichier_hash, "siret_detecte": siret, "email_detecte": email,
                "methode_identification": methode, "confiance_identification": confiance,
                "statut": "a_traiter" if client_id else "client_a_confirmer",
            }).execute()
        except Exception:
            logger.exception("Échec insertion facture (dossier surveillé) pour %s", chemin.name)
            return False
        logger.info("Fichier %s classé FACTURE (client %s)", chemin.name, "identifié" if client_id else "à confirmer")
        return True

    # ---- Chemin BON : image ou PDF scanné, direction la file OCR ----
    chemin_storage = f"{site}/bons/{horodatage}-{nom_sur}"
    if not _uploader(sb, bucket, chemin_storage, contenu, content_type):
        return False

    periode_id = _periode_courante_id(sb, site)
    try:
        file_ocr = sb.table("documents_ocr_file").insert({
            "site": site, "fichier_path": chemin_storage, "type_document": "bon_livraison", "depose_par": None,
        }).select("id").single().execute()
        sb.table("supporting_documents").insert({
            "client_id": None, "billing_period_id": periode_id, "type_document": "bon_livraison",
            "fichier_path": chemin_storage, "fichier_hash": fichier_hash, "statut_extraction": "en_attente",
            "documents_ocr_file_id": file_ocr.data["id"],
        }).execute()
    except Exception:
        logger.exception("Échec mise en file OCR (dossier surveillé) pour %s", chemin.name)
        return False
    logger.info("Fichier %s classé BON — mis en file OCR", chemin.name)
    return True


def scanner_dossier_surveille(sb, site: str, bucket: str, dossier: str) -> None:
    """Appelée à chaque tour de boucle du worker. Ne fait rien si le
    dossier n'existe pas encore (ex : Frédéric n'a pas encore créé son
    dossier dédié) — logge juste un avertissement une seule fois par
    redémarrage plutôt que de planter le worker."""
    racine = Path(dossier).expanduser()
    if not racine.is_dir():
        return

    dossier_traites = racine / DOSSIER_TRAITES_NOM
    dossier_traites.mkdir(exist_ok=True)

    maintenant = time.time()
    for chemin in sorted(racine.iterdir()):
        if not chemin.is_file() or chemin.name.startswith("."):
            continue
        if chemin.suffix.lower() not in EXTENSIONS_ACCEPTEES:
            continue
        if (maintenant - chemin.stat().st_mtime) < AGE_MINIMAL_FICHIER_S:
            continue  # probablement encore en cours d'écriture par le scanner

        try:
            succes = _traiter_un_fichier(sb, site, bucket, chemin)
        except Exception:
            logger.exception("Erreur inattendue en traitant %s — fichier laissé en place, nouvelle tentative au prochain passage", chemin.name)
            continue

        if succes:
            try:
                chemin.rename(dossier_traites / chemin.name)
            except Exception:
                logger.exception("Fichier %s traité avec succès mais impossible à déplacer vers %s — restera visible ici, sans être retraité (déjà en base)", chemin.name, dossier_traites)
