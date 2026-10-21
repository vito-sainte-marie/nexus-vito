<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-PHOTO-20261021/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-PHOTO-20261021
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=cdfee414
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 159-fichiers
  - id: fusion-pr144
    classe: VERIFIED
    valeur: cdfee414bf76165f7054020c8549bcd4853e0761
  - id: deploiement-manuel
    classe: VERIFIED
    valeur: run 39622404453 success, build servi cdfee414
---
# Demande de clôture — JAUGEAGE-PHOTO-20261021

## Preuve des conditions de decision-1

Les conditions de la decision-1 sont tenues.

- Publication d'abord sur l'aperçu Test seulement ; recette iPhone faite par Frédéric sur Test (carte Inventaire visible, caméra en page, enregistrement SP 23436 / GO1 13897 / GO2 8371 / GNR 4372 relus, carte Inventaire passée à « fait »). Deux corrections demandées à la recette sont livrées (bandeau d'état, carte « Jaugeage enregistré »).
- PR #144 ouverte après le GO explicite de Frédéric (`PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`), `Tests` vert, **fusionnée par Frédéric** : `cdfee414bf76165f7054020c8549bcd4853e0761` (21/10/2026, 14:45Z).
- Aucun déploiement automatique n'a suivi la fusion (cause non élucidée) ; déploiement manuel `workflow_dispatch deployer=oui`, exécution 39622404453, approuvé par Frédéric.
- Contenu servi mesuré : `nexus-build.js` = `cdfee414`, empreinte de `nexus-camera-page.js` identique au dépôt, « Jaugeage enregistré : SP » présent, `rpc().catch` absent.
- Non vérifié : essai iPhone en Production (la carte n'y apparaît que si `jaugeage_carburant_actif` est activé) ; taille en pixels de la photo déposée (estimée ~2000×1500).
- Hors lot : worker OCR (HEIC / orientation) ; cause du push `production` sans déclenchement du workflow.
- Registre : les commits du lot sont sur `main` (fusion `cdfee414`), pas dans l'historique du rail ; `--preuve-action` ne peut donc pas les désigner. La prise en charge de decision-1 est posée (`ATTENTE_CONSOMMATION_DECISION`) ; on demande la clôture sur ces preuves.
