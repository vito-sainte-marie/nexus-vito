# Baseline machine-readable du programme de stabilisation — premier dépôt

Répond à `decision-11.md` §6 (« Claude commence à produire cette baseline »). Voir le fichier
jumeau `baseline-programme-stabilisation-1.json` pour la forme exploitable par outillage ; ce
document en explique le contenu, les écarts avec les mesures précédentes, et ce qui reste hors de
portée de ce canal.

## 1. Ce qui a changé par rapport au 22/09/2026

`classement-gates-etat-git-62-65-1.md` et `dossier-decision-pr-62.md` §8.1 décrivaient les 11
migrations d'écart entre `production` (276) et Supabase Test (287) comme « présentes dans aucun
arbre du dépôt ». Mesuré à nouveau le 24/09/2026 (`git diff --name-status origin/production HEAD
-- supabase/migrations/`, contre le rail `handoff-continuite-20260920` cette fois, pas seulement
contre `production`/les candidates) : **ces 11 fichiers existent bel et bien sur le rail**, sans
aucune suppression ni modification par ailleurs. Ils manquaient à l'arbre `production`/candidates,
pas à Git dans son ensemble.

Ceci ne referme pas la gate « dérive de schéma Supabase Test » : ce que ce canal peut mesurer
(les arbres Git) et ce qu'il ne peut pas (la table réelle `supabase_migrations.schema_migrations`
de `nexus-test`) restent deux choses différentes — voir §4.

## 2. Le correctif Login, isolé et tracé pour la première fois sous cette forme

Sur les 11 fichiers, **un seul n'est pas Test/CI** : `20260904175747_login_non_enumerable`. Son
propre en-tête l'annonce : *« ORDRE DE PROMOTION — INCOMPATIBLE AVEC LE CODE ACTUELLEMENT EN
PRODUCTION. […] appliquer cette migration à la production AVANT d'y promouvoir le nouveau
`NEXUS-Login-v1.html` rendrait la connexion impossible. »* C'est très exactement le « correctif
Login » nommé par `decision-11.md` §3 — une mesure de sécurité réelle (fermeture d'une énumération
anonyme de l'annuaire employés via `employees_public`), en attente d'un ordre de promotion précis,
et sans rapport de fond avec `#65`. Conformément à la décision : **il n'est pas injecté dans
`#65`**, et reste une dette infrastructure/baseline distincte, tracée ici.

Les 10 autres fichiers sont Test/CI par construction (nom auto-déclaratif `_test`/`preprod`, ou
dépendance au rôle `nexus_ci_recette`, ou dépendance à `nexus_live_events` — elle-même exclue de
Production par le manifeste historique, migration #21 du lot
`NEXUS-PRODUCTION-READINESS-1-20260908`). Classement détaillé fichier par fichier dans le JSON.

## 3. Mécanisme de reconstruction — réutilisation, pas un nouveau module

`outils/reconstruire-baseline-candidat.sh` (nouveau, mais **n'écrit aucune nouvelle logique de
reconstruction** : il orcheste `outils/reconstruire-base-test.sh`, inchangé). Le principe : comme
`origin/production` est un ancêtre direct de `#62` et `#65` (vérifié par le script lui-même avant
tout geste), le répertoire `supabase/migrations/` de chaque branche candidate contient exactement
Production + son propre delta — aucune des 11 migrations ci-dessus, puisqu'elles n'existent que sur
la lignée du rail, jamais mergée dans `production` ni les candidates. Reconstruire depuis un git
worktree jetable détaché sur la branche candidate donne donc directement la baseline demandée par
`decision-11.md` §1, sans avoir à filtrer ou réordonner quoi que ce soit.

Gardes fail-closed : refuse la cible `PRODUCTION`, refuse la cible `nexus-test` (Test historique —
non détruit, non réutilisé pour cette preuve, conformément à `decision-11.md` §2), refuse une
candidate dont `production` n'est pas un ancêtre, refuse un delta qui ne serait pas un ajout pur.
Mode `DRY_RUN=oui` pour auditer (SHA résolus, delta imprimé) sans créer de worktree ni ouvrir de
connexion.

**Preuve apportée dans ce lot** : 10/10 épreuves (`test_reconstruire_baseline_candidat_20260924.js`),
toutes en `DRY_RUN` — delta exact mesuré contre les refs réelles (1 migration pour `#65`, 12 pour
`#62`, conforme à `classement-gates-etat-git-62-65-1.md` §3), toutes les gardes de refus vérifiées
une par une, aucun worktree créé. `node run-tests.js` : aucune régression (seuls les 9 échecs
connus subsistent). `outils/guardians-router.js` : 0 nouveau finding (seule la collision `NexusStock`
déjà tracée `ARCH-002` subsiste, sans rapport avec ce lot). `outils/verifier-apprentissage.js` et
`outils/guardian-qa.js` : conformes.

## 4. STOP — besoin exact avant toute exécution réelle

Conformément à `decision-11.md` §4 (« si une ressource externe payante, un nouveau projet
Supabase […] est nécessaire, STOP avec le besoin exact avant création ») : exécuter réellement ce
mécanisme requiert un **projet Supabase jetable/isolé**, distinct de Production
(`uzhjpqpctpvxytxpxoqz`) et du Test historique (`udljdqxerrbbbajxubfn`), plus `NEXUS_TEST_DB_URL`
(ou équivalent) pointant dessus. Ni la création de ce projet ni l'accès réseau/identifiants
correspondants ne sont possibles depuis ce canal (GitHub Issue) — confirmé par construction, comme
pour tout accès Supabase depuis le 06/09/2026. **Ce lot ne crée donc rien** : le script est prêt,
prouvé en `DRY_RUN`, et attend une session disposant de ce projet jetable pour la suite (application
de la migration, preuve de création, recette candidate).

## 5. Ce que ce dossier ne fait pas

Aucune écriture Supabase (Test ou Production), aucune création de ressource, aucun accès Cloudflare,
aucun push vers `handoff-continuite-20260920`, aucune modification de règle métier/UX/rôle/RLS,
aucun nouveau module produit. Le portage de la chaîne de configuration (`nexus-auth.js` refondu,
`outils/build.sh`, etc.) sur `#62`/`#65` reste délibérément non fait, conditionné à l'observation
Cloudflare humaine préalable (`etude-isolation-test-candidats-web-1.md` §5, inchangé par ce lot).
