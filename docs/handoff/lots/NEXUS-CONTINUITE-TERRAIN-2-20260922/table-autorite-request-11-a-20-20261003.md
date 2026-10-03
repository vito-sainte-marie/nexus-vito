# Table d'autorité — `request-11.md` à `request-20.md` du lot `NEXUS-CONTINUITE-TERRAIN-2-20260922`

Déposée au titre de **Q76** (arbitrage a posteriori, outillage/rail/gouvernance — aucun
choix métier, aucun secret, aucune Production, aucun `main`). Réponse au réveil du
03/10/2026 (issue #28) : « remettre le lot dans un état déterministe, append-only et
vérifiable, sans réécrire l'histoire et sans créer une nouvelle boucle de requests ».

Ce document n'est ni une demande ni une décision au sens `nexus-handoff/2` : il ne porte
pas le préfixe `request-`/`decision-` et `outils/handoff.js` ne le lit pas (confirmé —
`echanges()` ne filtre que sur ces deux préfixes). C'est une pièce de dossier, au même
titre que `classement-gates-etat-git-62-65-1.md` déjà présent dans ce répertoire.

## Méthode

Chaque ligne cite soit une décision canonique déjà consommée, soit un commit/fait du rail
vérifiable indépendamment de ce que la demande affirmait d'elle-même. Aucune ligne ne
repose sur une inférence non sourcée. Les SHA de dépôt sont lus par
`git log --format=%h -- <fichier>` sur ce checkout (HEAD exactement
`handoff-continuite-20260920` au moment de cette rédaction — vérifié avant toute lecture,
voir §3).

## Table

| Demande | Dépôt (SHA, date) | Classement | Réponse canonique / preuve ultérieure exacte |
|---|---|---|---|
| `request-11.md` | `19288fe`, 2026-09-23 | **CONSOMMÉE** | `decision-9.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, `in_reply_to: request-11.md`), déposée `c9e0b76` et marquée `DECISION_CONSOMMEE` par `outils/handoff.js consommer` (commit de consommation `44fc13a`, 2026-09-24). Ne pas doubler — conforme à l'état à respecter du réveil. |
| `request-12.md` | `57e6a2d`, 2026-09-24 | **DÉPASSÉE** | Pose une question ouverte à deux branches (« qui transporte le fichier restauré vers la candidate ? »). Résolue par l'exécution réelle, pas par un arbitrage écrit : le commit `a31b2e4` (« fix(#65): restaurer nexus-auth.js prouvé sur la candidate », 2026-09-24, branche `rebuild/carburants-65-20260922`, confirmé présent dans ce dépôt par `git cat-file -t`) transporte exactement le blob annoncé par `request-12.md` — `request-14.md` §1 le constate lui-même par comparaison d'empreinte de blob (`a0b2acc5...` identique). Le contenu de `request-12.md` (harnais 38/38, diff mesuré, vérification négative) n'est jamais contredit ensuite ; il est repris tel quel comme acquis par `request-14.md`/`request-16.md`, eux-mêmes couverts par `decision-10.md` (voir ligne `request-16.md`). |
| `request-13.md` | `f922813`, 2026-09-24 | **DÉPASSÉE** | Compte rendu de blocage de transport, explicite lui-même : « rien à consommer, `request-12.md` attend légitimement ». Ne pose aucune question propre au-delà de celle déjà posée par `request-12.md`. Dépassée par le même fait que la ligne précédente (transport réel `a31b2e4`, mesuré par `request-14.md`). |
| `request-14.md` | `5b5b86c`, 2026-09-24 | **DÉPASSÉE** | Mesure la CI sur `a31b2e4` et pose une question à deux options (§6) : transporter aussi les harnais réalignés, ou traiter séparément. L'option 1 a été exécutée : commit `1ba8b88` (« test(#65): réaligner les deux harnais NEXUS_CONFIG », 2026-09-24, même branche candidate, confirmé présent par `git cat-file -t`) transporte exactement les deux harnais — `request-15.md` §1 le constate par diff/blobs identiques. La classification des échecs faite par `request-14.md` §4 est reprise sans contradiction par `request-16.md` §3, elle-même couverte par `decision-10.md`. |
| `request-15.md` | `5621bd2`, 2026-09-24 | **ABSORBÉE PAR `request-16.md`** | Mesure complète du transport `1ba8b88` (harnais réels 38/38, CI, preview Cloudflare/Test). Ne pose pas de question d'arbitrage propre — conclut `#65` toujours `NO GO` et prépare la mesure suivante. Son contenu est explicitement repris et étendu par `request-16.md` §1 (« capacité nouvelle... logs de job CI accessibles », même commit `1ba8b88`), qui pose la question effectivement arbitrée par `decision-10.md`. |
| `request-16.md` | `f35b69b`, 2026-09-24 | **CONSOMMÉE** | `decision-10.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, `in_reply_to: request-16.md`), déposée `ce27a56`, répond nommément aux 3 questions de `request-16.md` §8 et marquée `DECISION_CONSOMMEE` (commit de consommation `ce27a56` lui-même, confirmé par `request-17.md` §1 : « consommée via `outils/handoff.js consommer`... commit `ce27a56` »). Ne pas doubler — conforme à l'état à respecter du réveil. |
| `request-17.md` | `178f265`, 2026-09-24 | **INFORMATIVE — SANS OBJET D'ARBITRAGE** | Compte rendu déposé *après* consommation de `decision-10.md` (le fichier le dit lui-même en §1). Documente une recherche de voie d'exécution pour la recette navigateur et conclut qu'aucun geste n'est déclenché (« Ce que cette session ne fait pas »). Ne pose aucune question à ChatGPT/Frédéric : rien à arbitrer, donc rien à consommer. Son contenu n'est contredit par aucune demande ultérieure (`classement-gates-etat-git-62-65-1.md`, référencé, reste la source des gates `#65` et n'a pas changé). |
| `request-18.md` | `2c82fb2` (2026-09-25), complétée par append `fc807a7` (2026-09-26) | **SATISFAITE** | Pose « une seule question » (§5) : accorder `issues: write` pour que le réveil Orchestrateur se poste seul ? Répondue par un geste humain direct sur le rail, pas par une décision Handoff : commit `0b3c387` (« Le réveil Claude → Orchestrateur se poste seul (issues: write, accordé le 26/09) », 2026-09-26) et `.github/workflows/tests.yml:41-42`, qui documente explicitement « `issues: write` AUTORISÉ PAR FRÉDÉRIC BRAGANCE LE 26/09/2026, à sa demande explicite (« GO pour `issues: write` dans tests.yml ») ». Le mécanisme de réveil publie réellement en commentaire depuis cette date — vérifiable par construction (ce commentaire-ci en est la preuve vivante). L'append du 26/09 dans `request-18.md` lui-même le constate déjà, sans réécrire le §5-6 initial. |
| `request-19.md` | `217f6f4`, 2026-10-02 | **SUPPLANTÉE PAR `request-20.md`** | Rend un verdict `PRET_POUR_HANDOFF_PRODUCTION (qualifié)`. `request-20.md` §6 le dit explicitement et sans ambiguïté : « Ce verdict **révise** le `PRET_POUR_HANDOFF_PRODUCTION (qualifié)` de `request-19.md` » — supersession sur le fond, assumée par son auteur, pas une inférence de cette table. Conforme à l'état à respecter du réveil. |
| `request-20.md` | `40c0df8`, 2026-10-02 | **GATE ACTIVE — NON ARBITRÉE** | Rend `NO_GO_GATE_PRODUCTION`. C'est la demande la plus récente du lot et la seule que les deux mécanismes de réveil désignent (voir §3). **Non fermée par ce document**, conformément à l'instruction explicite du réveil. |

## Décisions canoniques déjà déposées sur ce lot (rappel, aucune n'est touchée)

`decision-1.md` à `decision-10.md` existent toutes dans `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/` et sont append-only, inchangées par ce document.

## Pourquoi aucune nouvelle décision append-only n'est déposée pour 12, 13, 14, 15, 17, 18, 19

La mission ne demande d'en déposer que « si et seulement si le protocole `nexus-handoff/2`
exige une décision canonique pour empêcher leur réveil ». Ce n'est pas le cas, mesuré et
non supposé : les deux mécanismes de réveil du rail (`outils/reveil-handoff.js`,
`outils/reveil-orchestrateur.js`) ne considèrent jamais, pour un lot donné, qu'**une seule**
relation — la dernière décision déposée contre la dernière demande déposée
(`handoff.js:277-322`, `handoff.js:63-90`). Aucun des deux n'itère sur les demandes
intermédiaires pour leur demander individuellement un arbitrage. Une demande intermédiaire
ne peut donc structurellement jamais déclencher de réveil, qu'une décision lui réponde ou
non — ce que la mesure réelle ci-dessous confirme : avant toute écriture de ce document, les
deux outils désignaient déjà `request-20.md` comme seule entrée, et aucun autre. Déposer
des décisions `decision-11.md` à `decision-16.md` pour viser rétroactivement 12/13/14/15/17/18/19
ne changerait donc rien à ce que les outils voient, n'apporterait aucune garantie
supplémentaire, et introduirait sept dérogations ou plus pour la seule raison de « faire
quelque chose » — exactement ce que l'instruction 5 du réveil interdit (« Ne crée aucune
décision factice uniquement pour faire passer le vérificateur »). Le classement de la table
ci-dessus (DÉPASSÉE / ABSORBÉE / INFORMATIVE / SATISFAITE / SUPPLANTÉE) est donc la
normalisation elle-même : un fait établi par preuve, pas un acte d'écriture supplémentaire
sur le registre.

