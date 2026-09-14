---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: reveil
    classe: VERIFIED
    valeur: 7 epreuves, 5 mutations tentees 5 detectees
  - id: recette-ui
    classe: VERIFIED
    valeur: 11 epreuves, 6 mutations tentees 6 detectees ; selecteurs sondes contre le vrai ecran
  - id: recette-bout-en-bout
    classe: HUMAN
    valeur: jamais executee entierement — aucune session locale ne dispose du PIN
  - id: semis-test
    classe: DECLARED
    valeur: cable en CI ; secret SUPABASE_TEST_DB_URL_WRITE a creer par Frederic
  - id: cron
    classe: NOT_APPLICABLE
    valeur: declencheur non pose — exige une modification de main, interdite par decision-4
  - id: suite
    classe: VERIFIED
    valeur: 198/207
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Request-1 — sortir Frédéric de la boucle sur les tâches déterministes

`decision-4.md` de CARB-004 appelle explicitement un « futur lot d'orchestration
qui reprendra proprement la dette de REPAIR-1 (Guardians/CI et recette
navigateur), depuis le HEAD canonique courant ». Ce lot l'ouvre, et y ajoute le
réveil automatique demandé par Frédéric le 07/09.

Trois outils sont posés et prouvés sur le HEAD canonique. **Aucun ne s'active de
lui-même** : deux sont câblés en CI derrière une condition de branche, le
troisième attend une décision qui n'est pas la mienne.

## 1) Réveil automatique — `outils/reveil-handoff.js`

Le Handoff est déjà un bus d'événements ; il lui manquait une horloge. Jusqu'ici
il fallait que Frédéric écrive « @claude » sur l'issue #28 même quand la décision
attendait, déposée et lisible, dans le registre — l'humain servait de facteur
entre deux agents, ce que la gouvernance autonome v2 lui interdit précisément.

L'outil répond à une seule question — « reste-t-il une décision déposée que
personne n'a consommée ? » — et **ne fait rien d'autre** : ni consommation, ni
écriture, ni push. Un planificateur l'appelle et n'ouvre une session que si la
réponse est oui.

Le point qui le rend utilisable plutôt que bruyant : il distingue

- `DECISION_NON_CONSOMMEE` — il y a du travail, réveil ;
- `DECISION_PERIMEE` — une décision existe mais répond à une demande qui n'est
  plus l'active. `handoff.js consommer` la refuserait ; réveiller Claude
  produirait un run condamné, que GOV-001 interdit ensuite de rejouer. **Pas de
  réveil** : c'est un appel à l'humain.

Sur l'état réel juste avant la consommation de `decision-4`, il répondait
correctement « pas de réveil, decision-3 répond à request-3 mais la demande
active est request-4 ». Après consommation : « rien à réveiller ».

Preuves : 7 épreuves sur registres jetables ; 5 mutations tentées, 5 détectées
(réveil sur décision périmée, perte du filtre des lots consommés, réveil sur
registre illisible, sortie Actions muette, code de sortie non nul quand tout va
bien). La lecture du registre est empruntée à `handoff.js` et non réécrite
(ARCH-001) ; `handoff.js` expose donc `lots`/`echanges`/`dernier` et garde son
CLI derrière `require.main`.

**Ce qui manque, et que je ne peux pas faire.** Un `schedule` ne peut vivre que
sur la branche PAR DÉFAUT du dépôt — GitHub ne lit les workflows planifiés que
là. Le déclencheur suppose donc une modification de `main`, que `decision-4`
vient d'interdire à l'Orchestrator (« aucune nouvelle modification de main »).
Le patch est de quatre lignes sur `.github/workflows/claude.yml` :

```yaml
on:
  schedule:
    - cron: '*/30 * * * *'   # toutes les 30 minutes
  # … déclencheurs existants inchangés
```

avec une étape préalable qui appelle `outils/reveil-handoff.js` et n'exécute
Claude que si `reveil == true`. **Je ne l'ai pas appliqué.** Question posée en
fin de document.

## 2) Recette navigateur — `outils/recette-navigateur-test.js`

`decision-4.md` (Q69) rattache l'automatisation de la recette à ce lot. Elle est
écrite.

Le PIN était déjà au bon endroit depuis le 07/09 — dans le secret
`NEXUS_TEST_PIN`, illisible hors d'un run. Ce qui manquait n'était pas l'accès,
c'était ce fichier : `outils/recette-navigateur-test.js` de la branche REPAIR-1
n'était qu'un vérificateur de préconditions, attendait des noms de secrets
inexistants, et n'a jamais contenu de scénario.

Deux choix qui décident de sa valeur :

- **Il lit l'objet produit par la chaîne, pas le texte affiché.** Un total de
  36 000 L peut venir d'un arrondi vers le haut sur deux carburants en sécurité,
  sans que la phase corrigée par CARB-004 soit exercée. Une recette qui se
  contenterait du chiffre afficherait vert sur un moteur non corrigé. Elle exige
  donc `reliquatArrondi.recupereL === 1000`, crédité au `go`, et un refus `sp95`
  dont le motif nomme la capacité.
