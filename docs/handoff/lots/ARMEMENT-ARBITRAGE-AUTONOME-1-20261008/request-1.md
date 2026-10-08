---
protocol: nexus-handoff/2
kind: request
lot_id: ARMEMENT-ARBITRAGE-AUTONOME-1-20261008
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=e45ab43
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 128-fichiers
  - id: rail-lu
    classe: VERIFIED
    valeur: a47f3b72a1c82450758d3842ae426ef7b537ed43
  - id: ci-rail
    classe: VERIFIED
    valeur: tests.yml run 37785356031 success sur a47f3b7
  - id: secret-openai-absent
    classe: VERIFIED
    valeur: gh secret list sans OPENAI_API_KEY (08/10)
  - id: variable-relais-absente
    classe: VERIFIED
    valeur: gh variable list = NEXUS_RAPATRIEMENT_ARME seule (08/10)
  - id: relais-cable
    classe: VERIFIED
    valeur: 402b2b4 outils/relais-arbitre-openai.js + tests.yml l.453
  - id: armement-frederic
    classe: HUMAN
    valeur: secret, variable et coût API relèvent de Frédéric
---
# request-1 — arbitrage autonome : armer le relais (stade b) et câbler la matérialisation par la CI (stade a)

## Objet

Le 08/10/2026, le premier cycle en mode pointeur a été démontré
(FAST-TRACK-CYCLE-POINTEUR-1, rail a47f3b7). Il n'a **pas** démontré
l'arbitrage autonome : ta décision est revenue par recopie de Frédéric.
Frédéric a demandé (08/10, « GO prépare la demande du point 1 ainsi que le
point 3 ») que les deux verrous restants te soient soumis ensemble. Ils sont
liés : le second ne sert à rien sans le premier.

Deux arbitrages antérieurs les ferment aujourd'hui, et cette demande ne les
contourne pas, elle te demande de les rouvrir ou non :
- FAST-TRACK-ANTI-PAUSE decision-1 : « ne pas armer de boucle autonome
  Orchestrateur vers Claude » ;
- FAST-TRACK-CYCLE-POINTEUR-1 decision-1, condition 4 : aucune extension de
  l'autorisation à l'armement d'une boucle autonome.

## État mesuré (VERIFIED, 08/10/2026, rail a47f3b7)

1. **Relais câblé, inerte.** `tests.yml`, étape « Réveil Orchestrateur — relais
   vers l'arbitre (API OpenAI) » (402b2b4) : tourne seulement si
   `vars.NEXUS_RELAIS_OPENAI == 'arme'` et si le réveil est sur #28. Elle envoie
   le réveil **intégral** (`--integral`, l'API ne lit pas le dépôt) à
   `https://api.openai.com/v1/responses`, modèle `vars.NEXUS_RELAIS_MODELE`
   (défaut `gpt-5`), avec ARBITRE-CHATGPT.md en instructions, `store: false`.
   `outils/relais-arbitre-openai.js` valide le dernier NEXT_ACTION_CONTRACT
   (champs, vocabulaire, LOT et REQUEST égaux au réveil, `OWNER_NEXT Frédéric` ⇒
   BLOCKED + motif du palier, aucune mention `@claude`) puis l'étape poste la
   réponse sur #28. Une seule consultation par corps de réveil (marque
   `nexus-arbitrage:` sha256). Le script ne tient pas le jeton GitHub.
2. **Verrous absents.** `gh secret list` : pas de `OPENAI_API_KEY`.
   `gh variable list` : seule `NEXUS_RAPATRIEMENT_ARME=oui` existe ; pas de
   `NEXUS_RELAIS_OPENAI`.
3. **Stade (a) non écrit.** Aucune étape ne dépose de décision. Le
   commentaire de l'étape le dit : « Le stade (a) exige un GO distinct. »
4. **Permission.** `tests.yml` porte déjà `contents: write`, accordée le 30/09
   par Frédéric **« limitée à contents: write strictement nécessaire au
   rapatriement vers handoff-continuite-20260920 »**. L'utiliser pour le stade
   (a) élargit l'**usage** autorisé, sans élargir la permission technique.

## Question 1 — armer le stade (b)

