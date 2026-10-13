<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/request-7.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=13a4e56
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 146-fichiers
  - id: migration-appliquee-production
    classe: VERIFIED
    valeur: 311 migrations, derniere 20261013152155, colonnes presentes, CHECK 6 et 16 valeurs, relu en lecture seule le 13-10-2026
  - id: go-nominatif
    classe: DECLARED
    valeur: Frederic Bragance, session du 13-10-2026, go pour appliquer la migration en Production
---
# Compte rendu d'application — migration Production (suite de request-6)

Ceci n'est pas une demande de verdict : c'est la trace d'un geste exécuté après autorisation nominative.

## Chaîne d'autorisation

- request-6 (`0edcffc`) : demande limitée à `SUPABASE_PRODUCTION_MUTATION`.
- Réponse de l'arbitre (issue #28, run 38420656956) : `BLOCKED`, `STOP_REQUIRED: SUPABASE_PRODUCTION_MUTATION`, `PROOF_VALID`, aucune condition ; la décision revient à Frédéric. La CI ne l'a pas matérialisée (`HUMAN_DECISION_REQUIRED`) : il n'existe donc pas de decision-3.
- GO nominatif de Frédéric Bragance, en session, le 13/10/2026 : « go pour appliquer la migration en Production ».

## Ce qui a été fait

Migration `20261013132532_nexus_paye_items_types_heures_verify.sql`, blob `fe205ec861e8c81d240d929b0b98343dd0f653cd` (vérifié par `git hash-object` avant l'envoi), appliquée à Production `uzhjpqpctpvxytxpxoqz` par le connecteur Supabase, le 13/10/2026.

**Préflight immédiat** (lecture seule, juste avant l'écriture) : 310 migrations, dernière `20261011220000`, colonnes absentes, 10 lignes `nexus_paye_items`, 0 statut hors liste, 0 type hors liste.

**Relecture après écriture** (lecture seule) :

| Mesure | Valeur |
|---|---|
| migrations / dernière | 311 / `20261013152155` |
| `audits_caisse.employes_renfort` | présente |
| `nexus_paye_items.detail` | présente |
| CHECK `statut` | 6 valeurs |
| CHECK `type_item` | 16 valeurs |
| lignes `nexus_paye_items` | 10, inchangées |
| `employes_renfort` renseignés | 0 |

## Écart d'estampille, constaté

Le fichier porte `20261013132532` ; Production a enregistré `20261013152155` (estampille du connecteur). C'est l'écart annoncé dans request-5/6 ; le tableau des « migrations sans fichier » et la garde d'ordre devront le constater.

## Ce qui n'a PAS été fait

- Fusion de la PR #104 : non. Pages : non. Le code servi est inchangé.
- Le manifeste de migrations n'est pas encore mis à jour (il classe la migration « appliquée nulle part ») : à faire avec la PR, pas sur le rail seul.
- Q4 et B : non tranchées.

## Suite

Une demande distincte pour la fusion de la PR #104 (tête `c577e3d`) puis Pages, avec son propre GO nommé.
