# Preuve — restauration minimale `nexus-auth.js` candidate #65, `decision-9.md`

Exécuté sous `decision-9.md` (APPROVED_WITH_CONDITIONS, `closes: false`, en réponse à
`request-11.md`), commit de décision `c9e0b76ca978b88426387301ba39da8ba169132b`,
consommée par cette session. Périmètre : restauration minimale de comportement déjà
présent en Production, sur la candidate non-Production `rebuild/carburants-65-20260922`
uniquement. Aucun changement `main`/`production`, aucune opération Supabase.

Fichier livré : `nexus-auth-restaure-65-20260924.js` (759 lignes), assemblé par script
(jamais à la main) à partir de deux sources lues en lecture seule (`git show`, aucune
écriture sur aucune branche) :
- `origin/rebuild/carburants-65-20260922:nexus-auth.js` (305 lignes, base inchangée) ;
- `origin/production:nexus-auth.js` (932 lignes, source des 4 blocs autorisés).

## 1. Assemblage — exactement le périmètre autorisé par `decision-9.md` §1

| # | Élément | Source | Lignes production | Statut |
|---|---|---|---|---|
| 1 | `nexusEstManager(employee)` | Production | 324-331 | copié tel quel |
| 2 | Bloc d'autorité de fuseau (`nexusFuseauxSite`, `nexusFuseauValide`, `nexusRetenirFuseau`, `nexusJourDansFuseau`, `nexusFuseauSite`) | Production | 609-774 (commentaire historique inclus) | copié tel quel |
| 3 | Cycle pilote (`nexusReglesPilote`, `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`, `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`) | Production | 350-579 | copié tel quel |
| 4 | `nexusServiceCourant` mis à jour | Production | 775-869 | copié tel quel, remplace l'ancienne version (device-date) de la candidate |
| 5 | Consolidation des deux prédicats manager résiduels | Candidate, modifiée | — | `employee.role==='manager'||employee.role==='gerant'` → `nexusEstManager(employee)` dans `nexusPointageArriveeManquant` ET `nexusPriseDePosteManquante` |

Gardes build/config de la candidate (`NEXUS_CFG`/`window.NEXUS_CONFIG`, `NexusBuild.versionner`,
`NexusPage`) : **non touchées**, vérifié par diff — aucune ligne du bloc de configuration/chargement
d'extensions ne diffère de la candidate actuelle. Aucun remplacement en bloc de `nexus-auth.js` :
seules les zones listées ci-dessus sont insérées/modifiées, le reste (en-tête, config, chargeur
d'extensions, `nexusRequireAuth`, `nexusRemplirNomDuCommerce`, `nexusDateLocaleISO`,
`nexusDepartPointeAujourdhui`, `nexusLogout`, `nexusQuitterConsultation`) provient de la candidate,
caractère pour caractère.

**Périmètre explicitement exclu, vérifié par grep négatif** — aucune des chaînes suivantes n'apparaît
dans le fichier restauré : `nexusCategorieAcces`, `NEXUS_PAGES_CONSULTATION`,
`NEXUS_PAGES_OPERATIONNELLES`, `NEXUS_PAGES_PUBLIQUES`, `nexusPageExigeServiceOperationnel`,
`nexusEcranOperationnelAtteignable`. La classification d'accès/navigation n'est pas restaurée dans ce
geste, conformément à `decision-9.md` §2. `nexusPointageArriveeManquant`/`nexusPriseDePosteManquante`/
`nexusDepartPointeAujourdhui` restent sur la date locale de l'appareil (non migrées vers
`nexusFuseauSite`), comme prescrit.

## 2. `node --check`

```
node --check nexus-auth-restaure-65-20260924.js
```
→ **succès**, aucune erreur de syntaxe.

## 3. Harnais réalignés — exécution réelle, assertions inchangées

Exécutés tels quels (aucune assertion modifiée, aucune affaiblie), dans un répertoire de travail
reconstituant les dépendances réelles de la candidate (`nexus-pointage-regles.js`, `nexus-page.js`,
la migration `20260916195000_cloture_source_cycle_pilote.sql`, et les six écrans consommateurs —
`NEXUS-Pointage-v1.html`, `NEXUS-Missions-v1.html`, `NEXUS-Inventaire-v1.html`, `NEXUS-Cockpit-v2.html`,
`NEXUS-Brief-v1.html`, `NEXUS-App-v1.html` — tous lus depuis `origin/rebuild/carburants-65-20260922`,
non modifiés) :

- `test_regularisation_manager_20260916-harnais-realigne-1.js` → **24/24**.
- `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` → **14/14**.
- **38/38 assertions métier au vert**, y compris l'assertion qui avait initialement détecté (session
  d'origine, `request-11.md` §5.1) la nécessité de la consolidation du prédicat manager.

