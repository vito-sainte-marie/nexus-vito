<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-20261021/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-20261021
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=84adc5de
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 159-fichiers
---
# Demande d'ouverture — JAUGEAGE-OCR-20261021 (lecture OCR de la photo Veeder-Root, lot à part)

## Preuve des conditions de decision-1

Sans objet : lot nouveau, aucune decision antérieure. Il découle de JAUGEAGE-PHOTO-20261021, clos par decision-4 (APPROVED, closes:true), qui avait explicitement laissé l'OCR hors périmètre ; Frédéric a confirmé le 21/10/2026 que l'OCR du jaugeage fait un lot à part.

## Objet

Lire par OCR l'écran Veeder-Root photographié dans l'écran de jaugeage : pour chacun des quatre réservoirs, volume, hauteur et température. Aujourd'hui le worker OCR (iMac) ne reconnaît pas ce type : aucun parseur Veeder-Root, aucun retour dans l'écran de jaugeage. Le type `jaugeage_veeder_root` n'est pas traité spécifiquement.

## Périmètre proposé

- Parseur Veeder-Root dans `ocr_engine.py` ; branchement dans `main.py` pour `type_document = jaugeage_veeder_root` ; résultat dans `resultat_json`.
- Aucun pré-remplissage de l'écran : la lecture est un résultat stocké, pas une saisie.
- Versionner le worker dans `nexus-ocr-worker/` : seuls `main.py`, `ocr_engine.py`, `dossier_watcher.py` (la copie suivie est périmée), `requirements.txt`, les scripts d'installation et un `.env.example`. Aucun `.env`, aucun rapport .md, aucun dossier `.claude/`.

## Contraintes dites sans fard

- Le dépôt est PUBLIC. Preuve d'absence de secret exigée avant tout commit du worker (scan des fichiers versionnés, `.gitignore` excluant `.env`). Le worker lit `SUPABASE_URL` et `SUPABASE_SERVICE_KEY` dans un `.env` local jamais versionné.
- Aucune photo d'essai exploitable pour l'instant : les photos de Test ont été supprimées (données personnelles dans le cadre). Frédéric reprendra une photo de l'écran seul, sans personne ni document ; les tests du parseur n'utiliseront que cette photo ou des textes synthétiques.
- La copie du worker de l'iMac n'a pas été comparée à celle d'iCloud (pas d'accès à l'iMac) : comparaison par empreintes à faire avant de versionner.
- Rien en Production, aucune migration, aucun SQL. Déploiement du worker sur l'iMac : geste de Frédéric.

## Demande

Dire si ce périmètre est approuvé pour ouvrir la PR du worker (sans fusion ni déploiement sans GO de Frédéric), ou nommer la preuve manquante.
