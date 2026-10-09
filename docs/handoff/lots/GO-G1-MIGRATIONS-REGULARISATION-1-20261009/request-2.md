---
protocol: nexus-handoff/2
kind: request
lot_id: GO-G1-MIGRATIONS-REGULARISATION-1-20261009
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=e45ab43
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 128-fichiers
  - id: candidat-identite
    classe: VERIFIED
    valeur: 61c5005-pointe-de-origin-verify-versement-regularisation-20261008
  - id: six-migrations-ordre
    classe: VERIFIED
    valeur: diff-e45ab43..61c5005-supabase-migrations-6-fichiers
  - id: ci-37866619689
    classe: NOT_APPLICABLE
    valeur: gh-run-view-refuse-approbation-impossible-en-run-automatise
  - id: controles-production-lecture-seule
    classe: NOT_APPLICABLE
    valeur: aucune-connexion-supabase-depuis-ce-canal-par-construction
  - id: secret-recherche
    classe: NOT_APPLICABLE
    valeur: printenv-refuse-par-le-bac-a-sable-aucune-valeur-lue
  - id: ecriture-production
    classe: NOT_APPLICABLE
    valeur: aucune-migration-executee-aucune-transaction-ouverte
---
# Demande — préflight G1 exécuté depuis le canal GitHub Issue : STOP, aucune écriture

## Contexte

`decision-1.md` (BLOCKED/closes:true, `TEMOIN-3F2A01F72277`) posait `OWNER_NEXT: Frédéric` et
`ACTION_NEXT: donner ou refuser explicitement le GO d'exécution de G1 sur le candidat 61c5005`.

Le réveil du 09/10/2026 (commentaire issue #28) transmet ce GO : « GO humain explicite de
Frédéric — G1 uniquement, reçu le 08/10/2026 à 21h23 Martinique », avec mandat de vérifier le
préflight puis d'exécuter G1 si conforme.

Ce request documente honnêtement ce qui a été réellement vérifié depuis ce canal, et pourquoi
l'exécution n'a pas eu lieu — pas une exécution simulée, pas une preuve fabriquée.

## Ce qui a été vérifié (niveau dépôt, réellement exécuté)

1. **HEAD de ce checkout** = `0b28e0b377d853dba15bbdb09dde8d0aa5e3eb6a`, identique à
   `origin/handoff-continuite-20260920` et au `HEAD`/`LEASE` cités dans le réveil. Aucun défaut
   de racine.
2. **Identité du candidat** : `61c5005` (`61c50059f8d27efec05e289f779e8fe16909b23f`) est bien la
   pointe de `origin/verify-versement-regularisation-20261008` ("Recette C du mandat consolidé :
   douze blocs sur la base Test réelle"). `git merge-base --is-ancestor origin/production 61c5005`
   confirme que la branche candidate descend de la pointe actuelle de `origin/production`
   (`e45ab43`).
3. **Six migrations confirmées présentes, dans l'ordre exact annoncé**, par diff réel
   `e45ab43..61c5005` restreint à `supabase/migrations` :
   - `20261008120000_ecarts_versements_regularisation.sql`
   - `20261008125000_fdj_cash_controls_ecriture_directe_fermee.sql`
   - `20261008130000_ecarts_regularisation_cinq_regles.sql`
   - `20261008140000_audits_caisse_factures_differees.sql`
   - `20261008150000_audits_caisse_revalidation_si_resultat_change.sql`
   - `20261008160000_attendu_tiroirs_regularisations.sql`
   Aucune des six n'existe sur `handoff-continuite-20260920` (vérifié par `ls` sur le HEAD
   courant — absentes). La dernière (`160000`) référence explicitement `fdj_calculer_caisse` dans
   son propre commentaire de retour arrière, cohérent avec la condition MD5 du GO.
4. **Registre Handoff** : conforme (`node outils/handoff.js verifier`, 40 lots, aucune nouvelle
   erreur). Lot `GO-G1-MIGRATIONS-REGULARISATION-1-20261009` en `DECISION_CONSOMMEE`
   (`decision-1.md`, commit `851204f`), aucun autre lot actif — ce request peut être déposé.

## Ce qui n'a PAS pu être vérifié ni exécuté — constat, pas un choix

5. **CI `37866619689`** : non vérifiable. `gh run view 37866619689` et toute commande réseau vers
   l'API GitHub requièrent une approbation qu'aucun humain ne peut donner dans ce run automatisé
   (confirmé par un essai réel, rejeté). Je ne peux donc ni confirmer ni infirmer ce run moi-même
   depuis ce canal.
6. **Les quatre contrôles Production en lecture seule exigés par `decision-1.md` §2** (registre
   exactement 298, dernière version `20261006220000`, les six migrations absentes, MD5 de
   `fdj_calculer_caisse(uuid,numeric,numeric)` = `0418bed1d0316063def74ab81cfe71e1`) : **aucun
   n'est vérifiable depuis ce canal**, pour une raison structurelle confirmée à nouveau
   aujourd'hui, identique à celle documentée dans ce fil depuis le 06/09/2026 : ce workflow
   (`issue_comment` → Claude Code Action) ne porte ni `service_role`, ni chaîne de connexion
   Supabase (Test ou Production), ni accès réseau sortant — par construction (`permissions:
   contents: read`, aucun secret applicatif exposé). Vérifié concrètement : `printenv`/`env`
   refusés par le bac à sable lui-même (approbation requise, jamais obtenue), aucune URL
   `NEXUS_TEST_DB_URL`/`SUPABASE_*` lisible, `psql` présent mais sans chaîne de connexion à lui
   donner. `decision-1.md` elle-même le constatait déjà : `RAIL_LU: INACCESSIBLE`, « le connecteur
   n'est pas accessible dans ce réveil ».
7. **Aucune tentative de connexion n'a été faite** vers un hôte Supabase quelconque, Test ou
   Production — deviner ou fabriquer une chaîne de connexion aurait été exactement le type
   d'action interdite par la Bible/CLAUDE.md (gate humaine sur toute lecture/rotation de secret,
   et sur toute opération Supabase Production). Je n'ai pas non plus recherché de `service_role`
   ni de clé au-delà de vérifier l'absence de noms de variable pertinents.
