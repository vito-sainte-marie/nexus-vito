---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=2f27e5c
  - id: decision-2-consommee
    classe: VERIFIED
    valeur: commit-adf1ca3-statut-DECISION_CONSOMMEE
  - id: candidat-verifie
    classe: VERIFIED
    valeur: 9ffee7e438d5fdf29c4fc879c5729ac7cc27e085-identique-a-request-2
  - id: acces-supabase-test-absent
    classe: VERIFIED
    valeur: NEXUS_TEST_DB_AVAILABLE=0-aucune-url-de-connexion-dans-ce-canal
  - id: vehicule-application-prepare
    classe: VERIFIED
    valeur: outils-appliquer-migrations-fdj-vague1-candidat-62-test-a-executer-par-frederic.sh-non-execute
  - id: application-12-migrations
    classe: NOT_APPLICABLE
    valeur: aucun-acces-nexus-test-depuis-ce-canal
  - id: recette-cas-1-a-5
    classe: NOT_APPLICABLE
    valeur: migrations-non-appliquees-recette-mesurerait-rien
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Demande — `decision-2.md` consommée ; véhicule d'application préparé, non exécuté

## 1. Ce qui a été fait

### Décision déposée et consommée

`decision-2.md` a été déposée via `outils/handoff.js decision`, en réponse à `request-2.md`,
reprenant verbatim l'arbitrage de Frédéric Bragance du 04/10/2026 (« Je choisis l'option A
recommandée, strictement sur nexus-test ») et ses neuf conditions cumulatives. Verdict :
`APPROVED_WITH_CONDITIONS`, `closes: false`.

- Dépôt : commit `95711fd6c9ca37e24d4282e57b64ca9160068dab`.
- Consommation : commit `adf1ca3cf0c20d7692ff0b8ca21dc90c69913ffc` (registre marqué
  `DECISION_CONSOMMEE`, miroirs régénérés).
- `outils/handoff.js verifier` reste conforme après les deux (33 lots, aucune nouvelle erreur).

### Candidat et migrations vérifiés, pas supposés

- `origin/rebuild/fdj-62-20260922` mesuré depuis ce checkout : `9ffee7e438d5fdf29c4fc879c5729ac7cc27e085`
  — identique au SHA cité par `request-2.md`.
- Les 12 fichiers `20260916220000` → `20260916221100` sont bien présents sur cette branche,
  à l'emplacement attendu (`supabase/migrations/`), listés un par un par `git show`.

### Vérification explicite de l'accès Supabase Test depuis ce canal — absent, par construction

Ce canal (déclenchement `@claude` sur commentaire d'issue) expose une variable de diagnostic
dédiée : `NEXUS_TEST_DB_AVAILABLE=0`. Aucune des variables de connexion (`NEXUS_TEST_DB_URL`,
`NEXUS_TEST_DB_URL_WRITE`, `SUPABASE_TEST_DB_URL_WRITE`, `NEXUS_TEST_DB_PASSWORD`) n'est
présente ; `psql` est installé mais n'a aucune cible. C'est la même limite structurelle que
celle déjà documentée à plusieurs reprises depuis le 06/09/2026 pour ce type de déclenchement
— mesurée ici de nouveau, pas supposée. Trois profils de recette navigateur (Manager, Créateur,
Employé A) sont en revanche disponibles dans ce canal, mais une recette contre `nexus-test`
sans les 12 migrations appliquées ne mesurerait rien (constat déjà posé par `request-2.md` §2).

**Conséquence : ni l'application des 12 migrations, ni la recette Cas 1 à 5, n'ont pu être
exécutées par cette session.** Aucune exécution n'a été fabriquée ou simulée pour compenser.

## 2. Ce qui a été préparé pour la session qui a l'accès

`outils/appliquer-migrations-fdj-vague1-candidat-62-test-a-executer-par-frederic.sh` (nouveau,
non exécuté — son nom le dit). Conçu dans la forme déjà établie par
`outils/appliquer-migration-ecriture-bornee-station-config-test-a-executer-par-frederic.sh` :

- refuse par nom, avant toute connexion : le pooler, la référence Production
  (`uzhjpqpctpvxytxpxoqz`), toute URL qui ne nomme pas explicitement `nexus-test`
  (`udljdqxerrbbbajxubfn`), et l'identité `nexus_ci_recette` (ce rôle ne peut pas créer les
  fonctions/triggers/politiques que ces migrations créent) — c'est la vérification d'identité
  exigée par la condition 3 de `decision-2.md`, faite avant d'écrire, pas après ;