## Preuves d'exécution réelle (mesurées sur ce HEAD, avant toute modification de ce lot)

```
$ node outils/handoff.js verifier
Handoff v2 : registre, enveloppes et STATE.json conformes (32 lot(s), 15 avertissement(s), 11 dérogation(s)).

$ node outils/reveil-handoff.js --json
{
  "reveil": false,
  "motif": "DECISION_PERIMEE",
  "lot": "NEXUS-CONTINUITE-TERRAIN-2-20260922",
  "lots": [{
    "lot": "NEXUS-CONTINUITE-TERRAIN-2-20260922",
    "decision": "decision-10.md",
    "demande_active": "request-20.md",
    "repond_a": "request-16.md",
    "statut": "ATTENTE_DECISION",
    "motif": "DECISION_PERIMEE"
  }],
  "message": "Pas de réveil : .../decision-10.md répond à request-16.md, mais la demande active est request-20.md. ..."
}

$ node outils/reveil-orchestrateur.js --json
{
  "reveil": true,
  "motif": "DEMANDE_DEPASSEE",
  "lot": "NEXUS-CONTINUITE-TERRAIN-2-20260922",
  "demande": "request-20.md",
  ...
  "message": "Réveil Orchestrateur : NEXUS-CONTINUITE-TERRAIN-2-20260922/request-20.md attend un arbitrage."
}
```

**Conclusion mesurée : `request-20.md` est déjà, et était déjà avant ce document, la
seule demande en attente du lot — pour les deux sens du rail.** Aucune des demandes 12 à
19 n'apparaît dans l'un ou l'autre résultat. C'est l'objectif de la mission §7,
atteint sans écriture supplémentaire sur le registre.

## Ce que ce document ne fait pas

Ne réécrit, ne renomme, ne supprime aucun `request-N.md`/`decision-N.md` existant. Ne
dépose aucune décision. Ne modifie pas `STATE.json` (aucune correction n'y est nécessaire
— `derniere_demande: request-20.md`, `derniere_decision: decision-10.md` y figurent déjà
correctement, et les miroirs v1 `CURRENT.md`/`DECISION.md` pointent déjà vers ces mêmes
fichiers, vérifié avant rédaction). Ne ferme ni n'arbitre `request-20.md`. Aucun changement
`main`/`production`, aucune opération Supabase, aucun secret.