- **Il attend que NEXUS Test serve réellement le commit testé** avant de juger.
  Cloudflare déploie de façon asynchrone ; juger trop tôt prouverait la version
  précédente, ce que `decision-2.md` interdisait explicitement. Si la version ne
  vient pas, il le dit et ne bloque pas — il ne prouve pas autre chose.

Le PIN ne circule que vers le champ du formulaire. Un contrat de source le
vérifie : l'identifiant `pin` ne peut apparaître qu'à deux endroits, la signature
qui le reçoit et le `.fill()` qui le saisit. Ce contrat a attrapé deux fuites
simulées, dont une dans un `throw` — que sa première version, ligne à ligne,
laissait passer.

Preuves : 11 épreuves ; 6 mutations tentées, 6 détectées. Sélecteurs sondés
contre le **vrai** écran de connexion NEXUS Test : les trois locators résolvent
chacun exactement un élément, et l'extracteur de version lit le commit servi
depuis `nexus-build.js`. **Aucun PIN n'a été saisi par cette sonde** — la recette
complète n'a donc pas encore tourné de bout en bout ; elle le fera au premier
run CI sur la branche canonique.

## 3) Écriture Supabase Test — câblage CI

Le semis est versionné depuis le 07/09 (`outils/recette-carburants-test.sql`,
idempotent et non destructeur). Il lui manquait un moyen de s'exécuter : le rail
n'injecte qu'une URL **read-only**.

`tests.yml` porte désormais deux étapes, sur la branche canonique uniquement :
décomposition de `SUPABASE_TEST_DB_URL_WRITE` — exactement le motif éprouvé de
`claude.yml`, mot de passe masqué avant d'exister ailleurs, `psql` lancé sans
aucun argument de connexion — puis le semis. Sans le secret, l'étape se déclare
indisponible et passe (ENV-003).

Défaut corrigé avant de pousser : les deux étaient dans le **même** step, or
`$GITHUB_ENV` ne prend effet qu'au step suivant — `psql` serait parti sans
aucune connexion, pour un rouge incompréhensible.

**Le secret `SUPABASE_TEST_DB_URL_WRITE` reste à créer par Frédéric.** Un rôle
Test en écriture, jamais `service_role`, jamais une URL Production. Je ne le
génère pas et je ne le manipule pas.

## 4) Ce que ce lot ne fait PAS

- Aucun rapatriement des Guardians (`guardians-router.js`,
  `verifier-apprentissage.js`) : `decision-2.md` de REPAIR-1 en fixe les huit
  critères de sortie, et les traiter dans le même lot mélangerait deux chantiers.
- Aucune correction de la dette « capacité surestimée sur stock projeté
  négatif » : `decision-4.md` (Q68) exige un lot distinct.
- Aucune modification `main`, aucune Production, aucun merge.

## 5) Guardians

- **Architecture & Cohérence** : PASS — la lecture du registre reste chez
  `handoff.js` ; aucune seconde vérité créée.
- **Security & Isolation** : PASS — Test uniquement ; PIN jamais journalisé,
  contrat de source à l'appui ; mot de passe masqué avant usage ; aucun
  `service_role` ; `production` inchangée.
- **Business Rules** : PASS — la recette exige le mécanisme CARB-004, pas
  seulement son résultat.
- **QA/Regression** : PASS — 198/207, les 9 échecs connus inchangés ; 11
  mutations tentées sur les deux outils, 11 détectées.
- **Bible/Philosophie** : PASS — chaque outil dit ce qu'il ne sait pas plutôt
  que de laisser croire qu'une preuve existe.

## 6) Limites honnêtes

1. La recette navigateur n'a jamais tourné de bout en bout : sans PIN, aucune
   session locale ne peut le faire. Seuls les sélecteurs et l'extracteur de
   version sont vérifiés contre le vrai site.
2. Le réveil n'a pas de déclencheur tant que `main` reste fermée (§1).
3. Le semis n'a pas de secret d'écriture tant que Frédéric ne l'a pas créé.
4. Playwright est installé à la volée en CI (`--no-save`) plutôt qu'ajouté aux
   dépendances : le dépôt reste « sans étape de build », comme son
   `package.json` le revendique.

## 7) Production

`NOT_APPLICABLE` — aucune requête, aucun merge, aucun déploiement.

## Questions à arbitrer

**Q70 — Le `schedule` sur `main` est-il autorisé ?** `decision-4` interdit à
l'Orchestrator toute nouvelle modification de `main`, et le déclencheur ne peut
vivre nulle part ailleurs. Sans lui, le réveil reste un outil que personne
n'appelle. Recommandation : **oui, sur autorisation humaine explicite de
Frédéric**, quatre lignes, aucun code métier — ou bien renoncer au cron et
déclencher par `repository_dispatch` depuis l'Orchestrator, qui n'exige aucune
écriture sur `main` mais suppose un token dédié.

**Q71 — La recette navigateur doit-elle bloquer la CI dès son premier run ?**
Elle n'a jamais tourné entièrement. Recommandation : **non bloquante au premier
run**, puis bloquante une fois un vert observé — une garde dont le premier
verdict est rouge pour une raison d'outillage se fait retirer.

**Q72 — Le rapatriement Guardians rejoint-il ce lot ou reste-t-il séparé ?**
Recommandation : **un sous-lot distinct**, avec les huit critères de
`decision-2.md` de REPAIR-1 comme conditions de sortie.