- mesure l'état des 12 versions dans `schema_migrations` avant d'écrire quoi que ce soit, et
  refuse (`ETAT_DEJA_PARTIEL`) si l'une d'elles y figure déjà, plutôt que de deviner si elle
  est rejouable sans risque ;
- applique les 12 fichiers dans une transaction SQL unique (`begin; \i …; commit;`,
  `-v ON_ERROR_STOP=1`) — en mode mesure seule par défaut, écriture uniquement avec
  `--appliquer` ;
- n'invente aucun rollback inverse : si `psql` s'arrête en cours de route, la transaction reste
  ouverte et PostgreSQL la défait lui-même à la fermeture de la connexion — mécanisme natif, pas
  un script écrit pour l'occasion. Le véhicule rapporte alors la sortie exacte de `psql` et
  s'arrête (condition 5) ;
- mesure `schema_migrations` après coup et exige les 12 versions exactes avant de rendre un
  verdict positif (condition 6) — jamais le code de sortie de `psql` seul.

**Limite honnête** : ce canal ne peut pas exécuter `bash -n` ni `chmod` sur ce fichier (les deux
exigent une approbation qu'aucun humain ne peut donner dans ce run automatisé) — le script a
donc été relu ligne à ligne, pas vérifié par exécution, et son bit exécutable n'a pas pu être
posé (`git update-index --chmod=+x` refusé pour la même raison). Invocation prévue :
`bash outils/appliquer-migrations-fdj-vague1-candidat-62-test-a-executer-par-frederic.sh
[--appliquer]`, depuis un checkout de `rebuild/fdj-62-20260922`.

Ce véhicule ne couvre que la moitié SQL du geste A. La recette FDJ Cas 1 à 5 (`request-1.md`,
§6) exige un navigateur réel contre l'alias `https://rebuild-fdj-62-20260922.nexus-test-ddf.pages.dev/`,
hors du périmètre d'un véhicule `psql` — à exécuter juste après, par la même session outillée,
en reprenant l'approche déjà démontrée possible par geste 2 de `request-2.md` (essai à blanc,
recette, empreinte).

## 3. SHA et identifiants, pour mémoire

- Candidat qualifié : `9ffee7e438d5fdf29c4fc879c5729ac7cc27e085` (`rebuild/fdj-62-20260922`).
- Projet Test attendu : `nexus-test` (`udljdqxerrbbbajxubfn`).
- Alias de recette : `https://rebuild-fdj-62-20260922.nexus-test-ddf.pages.dev/`.
- Dépôt `decision-2.md` : `95711fd6c9ca37e24d4282e57b64ca9160068dab`.
- Consommation de `decision-2.md` : `adf1ca3cf0c20d7692ff0b8ca21dc90c69913ffc`.
- **Aucun run ID n'existe pour l'application des 12 migrations ni pour la recette** : aucune
  des deux n'a été exécutée. En donner un serait fabriquer une preuve.

## 4. Arbitrage demandé

Aucun nouvel arbitrage de fond n'est nécessaire : `decision-2.md` autorise déjà exactement ce
qui reste à faire. Ce `request-3.md` sert uniquement de point de passage, pour que le registre
reflète l'état réel avant que la session outillée (Frédéric ou l'Orchestrator, avec accès
`nexus-test` réel) exécute le véhicule puis la recette. Le lot reste ouvert
(`closes: false` attendu) ; le prochain retour canonique portera les preuves mesurées des
Cas 1 à 5, ou l'obstacle exact si le véhicule ou la recette échouent.

Rien n'a été écrit sur `nexus-test`, ni fusionné, ni déployé en Production par cette session.
