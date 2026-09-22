---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408_production=6c3efcc
  - id: comparateur-migration-documentaire
    classe: VERIFIED
    valeur: divergence_documentaire_31_lignes_commentaire_aucune_divergence_logique
  - id: correction-direction-narrative
    classe: VERIFIED
    valeur: production_porte_excedent_rail_jamais_linverse
  - id: contre-preuve-mutation-garde1
    classe: VERIFIED
    valeur: 8_sur_8_mutation_logique_detectee
  - id: manifeste-addendum-append-only
    classe: VERIFIED
    valeur: 47_migrations_classees_manifeste_historique_plus_addendum
  - id: contre-preuve-mutation-garde2
    classe: VERIFIED
    valeur: 8_sur_8_migration_manquante_et_manifeste_altere_detectes
  - id: manifeste-historique-inchange
    classe: VERIFIED
    valeur: empreinte_sha256_identique_avant_apres
  - id: non-regression-globale
    classe: VERIFIED
    valeur: 263_sur_274_9_connus_2_memes_echecs_reportes_0_nouveau
  - id: guardians
    classe: VERIFIED
    valeur: 1_finding_nexusstock_deja_connu_arch-002_0_nouveau_imputable
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 31_lots_10_avertissements_0_nouvelle_erreur
  - id: decision-4-consommee
    classe: VERIFIED
    valeur: commit_69af6a8
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Les deux gardes CI démasquées, caractérisées — preuve, contre-preuve, proposition minimale

Périmètre exécuté strictement conforme à `decision-4.md` : preuve et
proposition minimale uniquement. Ni `20260911180600_pointage_exige_service_et_evenement.sql`
ni le manifeste historique `NEXUS-PRODUCTION-READINESS-1-20260908/manifeste-migrations-production-1.md`
ne sont modifiés dans ce lot. Les deux échecs restent rouges dans la suite
réelle, exactement comme `decision-4.md` l'exige — caractériser, pas
corriger. Aucune entrée ajoutée à `docs/qa/ECHECS-CONNUS.json`.

## Garde 1 — `20260911180600_pointage_exige_service_et_evenement.sql`

### Preuve reproductible : divergence strictement documentaire

`outils/comparer-migration-documentaire.js` (nouveau, lecture seule — `git
show` + `fs.readFileSync`, aucune écriture, aucun SQL exécuté) normalise les
deux côtés en retirant les lignes de commentaire SQL **pleine ligne**
(`/^\s*--/`, jamais un commentaire en fin de ligne de code) puis compare le
reste octet pour octet :

```
node outils/comparer-migration-documentaire.js 20260911180600_pointage_exige_service_et_evenement.sql
Verdict : DIVERGENCE_DOCUMENTAIRE
Octets — production: 6687, rail: 4521
Lignes de commentaire présentes SEULEMENT en production (31)
Lignes de commentaire présentes SEULEMENT sur le rail (0)
Aucune divergence de logique SQL.
```

Le `create or replace function` et tout ce qui suit sont identiques octet
pour octet une fois les commentaires retirés des deux côtés. Confirmé par un
second chemin indépendant : `git diff --numstat` sur ce fichier ne montre
qu'un seul hunk, entièrement composé de lignes `-- ...`.

### Correction à la narration de `request-4.md` — la direction était inversée

`request-4.md` affirmait le bloc « présent sur le rail et absent de la
version réellement appliquée en Production ». **Mesuré à nouveau ici,
indépendamment, c'est l'inverse** :

- le rail (commit `f682ed6`, 11/09/2026, « Plus aucun pointage ne se cherche
  un service ») n'a **jamais** porté ce bloc de 31 lignes — confirmé par
  `git log --oneline -- <chemin>` sur la branche courante : un seul commit,
  et son contenu au moment du commit est déjà la version courte (115
  lignes) ;
- `origin/production` porte le bloc depuis le commit `41538aa` (16/09/2026,
  « Rapatrier le trigger `nexus_pointage_exige_service`, derrière son
  code »), commité directement sur la branche `production` (153 lignes) ;
- `wc -l` des deux côtés le confirme : rail 115 lignes, production 153.

Le bloc lui-même se décrit comme une note d'audit de déploiement écrite
« AVANT DE RAPATRIER CE FICHIER AU DEPOT », documentant que ce fichier a
vécu hors dépôt (`f682ed6`, sur une branche jamais rapatriée) avant d'être
rattaché à `production` avec ce contexte. Ce n'est donc pas une trace
disparue du rail — c'est une annotation ajoutée directement sur `production`
au moment du rattachement, jamais reportée sur le rail.

