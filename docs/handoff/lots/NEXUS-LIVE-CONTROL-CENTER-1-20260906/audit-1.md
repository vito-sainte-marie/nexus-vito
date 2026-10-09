# NEXUS Handoff — audit-1

protocol: nexus-handoff/2
lot_id: NEXUS-LIVE-CONTROL-CENTER-1-20260906
type: implementation-report
branch: config-par-environnement
environment: TEST_ONLY
decision_consommee: 693570bfccd46c83ea50a88246eb1eaef9b5e8f5 (decision-1.md)

## 1. Reconstruction factuelle (avant ce réveil)

Vérifié par `git merge-base`/`git log` contre `origin/config-par-environnement`, `origin/main`, `origin/production` — aucune mémoire supposée. `docs/handoff/STATE.json` (lu via `git diff origin/main origin/config-par-environnement -- docs/handoff/STATE.json`, ce fichier étant absent de ce checkout) classe explicitement `NEXUS-LIVE-CONTROL-CENTER-1-20260906` dans `artefacts_hors_registre` : « Dossier de conception créé avant la normalisation des lots Handoff v2 ; son request-1.md n'a jamais porté d'enveloppe YAML ». Ce lot n'a donc **jamais** fait l'objet d'une consommation via `outils/handoff.js` et ce réveil est la **première exécution** demandée pour lui — classification : **non commencé**.

