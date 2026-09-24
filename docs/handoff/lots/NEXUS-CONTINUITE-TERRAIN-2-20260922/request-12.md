---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 12
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: node-check
    classe: VERIFIED
    valeur: succes-sans-erreur-syntaxe
  - id: harnais-1-vert
    classe: VERIFIED
    valeur: test_regularisation_manager_20260916-harnais-realigne-1-24-sur-24-execution-reelle
  - id: harnais-2-vert
    classe: VERIFIED
    valeur: test_cloture_services_obsoletes_20260916-harnais-realigne-1-14-sur-14-execution-reelle
  - id: source-unique-role
    classe: VERIFIED
    valeur: une-seule-occurrence-ligne-185-nexusEstManager
  - id: diff-mesure
    classe: VERIFIED
    valeur: 463-insertions-9-suppressions-un-seul-fichier
  - id: perimetre-exclu-absent
    classe: VERIFIED
    valeur: grep-negatif-nexusCategorieAcces-et-consorts
  - id: suite-candidate-complete
    classe: NOT_APPLICABLE
    valeur: transport-git-indisponible-depuis-ce-canal-1146-fichiers-224-tests
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Restauration minimale `nexus-auth.js` #65 — exécutée, `nexus-auth-restaure-65-20260924.js`

En réponse à `decision-9.md` (consommée, commit `c9e0b76ca978b88426387301ba39da8ba169132b`).

## Ce qui a été fait

Assemblage script (jamais à la main) du plus petit plan autorisé par `decision-9.md` §1, à partir
de `origin/rebuild/carburants-65-20260922:nexus-auth.js` (305 lignes, base) et
`origin/production:nexus-auth.js` (932 lignes, source des blocs) :

1. `nexusEstManager(employee)` — copié tel quel (Production lignes 324-331).
2. Bloc d'autorité de fuseau (`nexusFuseauxSite`, `nexusFuseauValide`, `nexusRetenirFuseau`,
   `nexusJourDansFuseau`, `nexusFuseauSite`) — copié tel quel (Production lignes 609-774, commentaire
   historique inclus).
3. Cycle pilote (`nexusReglesPilote`, `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`,
   `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`) — copié tel quel (Production
   lignes 350-579).
4. `nexusServiceCourant` mis à jour — copié tel quel (Production lignes 775-869), remplace l'ancienne
   version (date locale de l'appareil) de la candidate.
5. Consolidation mécanique des deux occurrences résiduelles de
   `employee.role==='manager'||employee.role==='gerant'` (dans `nexusPointageArriveeManquant` et
   `nexusPriseDePosteManquante`) vers `nexusEstManager(employee)` — même sémantique, une seule
   définition.

Gardes build/config (`NEXUS_CONFIG`, `NexusBuild`, `NexusPage`) intégralement conservées. Aucun
remplacement en bloc de `nexus-auth.js`. Périmètre exclu par `decision-9.md` §2 (classification
d'accès/navigation, migration fuseau des trois fonctions de pointage restantes) vérifié absent par
recherche négative.

Fichier livré : `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js`
(759 lignes). Preuves détaillées :
`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/preuve-restauration-nexus-auth-65-20260924.md`.

## Preuves obligatoires de `decision-9.md` §3

- `node --check` : **succès**.
- Deux harnais réalignés, exécutés réellement (dépendances candidate reconstituées : `nexus-pointage-regles.js`,
  `nexus-page.js`, migration `20260916195000_cloture_source_cycle_pilote.sql`, six écrans consommateurs) :
  `test_regularisation_manager_20260916-harnais-realigne-1.js` **24/24**,
  `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` **14/14** — **38/38**, assertions
  inchangées.
- Source unique du rôle : une seule occurrence de `role\s*===\s*'manager'` dans tout le fichier (ligne 185,
  dans `nexusEstManager`).
- Diff mesuré : **463 insertions, 9 suppressions**, un seul fichier (écart de 3 lignes par rapport au
  chiffre 466/9 de `request-11.md` : variance de mise en forme des lignes vides entre deux assemblages
  distincts, sans effet fonctionnel).
- **Suite candidate complète vs baseline : NON EXÉCUTÉE** — limitation de transport confirmée
  positivement dans cette session (`git checkout`/`git worktree add`/`git archive` vers un arbre complet
  refusés ; `git ls-tree`/`git grep` contre une réf distante ne produisent aucune sortie exploitable dans
  ce canal, y compris sur un contrôle connu pour réussir). Candidate = 1146 fichiers, 224 fichiers
  `test_*.js` ; matérialiser l'arbre complet fichier par fichier dépasse ce qui est raisonnable dans une
  session. Détail complet dans le fichier de preuve §6.
- Aucune régression matérielle constatée sur ce qui a pu être exécuté ; le point non acquis est un point
  d'exécution (transport), pas une contradiction — la clause STOP de `decision-9.md` §3 ne s'applique donc
  pas ici.

## Transport (decision-9.md §5)

Écriture directe sur `rebuild/carburants-65-20260922` non disponible depuis ce canal (même limitation que
documentée à chaque réveil précédent de ce lot). Commit atomique préparé sur la branche de travail
persistante `claude/issue-28-20260924-0143`, diff exact et preuves ci-dessus, commandes de transport
exactes dans le fichier de preuve §"Pour transporter et clore depuis une session outillée". Aucune gate
Créateur demandée pour cette limitation de transport, conformément à l'instruction explicite.

Le transport doit aussi inclure les deux fichiers de test déjà réalignés (présents dans ce répertoire de
lot), à poser sur la candidate sans le suffixe `-harnais-realigne-1` : les versions actuellement sur la
candidate ne portent pas `NEXUS_CONFIG`/le chargement de `nexus-page.js` et échoueraient au démarrage
même de `nexus-auth.js` restauré, pour une raison déjà diagnostiquée sous `decision-8.md`, indépendante
de ce lot.

## Gates suivantes (decision-9.md §4) — inchangées

Même si cette restauration devient verte une fois transportée, #65 reste NO GO tant que les gates déjà
établies ne sont pas fermées : CI candidate verte (sur l'arbre réellement modifié, cf. suite complète
non exécutée ci-dessus), preuve du `nexus-config.js` réellement servi ciblant exclusivement Supabase
Test, puis recette navigateur autorisée. Aucune activation demandée dans ce retour.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase Production/NEXUS Production, aucune
migration ou écriture Supabase, aucun déploiement/promotion Production, aucun changement de rôle/RLS,
aucun secret exposé, aucune règle métier/UX nouvelle. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste canonique.
