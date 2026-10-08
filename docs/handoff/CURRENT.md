<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FAST-TRACK-ANTI-PAUSE-1-20261007/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-ANTI-PAUSE-1-20261007
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
---
# request-1 — mécanisme Fast Track : relais de canal déterministe, anti-pause

## Pourquoi ce lot est en attente, pas publié directement

Au moment de ce travail, `GOUVERNANCE-REFERENCE-CODE-20261005` est `ATTENTE_DECISION`
(`request-6.md`, `wake_to: ChatGPT`) et porte déjà une décision dans son historique
(`decision-5.md`). `outils/handoff.js demande` refuse donc mécaniquement tout nouveau
lot tant qu'un seul lot n'est pas actif à la fois — vérifié en conditions réelles,
pas supposé :

```
$ node outils/handoff.js demande FAST-TRACK-ANTI-PAUSE-1-20261007 <corps> --wake-to ChatGPT
REFUS — le lot GOUVERNANCE-REFERENCE-CODE-20261005 est actif (ATTENTE_DECISION) et
porte déjà une décision dans son historique (decision-5.md). Un seul lot actif à la
fois : terminez ce lot ... avant d'en ouvrir un autre.
```

C'est l'un des points identifiés par la mission elle-même (§1 ci-dessous) : un lot
purement outillage/CI, pré-autorisé a posteriori par CLAUDE.md (« aucun choix métier,
aucun secret, aucune Production, aucun `main` » — les quatre conditions sont réunies,
voir §6), ne peut pourtant pas même déposer sa `request-1` tant qu'un lot métier
distinct reste en arbitrage. Ce n'est pas un défaut à corriger dans ce lot-ci — c'est
l'invariant `PLUSIEURS_LOTS_ACTIFS`, volontaire, qui protège le registre d'une
mutation concurrente. Le travail est donc fait, prouvé, committé — et ce corps attend
dans `docs/handoff/en-attente/`, à publier par `outils/handoff.js demande` (jamais à
la main dans `lots/`) dès que `GOUVERNANCE-REFERENCE-CODE-20261005` se ferme ou que
l'Orchestrateur autorise explicitement l'exception.

## §1 — Les points de pause identifiés, précisément