Pour mémoire, état des autres lots touchés par Claude dans cette issue (aucun n'est modifié par ce lot) :

| Lot | Statut registre (`STATE.json`) | Code Claude fusionné dans `config-par-environnement` ? |
|---|---|---|
| SITE-EXPLICITE-1-POMPISTE-DU-JOUR-TIMEZONE-GUARD-20260906 | `DECISION_CONSOMMEE` | Non (commit `93852f8` isolé) — clos par une autre voie (`commit_decision: c8a2c128`) |
| CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906 | `DECISION_CONSOMMEE` (jusqu'à decision-4.md) | Partiel — `a6b9f98` (créneau/motif/CTA) **oui** ; `72cec14`/`821310c` (clarifications ultérieures) non |
| NEXUS-ORCHESTRATOR-EVENT-DRIVEN-1-20260906 | `artefacts_hors_registre` | Non (`7a5d329`) |
| NEXUS-GUARDIAN-ARCHITECTURE-COHERENCE-1-20260906 | `artefacts_hors_registre` | Non (`157316e`) |
| Gouvernance Autonome v2 (Guardians backend) | hors ledger lots | Non (`4ecccc8`) |
| CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906 | `ATTENTE_DECISION` (lot **actif**) | — non touché par ce réveil, conformément à l'instruction explicite « ne pas mélanger » |

Obstacle structurel inchangé : ce checkout (`claude/issue-28-20260907-0044`) reste raciné sur `main` (HEAD `645116b`), pas sur `config-par-environnement` — confirmé par `git merge-base --is-ancestor HEAD origin/config-par-environnement` (échec). `docs/handoff/` est donc absent de ce répertoire de travail ; les fichiers canoniques du lot (`request-1.md`, `spec-1.md`) ont été lus par `git diff origin/main origin/config-par-environnement -- <fichier>` (les deux étant des fichiers neufs sur `config-par-environnement`, le diff en restitue le contenu intégral sans nécessiter `git show`/`checkout`).

**Nouveau cette fois** : `NEXUS_TEST_URL`, les trois usernames Test et `NEXUS_TEST_PIN` sont réellement injectés (vérifié par présence, jamais par valeur), et l'installation réseau de Playwright/Chromium a réussi dans ce runner — une preuve comportementale réelle contre le déploiement NEXUS Test a donc pu être obtenue pour la première fois dans ce fil (§4).

## 2. Décision d'architecture — capacité Créateur réutilisée, pas dupliquée

`spec-1.md` §2 proposait une capacité neuve `nexus_creator_live_development`. Ce dépôt possède déjà une capacité Créateur **éprouvée et appliquée côté serveur** :
- colonne `employees.est_createur` (booléenne, `NOT NULL DEFAULT false`) ;
- fonction SQL `SECURITY DEFINER` `public.je_suis_createur()` (`supabase/migrations/20260101000000_baseline_pre_existing_schema.sql:449`), déjà utilisée dans les RLS d'au moins 24 migrations (ex. `20260904130807_fermer_lecture_anonyme_sites.sql`) ;
- gate client existant : `nexus-auth.js` (`nexusRequireAuth`) et `NEXUS-Debug-Createur-v1.html` (`if (!employee.est_createur)`).

**Décision retenue : NEXUS LIVE DÉVELOPPEMENT réutilise `est_createur`/`je_suis_createur()` comme capacité unique.** Introduire une seconde capacité parallèle aurait reproduit exactement le risque déjà signalé par le Guardian Architecture & Cohérence (`audit-1.md` du lot NEXUS-GUARDIAN-ARCHITECTURE-COHERENCE-1-20260906 : collision d'identité `NexusStock`). Aucune décision stratégique non tranchée par la Bible n'était nécessaire ici — pas de gate Frédéric demandée pour ce point.

## 3. Livré (Test uniquement, commit voir le rapport de l'issue #28)

- `nexus-live-evenement.js` — contrat `nexus-execution-event/1` (spec-1.md §5) : validation stricte (protocole, phases/statuts énumérés, acteur, gate humain avec question obligatoire), détection défensive de contenu ressemblant à un secret, idempotence par `event_id`, immutabilité du journal fourni.
- `nexus-live-projection.js` — réduction du journal en projection structurée (spec-1.md §6) : statut système (`AUTONOMOUS`/`HUMAN_REQUIRED`/`FAIL_CLOSED`/`IDLE`), lot/agent/phase actifs, Guardians (dernier statut par acteur), tests/CI par lot, gate humain ouvert/refermé. Indépendant de tout fournisseur (aucune référence GitHub/Claude).
- `nexus-live-acces.js` — `nexusLiveAutorise(employee)`/`motifRefusLive(employee)`, fonction pure, aucune coercition implicite, fail closed si session absente.
- `NEXUS-Live-Developpement-v1.html` — page MVP : bandeau statut, bloc « Maintenant », timeline, Guardians, tests/CI, bloc intervention conditionnel. Gate via `nexusRequireAuth()` + `NexusLiveAcces.nexusLiveAutorise` (un seul point de décision, aucun second calcul). Lecture de `nexus_live_events` via `nexusClient`.
- `supabase/migrations/20260907010000_creer_nexus_live_events_test.sql` — table `nexus_live_events` (append-only, pas de politique UPDATE/DELETE), RLS `select`/`insert` restreintes à `je_suis_createur()`. **Non appliquée** à `nexus-test` par ce lot (aucune opération Supabase d'écriture effectuée depuis ce canal).
- Tests unitaires : `test_nexus_live_evenement_20260907.js` (10 assertions), `test_nexus_live_projection_20260907.js` (10), `test_nexus_live_acces_20260907.js` (7) — tous exécutés réellement, tous verts.
- `recette_live_acces_negatif_20260907.js` — script de recette navigateur (Playwright), non permanent (ne suit pas la convention `test_*.js`, dépend de secrets d'exécution).

## 4. Preuve comportementale réelle contre NEXUS Test (nouveau)

Playwright/Chromium installés dans ce runner (téléchargement réseau réussi, ~168 Mio) — première fois dans ce fil qu'une recette navigateur s'exécute réellement plutôt que d'être déclarée hors de portée. Résultats exacts (aucune valeur de `NEXUS_TEST_PIN` journalisée, uniquement des booléens/textes d'écran) :

| Vérification | Résultat |
|---|---|
| Accès direct (sans session) à un écran déjà gardé Créateur (`NEXUS-Debug-Createur-v1.html`) | Redirigé vers `NEXUS-Login-v1` — fail closed confirmé |
| `manager-test` (« Manager Test ») — connexion avec `NEXUS_TEST_PIN` | Connecté avec succès |
| `manager-test` — `je_suis_createur()` (RPC réel, même fonction que la RLS `nexus_live_events`) | `false` |
| `manager-test` — accès à l'écran Créateur existant | Verrouillé : « Cet écran est réservé au compte créateur. » |
| `employe-test-a` (« Employé Test A ») — connexion | Connectée avec succès |
| `employe-test-a` — `je_suis_createur()` | `false` |
| `employe-test-a` — accès à l'écran Créateur existant | Verrouillé, même message |

Cette preuve porte sur la capacité `je_suis_createur()` elle-même et sur l'écran Créateur **déjà déployé** — c'est exactement la capacité que réutilise NEXUS LIVE DÉVELOPPEMENT (§2), mais **pas encore sur `nexus_live_events`/`NEXUS-Live-Developpement-v1.html` eux-mêmes**, absents du déploiement Test tant que la migration §3 et ce fichier n'y sont pas promus. La preuve négative manager/employé exigée par spec-1.md §7 est donc obtenue réellement, par transitivité sur la capacité partagée — pas encore rejouée après déploiement du Live lui-même.

Aucun compte Créateur Test n'a été fourni dans ce réveil (seulement `manager-test`, `employe-test-a`, `employe-test-b`) : le test positif (« un Créateur accède ») n'a pas pu être exécuté et n'a pas été simulé.

## 5. Limites résiduelles honnêtes

1. Migration `nexus_live_events` non appliquée à `nexus-test` (aucune écriture Supabase depuis ce canal) — la RLS n'est donc pas encore éprouvée en conditions réelles sur cette table précise.
2. Aucun producteur d'événements n'écrit encore dans `nexus_live_events` : ni l'Orchestrator event-driven (lot séparé, non mélangé ici conformément à la contrainte de spec-1.md), ni un pont GitHub Actions/Handoff. La page affiche donc « Aucun événement Live reçu » tant que ce câblage n'existe pas — cohérent avec spec-1.md §10 (« figer le contrat après confrontation avec le rail event-driven », « connecter Handoff et GitHub Actions » restent des étapes ultérieures).
3. Aucune entrée de menu Créateur n'a été ajoutée dans la navigation NEXUS globale (page atteignable par URL directe uniquement) — changement minimal, pas de modification des écrans de navigation existants hors périmètre de ce lot.
4. Test positif Créateur non exécuté (aucun compte Test disponible).
5. `docs/handoff/lots/NEXUS-LIVE-CONTROL-CENTER-1-20260906/request-2.md` / dépôt canonique non déposés via `outils/handoff.js` — obstacle structurel inchangé (checkout non raciné sur `config-par-environnement`). Ce fichier `audit-1.md` est produit hors du registre pour la même raison que `request-1.md`/`spec-1.md` (cf. §1) et devra être rapatrié par une session outillée.

## 6. Verdict Guardians (pour ce livrable)

- **Architecture & Cohérence** : confirmé — aucune capacité parallèle créée (§2), aucun second calcul d'autorisation (page → un seul appel `nexusLiveAutorise`), moteur de projection indépendant du fournisseur.
- **Security & Isolation** : confirmé — RLS restreinte à `je_suis_createur()`, aucun secret dans les fichiers commités, PIN jamais journalisé (vérifié dans la sortie du script §4), aucune donnée cliente exposée par le contrat d'événement (détection défensive dans `nexus-live-evenement.js`).
- **Business Rules** : confirmé — aucune alternance avec le lot Carburants actif, aucune vérité métier des moteurs recalculée.
- **QA/Regression** : confirmé — 27 assertions neuves toutes vertes, suite complète 168/177 (9 échecs pré-existants identiques avant/après, hors périmètre).
- **Bible/Philosophie** : confirmé — « autonomie sans opacité » respecté (aucune approbation manuelle artificielle introduite), gate humain modélisé mais jamais forcé.

Aucune décision stratégique non tranchée par la Bible n'a été identifiée : pas de gate Frédéric demandée par ce rapport.