8. **Aucune migration n'a été exécutée, aucune transaction ouverte, aucune définition SQL
   sauvegardée en base** : il n'y a rien à sauvegarder depuis un canal qui n'a pas de connexion.

## Décision prise ici : STOP, conformément au mandat lui-même

Le réveil dit explicitement : « Si un seul invariant diverge, STOP sans écriture et remonter les
preuves à Frédéric. » Je traite l'impossibilité matérielle de rejouer les contrôles Production du
§2 comme équivalente à une divergence non résolue : impossible de prouver que le registre est à
298 et le MD5 attendu revient à ne pas pouvoir écarter qu'il ait changé. Exécuter les six
migrations sans cette preuve serait exactement l'inverse de ce que le GO conditionne. Je n'ai donc
engagé aucune écriture Supabase Production, conformément à `CLAUDE.md` (« toute opération sur
Supabase Production » reste une gate humaine jamais contournée, et « on vérifie qu'une mutation
s'est réellement appliquée avant de lire son résultat » — ici, il n'y a même pas de canal pour
tenter la mutation).

Ceci ne remet pas en cause la légitimité du GO de Frédéric : c'est une incapacité technique de ce
canal précis, pas un refus d'autorité. Les mêmes six migrations, avec les mêmes preuves de
préflight ci-dessus (identité du candidat, contenu, ordre), peuvent être exécutées par une session
disposant réellement d'une connexion Supabase Production sous supervision directe de Frédéric —
pas via ce canal `issue_comment`, qui n'en a jamais porté et n'en porte toujours pas aujourd'hui.

## Retour attendu

`OWNER_NEXT` reste Frédéric (ou l'exécutant qui dispose réellement de la connexion Production) :
soit rejouer lui-même/elle-même les contrôles du §2 de `decision-1.md` puis exécuter les six
migrations depuis un canal outillé, soit répondre explicitement si un autre chemin d'exécution est
voulu. Aucune nouvelle question de fond n'est ouverte ici — ce request documente uniquement
l'exécution tentée et son arrêt.
