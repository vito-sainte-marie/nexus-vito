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
    valeur: main=4a49bf4 production=2bc7b39
  - id: decision-11-consommee
    classe: VERIFIED
    valeur: outils-handoff-js-consommer-commit-61abec1
  - id: gate-migration-65-fermee
    classe: VERIFIED
    valeur: classement-gates-etat-git-62-65-1-md-section-5
  - id: fait-git-nouveau-candidate-65
    classe: VERIFIED
    valeur: rebuild-carburants-65-20260922-tip-20af9f6-5-commits-depuis-fe36a8e
  - id: mecanisme-recette-candidat-coherent
    classe: VERIFIED
    valeur: workflow-recette-candidat-65-yml-lu-en-entier-script-lit-NEXUS_COMMIT_ATTENDU
  - id: execution-ci-candidate
    classe: NOT_APPLICABLE
    valeur: gh-api-gh-auth-status-git-fetch-push-requierent-approbation-indisponible
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# `decision-11.md` consommée (gate migration `#65` fermée) — les deux gates restantes ont un mécanisme déjà écrit, non exécutable depuis ce canal

## 1. Décision consommée

`decision-11.md` (Créateur — preuve `#65` du 22/09 recevable pour la gate migration,
`APPROVED_WITH_CONDITIONS`, `closes: false`) consommée via `outils/handoff.js consommer
NEXUS-CONTINUITE-TERRAIN-2-20260922` (commit `61abec1`). Registre conforme avant/après (32 lots,
mêmes avertissements préexistants + 1 nouveau attendu — miroir `DECISION.md` dérivé, corrigé par
`handoff.js miroirs`). Ceci ferme **uniquement** la ligne « Preuve de création réelle de la
migration `#65` » de `classement-gates-etat-git-62-65-1.md` §2 — ni un GO de fusion, ni un GO
Production. Les deux constats résiduels de `preuve-65-schema-jetable.md` §4 (`revoke ... from
public` inefficace sur `anon`/`authenticated` ; horodatage `20260919103000` antérieur à neuf
migrations Production) restent ouverts, portés au futur dossier de gate Production — pas absous
par cette fermeture.

`request-18.md §5` (la question `issues: write`) n'appelait plus d'arbitrage : Frédéric l'a
tranchée directement par le commit `0b3c387` du 26/09/2026, hors de ce fil de décision. Aucune
réouverture de ce diagnostic ici.

## 2. Poursuite automatique des gates restantes — un fait git nouveau trouvé, pas supposé

Consigné en détail, par append, dans `classement-gates-etat-git-62-65-1.md` §5 (nouveau) : la
branche candidate `rebuild/carburants-65-20260922` (nommée par `decision-2.md`/`preuve-cloudflare-
humaine-65-portage-1.md` pour le portage mécanique de l'isolation Test) a avancé de **cinq
commits** depuis le 23/09, tous déjà présents dans ce checkout sans `git fetch` :

- `290a217`/`664af98`/`a31b2e4`/`1ba8b88` : exactement les gestes déjà documentés par les lots
  précédents de ce fil (portage des 7 fichiers de build, correctif `nexus-auth.js`, réalignement
  des harnais — cause racine `290a217`, `decision-9.md` ; CI acceptée par `decision-10.md`).
- `20af9f6` (24/09) : **nouveau**, jamais cité par un `request-N.md`/`decision-N.md` de ce lot.
  Ajoute `.github/workflows/recette-candidat-65.yml` — un mécanisme complet et cohérent, lu en
  entier avant ce paragraphe :
  - se déclenche sur push vers `rebuild/carburants-65-20260922` et sur `workflow_dispatch` ;
  - vérifie d'abord, fail-closed, que la preview Cloudflare sert **exactement** `github.sha`
    (`nexus-build.js`), que `nexus-config.js` annonce `environnement: "test"` et le projet
    Supabase Test `udljdqxerrbbbajxubfn`, avec **refus explicite** si la référence Production
    (`uzhjpqpctpvxytxpxoqz`) apparaît ;
  - lance ensuite `node outils/recette-navigateur-test.js` avec les trois secrets Test déjà
    provisionnés (Manager, Créateur, Employé A) — jamais lus, jamais journalisés depuis ce canal.
  - la version du script présente sur la candidate (vintage 09/09/2026, relue en entier) lit bien
    `NEXUS_COMMIT_ATTENDU`, exactement ce que le workflow lui passe : cohérent, pas un décalage.

**Ce que ceci change, précisément** : l'« Isolation Supabase Test des candidats web » n'est plus
« portage non fait » (état du 22/09) mais « portage mécanique fait, exécution non confirmée ». La
« recette navigateur authentifiée » n'est plus seulement une voie identifiée dans l'abstrait
(`request-17.md §2`) : un mécanisme concret, avec de vrais secrets, existe déjà sur la candidate
elle-même. Aucune des deux gates n'est déclarée close par ce paragraphe — leur preuve d'exécution
manque encore.

## 3. Pourquoi ce canal ne peut pas fournir cette dernière preuve

Revérifié dans cette session, même constat que `request-17.md §2` : `gh api`, `gh auth status`,
`git fetch`/`push` requièrent tous une approbation qu'aucun humain ne peut donner dans ce run
automatisé. Aucune tentative de déclenchement (`workflow_dispatch`) ni de lecture de run n'a donc
été faite — ni contournée par un geste alternatif (aucun push, aucune modification de la
candidate, aucun secret lu ou deviné).

## 4. Verdict de ce tour

Ni `PRET_GATE_CREATEUR`, ni `BLOQUE_CAUSE_RACINE` : il n'y a pas de cause racine bloquante — un
mécanisme sain existe et attend seulement d'être lu ou déclenché par un accès que ce canal n'a
pas, structurellement, depuis le début de ce fil.

**Geste minimal exact requis, et rien de plus** : depuis un accès `gh`/GitHub disposant de droits
sur ce dépôt, lire l'historique des runs du workflow « Preuve Test #65 » sur
`rebuild/carburants-65-20260922` à `20af9f6`. S'il n'a jamais tourné ou a échoué, le déclencher
par `workflow_dispatch` (aucun nouveau secret, aucune nouvelle permission), puis rapporter le
verdict exact (SHA servi, `environnement` annoncé, projet Supabase observé, résultat de la
recette) par un nouveau `request-N.md`. Une fois ce verdict positif obtenu et l'isolation
confirmée en exécution, le dossier de gate Production pourra être préparé — pas avant.

Je ne redemande pas l'arbitrage migration : `decision-11.md` le clôt. Cette demande porte
uniquement sur la suite mécanique.

## Ce que cette session n'a pas fait

Aucun portage, aucune modification de fichier applicatif, aucune configuration Cloudflare, aucune
requête Supabase, aucun déclenchement de workflow, aucune lecture ni exposition de secret, aucune
réouverture d'un verdict déjà rendu (`decision-9.md`, `decision-10.md`, NO GO temporaire de
`#62`/`#65`).

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase, aucune promotion
Production, aucun secret lu ou exposé, aucun reset de Test historique, aucun changement
métier/UX/rôle/RLS/sécurité, aucun affaiblissement de tests/`ECHECS-CONNUS`, aucune baisse de
gate. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