### Correction canonique minimale identifiée (non appliquée dans ce lot)

`test_migrations_immuables_20260905.js` traite `production` comme la vérité
immuable que le rail doit refléter (« une migration appliquée en production
devient immuable dans son identité »/« ce n'est le rail qui suit la
production, jamais l'inverse »). La correction minimale qui ferait du
fichier Git le reflet exact de la migration réellement appliquée est donc
d'**ajouter au fichier du rail les 31 lignes de commentaire déjà présentes
sur `production`** — pas de les retirer de `production`. Portée exacte : un
seul fichier, `supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql`,
aucune ligne de SQL exécutable touchée, aucune migration Production, aucun
applicatif. **Non appliquée dans ce geste**, conformément à l'interdiction
explicite de `decision-4.md`.

### Contre-preuve par mutation (`test_comparer_migration_documentaire_20260921.js`, 8/8)

- Le vrai fichier est bien classé `DIVERGENCE_DOCUMENTAIRE`, et la direction
  (production porte l'excédent, jamais le rail) est vérifiée par deux
  méthodes indépendantes (le module lui-même, puis un `git diff` direct).
- **Mutation** : deux contenus synthétiques où, en plus du changement de
  commentaire, une ligne de SQL exécutable change réellement (`select 1` →
  `select 2`) sont classés `DIVERGENCE_LOGIQUE`, jamais documentaire — la
  garde ne peut pas être trompée en cachant une vraie divergence derrière
  `--`.
- Un commentaire **en fin** de ligne de code (`select 1; -- inline`) n'est
  jamais traité comme une ligne de commentaire pleine ligne : `select 1;`
  reste comparé tel quel.

## Garde 2 — manifeste historique clos, migrations postérieures non classées

### Analyse sémantique

`test_manifeste_migrations_complet_20260909.js` lit un seul fichier
(`manifeste-migrations-production-1.md` du lot clos
`NEXUS-PRODUCTION-READINESS-1-20260908`) et exige que toute migration
postérieure à `VERSION_PRODUCTION` (`20260904175722`, une constante fixe)
y soit citée. Le manifeste a déjà été étendu deux fois après sa clôture
(« Ajouts du 09/09/2026 », « INCLUSES — lot correctif du 11/09/2026 ») en le
rouvrant à chaque fois — ce que `decision-4.md` interdit désormais pour un
geste de simple transport.

### Proposition minimale : addendum append-only, garde d'immuabilité active

- `docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md` (nouveau) :
  addendum append-only, distinct du manifeste historique, qui classe les 14
  migrations transportées par ce lot. Fige l'empreinte SHA256 du manifeste
  historique au moment de sa rédaction
  (`59f9f95e9fe03e9227f1355885da3f68474a1fae097dfa58193ed1ae3dc90fa7`) pour
  détecter toute réécriture future du fichier clos.
- `outils/verifier-manifeste-migrations-complet.js` (nouveau, prototype) :
  lit le manifeste historique **et** l'addendum, considère une migration
  classée dès qu'elle est citée dans l'un des deux, et **refuse de conclure**
  si l'empreinte du manifeste historique ne concorde plus.
- Classification des 14 migrations : **aucun nouveau critère inventé** —
  rejeu exact de la règle déjà canonique du test réel (Test/CI seulement si
  le fichier le DÉCLARE dans son en-tête, ou touche `nexus_ci_recette`).
  Vérifié par lecture des 14 fichiers réels : aucune ne se déclare Test/CI,
  aucune ne touche `nexus_ci_recette` → proposées **incluses**, marquées
  explicitement **PROPOSITION — non arbitrée** dans l'addendum (la décision
  de les promouvoir réellement reste une gate distincte).

```
node outils/verifier-manifeste-migrations-complet.js
Verdict : COMPLET
47 migration(s) de la promotion, toutes classées (manifeste historique + addendum).
```

### Contre-preuve par mutation (`test_manifeste_migrations_append_only_20260921.js`, 8/8)

- Sur les vrais fichiers : la combinaison manifeste historique + addendum
  classe bien les 47 migrations de la promotion réelle (21+5+7+14), et les
  14 migrations de ce lot sont classées PAR L'ADDENDUM (absentes du
  manifeste historique, présentes dans l'addendum — vérifié explicitement).
- **Mutation #1** : une migration retirée de l'addendum (contenu injecté en
  mémoire, jamais écrit sur disque) est détectée comme non classée — le
  verdict passe à `MIGRATIONS_NON_CLASSEES` et nomme exactement le fichier
  manquant.