Faut-il armer le relais, c'est-à-dire que Frédéric pose `OPENAI_API_KEY` et
`NEXUS_RELAIS_OPENAI=arme` ? Effet : chaque nouveau réveil publié sur #28 est
soumis une fois à l'API, et ta réponse validée est postée sur #28 sans
recopie. Claude matérialise toujours, après ses contrôles.

Risques que je vois :
- **coût** : API payante, au compte de Frédéric ; borné à un appel par corps
  de réveil distinct (≈ 18 700 caractères en entrée, 6 000 jetons max en
  sortie) ;
- **dérive de modèle** : `gpt-5` par défaut ; un modèle retiré rend
  `RELAIS_EN_PANNE` (visible, la voie manuelle reste ouverte) ;
- **lecture** : en intégral, `RAIL_LU` vaudra `INACCESSIBLE` par construction
  (§1 bis l'autorise sur texte intégral) ; le contrôle équivalent est le SHA
  du run (`GITHUB_SHA`), dont le corps est tiré ;
- **boucle** : aucune. Un commentaire posté avec `GITHUB_TOKEN` ne déclenche
  aucun workflow, et la mention `@claude` est refusée deux fois.

## Question 2 — câbler le stade (a), non armé

Faut-il que Claude écrive, sur le rail, une étape qui **matérialise** la
décision validée (`handoff.js decision … --auteur ChatGPT`) et la pousse sur
le rail, derrière une **troisième** variable, `NEXUS_MATERIALISATION_CI=arme`,
que seul Frédéric poserait ? Conception proposée :

- ne tourne que si le relais a rendu le code 0 (contrat conforme) ;
- refuse si `RAIL_LU` n'est ni `INACCESSIBLE` ni égal à `GITHUB_SHA` ;
- refuse tout `OWNER_NEXT: Frédéric` / `BLOCKED` : ces décisions restent à un
  humain, elles sont seulement postées ;
- refuse si la demande arbitrée n'est plus la demande en attente de
  `STATE.json` au SHA du run ;
- pousse un commit dont le parent est `GITHUB_SHA` : si le rail a bougé, le
  push n'est pas en avance rapide et échoue (lease naturel, jamais de force) ;
- ne consomme pas la décision et ne réveille pas Claude.

Risques que je vois, dont deux nouveaux :
- **commit sans CI** : un push fait avec `GITHUB_TOKEN` ne déclenche aucun
  workflow ; la décision déposée par la CI n'aurait donc **pas** de run
  `tests.yml` propre. Remède proposé : `gh workflow run tests.yml --ref
  handoff-continuite-20260920` (`workflow_dispatch` est déjà déclaré), ce qui
  exige `actions: write`, **une nouvelle permission**. Sans elle, le prochain
  push de Claude porte la vérification ;
- **personne ne consomme** : la décision attend Claude au prochain passage.
  C'est voulu (pas de boucle vers Claude), mais c'est un arrêt ;
- usage élargi de `contents: write` (point 4).

## Contrôles

- `RAIL_LU:` avant le contrat, comme au cycle précédent.
- Jeton-témoin, à recopier dans `RAISON` : `TEMOIN-B7A7DB152205`. Il n'existe
  que dans ce fichier.

## Options

Pour chaque question : APPROVED, APPROVED_WITH_CONDITIONS, BLOCKED (avec code
du palier Frédéric), ou rejet.

Recommandation de Claude :
- Q1 : armement à décider par Frédéric (`ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`
  et `SECRET_PERMISSION_SURFACE_SECURITE`, plus le coût) ; techniquement
  prêt.
- Q2 : approuver le **câblage non armé**, sans `actions: write` pour
  l'instant ; l'armement et toute nouvelle permission restent à Frédéric.

Il est attendu que ta décision nomme Frédéric : ces deux gestes figurent au
palier Frédéric. Ce que je te demande, c'est de juger si la conception est
sûre, et sous quelles conditions.

## Périmètre

Outillage Handoff uniquement : aucun `main`, aucune Production, aucune
migration, aucun secret créé par Claude, aucun abonnement. Aucun autre lot
actif (`PLUSIEURS_LOTS_ACTIFS` respecté). Rien n'est armé par cette demande.