Le répertoire de travail temporaire (copies de `nexus-auth.js` assemblé, dépendances candidate,
script d'assemblage) a été supprimé avant ce dépôt — seul le fichier `nexus-auth-restaure-65-20260924.js`
et le présent rapport subsistent dans ce lot.

## 4. Source unique du rôle

```
grep -noP "role\s*===\s*'manager'" nexus-auth-restaure-65-20260924.js
```
→ **une seule occurrence**, ligne 185, à l'intérieur de `nexusEstManager`. Les deux anciennes
occurrences de `employee.role==='manager'||employee.role==='gerant'` ont été remplacées par des
appels à `nexusEstManager(employee)`.

## 5. Diff mesuré

```
candidate-nexus-auth.js (305 lignes) => nexus-auth-restaure-65-20260924.js (759 lignes)
463 insertions(+), 9 deletions(-), un seul fichier
```

Écart de 3 lignes d'insertion par rapport au chiffre cité par `request-11.md` (466/9) : variance de
mise en forme (choix de lignes vides autour des blocs insérés) entre cet assemblage et celui de la
session d'origine, sans effet fonctionnel — confirmé par les 38/38 assertions et par le grep négatif
du périmètre exclu (§1).

## 6. Suite candidate complète vs baseline — NON EXÉCUTÉE, limitation de transport

`decision-9.md` §3 exige d'« exécuter la suite candidate complète et comparer au baseline connu ».
Cette session en a vérifié la faisabilité réelle avant de la déclarer hors de portée :

- `git checkout <ref>`, `git worktree add`, `git archive <ref>` vers un répertoire de travail complet :
  **refusés**, approbation requise indisponible dans ce canal automatisé (même obstacle que documenté
  à chaque réveil précédent de ce lot et du lot prédécesseur).
- `git ls-tree`/`git grep` contre une réf distante : **ne produisent aucune sortie exploitable** dans ce
  canal (testé positivement : une commande de contrôle connue pour retourner du contenu — recherche de
  `function` dans un fichier dont le contenu est déjà lu par ailleurs — ne retourne rien non plus ; ce
  n'est donc pas un filtrage légitime mais une limitation d'outillage).
- Seule voie qui fonctionne : `git show <ref>:<chemin exact>` et `git cat-file -e <ref>:<chemin>`,
  fichier par fichier. La candidate compte **1146 fichiers** (mesuré via `git diff --name-only` contre
  l'arbre vide) dont **224 fichiers `test_*.js`** — matérialiser puis exécuter l'arbre complet par ce
  seul mécanisme dépasse ce qui est raisonnable dans une session.
- Un test représentatif a été inspecté (`test_service_courant_unique_20260905.js`) : il énumère
  `fs.readdirSync(__dirname)` pour vérifier une invariance sur *tous* les fichiers applicatifs présents
  dans le répertoire — il ne peut donner un résultat significatif que dans une copie complète et exacte
  de l'arbre candidate, pas dans un sous-ensemble reconstitué à la main.

**Conclusion honnête** : ce point de preuve n'est pas acquis depuis ce canal. Conformément à
`decision-9.md` §5 (« Si Claude ne peut pas écrire directement sur
`rebuild/carburants-65-20260922`, préparer un commit atomique sur une branche de travail persistante
avec le diff exact et les preuves, puis revenir au rail. Ne pas demander une gate Créateur pour une
limitation de transport Git non-Production. »), ce rapport et le fichier restauré sont déposés sur le
rail pour transport par une session outillée (accès écriture réel à la candidate + `node run-tests.js`
sur l'arbre complet).

Note complémentaire : le transport doit aussi porter les deux fichiers de test déjà réalignés
(`test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` et
`test_regularisation_manager_20260916-harnais-realigne-1.js`, déjà présents dans ce répertoire de lot,
renommés sans le suffixe `-harnais-realigne-1` lors de la pose sur la candidate) — les versions
actuellement sur la candidate (`test_cloture_services_obsoletes_20260916.js` et
`test_regularisation_manager_20260916.js`, sans NEXUS_CONFIG ni chargement de `nexus-page.js`)
échoueraient sinon au démarrage même de `nexus-auth.js` restauré, pour une raison déjà diagnostiquée
et non liée à ce lot (`decision-8.md`).

## 7. Aucune nouvelle régression matérielle constatée

Rien, dans les preuves réellement exécutables depuis ce canal, ne diverge de Production, aucun harnais
n'a échoué sur une assertion métier, aucun élargissement UX/sécurité/rôle/RLS n'a été nécessaire. Le
seul point non acquis est un point d'exécution (§6), pas une contradiction — la classification de
`decision-9.md` §3 (« si une nouvelle régression apparaît, STOP ») ne s'applique donc pas : aucune
régression n'a été observée, seule une preuve reste hors de portée du canal.

## Pour transporter et clore depuis une session outillée

```
git fetch origin claude/issue-28-20260924-0143 rebuild/carburants-65-20260922
git checkout -b lot/carburants-65-restauration-nexus-auth origin/rebuild/carburants-65-20260922
git checkout origin/claude/issue-28-20260924-0143 -- \
  "docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js"
cp "docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js" nexus-auth.js
git checkout origin/handoff-continuite-20260920 -- \
  "docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_cloture_services_obsoletes_20260916-harnais-realigne-1.js" \
  "docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_regularisation_manager_20260916-harnais-realigne-1.js"
cp "docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_cloture_services_obsoletes_20260916-harnais-realigne-1.js" test_cloture_services_obsoletes_20260916.js
cp "docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_regularisation_manager_20260916-harnais-realigne-1.js" test_regularisation_manager_20260916.js
node --check nexus-auth.js
node run-tests.js        # comparer au baseline connu (échecs CONNUS déjà documentés)
git add nexus-auth.js test_cloture_services_obsoletes_20260916.js test_regularisation_manager_20260916.js
git commit -m "fix(65): restaurer nexusEstManager, fuseau site, cycle pilote (decision-9)"
git push origin lot/carburants-65-restauration-nexus-auth:rebuild/carburants-65-20260922
```

## Invariants respectés

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production, aucun
déploiement/promotion Production, aucun changement de rôle/RLS, aucun secret exposé, aucune règle
métier/UX nouvelle. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