- **Mutation #2 (garde d'immuabilité)** : un manifeste historique altéré
  (contenu injecté en mémoire, jamais écrit sur le vrai fichier) fait
  échouer le contrôle (`MANIFESTE_HISTORIQUE_MODIFIE`) plutôt que de
  conclure sur une base mouvante. Un addendum sans empreinte figée refuse
  aussi de conclure.
- Le manifeste historique réel sur disque est relu à la fin de l'épreuve et
  comparé octet pour octet à son contenu de départ : identique, empreinte
  inchangée.

## Impact exact en fichiers — purement infrastructure/QA

5 fichiers créés, **0 fichier existant modifié** :

```
outils/comparer-migration-documentaire.js               (nouveau, outillage)
outils/verifier-manifeste-migrations-complet.js          (nouveau, outillage)
docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md  (nouveau, addendum Handoff)
test_comparer_migration_documentaire_20260921.js          (nouveau, test)
test_manifeste_migrations_append_only_20260921.js         (nouveau, test)
```

Aucun applicatif, aucune migration SQL, aucune modification de
`20260911180600_pointage_exige_service_et_evenement.sql` ni du manifeste
historique. Si une future décision autorise l'application des deux
corrections identifiées, l'impact resterait également purement
infrastructure/QA :
- garde 1 : ajouter 31 lignes de commentaire à un seul fichier de migration
  (aucune ligne de SQL exécutable) ;
- garde 2 : ~5-10 lignes dans `test_manifeste_migrations_complet_20260909.js`
  pour lire aussi l'addendum — le manifeste historique resterait, lui,
  jamais modifié.

## Régression, Guardians, Handoff

- `node run-tests.js` : **263/274** — 9 échecs connus + les 2 mêmes échecs
  déjà rapportés par `request-4.md` (`test_migrations_immuables_20260905.js`,
  `test_manifeste_migrations_complet_20260909.js`, inchangés, non corrigés
  dans ce lot). Les 2 nouveaux fichiers de test de ce lot sont verts et
  comptés dans les 263. **0 nouvelle régression.**
- `node outils/guardians-router.js` sur le diff réel de ce lot → 1 finding,
  la collision `NexusStock` déjà connue et tracée (Backlog `ARCH-002`, non
  bloquante) — **0 nouveau finding imputable**.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.
- `node outils/handoff.js verifier` → conforme avant et après ce dépôt (31
  lots, 10 avertissements préexistants, 0 nouvelle erreur).
- `decision-4.md` consommée (`outils/handoff.js consommer`).

## Refs protégées

`main = a786408`, `production = 6c3efcc` — identiques avant et après ce
geste.

## Ce que ce lot ne fait pas

Ne modifie ni `20260911180600_pointage_exige_service_et_evenement.sql` ni le
manifeste historique du lot clos. Ne câble aucun des deux mécanismes proposés
dans les contrôles réels (`test_migrations_immuables_20260905.js`,
`test_manifeste_migrations_complet_20260909.js` restent inchangés et rouges).
N'ajoute rien à `docs/qa/ECHECS-CONNUS.json`. Aucun portage applicatif,
`dd4d0f3`, P0-1/P0-3, NEXUS Live, #62/#65, P0-2, B1, `public.rappels`. Aucun
merge/rebase/squash, aucune écriture Supabase, aucune Production, aucun
élargissement de permissions GitHub.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
promotion Production, aucun secret exposé, aucun merge/rebase/squash de
`production` vers le rail, aucun portage applicatif.

## STOP

Conformément à `decision-4.md` §5 : preuves et recommandation minimale
déposées, ni la migration divergente ni le manifeste historique ne sont
modifiés. Deux corrections minimales sont identifiées et prêtes à être
arbitrées (ajout des 31 lignes de commentaire sur le rail pour la garde 1 ;
lecture de l'addendum en plus du manifeste historique pour la garde 2), mais
non appliquées. STOP à cette gate — aucune exécution supplémentaire sans
nouvelle décision.
