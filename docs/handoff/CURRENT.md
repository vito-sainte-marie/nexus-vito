<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-R4-VIGIE-20261020/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R4-VIGIE-20261020
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: rail-tete
    classe: VERIFIED
    valeur: e79e071c
  - id: workflows-presents
    classe: VERIFIED
    valeur: tests.yml+test-telegram-handoff.yml-sans-schedule
---
# GOV-R4-VIGIE-20261020 : request-1, cadrage d'une vigie planifiée qui appelle O3

**Domaine :** gouvernance. **Origine :** GO de Frédéric du 20/10/2026 (« ouvre la vigie R4 »), suite de R3 (O3 livré, non câblé).
**Nature de cette request-1 :** cadrage seulement. Aucun workflow, permission, secret, identité, connecteur ni armement n'est créé ni modifié par elle. Rien n'est écrit en dehors du registre.

## Constat

- O3 (`outils/consommer-clotures-ci.js`) consomme une clôture CI conforme, mais ne s'exécute que si une session l'appelle. Une clôture déposée la nuit attend la prochaine ouverture (mémoire : deux clôtures R1/R2 sont restées sans consommateur le 20/10).
- Les workflows présents sont `tests.yml` et `test-telegram-handoff.yml`. Aucun n'est planifié (aucun `schedule`/`cron`).
- O3 ne pousse jamais, par construction (R3 G10). Une vigie qui consomme « pour de bon » devrait donc pousser sur le rail : c'est une écriture de la CI sur une branche, et un commit poussé avec le jeton du workflow ne relance pas la CI.

## Objet : trois niveaux, du plus sûr au plus fort

1. **V1 — vigie en lecture seule.** Workflow planifié qui lance O3 en mode rapport (sans `--appliquer`) et signale, par le canal d'alerte existant, « clôture en attente de consommation : <lot> ». Permissions `contents: read`. Ne modifie rien.
2. **V2 — consommation par la vigie.** Même workflow avec `--appliquer` puis push du commit de registre. Exige `contents: write` sur le rail, et le push ne relance pas la CI : la preuve de vert du commit de consommation reste à produire autrement.
3. **V3 — réveil de Claude après consommation.** Hors cadrage ici (touche l'armement de la boucle).

**Recommandation de Claude :** n'admettre que V1 comme périmètre d'une première étape. V2 et V3 changent ce que la CI peut écrire ou déclencher au nom de Frédéric : à nommer comme paliers réservés, pas à trancher ici.

## Questions à arbitrer

1. V1 relève-t-il d'un palier réservé (ajout d'un workflow planifié) ou d'un arbitrage ordinaire ? Dans le doute, dire lequel : Claude s'arrête et rapporte.
2. Le canal d'alerte : réutiliser Telegram (secret déjà présent, alerte `RAIL_SANS_ADRESSE` exclue du lot précédent) ou un commentaire sur #28 ? Chacun a son périmètre de permission.
3. Fréquence et idempotence : une alerte par clôture et par lot, pas de répétition tant que l'état ne change pas.
4. Épreuves de falsification à écrire rouges avant tout code : V1 sans clôture → silence ; avec clôture conforme → une alerte, aucune écriture ; clôture non conforme (empreinte divergente, API muette) → alerte de refus, pas de succès ; jamais d'écriture sur le dépôt ; même état deux fois → une seule alerte.

## Hors périmètre

Voie B ; `tests.yml` ; permission, secret, identité, connecteur ; V2, V3 et O1/O2 ; Production ; règle des niveaux ; incident SQL et clôture d'ETAPE5 ; toute écriture Supabase, fusion ou déploiement.

## Décision demandée

Admettre V1 comme seul périmètre d'une étape suivante (ou l'amender), nommer le palier réservé s'il y en a un, et dire si un GO distinct de Frédéric est requis avant d'écrire le workflow. Rien n'est appliqué par cette demande.
