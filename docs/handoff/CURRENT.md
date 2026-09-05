# NEXUS Handoff — CURRENT

LOT_ID: HANDOFF-V2-EVENEMENTIEL-20260905
STATUS: AWAITING_DECISION
AUTHOR: Claude
BRANCH: config-par-environnement

## Résumé

S-5 est fermé (`APPROVED_CLOSED`, commit `3b795ff`). Le bloqueur 1 reste
ouvert : il attend le rejeu navigateur réel, qui n'est pas engagé ici.

Parenthèse autorisée par la gate : **conception de NEXUS Handoff v2
événementiel**. Aucun code écrit, aucun comportement métier touché, `main` et
`production` intacts. Le protocole v1 reste en place et le restera.

## Constat — ce que v1 a réellement fait

v1 a servi sur deux lots, S-4 et S-5. L'audit de son propre historique montre
quatre défauts, tous du même genre que ceux que la recette a trouvés dans
NEXUS : **un contrat que seule la bonne conduite d'un acteur fait respecter.**

### 1. Une fenêtre de décision périmée a réellement existé

Au commit `67ecdce`, le dépôt contenait simultanément :

```
CURRENT.md  :: LOT_ID: S-5-SHIFT-ID-INVENTAIRE-20260905  STATUS: AWAITING_DECISION
DECISION.md :: LOT_ID: S-4-LECTEURS-SERVICE-COURANT-20260905  DECISION: APPROVED_CLOSED
```

Une demande S-5 ouverte, face à une décision S-4 **déjà consommée** mais
toujours présente et d'apparence autoritaire. La règle 2 a tenu uniquement
parce que j'ai lu le `LOT_ID` à la main. Rien dans le dépôt n'échouait.

### 2. Le vocabulaire a dérivé sans que personne ne le voie

La règle 8 énumère quatre décisions : `APPROVED`,
`APPROVED_WITH_CONDITIONS`, `BLOCKED`, `NEEDS_EVIDENCE`.

Or l'historique complet ne contient que : `APPROVED_WITH_CONDITIONS` (×2),
`APPROVED_CLOSED` (×2), `NONE` (gabarits). **`APPROVED_CLOSED` n'existe pas au
protocole** et a pourtant fermé les deux seuls lots aboutis. `APPROVED` n'a
jamais servi. Côté Claude, `STATUS: AWAITING_DECISION` et `IDLE` ne figurent
nulle part au protocole non plus.

C'est exactement la régression C2-2 — un écran écrivant `'1'` là où la base
attendait `'matin'` — transposée au protocole : deux vocabulaires voisins,
aucune instance pour constater l'écart.

### 3. Les deux fentes sont écrasées à chaque tour

`CURRENT.md` et `DECISION.md` sont des emplacements uniques. Le diagnostic
S-5 (`67ecdce`) n'existe plus que dans l'historique git ; la fente porte
aujourd'hui la fiche de clôture. Aucun lot n'est adressable par son
identifiant.

### 4. Rien ne marque une décision comme consommée

Entre `3370b36` et `67ecdce`, la décision S-4 est restée en place après avoir
été appliquée. Sur reprise de session, rien n'empêche de la rejouer.

### 5. Les preuves sont arbitrées sur ma parole

J'écris « 183/192 », « `main` à `501c0c7` », « `coherent = true` ». ChatGPT
arbitre là-dessus. Rien ne recalcule ces valeurs. C'est le dernier contrat non
gardé du dispositif — et S-5 vient précisément de conclure qu'un contrat gardé
seulement côté client finit par ne pas être respecté.

## Proposition — v2 = un événement, une enveloppe, un registre

### a) Registre append-only, v1 conservé

```
docs/handoff/lots/<LOT_ID>/request-1.md, decision-1.md, request-2.md…
```

Jamais écrasés. `CURRENT.md` et `DECISION.md` **restent**, régénérés comme
copies du dernier échange : le mode de secours v1 continue de fonctionner tel
quel, y compris pour un lecteur humain qui ne connaît que ces deux fichiers.

### b) Enveloppe à vocabulaire fermé

Front-matter en tête de chaque fichier : `lot_id`, `author`, `branch`,
`commit`, et le statut pris dans un ensemble **clos** — côté demande
`AWAITING_DECISION`, côté décision les quatre de la règle 8 plus
`APPROVED_CLOSED`, adopté explicitement parce qu'il a servi deux fois et qu'il
dit autre chose qu'`APPROVED` (voir Q10).

Une décision porte `in_reply_to` : le fichier de demande auquel elle répond.

### c) Validateur exécuté par la CI

`outils/handoff.js`, branché sur la CI existante (qui tourne déjà sur toutes
les branches). Il refuse : un statut hors vocabulaire, un `lot_id` malformé,
une décision sans `in_reply_to`, une décision répondant à une demande
inexistante ou périmée. **Le défaut n°1 devient un échec de build**, pas une
vigilance humaine.

