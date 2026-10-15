<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-FDJ-STOCK-Q1-ABSENT-20261015/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-FDJ-STOCK-Q1-ABSENT-20261015
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=50c634a8
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: ci-verte
    classe: VERIFIED
    valeur: run 38725132515 success sur 933e9e74
  - id: recette-test
    classe: VERIFIED
    valeur: 25 preuves ok, nettoyage 0 ligne, deux sites
---
# Request 3 — conditions de decision-2 exécutées, CI verte, demande de validation avant promotion

Réponse à decision-2 (APPROVED_WITH_CONDITIONS, consommée `b20d06bc`). Le lot reste ouvert. Le travail vit sur la branche `fdj-quart-absent-reconstitution-20261015` (base `origin/production`, écart accepté par decision-2 pour cette branche seule), tête `933e9e74`, poussée sur le dépôt. Rien n'est poussé sur `main` ni `production`.

## Livré
- Migration `20261015100000_fdj_stock_chaine_reconstitue_quart_absent.sql` (`18dbc606`) : table dédiée, RLS lecture par site, fonction `fdj_reconstituer_quart_absent(uuid)`.
- Écrans employé (`NEXUS-FDJ-v1.html`) et manager (`NEXUS-FDJ-Manager-v1.html`), moteur `qualifierQuartsAbsentsReconstitues`, épreuve `test_fdj_quart_absent_reconstitue.js` : 14 assertions, 10 mutations sur 10 tuées (`52c53db2`).
- Recette SQL versionnée `supabase/recette-vague1/20261015_preuves_stock_chaine_reconstitue.sql` et sa sortie brute rejouée telle quelle (`9ce94717`) : 25 preuves, toutes `ok:true`.
- Empreinte et nombre attendus des migrations régénérés : 308 (`933e9e74`).
- Entrée nexus-incidents : ligne `EXPERIENCE.jsonl` `FDJ-STOCK-Q1-ABSENT-20261014` et règle `FDJ-001` dans `RULES.json`, validées par `verifier-apprentissage.js`.

## Preuve des conditions de decision-2
1. Périmètre limité aux écrans employé et manager, au moteur, aux épreuves avec mutations, à la recette SQL versionnée et à l'entrée nexus-incidents : c'est le contenu de la liste ci-dessus ; aucun autre module touché.
2. Absence opérationnelle, valeur physique et valeur reconstituée distinctes : table dédiée avec comptage réel conservé à côté (recette A « provenance distincte du physique », E « deux valeurs + écart »), statut `en_conflit`, et épreuve moteur/écrans.
3. Assertion de date corrigée, artefact final exact (commentaire compris) testé sur Test avec A–F et nettoyage constaté : recette A à F et S5 « commentaires de fonction et de table présents » ; nettoyage constaté, 0 ligne `recette-reco-%` après la recette. Sortie brute dans le dépôt.
4. RLS prouvée avec deux contextes de site distincts : R1 lecture autorisée (site A, 9 lignes), R2 et R7a lecture intersite = 0 ligne, R3 à R5 écriture directe refusée (42501), R6 et R7b appel intersite refusé, R7c le manager B écrit chez lui seulement. Limite : Test n'a de managers que sur un site, la recette crée donc un second site fictif, annulé en fin de script.
5. `search_path` fixé, exécution fermée : S3 `search_path=""` et SECURITY DEFINER, S2 `anon` refusé, S4 EXECUTE accordé à `authenticated`, `postgres` et `service_role` seulement, ni PUBLIC ni anon ; S0 caissier refusé, S1 sans session refusé.
6. Manifestes et empreintes régénérés, CI verte : run 38725132515, conclusion `success`, tête `933e9e74`. Le run précédent (38724858519) était rouge sur l'empreinte (307 attendu, 308 réel) ; corrigé. Sept échecs de la suite locale (inventaire, réception) sont antérieurs : ils échouent aussi sur `origin/production`.
7. Aucune mutation de Production, aucune écriture sur `main` ou `production` : Test seulement, via le connecteur (le pooler reste interdit).

## Demande
Valider que les conditions de decision-2 sont remplies. Cela ne demande aucune action sur Production. La migration en Production, la PR vers `production`, la fusion, le déploiement et l'écriture réelle du Q1 du 14/10 exigeront chacun un GO distinct de Frédéric, après une mesure fraîche en lecture seule.
