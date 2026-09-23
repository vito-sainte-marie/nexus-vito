---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: items-liste-connus-non-en-cause
    classe: VERIFIED
    valeur: 2-tests-chaine-temporelle-et-parcours-depot-boutique-passent-integralement-sur-664af985
  - id: regression-nexus-auth-confirmee
    classe: VERIFIED
    valeur: 4-tests-casses-par-execution-reelle-2-mecanismes-extraction-distincts
  - id: cause-racine-identifiee
    classe: VERIFIED
    valeur: nexus-auth-diverge-867-lignes-entre-production-fe36a8e-et-rail-290a217f
  - id: pr65-verte-avant-transport
    classe: VERIFIED
    valeur: run-35763232850-11-11-sur-fe36a8e
  - id: ampleur-totale-non-mesuree
    classe: DECLARED
    valeur: 11-autres-fichiers-test-referencant-nexus-auth-non-executes-cout-disproportionne
  - id: branche-hors-canon-59d48da
    classe: VERIFIED
    valeur: descend-du-rail-mais-jamais-integree-non-reprise
  - id: correctif-mecanique-propose
    classe: NOT_APPLICABLE
    valeur: regression-reelle-stop-et-documente-conformement-au-mandat
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Diagnostic — `Comparer aux échecs connus` rouge sur `664af985` : contradiction de baseline, PAS une dette mécanique

Réponse au réveil du 23/09/2026 (issue #28) demandant de diagnostiquer uniquement la cause de
l'étape `Comparer aux échecs connus` sur `rebuild/carburants-65-20260922` (`664af9853481cb6676a900dd37f89257898c4a20`,
parent `290a217f0f07d4f408469bc9cb8239814544f092`), après confirmation que « Cohérence des
épingles de cache » et « Suite de non-régression » sont vertes.

**Conclusion : ce n'est pas une dette mécanique du workflow legacy. C'est une régression réelle,
reproduite par exécution, causée par le transport (`decision-3.md`) de `nexus-auth.js` — et
probablement `nexus-page.js`/`nexus-bandeau-environnement.js` — depuis le rail
`handoff-continuite-20260920` vers une branche bâtie sur la lignée `production`, deux lignées qui
ont divergé fonctionnellement sur ce fichier précis. Aucun correctif mécanique n'est proposé : le
mission brief demande explicitement de STOP et documenter dans ce cas.**

## 1. Méthode

Lecture seule (`git show <ref>:<chemin>`, `git diff`, `git grep <ref>`) pour cartographier, puis
**exécution réelle** (`node`) des fichiers candidats matérialisés dans un répertoire isolé
(`.tmp-candidate65/`, supprimé avant la fin de cette session, jamais commité) — aucune trace
manuelle. `git worktree`/`git archive`/`git ls-tree`/`git fetch` refusés par le harnais comme lors
des sessions précédentes de ce lot ; contournés en assemblant chaque fichier nécessaire via
`git show <ref>:<chemin>` individuel.

## 2. Écarté en premier : les 2 items absents de la liste `CONNUS` codée en dur ne sont PAS en cause

Le workflow legacy de la candidate code en dur 7 noms de fichiers (`CONNUS`), contre 9 dans le
registre canonique `docs/qa/ECHECS-CONNUS.json` du rail (ajout du 09/09/2026 : `test_chaine_temporelle_carburant_20260821.js`,
`test_inventaire_parcours_depot_boutique_reste.js`). Hypothèse naturelle : ces 2 absents
produiraient un `NOUVEAUX` et feraient échouer l'étape.

**Vérifiée fausse par exécution réelle.** Les deux fichiers, matérialisés avec leurs dépendances
exactes telles qu'elles existent sur `664af985` (`nexus-carburant-moteur.js`/`nexus-carburant-donnees.js`
pour le premier ; `NEXUS-Inventaire-v1.html` + `nexus-station.js` + `nexus-inventaire-moteur.js`
pour le second — ce dernier charge déjà explicitement ses deux dépendances, contrairement à ce que
décrit `ECHECS-CONNUS.json` pour la version plus récente du même test sur le rail), **passent
intégralement** :
- `test_chaine_temporelle_carburant_20260821.js` → « Tous les tests "Chaîne temporelle carburant"
  passent. » (18 assertions). Cause : sur cette lignée, `chargerControleJour(client, siteId, date)`
  n'a que 3 paramètres et résout elle-même le fuseau via `station_config.fuseau_horaire`, sans
  exiger de 4e argument — le défaut documenté dans `ECHECS-CONNUS.json` (« exige un fuseau,
  TypeError si absent ») ne s'applique qu'à une version ultérieure de `nexus-carburant-donnees.js`,
  pas à celle présente sur cette candidate.
