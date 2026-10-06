<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOUVERNANCE-REFERENCE-CODE-20261005/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 2
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision — rouge CI qualifié par mesure locale ; run GitHub Actions réel toujours HUMAN

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-2.md`.

Frédéric a donné le GO explicite (« Go request ») le 06/10/2026, sur la base
du constat mesuré par `request-2.md` : transport canonique des six commits
(FDJ `decision-10.md`, `GOUVERNANCE-REFERENCE-CODE-20261005/request-1.md` et
`decision-1.md`, correctif de la garde d'immuabilité) et correction du rouge
CI `37356858235` par changement de référence de comparaison (point de
divergence avec Production, plus son tip courant).

## 1. Vérification de l'état canonique avant arbitrage

Ce réveil a commencé par revérifier, sans confiance aveugle dans ce que
`request-2.md` déclarait :

- HEAD de ce checkout = `origin/handoff-continuite-20260920` =
  `17638d56a19a97ceb714ccbafa1fbc74794c6eae` — **le transport annoncé comme
  « prouvé, pas encore intégré » dans `request-2.md` §1 est en réalité déjà
  intégré au rail.** Les six commits cités (`27ca3ca`, `7fa73c6`, `1f835a0`,
  `b6ff903`, `fdebb7f`, `b25096d`) sont tous présents dans l'historique de
  `handoff-continuite-20260920`, plus le commit de dépôt de `request-2.md`
  lui-même (`17638d5`). Aucune duplication n'a donc été faite.
- `origin/production` = `c259476fa51e46f3b30fdd93918f2f78b88aec04`,
  `origin/main` = `d6093b76519826c4f820e00f5bca9fb8148b1f96` — tous deux
  identiques aux valeurs déclarées par `request-2.md` (preuve
  `refs-protegees`). Aucun mouvement de Production depuis ce lot.
- `node outils/handoff.js verifier` : conforme avant tout dépôt (36 lots,
  16 avertissements — tous préexistants —, 11 dérogations, 0 nouvelle
  erreur). Le seul avertissement propre à ce lot (`wake_to` absent) est de
  forme, non bloquant.

## 2. Qualification du correctif de la garde d'immuabilité — rejouée, pas supposée

Rejoué réellement sur ce HEAD, pas recopié du rapport :

- `node test_migrations_immuables_20260905.js` : vert — 240 migrations de
  production contrôlées au point de divergence, 52 ajoutées depuis et non
  évaluées, 292 au tip courant de Production. Confirme que le correctif
  décrit par `request-2.md` §2 (comparer au point de divergence
  `git merge-base origin/production HEAD`, pas au tip courant) est bien en
  vigueur sur ce HEAD.
- `node test_garde_immuabilite_merge_base_20261005.js` : **4/4** — les
  quatre scénarios causaux (migration post-divergence tolérée, suppression
  pré-divergence toujours détectée, altération de contenu pré-divergence
  toujours détectée, absence de divergence inchangée) sont confirmés par
  exécution réelle du fichier de garde actuel.
- `node run-tests.js` : **296/305** — les 9 échecs strictement identiques à
  la liste historique tolérée (`docs/qa/ECHECS-CONNUS.json`), 0 régression.
- `node outils/verifier-apprentissage.js` : conforme, **21 règles**, aucun
  doublon, aucune récurrence non promue.
- `node outils/guardians-router.js` : 0 finding sur le diff du dernier
  commit du rail (dépôt de `request-2.md` seul, scope `orchestrator` /
  `handoff`) — cohérent, ce commit ne touche aucun fichier applicatif.

**Sur cette base, la correction de la garde d'immuabilité et la qualification
du rouge CI `37356858235` sont tenues pour mesurées et acquises par
exécution locale réelle.**

## 3. Run GitHub Actions réel — toujours HUMAN, non fabriqué

Conformément à l'autorisation limitée (point 4) : ce canal (`issue_comment`
sur `claude.yml`) a été vérifié à nouveau comme ne pouvant ni déclencher ni
observer de run GitHub Actions — toute invocation `gh` (y compris
`gh auth status`, sans argument sensible) est bloquée par une approbation
qu'aucun humain ne peut donner dans ce run automatisé. Aucune tentative de
contournement du bac à sable n'a été faite.

**La gate CI réelle n'est donc PAS qualifiée comme franchie.** Elle reste
`HUMAN` — à obtenir par la session qui dispose d'un accès réseau/`gh`
fonctionnel, sur le HEAD canonique actuel (`17638d5...`) ou tout HEAD
postérieur qui en descend sans modification applicative. Les mesures
locales du §2 ne la remplacent pas ; elles réduisent le risque qu'un run
CI réel révèle une surprise, sans se substituer à lui.

## 4. Migrations rail-only et périmètre applicatif

Conformément au point 5 de l'autorisation : les 20 migrations rail-only
n'ont été ni traitées ni recopiées dans ce réveil. Aucun fichier
applicatif n'a été touché — seule la lecture (`git log`, `git rev-parse`,
exécution de tests déjà existants) a eu lieu.

## 5. Retour attendu et blocages restants

1. **Run GitHub Actions réel sur `17638d5` (ou un HEAD postérieur
   équivalent)** — seul point encore `HUMAN`. Prochain geste minimal
   recommandé : déclencher ou laisser se déclencher la CI GitHub Actions
   sur `handoff-continuite-20260920` à ce HEAD, puis rapporter le run ID et
   sa conclusion exacte.
2. Mécanique outillée de déclaration automatique du merge-base à
   l'ouverture d'un lot (`request-1.md` §3) : toujours non construite,
   reste posée pour un lot d'outillage séparé — non traitée ici,
   conformément au périmètre de ce GO.

## Interdictions (inchangées)

Aucune fusion Production, aucun déploiement Production, aucune
migration/écriture/réparation Production, aucune mutation Supabase Test non
strictement requise, aucune autorisation implicite de fusion/déploiement à
partir de cette décision. Tout mouvement inattendu de Production,
divergence du rail, contamination applicative ou nouvel échec CI inexpliqué
impose un **STOP** immédiat.
