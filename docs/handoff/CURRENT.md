<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-REGULARISATION-20261026/request-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: secret-employe-auto
    classe: HUMAN
    valeur: Création par Frédéric du secret GitHub NEXUS_TEST_EMPLOYEE_AUTO_PIN dédié au compte Employé Test Auto, et confirmation du NOM à câbler
---
# OUTILLAGE-REGULARISATION-20261026 : request-5 — arrêt sur gate humaine (PIN dédié manquant), étape 2 de la proposition A

BRANCHE_DU_LOT: handoff-continuite-20260920

Réveil autonome reçu sur decision-3.md (réponse à request-4.md). La décision
est prise en charge (`--prise-en-charge`, commit `128bb4c`). Son
`ACTION_NEXT` — matérialiser la décision elle-même sur le rail — était déjà
exécuté par la CI avant ce réveil (run 40335016295, commit `128bb4ce`) : rien
à faire de ce côté. Sur le fond, decision-3 réémet le verdict de request-3
« inchangé » : CONDITIONS identiques à decision-2, qui autorisaient la suite
de la Proposition A, étape 2.

## Preuve des conditions de decision-3

Les six conditions de decision-3 (identiques à celles de decision-2/request-3) :

1. **Environnement Test uniquement** — respecté : aucune lecture ni écriture
   hors `nexus-test` dans cette session.
2. **Conserver Test A** — respecté : `employees` « Employé Test A » n'est ni
   lu ni modifié ; aucun retrait n'est tenté.
3. **Obtenir trois runs verts consécutifs [du nouveau scénario]** — **NON
   SATISFAITE, et bloquée**. Voir « Ce qui bloque » ci-dessous.
4. **Exécuter l'épreuve d'isolation et sa mutation avant tout retrait de Test
   A** — sans objet tant que 3 n'est pas atteinte : aucun retrait n'est à
   l'ordre du jour.
5. **Ne créer aucun compte Auth** — respecté : `auth.users` n'est ni lu ni
   écrit par cette session.
6. **N'écrire ni sur `main` ni en Production** — respecté : aucun accès.

## Ce qui bloque la condition 3

Le « nouveau scénario » de l'étape 2 est la même preuve UI que celle déjà
exercée pour « Employé Test A » (`outils/recette-navigateur-test.js`,
`observerEmploye`), mais pointée sur la nouvelle identité « Employé Test Auto »
semée par `outils/semer-employe-automate-test.sql` (decision-2, Proposition A
étape 1). Se connecter par nom + PIN exige, comme pour Manager, Créateur et
Employé A, un secret GitHub **dédié** à ce compte — la règle de moindre-
privilège posée par Frédéric le 08/09/2026 (un secret par profil, jamais
partagé) s'applique ici de la même façon.

Vérifié par recherche sur tout le dépôt : aucune référence à
`NEXUS_TEST_EMPLOYEE_AUTO_NOM` ni `NEXUS_TEST_EMPLOYEE_AUTO_PIN` n'existe,
ni dans `.github/workflows/`, ni dans `outils/`. Le secret n'a jamais été
créé.

Fixer un PIN pour un compte est déjà nommé, dans ce même fichier, comme un
geste humain hors du périmètre de Claude — précédent exact sur le compte
Créateur (`outils/recette-navigateur-test.js:1517` : « Créer ce compte
demande de fixer un PIN — geste humain, hors périmètre de Claude »). La gate
humaine du dépôt (CLAUDE.md) l'écrit plus largement encore : « la création,
la rotation ou la lecture d'un secret » n'est jamais pré-autorisée, sans
exception d'urgence.

Je ne fabrique donc ni PIN ni secret, et je ne contourne pas la condition en
réutilisant un secret existant sous un autre nom : ce serait recréer le
défaut de partage d'identité qui a causé l'incident du 11/09/2026 (service
clôturé avant sa création), raison même de la Proposition A.

## Geste demandé à Frédéric

- Créer le secret GitHub Actions `NEXUS_TEST_EMPLOYEE_AUTO_PIN`, dédié au
  compte « Employé Test Auto » (id `00000000-0000-4000-8000-0000a070ca7e`),
  distinct de `NEXUS_TEST_EMPLOYEE_A_PIN`.
- Confirmer que le NOM à câbler est exactement `Employé Test Auto` (valeur de
  `employees.nom` semée par `semer-employe-automate-test.sql`), pour reprendre
  le même schéma que `NEXUS_TEST_EMPLOYEE_A_NOM: Employé Test A` dans
  `tests.yml`.

Une fois ce secret posé, le câblage (ajout de la variable à `tests.yml` et du
second parcours employé dans `recette-navigateur-test.js`, dégradation non
bloquante si absent — ENV-003) relève de l'outillage pré-autorisé (§3) et
sera fait sans nouvelle demande ; seules les trois exécutions vertes et
l'épreuve d'isolation feront l'objet d'un compte-rendu avant tout retrait de
Test A.

## À arbitrer

1. La lecture ci-dessus de decision-3 (réémission inchangée sur le fond de
   request-3) est-elle correcte ?
2. Le lot reste-t-il ouvert, en attente du geste humain ci-dessus, sans
   nouvelle décision requise avant qu'il soit posé ?