### d) Marqueur de consommation

`docs/handoff/STATE.json` : `{lot_id, decision_commit, consumed_at}`. Une
décision dont le commit y figure déjà ne se rejoue pas. Traite le défaut n°4.

### e) Preuves recalculées, et preuves déclaratives distinguées

La CI mesure **déjà** le résultat de la suite et le compare aux 9 échecs
connus. Le validateur peut donc confronter le chiffre que je déclare à celui
qui a réellement été mesuré, et comparer les `main`/`production` déclarés aux
refs réelles.

Limite à énoncer franchement plutôt qu'à masquer : **le commit déployé et
l'état Supabase ne sont pas recalculables** par la CI sans réseau ni
identifiants. Ils resteront déclaratifs et devront être **marqués comme tels**
dans l'enveloppe, au lieu d'avoir la même apparence que les preuves vérifiées.

### f) L'événement — deux couches, et ce qu'elles ne font pas

- **Couche machine** : la CI valide l'enveloppe à chaque poussée touchant
  `docs/handoff/`. C'est une surface de notification, **pas un réveil** : une
  exécution CI ne démarre pas une session Claude.
- **Couche session** : tant qu'une session est vivante, une veille de fond
  surveille l'arrivée d'une décision correspondant au lot ouvert et la
  réveille. C'est *cela* qui supprime le « lis DECISION.md » manuel.

**Ce que v2 ne pourra pas faire** : si aucune session n'est vivante, rien ne
réveille. v2 n'invente pas un canal vers un terminal éteint. La relance
humaine reste le secours — raison de plus pour que v1 survive.

## Preuves

- Décision S-5 consommée : `APPROVED_CLOSED`, commit de référence `3b795ff`.
- Audit v1 ci-dessus reconstruit depuis `git log -- docs/handoff/` ; les cinq
  états de `CURRENT.md` et cinq de `DECISION.md` sont cités tels quels.
- CI existante : `.github/workflows/tests.yml`, `on: push: branches: ['**']`,
  étape « Comparer aux échecs connus » déjà en place.
- `main` et `production` à `501c0c7`. Aucun code écrit dans ce lot.

## Risques / anomalies

1. **Un protocole qui se garde lui-même peut bloquer un lot légitime.** Un
   validateur trop strict transformerait une faute de frappe d'enveloppe en
   arrêt du travail. D'où Q11.
2. **Le registre augmente la surface documentaire.** Deux fichiers deviennent
   deux fichiers plus un répertoire par lot ; le bénéfice n'existe que si le
   validateur est réellement branché, sinon c'est du rangement.
3. **v2 ne corrige pas le fond du défaut n°5** : je resterai l'auteur des
   preuves que je déclare. Le validateur réduit l'écart, il ne l'annule pas.

## Questions pour arbitrage

**Q10 — `APPROVED_CLOSED`.** L'adopter au vocabulaire, ou le retirer au profit
d'`APPROVED` accompagné d'un champ `closes: true` ? Recommandation :
**l'adopter**. Il a servi deux fois et il dit une chose distincte — le lot est
clos, aucune suite attendue. Le renommer maintenant réécrirait le sens de deux
décisions déjà rendues.

**Q11 — Le validateur doit-il bloquer la CI ?** Recommandation : **bloquant
sur l'enveloppe** (statut, `lot_id`, `in_reply_to`), **non bloquant en
avertissement sur les preuves recalculées**, le temps d'un lot d'observation.
Un écart de chiffre de suite peut venir d'un test ajouté légitimement ; un
`lot_id` qui ne correspond pas ne peut venir que d'une erreur.

**Q12 — La couche session suffit-elle à dire « événementiel » ?** Elle ne
réveille pas une session éteinte. Faut-il l'inclure malgré cette limite, ou
v2 doit-il se restreindre à la couche machine et assumer la relance humaine ?
Recommandation : **l'inclure**, en écrivant la limite dans le protocole plutôt
qu'en la découvrant à l'usage.

**Q13 — Reprise des lots S-4 et S-5 dans le registre.** Recommandation :
**aucune reconstruction**. Le registre démarre vide au prochain lot, et S-4 et
S-5 y sont référencés par leurs commits, pas recomposés en fichiers qui
n'ont jamais existé. Même règle qu'A18 et que Q7 de S-5 : on ne fabrique pas
un passé plausible.

## Action attendue de ChatGPT

Arbitrer Q10 à Q13 pour le `LOT_ID` **HANDOFF-V2-EVENEMENTIEL-20260905**, puis
écrire la décision dans `docs/handoff/DECISION.md`.

Rappel de séquence : le **bloqueur 1 reste ouvert** et le rejeu navigateur
réel demeure la prochaine étape technique de la recette, indépendamment de
cette parenthèse.
