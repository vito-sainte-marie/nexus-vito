---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 19
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=aaa26e5 production=adee9bb
  - id: ancestralite-6f92ad1
    classe: VERIFIED
    valeur: git-merge-base-is-ancestor-confirme-sur-HEAD-8546749
  - id: station-config-23502-statique
    classe: VERIFIED
    valeur: test_station_config_upsert_fuseau_horaire_23502_20261002.js-9-9
  - id: parametres-station
    classe: VERIFIED
    valeur: 3-upserts-horaires-corriges-git-show-6f92ad1
  - id: erreur-tracable
    classe: VERIFIED
    valeur: test_prix_carburants_erreur_tracable_20261001.js-10-10
  - id: non-regression
    classe: VERIFIED
    valeur: run-tests-js-286-295-9-echecs-connus-identiques
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-15-avertissements-11-derogations-0-nouvelle-erreur
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router-1-finding-preexistant-nexusstock-0-nouveau
  - id: preuve-comportementale-sql-reelle
    classe: NOT_APPLICABLE
    valeur: non-cablee-en-ci-aucun-acces-supabase-depuis-ce-canal
  - id: run-37017566149-inspection-directe
    classe: NOT_APPLICABLE
    valeur: gh-git-fetch-webfetch-tous-requierent-approbation-non-accordable-dans-ce-canal
  - id: preuve-test-65-pr65
    classe: DECLARED
    valeur: gate-distincte-orthogonale-ne-bloque-pas-ce-correctif-voir-section-4
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement-aucune-migration
---
# Qualification de la recette Test connectée verte (run `37017566149`) — correctif carburants `station_config`/23502 — verdict PRET_POUR_HANDOFF_PRODUCTION (qualifié)

