---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE5-20261018
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=a9ccf920
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: pr139-fusion
    classe: VERIFIED
    valeur: a9ccf920808f9328e790e817dc10b433b61677e3
  - id: arbitre-blocked
    classe: VERIFIED
    valeur: issue28-run39149304247-STOP_REQUIRED-SUPABASE_PRODUCTION_MUTATION
  - id: prod-lecture-seule
    classe: VERIFIED
    valeur: registre319-estampille-absente-2026-10-18
---
# DEMANDE DE DÉCISION HUMAINE — Mutation Supabase PRODUCTION (SECURITE-DEFINER-ETAPE5-20261018)

À : Frédéric (palier `SUPABASE_PRODUCTION_MUTATION`). Rédigée le 18/10/2026 par Claude. **Aucune écriture Production n'a eu lieu.** Cette demande ne vaut pas GO d'exécution.

## Liens et nature de ce dépôt
- Fait suite à `request-1.md` du même lot (rail `c4c1ad14`), que l'arbitre a classée `BLOCKED`, motif `SUPABASE_PRODUCTION_MUTATION` (issue #28, run 39149304247). Cette décision de l'arbitre est conservée telle quelle.
- PR #139 fusionnée au commit `a9ccf920808f9328e790e817dc10b433b61677e3` (branche `production`).
- **Le dépôt de cette demande n'est pas une décision.** Il ne vaut ni `APPROVED_WITH_CONDITIONS`, ni approbation de principe, ni GO d'exécution. La décision doit provenir explicitement de Frédéric, attribuée à l'autorité humaine (jamais à l'arbitre ChatGPT).
- Deux gestes distincts : (1) approbation humaine de principe, matérialisée par une decision sur le rail ; (2) GO d'exécution SQL, donné séparément. Ni l'un ni l'autre n'est donné ici ; aucun déploiement ni approbation de la gate Pages.

## Pourquoi vous
L'arbitre a rendu `BLOCKED` / `STOP_REQUIRED: SUPABASE_PRODUCTION_MUTATION` (issue #28, run 39149304247, request-1 rail `c4c1ad14`). Il ne peut pas franchir ce palier : la décision doit être humaine, matérialisée sur le rail.

## Ce qu'il s'agit d'autoriser (et rien d'autre)
Dans une seule transaction sur Production `uzhjpqpctpvxytxpxoqz` :
- 17 × `ALTER FUNCTION … SET search_path = public, pg_temp`
- 8 × `REVOKE EXECUTE … FROM public, anon, authenticated` (fonctions de trigger uniquement)
- 1 × `INSERT` dans `supabase_migrations.schema_migrations` : `20261018200000` / `securite_definer_search_path_et_triggers_fermes`

Exclusions : `nexus_identifiant_de_connexion(text)` reste exécutable par `anon` (decision humaine `799e0401`) ; `nexus_garde_regularisation_reception()` et `run_scheduled_inventory_reviews()` non touchées ; aucun GRANT, DROP, CREATE OR REPLACE, ni DDL de table.

## État constaté (lecture seule, après fusion)
- #139 fusionnée (`a9ccf920`, 18:52Z) ; fichier de migration présent sur `production`, blob `a33ad478…`, 4 fichiers au diff ; fiche de qualification et procédure en place.
- CI sur `a9ccf920` : Tests, Construire et éprouver l'artefact, non-regression = success ; Supabase Preview = skipped.
- Run Pages 39156144136 : `waiting` (gate humaine non approuvée) ; rien de publié.
- Production : registre 319, estampille `20261018200000` absente, 17 fonctions à `search_path=public`, fonctions de trigger ouvertes à `anon`.
- Désactivation de « Deploy to production » (Supabase) : constatée par vous, reconfirmation demandée avant exécution.

## Garanties de la procédure
`docs/deploiement/procedure-securite-definer-etape5-production-20261018.md` : verrou advisory, gardes (version absente, 17 à `{search_path=public}`, 8 ouvertes, exception login et garde de régularisation vérifiées), corps du fichier octet pour octet, inscription au registre dans la même transaction ; 10 épreuves après ; retour arrière écrit. Prouvé sur Test aux étapes 2 et 3 (6 épreuves, 16 refus `42501`, 9 triggers actifs, job `nexus-inventaire-reviews` succeeded).

## Risques résiduels
1. Un appel direct d'une des 8 fonctions hors dépôt (aucun indice : zéro occurrence dans `rpc(`) échouerait en `42501`.
2. Estampille au registre erronée : parade = version relue sur le fichier avant insertion.
3. Oracle prénom → identifiant : conservé, accepté.
4. Mécanisme automatique hors dépôt non exclu formellement.
5. Écart assumé : `main` n'a pas la migration (chantier de réconciliation distinct).

## Conditions proposées si vous approuvez
1. Votre GO d'exécution distinct, daté, après relecture du rail.
2. Reconfirmation visuelle que « Deploy to production » est éteint.
3. Relevé préalable complet (ACL et `proconfig` des 25 fonctions, 9 triggers, job, registre = 319) ; tout écart → arrêt et retour vers vous.
4. Fenêtre hors clôture de caisse.
5. Aucune approbation de la gate Pages, aucun déploiement, dans ce périmètre.
6. Compte rendu des 10 épreuves ; la connexion réelle est constatée par vous (je ne saisis ni PIN ni identifiants).

## Formulation de décision proposée (suggestion non engageante, à reprendre ou modifier par Frédéric)
> DECISION: APPROVED_WITH_CONDITIONS — le report en Production décrit ci-dessus est autorisé sous les conditions 1 à 6. Cette décision n'est pas un GO d'exécution ; celui-ci sera donné séparément. CLOSES: false. OWNER: Frédéric.

Variantes : `REJECTED` (rien n'est appliqué, Production reste à l'état actuel) ; `APPROVED_WITH_CONDITIONS` avec conditions modifiées.
