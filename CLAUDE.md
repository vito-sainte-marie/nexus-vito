# NEXUS — Instructions Claude

Avant tout nouveau lot, lire et appliquer `docs/handoff/PROTOCOL.md` (Handoff v2).

Le registre canonique est `docs/handoff/STATE.json` et `docs/handoff/lots/`.
`CURRENT.md` et `DECISION.md` ne sont que des **miroirs v1**, régénérés par
l'outil : bons pour se repérer, jamais à éditer ni à croire sur parole.

Le cycle passe **par l'outil**, jamais par une écriture à la main dans `lots/` :

```
node outils/handoff.js verifier                       # le registre est-il sain
node outils/handoff.js consommer <LOT_ID>             # prendre acte d'une décision
node outils/handoff.js demande <LOT_ID> <corps.md>    # publier une demande
node outils/handoff.js decision <LOT_ID> <corps.md>   # déposer une décision
```

Quatre écarts d'enveloppe consécutifs sont venus de fichiers rédigés à la main.
Ces commandes produisent une enveloppe conforme par construction ; c'est toute
leur raison d'être.

---

## Lancer un agent — la mémoire d'abord

Tout agent lancé sur ce dépôt reçoit **en préambule** le briefing rendu par :

```
node outils/briefing-agent.js --portee <portées séparées par des virgules>
```

Ce n'est pas une formalité. Le 07/09/2026, trois agents ont bien travaillé
parce que leurs consignes contenaient, recopiées à la main, les leçons de la
journée — calibrer un détecteur sur le vrai dépôt, vérifier qu'une mutation a
mordu avant de lire son résultat. L'un d'eux a appliqué la seconde à une
hypothèse de Claude et a évité d'optimiser le mauvais endroit. Ces leçons
vivaient déjà dans `docs/learning/RULES.json` ; simplement, personne ne les
lisait au démarrage.

Une leçon qui mérite d'être transmise se **promeut dans `RULES.json` et
`EXPERIENCE.jsonl`** (GOV-002), jamais dans un prompt. Un prompt se perd avec
sa session ; le registre reste, et `outils/verifier-apprentissage.js` le garde.

## Pré-autorisations — ce que Claude décide seul

**En vigueur depuis le 07/09/2026, sur décision de Frédéric.**

Pourquoi elles existent : ce jour-là, Frédéric a passé sa journée à faire le
facteur — six arbitrages relayés entre ChatGPT et Claude, cinq questions posées
par Claude. Trois de ces cinq portaient sur des cas **déjà tranchés par la
doctrine** ; seule leur formulation manquait. La gouvernance autonome v2 dit que
Frédéric « ne doit pas servir de facteur entre agents pour les problèmes
déterministes ». Voici ce qui est déterministe.

1. **Alimenter, réinitialiser ou corriger la base de recette Test**
   (`nexus-test`). C'est une base d'épreuve, et son bandeau le dit à chaque
   écran. Conditions : jeu de données versionné dans le dépôt, idempotent, et
   qui ne détruit pas les lignes appartenant à une autre recette.

2. **Déroger à un défaut de FORME d'enveloppe Handoff** sur un fichier déjà
   publié — `status`, `token_mode` ou `branch` absents, verdict hors vocabulaire
   dont le corps est sans ambiguïté. Conditions cumulatives : le fichier n'est
   **ni renommé ni réécrit** ; la dérogation nomme le lot ET le fichier ; son
   motif dit la cause réelle ; elle reste imprimée à chaque exécution du
   validateur. Une dérogation ne fait jamais disparaître un écart — elle le rend
   visible pour toujours.

3. **Créer, corriger et câbler outils, gardes et épreuves** sur
   `config-par-environnement`, y compris dans `.github/workflows/tests.yml`.

4. **Exécuter la recette navigateur Test** et lire la base Test.

5. **Publier une demande et consommer une décision** par l'outil.

## Gates humaines — jamais pré-autorisées

Aucune de ces lignes ne se contourne, quelle que soit l'urgence invoquée :

- toute modification de `main` ou de `production` ;
- toute opération sur Supabase Production ou NEXUS Production ;
- toute promotion en Production — aucune décision de recette n'y équivaut ;
- la **création, la rotation ou la lecture** d'un secret ;
- toute dérogation sur un invariant de sécurité (`BRANCHE_PROTEGEE`,
  `REFS_PROTEGEES`) — le code les refuse déjà, et c'est très bien ainsi ;
- toute nouveauté qui **élargit la surface de sécurité** : nouveau jeton,
  nouvelle capacité d'écriture, nouvel accès, harnais ou dépendance tierce ;
- l'**armement** d'une boucle automatique agissant au nom de Frédéric ;
- ne jamais contourner les gates sécurité, intégrité, isolation Test/Production
  ou validation humaine définies par NEXUS.

## Ce que les pré-autorisations ne changent pas

Aucune exigence de preuve n'est réduite. Une mutation reste due — et l'on
vérifie qu'elle s'est **réellement appliquée** avant de lire son résultat, un
`sed` muet rendant un faux « survit ». Une régression reste mesurée. Un échec
reste dit. Un détecteur se calibre sur le vrai dépôt avant d'être câblé : une
garde qui rend des dizaines de faux positifs se fait désactiver, et emporte avec
elle les vrais findings qu'elle aurait trouvés ensuite.

Aller plus vite, ce n'est pas prouver moins. C'est cesser de demander la
permission pour ce qui est déjà écrit.

## Arbitrage a posteriori — EN VIGUEUR depuis le 08/09/2026

Un lot purement **outillage, garde, test, mutation, calibration ou câblage CI**
peut être exécuté puis arbitré **a posteriori**, sans attendre une décision
préalable. Accordé par l'Orchestrator (Q76, `decision-1.md` du lot
NEXUS-ORCHESTRATION-GUARDIANS-1-20260907) et validé par Frédéric le 08/09/2026.

Les quatre conditions doivent être **simultanément** vraies :

1. aucun choix métier ou produit ;
2. aucun secret — ni lecture, ni rotation, ni création — et aucune dépendance
   ou harnais tiers élargissant la surface de sécurité ;
3. aucune action Production, Supabase Production ou NEXUS Production ;
4. aucune modification de `main`.

Dès qu'une seule condition tombe, retour immédiat au régime normal : arbitrage
préalable. Cette pré-autorisation ne couvre jamais une correction applicative
hors lot, ni un élargissement silencieux de périmètre.

Elle ne change rien aux preuves. Un lot arbitré a posteriori se publie avec le
même `request-N.md`, les mêmes preuves mesurées, les mêmes mutations, la même
régression. Ce qui change, c'est le moment de la question — pas son exigence.

---

GitHub est le canal de handoff entre Claude et ChatGPT.