1. **Le défaut réel qui a stoppé `request-6.md`.** `wake_to: ChatGPT` était déclaré,
   la CI locale était verte, et pourtant rien n'est jamais arrivé sur l'issue #28.
   Cause exacte : l'étape CI qui publie le réveil
   (`.github/workflows/tests.yml`, « Réveil Orchestrateur — publication au
   destinataire déclaré ») n'accepte qu'une adresse de la forme exacte
   `<serveur>/<dépôt>/issues/<numéro>`. « ChatGPT » — la forme utilisée par la quasi
   totalité des lots récents (`SECURITE-ANON5-20261004`, `GOUVERNANCE-REFERENCE-CODE
   -20261005`, `FDJ-*`) — n'en est pas une : elle tombe dans le refus
   `ADRESSE_HORS_DEPOT`, qui est un `BLOCKED` propre (il ne rougit pas la CI) mais qui,
   surtout, **ne publie rien sur l'issue**. Le réveil reste cantonné au résumé du run,
   invisible sans savoir qu'il faut l'y chercher. C'est une limitation de CANAL —
   le canal (l'issue #28) existe et fonctionne — confondue en pratique avec une
   absence de relais.
2. **Le registre lui-même sérialise les lots, y compris les lots outillage
   pré-autorisés a posteriori.** Voir ci-dessus : `nouvelleDemande` refuse d'ouvrir
   un second lot tant qu'un premier reste `ATTENTE_DECISION`/`ATTENTE_CONSOMMATION
   _DECISION` avec une décision dans son historique, et `verifier` bloquerait de
   toute façon sur `PLUSIEURS_LOTS_ACTIFS` si on contournait ce refus en écrivant
   directement. Volontaire, pas corrigé ici — mais c'est un point de pause réel pour
   tout lot outillage qui voudrait avancer en parallèle d'un lot métier en
   arbitrage, et il méritait d'être nommé plutôt que découvert une fois de plus.
3. **Le sens Orchestrateur → Claude n'a aucun déclencheur automatique.** `outils
   /reveil-handoff.js` répond correctement à « reste-t-il une décision déposée et
   non consommée ? », mais rien ne l'appelle seul : pas de `schedule` (fermé par
   `decision-1.md` de `NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907`, qui ne peut vivre
   que sur la branche par défaut), pas de `repository_dispatch` armé. C'est un vrai
   `BLOCKED_TECHNIQUE` — aucun canal n'existe aujourd'hui pour ce sens, et l'armer
   est explicitement une gate humaine CLAUDE.md (« armement d'une boucle automatique
   agissant au nom de Frédéric ») : ce lot ne la franchit pas, il la nomme.
4. **Le canal `issue_comment` où tourne Claude reste sans réseau ni `gh`.** Confirmé
   à nouveau dans cette session (`gh auth status` requiert une approbation
   qu'aucun humain ne peut donner dans ce run automatisé). C'est la limitation de
   canal originelle, déjà documentée depuis le 06/09/2026 — la différence que ce
   lot apporte est que, désormais, le canal ALTERNATIF (ChatGPT via l'issue, ou la
   CI elle-même) est effectivement adressable (§2), donc le bon relais est
   `CHANNEL_LIMITATION`, jamais un `STOP` humain pour ce seul motif.

## §2 — Correction : résolution déterministe de `wake_to`

`docs/handoff/CANAUX.json` (nouveau) porte la traduction d'un rôle logique
(`ChatGPT`, `Claude`) vers un canal postable concret — un **fait écrit dans le
rail**, jamais codé en dur dans l'outillage (conforme à `PROTOCOL.md` : « aucun
outil ne code de destinataire en dur »). `outils/reveil-orchestrateur.js` lit ce
fichier (`resoudreCanal`, `canauxConnus`, nouveaux, exportés) et résout l'adresse
AVANT de la rendre dans son JSON/message — donc avant que l'étape CI existante
(non modifiée, aucun accès `.github/workflows/*` dans ce canal) ne l'évalue.
Comportement de repli strict : fichier absent, illisible, entrée vide, ou rôle
inconnu → l'adresse brute traverse inchangée, exactement le comportement d'avant
cette correction. Aucune régression possible par construction.

## §3 — Nouveau : classification CHANNEL_LIMITATION / BLOCKED_TECHNIQUE

`outils/classification-canal.js` (nouveau) expose `classifier({ acteurCourant,
wakeTo, canalResolu, motifStop })`, une fonction pure :

- `wakeTo` absent → `BLOCKED_TECHNIQUE` (`AUCUN_DESTINATAIRE`) ;
- `wakeTo === acteurCourant` → `BLOCKED_TECHNIQUE` (`DESTINATAIRE_EST_ACTEUR
  _COURANT`) — un acteur ne se réveille jamais lui-même (séparation des rôles,
  skill Fast Track §2) ;
- `wakeTo` déclaré mais `canalResolu` absent → `BLOCKED_TECHNIQUE`
  (`CANAL_NON_RESOLU`) — jamais un relais fantôme vers une adresse qui n'existe pas ;
- sinon → `CHANNEL_LIMITATION` (`RELAIS_POSSIBLE`) ;
- et surtout : un `motifStop` de la liste fermée (reprise littérale du § STOP humain
  du skill Fast Track) **gagne toujours**, même avec un canal parfaitement résolu —
  un canal qui marche ne transforme jamais une fusion Production, une écriture
  Supabase Production ou une décision métier non arbitrée en un geste délégable.

Ce module ne réveille, ne lit et n'écrit rien lui-même : une décision pure,
appelable par un outil qui, lui, sait où regarder. Aucun câblage CI n'est fait ni
requis pour que cette correction prenne effet (voir §2) ; `classifier` est une
brique disponible pour un futur lot qui voudrait l'attacher à `etat-maillon.js`.

## §4 — Preuve causale, le cas request-6 rejoué (pas supposé)

`test_fast_track_anti_pause_20261007.js` (nouveau, 14 épreuves, 0 échec) monte un
registre jetable portant EXACTEMENT la forme réelle (lot avec `wake_to: ChatGPT`,
une décision périmée répondant à une demande antérieure, une demande active sans
réponse — la forme `DEMANDE_DEPASSEE` mesurée sur `GOUVERNANCE-REFERENCE-CODE
-20261005`), et rejoue le filtre d'adresse de `tests.yml` en JS (même motif :
`<serveur>/<dépôt>/issues/<numéro>`), sans bash ni CI :

- **A — le bug rejoué** : sans `CANAUX.json`, l'adresse calculée reste `"ChatGPT"`
  et échoue au filtre — la preuve que le défaut est réel, pas une supposition ;
- **B — la correction** : avec `CANAUX.json`, l'adresse calculée est l'URL d'issue
  et passe le même filtre, pour `ChatGPT` et pour `Claude` ;
- **C — cinq mutations de repli** (adresse déjà conforme, entrée vide, JSON cassé,
  rôle non déclaré) : jamais de plantage, jamais d'adresse fabriquée ;
- **D** : la fonction de résolution rejouée hors subprocess, même résultat ;
- **E — classification, 6 épreuves par mutation ciblée** : chaque branche de
  `classifier`, et la preuve qu'AUCUN motif STOP fermé n'est contournable par un
  canal résolu — testé sur les 10 motifs de la liste, un par un.

## §5 — Preuves mesurées sur ce HEAD

- `node test_fast_track_anti_pause_20261007.js` → **14/14**.
- `node test_continuite_bout_en_bout_20260930.js` → **23/23** (inchangé).
- `node test_cablage_maillons_20260930.js` → **10/10** (inchangé).
- `node test_permissions_workflow_20260908.js` → **13/13** (inchangé).
- `node test_handoff_v2_20260905.js` → **107/107** (inchangé).
- `node run-tests.js` → aucune régression ; seuls les 9 échecs connus subsistent.
- `node outils/handoff.js verifier` → conforme : 36 lots, 17 avertissements, 13
  dérogations — identique avant/après ce travail (le nouveau `CANAUX.json` n'est
  pas scanné par le validateur, qui ne lit que `lots/` et `STATE.json`).
- `node outils/guardians-router.js` → 1 finding, la collision `NexusStock`
  préexistante et déjà tracée (ARCH-002, Q73/Q74) — aucun fichier de ce lot n'y
  touche.
- `node outils/guardian-qa.js` → 307 épreuves analysées, 0 finding.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.

## §6 — Vérification des quatre conditions de l'arbitrage a posteriori (CLAUDE.md)

1. Aucun choix métier ou produit — confirmé : `outils/classification-canal.js`,
   `outils/reveil-orchestrateur.js`, `docs/handoff/CANAUX.json` et le fichier de
   test sont tous classés non applicatifs par `handoff.estFichierApplicatif`
   (vérifié, pas déclaré).
2. Aucun secret — ni lecture, ni rotation, ni création ; aucune dépendance ou
   harnais tiers. Confirmé : aucun fichier touché n'en référence, `CANAUX.json` ne
   porte qu'une URL publique d'issue GitHub.
3. Aucune action Production/Supabase Production/NEXUS Production.
4. Aucune modification de `main` — tout vit sur `handoff-continuite-20260920` /
   la branche de run de cette session.

Les quatre conditions sont simultanément vraies.

## État exact du rail

`HEAD` de ce travail = `e88476615da5e84d5854510220339fd26178c747` (`handoff
-continuite-20260920` au moment du déclenchement). `main=d6093b7`, `production
=e45ab43` — inchangées, aucune écriture.

## Prochaine action minimale et `wake_to`

1. **Si `GOUVERNANCE-REFERENCE-CODE-20261005` se ferme (ou si l'Orchestrateur
   autorise explicitement l'exception a posteriori sur ce point précis)** : publier
   ce corps via `node outils/handoff.js demande FAST-TRACK-ANTI-PAUSE-1-20261007
   docs/handoff/en-attente/FAST-TRACK-ANTI-PAUSE-1-20261007-request-1.md --wake-to
   ChatGPT`, jamais à la main dans `lots/`.
2. Ce lot ne touche ni ne requalifie `GOUVERNANCE-REFERENCE-CODE-20261005` — son
   `request-6.md`/décision attendue restent entièrement hors périmètre.

`wake_to: ChatGPT` — Claude ne peut pas arbitrer sa propre demande (séparation des
rôles, skill Fast Track §2). Aucune STOP de la liste fermée n'est déclenchée par ce
travail.