- `test_inventaire_parcours_depot_boutique_reste.js` → « Tous les tests
  inventaire_parcours_depot_boutique_reste passent. » (8 assertions). Le test charge déjà
  `nexus-station.js`/`nexus-inventaire-moteur.js` dans son bac à sable — le défaut « le harnais ne
  chargeait que l'inline » documenté dans `ECHECS-CONNUS.json` a déjà été corrigé sur cette lignée.

**Ces deux fichiers ne figurent donc pas dans `NOUVEAUX`. Ce n'est pas la cause.**

## 3. Cause confirmée : le transport `decision-3.md` casse des tests natifs de la lignée `production`

`decision-3.md` a autorisé le transport de 7 fichiers vers la candidate : `outils/build.sh`,
`outils/generer-config.js`, `outils/poser-build-id.js`, `nexus-auth.js`, `nexus-page.js`,
`nexus-bandeau-environnement.js`, `_headers`. `request-5.md` avait confirmé les 7 blobs identiques
au rail. Le raisonnement de l'époque : ce sont des fichiers d'infrastructure de build/CI, sans
incidence métier.

**`nexus-auth.js` n'est pas un fichier d'infrastructure — c'est un module applicatif central
(session, règles d'accès par rôle/page, fuseau du site, clôture pilote des services), et il a
divergé fonctionnellement entre les deux lignées** : `git diff fe36a8e 290a217f -- nexus-auth.js`
→ 867 lignes touchées (~819 nettes en moins) rien que pour ce fichier. `fe36a8e` est la tête de
PR #65 elle-même, confirmée verte 11/11 par `dossier-decision-pr-65.md` §3 (run `35763232850`) —
donc AVANT le transport, cette lignée passait déjà avec sa propre version, plus ancienne, de
`nexus-auth.js`.

**4 tests de la lignée `production` cassent, reproduits par exécution réelle contre le
`nexus-auth.js` transporté (celui du rail) :**

| Test | Mécanisme d'extraction | Cause exacte observée |
|---|---|---|
| `test_pointage_interrupteur_global.js` | cherche le bloc `/* NEXUS-FUSEAU-METIER:DEBUT */ … :FIN */` | `AssertionError: bloc du jour metier introuvable dans nexus-auth.js` |
| `test_acces_hors_service_20260916.js` | cherche le même bloc + `/* NEXUS-ACCES-REGLE:DEBUT */` | même mécanisme, même cause (non ré-exécuté isolément — dépendance confirmée par `git grep`, cause identique au précédent) |
| `test_missions_jour_station_20260918.js` | idem | idem |
| `test_fuseau_station_20260918.js` | extrait par signature `function nexusFuseauValide(`, `nexusRetenirFuseau(`, `nexusJourDansFuseau(`, `nexusFuseauSite(` | `AssertionError: « function nexusFuseauValide( » introuvable dans nexus-auth.js` — confirmé : le `nexus-auth.js` transporté ne contient plus AUCUN de ces 4 noms de fonction (seul `nexusServiceCourant` survit) |

`git show 664af985:nexus-auth.js \| grep 'NEXUS-.*:DEBUT'` → **zéro résultat** : les deux blocs-marqueurs
(`NEXUS-ACCES-REGLE`, `NEXUS-FUSEAU-METIER`) que la lignée `production` extrait littéralement de
`nexus-auth.js` n'existent tout simplement plus dans la version transportée depuis le rail. Ce
n'est pas une coïncidence de nommage : les deux lignées ont chacune fait évoluer ce fichier
séparément depuis leur ancêtre commun (fuseau/jour métier côté `production`, datés 18-19/09 ;
refonte plus large côté rail), et ces évolutions ne sont plus compatibles terme à terme.

`git grep "nexus-auth" 664af985 -- '*.js'` recense encore 11 autres fichiers `test_*.js` non
essayés (`test_accueil_hors_service_20260918.js`, `test_cloture_services_obsoletes_20260916.js`,
`test_connexion_nest_pas_presence_20260916.js`, `test_fuseau_parametres_station_20260920.js`,
`test_inventaire_mode_test_renfort_20260902.js`, `test_jour_metier_pointage_20260919.js`,
`test_rattachement_service_inventaire_20260905.js`, `test_regularisation_manager_20260916.js`,
et 3 des 5 tests `reception_*` déjà modifiés par #65 lui-même) — l'ampleur exacte de `NOUVEAUX`
n'est donc PAS entièrement mesurée ici : **4 échecs sont confirmés par exécution, le total réel est
probablement plus élevé.**

## 4. Ce que ceci implique — pourquoi ce n'est pas un correctif mécanique

Le mandat de ce réveil distingue explicitement : dette mécanique → petit correctif ; régression
réelle/contradiction de baseline → STOP et documenter. Ceci est le second cas :

- **Ce n'est pas une régression du portage carburant #65** — les 17 fichiers propres à #65
  n'incluent ni `nexus-auth.js` ni aucun des 4 tests cassés ; #65 était déjà vert avant le
  transport (`fe36a8e`, 11/11).
- **Ce n'est pas non plus une dette de liste figée** (contrairement à la section 2) — remettre à
  jour la liste `CONNUS` masquerait une incompatibilité fonctionnelle réelle entre deux lignées de
  `nexus-auth.js`, exactement le risque que `ECHECS-CONNUS.json` met en garde d'éviter (« Un
  contrôle qui compte n'est pas le compte, c'est la liste »).
- **Le choix correct n'est pas mécanique** : soit ne PAS transporter `nexus-auth.js`/`nexus-page.js`/
  `nexus-bandeau-environnement.js` tels quels sur une branche de lignée `production` (revenir à un
  transport plus étroit — seuls `outils/build.sh`, `outils/generer-config.js`,
  `outils/poser-build-id.js`, `_headers` étaient réellement nécessaires pour fixer « Cohérence des
  épingles de cache » ; `nexus-auth.js`/`nexus-page.js`/`nexus-bandeau-environnement.js` semblent
  avoir été inclus parce que `poser-build-id.js` calcule une empreinte sur l'ensemble des
  `.html`/`.js` racine, pas parce qu'ils sont eux-mêmes requis par le build) ; soit accepter
  explicitement ces 4+ échecs supplémentaires comme un nouvel « échec connu » propre à cette
  candidate isolée (jamais sur le rail) ; la décision revient à l'Orchestrator/Frédéric, pas à ce
  diagnostic.

## 5. Sur la branche hors canon signalée

`claude/issue-28-20260923-0837` (`59d48da…`) descend bien du rail canonique (`e09616f` en est
ancêtre), mais n'a jamais été intégrée : le registre canonique (`STATE.json` sur
`handoff-continuite-20260920`) reste à `derniere_demande: request-6.md` au moment du dépôt de ce
fichier. Ce dépôt n'en reprend ni le contenu ni la continuité ; il part du HEAD canonique réel
(`e09616f`) et calcule sa propre séquence via `outils/handoff.js demande`, qui l'a numéroté
`request-7.md` en lisant le registre réel — pas une hypothèse.

## 6. Ce qui n'est toujours pas fait, honnêtement

- L'ampleur complète de `NOUVEAUX`/`REPARES` (tous les fichiers root nécessaires pour rejouer
  `node run-tests.js` en entier sur `664af985`) n'a pas été matérialisée exhaustivement — coût
  disproportionné (~250 fichiers) pour un diagnostic dont la cause est déjà confirmée et
  reproduite sur 4 cas concrets, dans 2 mécanismes d'extraction différents (marqueur de bloc et
  signature de fonction), ce qui suffit à établir le caractère systémique plutôt qu'isolé.
- Aucun correctif n'a été codé ni proposé comme mécanique — conforme à l'instruction explicite de
  ce réveil.
- `nexus-config.js` réellement servi / ciblage Supabase Test exclusif : toujours non prouvé, comme
  déjà consigné dans `request-4.md`/`request-5.md`/`request-6.md` — non retenté ici, hors du
  périmètre de ce diagnostic.
- La candidate `#65` **n'est pas déclarée prête** — ni pour la recette navigateur, ni pour une CI
  verte : elle porte désormais une incompatibilité fonctionnelle réelle en plus du point déjà
  ouvert sur le ciblage Supabase Test.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion/déploiement
Production, aucun secret créé/lu/exposé, aucune nouvelle règle métier/UX/RLS/rôle, PR #65 non
modifiée, branche candidate non modifiée (aucune tentative d'écriture Git), aucun fichier
applicatif de ce dépôt touché (diff limité à `docs/handoff/`), répertoire temporaire de
matérialisation supprimé avant la fin de la session, aucune continuité fabriquée depuis la branche
hors canon signalée.