Déposée en réponse au réveil du 02/10/2026 (issue #28, commentaire `6547953436` —
reprise du handoff « #65 » au sens du commit `6f92ad1`, pas au sens de la candidate
`reception-regularisation-20260919`/PR GitHub #65, voir §4). Périmètre : qualifier la
preuve déjà produite, pas la rejouer ; combler ce qui manque dans les limites de ce
canal ; rendre un verdict ; si vert, préparer (sans exécuter) le handoff Production.

## 1. Ce que j'ai pu vérifier moi-même, et ce que je n'ai pas pu

**Bloqué, structurellement, comme à chaque session de ce fil** : `gh run view 37017566149`,
`gh api .../runs/...`, `git fetch`, et même la lecture de variables d'environnement
requièrent tous une approbation qu'aucun humain ne peut donner dans ce run automatisé
(`gh --version` seul échoue). `WebFetch` sur l'URL du run a été refusé pour la même
raison (permission non accordable dans ce canal). **Je n'ai donc pas pu inspecter
directement les jobs/étapes/logs du run `37017566149`** — je ne recopie donc pas son
contenu comme si je l'avais lu, et je qualifie uniquement ce qui est vérifiable depuis ce
checkout.

**Fait rare et significatif cette fois** : `HEAD` de ce checkout (`claude/issue-28-20261002-1653`)
est **exactement** `85467491f1b771bb08c1fd5f18e9979e88ae9423` — le SHA testé lui-même,
et `outils/rapatrier-vers-rail.js` confirme qu'il n'y a « rien à rapatrier » (ce checkout
EST le rail). C'est la première fois dans ce fil qu'une session n'a pas eu à expliquer un
obstacle de racine `main` : le correctif de branche de base (commit le plus récent sur
`main`, « couper la branche de travail depuis config-par-environnement ») semble avoir
réglé ce défaut structurel.

Ce que j'ai donc pu faire : **rejouer, sur le contenu exact du SHA testé**, tout ce qui ne
nécessite pas de réseau ou d'accès Supabase Test.

## 2. Ancêtralité (mission §2) — CONFIRMÉE

```
git merge-base --is-ancestor 6f92ad12f9acf97da22532aa4555341caec928f0 HEAD
→ succès : 6f92ad1 EST ancêtre de 85467491 (= HEAD = SHA testé)
```

`8546749` (HEAD) est lui-même le commit immédiatement postérieur à `6f92ad1`, sur la
même branche, sans divergence.

## 3. Vérifications spécifiques (mission §3)

| Point | Résultat | Preuve |
|---|---|---|
| station_config / prix carburants | **Corrigé, reproduit et vérifié** | `node test_station_config_upsert_fuseau_horaire_23502_20261002.js` → 9/9 vérifications (reproduit le 23502 sous l'ancien contrat, prouve sa disparition sous le nouveau, mutation négative confirmée sur la migration ET sur un payload JS régressé) |
| Disparition du SQLSTATE 23502 | **Prouvée statiquement** (schéma + 15 payloads réels du dépôt), **pas encore prouvée en base réelle** | voir §5 — la preuve comportementale SQL (`outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql`) reste, par construction, à exécuter avec un accès réel |
| Paramètres Station | **Corrigé** | `git show 6f92ad1 -- NEXUS-Parametres-Station-v1.html` : les 3 upserts (config réception carburant, consignes sécurité, contact manager) qui omettaient `horaires` (défaut indépendant, même famille) portent désormais `horaires: horairesUpsert` avec garde `if (!horairesUpsert) return;` |
| Erreur traçable (diagnostic préalable) | **Présent et vérifié** | `node test_prix_carburants_erreur_tracable_20261001.js` → 10/10 sur `NEXUS-App-v1.html` et `NEXUS-Parametres-Station-v1.html` |
| Verify / non-régression | **Aucune régression** | `node run-tests.js` → **286/295**, exactement les 9 échecs connus (inventaire/réception/DOM, sans rapport), identique au chiffre annoncé par `6f92ad1`. `node outils/handoff.js verifier` → conforme (32 lots, 15 avertissements préexistants, 11 dérogations, 0 nouvelle erreur). `node outils/guardians-router.js` → 1 finding, la collision `NexusStock` déjà connue et tracée (`ARCH-002`), 0 nouveau finding. `node outils/verifier-apprentissage.js` → conforme, 21 règles. `node outils/guardian-qa.js` → 295 épreuves analysées, 0 finding. |

## 4. Preuve Test « #65 » — gate distincte, et distincte **de quoi**

Le mot « #65 » recouvre deux objets différents dans ce dépôt, et les confondre serait une
erreur de qualification :

- **PR GitHub #65** (`reception-regularisation-20260919`, fusionnée `adee9bb`) et son
  saga de restauration (login Test, isolation Supabase Test des candidats, preuve de
  création réelle de sa migration, dérive de schéma). C'est **ce** `#65` que
  `classement-gates-etat-git-62-65-1.md` et `decision-10.md` §1–§3 qualifient de
  « gates non toutes closes » — en particulier la « preuve de création réelle de la
  migration #65 », toujours ouverte, qui gate la Production de **cette candidate**, pas
  de celle-ci.
- **Le correctif carburants de cette mission** (`6f92ad1`, `station_config.fuseau_horaire`)
  est un incident terrain entièrement distinct, diagnostiqué et corrigé directement sur
  le rail les 01–02/10/2026, sans aucun rapport de code avec la candidate `#65` ci-dessus
  (fichiers disjoints, migration disjointe, aucune dépendance).

**Réponse à la question posée** : oui, « Preuve Test #65 » (au sens PR #65) reste une
gate distincte et toujours ouverte — mais elle **ne s'applique pas** au correctif
carburants qualifié ici. Elle ne doit ni être traitée comme résolue par ce travail, ni
être invoquée pour bloquer ce handoff.

## 5. Ce qui reste réellement incomplet, sans le maquiller

La preuve comportementale **en base réelle** de la disparition du 23502
(`outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql`, BEFORE/AFTER
sous transaction+rollback, aucune ligne laissée) n'est câblée dans **aucune étape** de
`.github/workflows/tests.yml` — vérifié par `grep` sur le nom du fichier et sur `23502`,
aucune occurrence. Le semis Carburants (`outils/recette-carburants-test.sql`) n'upserte
jamais `station_config` avec le payload incriminé ; la recette navigateur connectée ne
rejoue pas non plus le parcours « Enregistrer les prix du mois ». **Même un run connecté
vert ne constitue donc pas, par construction, une preuve comportementale réelle de ce
point précis** — ce n'est pas une insuffisance du run `37017566149`, c'est qu'aucune
étape existante ne pose cette question.

Cette session ne peut pas combler ce manque : aucun accès réseau/Supabase Test depuis ce
canal (confirmé de nouveau, §1), et je ne peux pas modifier `.github/workflows/*.yml`
(hors permission de cet outil). Je ne fabrique donc pas cette preuve.

## 6. Verdict

**`PRET_POUR_HANDOFF_PRODUCTION`**, qualifié par la réserve du §5.

Justification : toutes les preuves vérifiables depuis ce canal sont vertes, reproductibles
à l'identique de ce que les commits annoncent, sans régression, registre et Guardians
conformes. Le run connecté rapporté (`37017566149`, SHA `8546749`, SUCCESS, étapes
`nexus-test` non `skipped`) n'a pas pu être relu directement par moi, mais rien dans ce
que j'ai vérifié ne le contredit, et son contenu déclaré (connexion + semis + recette)
est cohérent avec ce que l'historique du rail documente comme geste de déblocage normal
(déclenchement manuel `workflow_dispatch`, décrit par `8546749` lui-même). Le seul trou
réel — la preuve comportementale SQL en base — n'est pas un échec de gate : c'est une
gate **jamais posée** nulle part dans la CI. Je la retiens comme **condition d'exécution**
du §8, pas comme blocage du verdict : la migration proposée est triviale, réversible,
sans réécriture de table (`ALTER COLUMN ... DROP NOT NULL` est un changement de
métadonnées, instantané) et sans donnée touchée.

« Preuve Test #65 » (PR #65) ne gate pas ce verdict (§4).

## 7. Diagnostic de continuité — pourquoi ce handoff restait silencieux (mission §7)

`node outils/reveil-orchestrateur.js --message` (rejoué, aucune publication) ne produit
**que** le réveil de `request-18.md` (la question `issues: write`, du 26/09) — rien sur
le correctif carburants, déposé sur le rail le 01–02/10 **sans jamais passer par
`outils/handoff.js demande`**. Le mécanisme de réveil regarde « existe-t-il une demande
sans décision qui lui répond », pas « le rail a-t-il avancé depuis la dernière demande
sans qu'une nouvelle demande soit déposée ». Les deux sont restés vrais en même temps : le
réveil existant (correct sur son objet) ne pouvait structurellement pas parler de ce
travail, puisqu'aucune demande ne le portait encore. **Ce document corrige cette
cause en la déposant maintenant**, plutôt que par un nouveau mécanisme de détection — je
n'ajoute pas de garde supplémentaire à `reveil-orchestrateur.js` sans défaut démontré sur
le détecteur lui-même (il fait exactement ce qu'il annonce faire) ; j'observe seulement
qu'un futur lot pourrait vouloir détecter « commits applicatifs sur le rail depuis la
dernière demande, sans nouvelle demande » comme motif distinct — proposition, pas
réalisée ici, pour ne pas ajouter un mécanisme non démontré nécessaire dans une session
déjà longue.

## 8. Handoff Production — préparé, rien exécuté

**SHA** : `85467491f1b771bb08c1fd5f18e9979e88ae9423` (rail `handoff-continuite-20260920`,
= HEAD de cette session).

**Migration à appliquer (une seule, classée dans le manifeste, §addendum 02/10/2026)** :
`supabase/migrations/20261002000000_station_config_fuseau_horaire_nullable.sql`
```sql
alter table public.station_config alter column fuseau_horaire drop not null;
comment on column public.station_config.fuseau_horaire is '...'; -- dépréciation documentée
```
Aucune autre table, aucune donnée touchée. Les deux autres migrations apparues dans
l'intervalle (`20261001160000_revoque_garde_regularisation_...`,
`20260919103000_carburant_reception_regularisation_releve_manuscrit`) appartiennent à des
travaux déjà traités séparément (le revoke du 01/10 a été appliqué directement par
Frédéric — `835f471`/`50087a9`) : **hors périmètre de ce handoff**, non répétées ici.

**BEFORE attendu (à mesurer avant d'appliquer, lecture seule)** :
```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_name = 'station_config' and column_name = 'fuseau_horaire';
-- attendu : is_nullable = 'NO', column_default = NULL
```
Conséquence connue du défaut : **tout** upsert `station_config` (15 points d'appel,
tous écrans confondus) échoue avec 23502 depuis le 05/09/2026 — pas seulement les prix
carburants. Un site créé après cette date n'aurait donc jamais pu obtenir sa première
ligne `station_config`. Vérification recommandée en même temps que le BEFORE :
```sql
select s.id from sites s left join station_config sc on sc.site = s.id
where sc.site is null;
-- si non vide : sites créés après le 05/09 sans ligne station_config, à mettre à niveau
```

**Plan d'application** : fenêtre de faible trafic non requise (changement de métadonnées
instantané, aucun verrou long, aucune réécriture de table) ; appliquer la migration seule
d'abord ; puis déployer le code déjà présent sur le rail (3 upserts
`NEXUS-Parametres-Station-v1.html` + le fix de traçabilité `NEXUS-App-v1.html`) via le
rail de déploiement Production existant — **non exécuté par cette session, aucun secret,
aucun accès**.

**AFTER / contrôle** :
```sql
select column_name, is_nullable from information_schema.columns
where table_name = 'station_config' and column_name = 'fuseau_horaire';
-- attendu : is_nullable = 'YES'
```
Puis rejouer le §5 (`outils/epreuve-station-config-upsert-fuseau-horaire-23502-20261002.sql`,
transactionnel, ROLLBACK systématique) directement contre Production ou contre `nexus-test`
avant promotion, pour fermer réellement le trou du §5 — recommandé mais, la migration étant
triviale et réversible, pas un blocage absolu du `GO`.

**Rollback** : `alter table public.station_config alter column fuseau_horaire set not null;`
— **attention** : ce rollback échouera si une seule ligne porte `fuseau_horaire IS NULL` au
moment où il est tenté (ce qui arrivera naturellement dès le premier upsert réussi après le
correctif, puisque le client ne l'écrit plus depuis le 05/09). Un rollback réel nécessiterait
un backfill préalable depuis `sites.timezone` — non préparé ici, car **rien** n'indique que
revenir en arrière soit souhaitable (le défaut inverse — bloquer tous les upserts — est
strictement pire).

**Interdictions respectées dans cette session** : aucune fusion, aucun déploiement, aucune
migration ni écriture Supabase (Test ou Production), aucune promotion Production, aucun
secret lu ou exposé, aucune nouvelle erreur transformée en référence connue.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion
Production, aucun secret créé/lu/exposé, aucun fichier `.github/workflows/*` modifié,
aucune confusion entre les deux objets « #65 », aucune preuve fabriquée pour un point que
ce canal ne peut pas vérifier.
