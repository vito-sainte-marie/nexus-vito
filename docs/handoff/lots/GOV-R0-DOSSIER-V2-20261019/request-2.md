---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R0-DOSSIER-V2-20261019
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
---
# GOV-R0-DOSSIER-V2-20261019 : dépôt documentaire du dossier de gouvernance V2

> **Cette request-2 remplace la request-1 du lot.** La request-1 (`840102e7`) ne déclarait pas `wake_to` : le run « Tests » 39328910982 a arrêté le réveil (`RAIL_SANS_ADRESSE`) et sauté le relais vers l'arbitre. Le contenu ci-dessous est identique à celui de la request-1 ; seule change la déclaration `wake_to` (issue #28). L'arbitre est prié de répondre à cette request-2 ; la request-1 n'a reçu aucune décision.

**Domaine :** gouvernance.
**Préparé par :** Claude Guardian. **Publié par :** Claude Code, selon la procédure actuelle.
**Nature :** documentation seulement. Aucune règle active n'est modifiée.

## Objet

Déposer sur le rail le dossier de gouvernance V2 (`docs/gouvernance/v2/` et `docs/guardian/`). C'est l'étape R0 du plan révisé. Frédéric a donné en conversation un accord de principe sur ce dépôt documentaire (niveau b), puis, le 19/10/2026, un GO opérationnel sur la séquence « corriger le dossier, consommer `decision-3`, déposer R0 ». Ni l'un ni l'autre n'est la décision de doctrine que ce lot demande.

Ces textes n'existent aujourd'hui que dans des conversations. Or seul le rail fait foi.

## Fichiers ajoutés (13)

Référentiel de gouvernance, sous `docs/gouvernance/v2/` :
- `README.md`
- `CHARTE-ROLES-V2.md`
- `PROPOSITIONS-CONCEPTION-20261019.md`
- `sources/proposition-chatgpt-20261019.txt`
- `PLAN-RACCORDEMENT-GUARDIAN.md`
- `MATRICE-VARIANTES-BOUCLE-V2.md`

Espace Guardian, sous `docs/guardian/` (organisation proposée par le contre-audit de ChatGPT du 19/10/2026) :
- `README.md`
- `constats/CONSTATS-20261019.md`
- `preuves/MESURES-REFERENCE-20261008-20261018.md`
- `preuves/mesures-20261008-20261018/` : `mesurer-boucle.py`, `tours.csv`, `arrets-humains.csv`, `mesures.json`

Guardian n'a aucun droit d'écriture sur le contenu du dépôt : il prépare dans son espace de travail, et l'intégration relève de Claude Code dans un lot autorisé. Sa seule écriture prévue est un commentaire sur l'issue dédiée, après R1.

## Ce que ce lot ne fait pas

- Il ne modifie ni `CLAUDE.md`, ni `PROTOCOL.md`, ni `ARBITRAGES-ACQUIS.json`, ni `ARBITRE-CHATGPT.md`, ni aucun workflow, garde ou outil.
- Il ne réduit aucun motif de réveil.
- Il ne change aucune permission, aucun secret, aucune identité.
- Il n'arme rien. Il ne touche ni à `main`, ni à `production`, ni à Supabase.
- Le script `mesurer-boucle.py` n'est appelé par aucun workflow. Il lit l'API GitHub et écrit dans le dossier passé en 3e argument (par défaut, le dossier courant).

## Preuves

1. Le diff applicatif ne contient que des fichiers ajoutés sous `docs/gouvernance/v2/` et `docs/guardian/` (en plus des fichiers du lot produits par l'outil).
2. `node outils/handoff.js verifier` reste vert.
3. La suite de non-régression ne change pas. Mesure de Guardian sur le rail à `851f31bd` : 341/350 avec et sans le dossier, mêmes échecs (tests liés au fuseau horaire de son environnement). Claude Code remesure sur son poste au moment de publier.
4. Le texte source du 19/10 est une **proposition de ChatGPT**, pas un message de Frédéric. Son empreinte sha256 `33df10f3f6373b932530a78c2ddd20761843f396f20e38991d436917ad2156ed` ne garantit que l'intégrité du texte.
5. Les chiffres de référence sont **reproduits par le même script, non vérifiés indépendamment** : `python3 docs/guardian/preuves/mesures-20261008-20261018/mesurer-boucle.py 2026-10-08T00:00:00Z 2026-10-18T12:50:00Z <dossier-hors-depot>`. Le script a été modifié pour ajouter ce paramètre (sha256 `6584f5582ae15b140753f436ff4250284404de979b0872621bc7039ee29471f3`) ; la version modifiée a été rejouée le 19/10/2026 et redonne les mêmes fichiers.

## Dépendances et points ouverts

- **Lot actif.** Au 19/10/2026, le lot actif est `SECURITE-DEFINER-ETAPE5-20261018`. Une dérogation n'est pas possible : `handoff.js` (l. 920) refuse toute nouvelle demande tant qu'un lot actif porte une décision. Condition minimale, vérifiée sur une copie jetable du rail : la `decision-3` (confirmée par Frédéric, provenance de niveau 2, voir `docs/deploiement/provenance-decision-3-etape5-20261019.md`) est prise en charge puis consommée avec une preuve d'action ; ETAPE5 passe en `DECISION_CONSOMMEE`, **sans clôture**. La demande R0 doit désigner `--rail handoff-continuite-20260920`.
- **Incident SQL de l'étape 5.** Exécutant, heure, cible et GO inconnus. Il reste ouvert ; ce lot ne le clôt pas.

## Décision demandée

Dépôt de doctrine cible : motif `CHANGEMENT_DOCTRINE`, palier de Frédéric. L'accord de principe de Frédéric a été exprimé en conversation (niveau b), pas inscrit sur le rail ; ce lot lui demande le GO formel sur le contenu exact ci-dessus, y compris la confirmation point par point du tableau de `PROPOSITIONS-CONCEPTION-20261019.md`.

**Question :** Frédéric autorise-t-il l'inscription de ce dossier comme cible non appliquée ?
