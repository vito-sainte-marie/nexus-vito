# NEXUS Incidents — enregistrement et clôture

## Mission

Fermer la boucle entre « la chaîne s'est arrêtée » et « la leçon est devenue
un contrôle ». Ce skill ne juge pas si un arrêt est légitime — `classerArret`
(`outils/watchdog-stagnation.js`, P3) tranche seul, et ce skill ne le
requalifie jamais. Il décrit ce qui précède l'écriture (l'enregistrement,
désormais automatique) et ce qui la suit (la clôture, qui reste un geste
réfléchi).

## Autorité

Outillage, garde, test, mutation et câblage CI, pré-autorisés par
`OUTILLAGE_A_POSTERIORI`, `PREAUTORISATIONS_CLAUDE` et
`COMMIT_PUSH_RAIL_SANS_GO` (CLAUDE.md, decision-1 du lot
NEXUS-INCIDENTS-CI-1-20261014). Promouvoir une leçon dans `RULES.json` reste
une écriture sur le rail comme une autre ; ce skill ne donne aucune autorité
Production.

## Ce qui est automatique

Depuis le lot NEXUS-INCIDENTS-CI-1-20261014, le job `enregistrement-incident`
de `.github/workflows/tests.yml` observe le seul verdict que la boucle
autonome (étape `boucle_autonome` du job `non-regression`) classe comme
devant notifier un humain, et appelle `outils/enregistrer-incident.js` :

1. `classerArret` qualifie le code du verdict (famille, orpheline, humain).
2. Un arrêt humain voulu (famille `DECISION_HUMAINE` — `STOP_ARBITRE`,
   `BLOQUE`, `STOP_HUMAIN`, `VERDICT_REPETE`, `PLAFOND_LOT_ATTEINT`,
   `PLAFOND_JOUR_ATTEINT`…) rend `NON_ENREGISTRE` : ce n'est pas un incident,
   rien n'est écrit. Préserver ces arrêts en `NON_ENREGISTRE` est une
   condition retenue par l'arbitre ; l'étendre à un nouveau code suppose de
   relire `FAMILLES` dans `watchdog-stagnation.js`, jamais de le décider à la
   volée dans ce skill.
3. Sinon, une ligne `OUVERT` est ajoutée à `docs/learning/INCIDENTS.jsonl`
   (append-only, idempotent par `id = hash(code, lot, sha)`).
4. Si ce `code` était déjà apparu au journal (une VRAIE récurrence, sous un
   autre `id`), `outils/compteur-repetitions.js` ajoute une ligne à
   `docs/learning/REPETITIONS.jsonl` — jamais un compteur réécrit, toujours
   une ligne de plus. Le total se lit en comptant les lignes, jamais dans un
   champ stocké.
5. Le commit et le push se font sous lease (tête du rail lue au début du
   job), dans un groupe `concurrency` dédié qui ne s'annule jamais
   (`cancel-in-progress: false`) : un enregistrement en cours n'est jamais
   coupé par un run plus récent, il est mis en file.

Rien dans cette chaîne ne relance la CI ni Claude : le push utilise les
identifiants persistés par `actions/checkout`, qui ne déclenchent aucun
workflow sur ce dépôt.

## Ce qui reste un geste réfléchi — la clôture

Une ligne `OUVERT` n'est pas une clôture. `INCIDENTS.jsonl` est en ajout
seul : son `statut` n'est jamais réécrit en `FERME` par aucun outil
aujourd'hui. La clôture se lit par le lien vers `EXPERIENCE.jsonl`, comme
pour `INC-1b3e3a7d6d30` (14/10/2026, lot NEXUS-REPARATION-HANDOFF-1) :

1. **Diagnostiquer** la cause réelle de l'arrêt (pas seulement son `code`) —
   lire le journal du run nommé par l'incident, identifier le maillon et la
   garde absente ou insuffisante.
2. **Corriger** : écrire la garde, le test, la mutation. Un rejeu manuel qui
   « règle » l'incident une fois ne clôt rien si rien n'empêche la récidive
   (GOV-002 : « a twice-solved problem should not require a third identical
   human analysis »).
3. **Promouvoir** la leçon : une ligne dans `docs/learning/EXPERIENCE.jsonl`
   (`date`, `type`, `component`, `incident: <id>`, `cause`, `impact`,
   `resolution`, `promoted_rule: <ID>`), et la règle elle-même dans
   `docs/learning/RULES.json`, avec son `id` au prochain rang de la famille
   `GOV-*` (ou la famille concernée). `outils/verifier-apprentissage.js`
   refuse un doublon, un id invalide, ou une récurrence non promue.
4. Un geste qui promet une promotion sans l'écrire n'est pas une clôture :
   GOV-007 (« a condition retained only in prose is not a control »)
   s'applique identiquement ici — une leçon qui ne vit que dans ce fichier ou
   dans la prose d'une décision n'a rien fermé.

## Ce que ce skill ne fait pas

- Il ne requalifie pas un arrêt : `classerArret` est l'unique classeur
  (principe P3, répété depuis le 14/10/2026).
- Il n'invente pas de statut `FERME` : tant qu'aucun outil ne l'écrit, un
  incident réputé clos se vérifie par le lien `EXPERIENCE.jsonl`, pas par un
  champ qu'on espère voir un jour réécrit.
- Il n'autorise aucune promotion sur Production ni aucun secret.

## Récurrence — quand la regarder

`outils/compteur-repetitions.js` expose `total(code, { racine })`, qui compte
les lignes de `REPETITIONS.jsonl` pour un `code`. Une récurrence n'appelle pas
automatiquement une clôture plus sévère : elle dit seulement qu'une famille
d'arrêt déjà vue revient, information que l'étape « diagnostiquer »
ci-dessus doit lire avant de proposer une correction — une leçon promue une
fois qui n'a pas empêché la deuxième occurrence n'a pas tenu sa promesse
(GOV-002).

## Critère de succès

Le skill fonctionne lorsque chaque incident `OUVERT` reçoit, avant d'être
considéré clos, un diagnostic réel, une correction câblée et une ligne dans
`EXPERIENCE.jsonl` + `RULES.json` — jamais une promesse de promotion qui
reste dans un commentaire ou une demande Handoff.
