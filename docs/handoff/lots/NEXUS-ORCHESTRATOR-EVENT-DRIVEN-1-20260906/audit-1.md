<!-- Document de travail matérialisé depuis un canal Issue GitHub (checkout raciné
     sur `main`, docs/handoff/ absent localement — voir rapport). Ce n'est PAS un
     dépôt dans le registre append-only : `outils/handoff.js demande` n'a pas pu
     être exécuté depuis ce canal. À faire relire puis, si retenu, déposer comme
     request-2.md par une session outillée (voir commandes de rapatriement dans
     le commentaire GitHub associé). -->

# NEXUS-ORCHESTRATOR-EVENT-DRIVEN-1-20260906 — audit et plan avant implémentation

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Réduire la latence et la sollicitation humaine du relais Handoff, sans affaiblir aucun invariant de sécurité. |
| `gain_attendu` | **Fiabilité + latence** — mais seulement si le mécanisme choisi peut réellement écrire sur `config-par-environnement`, ce que ce lot met en doute (§1). |
| `contrats_touches` | `outils/handoff.js` (idempotence, anti-boucle) ; aucune policy, aucune donnée. |
| `guardians_requis` | Architecture · Security & Isolation · **Guardian Philosophie NEXUS** (nouveau, voir §4) |
| `preuves_exigées` | Reproductibilité de l'obstacle §1 sur trois sessions indépendantes de ce fil ; trace manuelle des nouvelles gardes `outils/handoff.js` (non exécutées, voir §6) |
| `définition_de_terminé` | Audit rendu, plan proposé, parties non-workflow implémentées et honnêtement non vérifiées par exécution ; arbitrage demandé sur §1 et §3. **Ce lot ne peut pas se clore lui-même** — il dépend d'une capacité que Claude n'a pas dans ce canal. |

## Résumé

Ce lot demande une architecture event-driven + watchdog horaire. L'audit
trouve que **l'obstacle qui a bloqué le dépôt Handoff sur les quatre lots
précédents de ce fil (04:42, 06:04, 11:33, 13:14) a une cause précise et
reproductible**, distincte d'un simple aléa d'infrastructure — et que cette
cause limite fortement ce que « event-driven » peut vouloir dire tant qu'elle
n'est pas résolue par une décision humaine (§1, §3). Les parties du lot qui
n'en dépendent pas — idempotence, anti-boucle, Guardian Philosophie — sont
implémentées ici (§4-§6), matérialisées sur une branche `claude/issue-*`
faute de pouvoir écrire sur `config-par-environnement` depuis ce canal.

## 1. Pourquoi ce canal ne peut pas écrire sur `config-par-environnement`

`.github/workflows/claude.yml` (sur `main`) déclare explicitement :

```yaml
- uses: actions/checkout@…
  with:
    ref: config-par-environnement
```

Et pourtant, sur les cinq sessions successives de ce fil qui l'ont vérifié
(cette session comprise), `HEAD` du checkout est un commit de `main`
(`c434201`), jamais de `config-par-environnement`. Ce n'est **pas** un bug
intermittent : `git merge-base --is-ancestor c434201 origin/config-par-environnement`
échoue — les deux branches ont divergé, `c434201` n'existe que sur `main`.

**Cause identifiée** : le déclencheur de ce workflow est `issue_comment` /
`issues`. GitHub résout et charge la définition d'un workflow déclenché par un
événement d'issue **depuis la branche par défaut du dépôt** (`main`), quel que
soit le contenu de l'étape `actions/checkout`. Le commentaire du fichier
`claude.yml` le confirme lui-même : *« Le workflow est chargé depuis `main`,
branche par défaut requise par GitHub pour les évènements d'issues. »* Ce que
les sessions précédentes n'avaient pas établi, c'est que **l'action
`anthropics/claude-code-action` crée elle-même la branche de travail
`claude/issue-N-*` à partir de la référence par défaut résolue par GitHub pour
l'événement**, indépendamment de l'étape `actions/checkout` qui la précède
dans le YAML. Le `ref: config-par-environnement` de cette étape permet de
**lire** `config-par-environnement` (c'est ce que ce lot et les précédents ont
fait, via `git show origin/config-par-environnement:<chemin>`) — il ne
détermine pas la branche sur laquelle Claude committe.

**Conséquence directe** : aucun changement à `claude.yml` ne peut résoudre
ceci tant que le déclencheur reste `issue_comment`/`issues`. Ce n'est pas non
plus quelque chose que Claude peut corriger lui-même : modifier
`.github/workflows/*` est explicitement hors du périmètre d'écriture de
l'agent (contrainte de permission GitHub App, indépendante de la branche).

## 2. Ce qui existe déjà, et ce qui n'existe pas

- **Aucun workflow planifié (`schedule:`) n'existe** dans ce dépôt, ni sur
  `main` ni sur `config-par-environnement`. Le « watchdog horaire » évoqué
  dans plusieurs réveils de ce fil est aujourd'hui un **processus humain**
  (Frédéric relance manuellement), pas un mécanisme GitHub Actions. Il est à
  créer, pas à conserver.
- **Une primitive de veille existe déjà** : `outils/handoff.js veiller
  <LOT_ID>` fait un `git fetch` puis compare l'état local à l'état distant.
  Elle a un défaut réel, corrigé dans ce lot (§6) : elle relisait le
  registre depuis le **disque** après le fetch, alors qu'un `git fetch` seul
  ne modifie jamais la copie de travail — seul un `checkout`/`reset` le
  ferait. Sans ce correctif, `veiller` ne détectait donc jamais un événement
  distant tant qu'aucune réinitialisation locale n'avait eu lieu.
- **`.github/workflows/tests.yml` exécute déjà `node outils/handoff.js
  verifier`** à chaque push/PR — c'est le point d'ancrage naturel pour toute
  garde supplémentaire (Guardian Philosophie, anti-boucle) qui ne nécessite
  pas de nouveau déclencheur, seulement une extension du validateur existant.

## 3. Options pour le rail événementiel réel — arbitrage nécessaire

Le principe cardinal du lot (« automatisation par défaut, humain par
exception ») ne peut pas trancher entre ces options : elles diffèrent sur un
fait d'infrastructure, pas sur un jugement de valeur.

**Option A — router le réveil via une Pull Request plutôt qu'une Issue.**
Une session Claude déclenchée sur une PR ouverte **depuis**
`config-par-environnement` pousse directement sur la branche de la PR (cf.
capacités documentées de l'agent : *« When triggered on an open PR: Always
push directly to the existing PR branch »*), sans la résolution
« branche par défaut » qui affecte les événements d'issue. Concrètement :
ouvrir une PR permanente `config-par-environnement → main` (jamais fusionnée
— seulement un support de dialogue) et faire porter les réveils `@claude` par
des commentaires sur cette PR plutôt que sur l'issue #28. Avantage : écriture
réelle possible dans le rail Handoff. Coût : changement d'habitude du canal
de dialogue, et une PR ouverte en permanence vers `main` doit rester
clairement documentée comme non-fusionnable (contrat déjà existant : «
Orchestrator ne merge jamais vers main »).

**Option B — accepter le canal Issue comme lecture + relais humain pour le
dépôt.** Garder l'architecture actuelle : Claude audite/conçoit/implémente
sur `claude/issue-*`, un humain (ou une session outillée avec accès complet)
rapatrie sur `config-par-environnement` via les commandes déjà données à
chaque lot de ce fil. C'est ce qui a été fait jusqu'ici ; le coût est humain,
directement contraire au principe cardinal de ce lot.

**Recommandation de l'audit** : Option A, parce qu'elle seule change
effectivement la propriété qui a bloqué quatre lots consécutifs sans
introduire de nouveau risque de sécurité (aucun secret, aucune branche
protégée touchée, la PR ne fusionne jamais). Mais c'est un changement de
topologie du canal de dialogue humain↔Claude↔ChatGPT, pas un détail
d'implémentation : il est soumis à arbitrage (Q1 ci-dessous), pas décidé
unilatéralement ici.

## 4. Guardian Philosophie NEXUS — nouveau, documenté et câblé

`docs/gouvernance/GUARDIAN-PHILOSOPHIE-NEXUS.md` (nouveau fichier) définit
les neuf critères demandés par le lot, la question obligatoire (« pourquoi un
humain doit-il intervenir ici ? ») et le droit de veto — distinct des
Guardians Architecture/Security/QA déjà en usage.

Câblage minimal, sans toucher à un workflow : `outils/handoff.js` refuse
désormais (bloquant, mais **dérogeable** — ce n'est pas un invariant de
sécurité comme `BRANCHE_PROTEGEE`) toute demande dont `type:
architecture-and-implementation-request` ne porte pas de section `##
Guardian Philosophie NEXUS` dans son corps. **Ce lot lui-même
(`request-1.md`, déjà déposé) n'a pas cette section** : la garde est
postérieure à son dépôt. Une dérogation `GUARDIAN_PHILOSOPHIE_MANQUANTE`
dans `STATE.json`, motivée et datée, est nécessaire pour que ce lot continue
à valider une fois cette garde fusionnée — exactement le mécanisme déjà
utilisé pour `BRANCHE_ABSENTE`/`DECISION_HORS_VOCABULAIRE` sur d'autres
lots.

## 5. Anti-boucle

`outils/handoff.js` refuse maintenant (bloquant, **non dérogeable** — même
famille que les refs protégées) toute décision dont l'`author` est identique
à celui de la demande à laquelle elle répond. Le registre actuel ne casse
pas : toutes les demandes connues portent `author: Claude`, toutes les
décisions connues portent un autre auteur (`ChatGPT`, `Frédéric Bragance`).
C'est la garde structurelle contre l'auto-arbitrage — Claude ne peut
techniquement jamais être compté comme ayant décidé de sa propre demande,
même si un futur mécanisme automatisé tentait de le faire.

## 6. Idempotence

`outils/handoff.js veiller` est corrigé pour lire l'état **distant** après
`git fetch` (`git ls-tree <ref> …`) plutôt que la copie de travail locale
(qui ne change pas avec un simple fetch — défaut préexistant, voir §2). La
source de vérité pour « déjà traité » reste `STATE.json.lots[LOT].statut` +
`derniere_decision`, déjà écrits par `consommer()` : aucun second registre
n'est introduit (critère 3 du Guardian Philosophie, §4). Un watchdog qui
appellerait `veiller` toutes les heures ne peut donc jamais émettre deux fois
« event detected » pour la même décision.

## 7. Ce qui n'a pas pu être vérifié par exécution

Comme pour les lots précédents de ce fil, `node`, `git fetch` et `git
ls-tree` requièrent dans ce canal une approbation qu'aucun humain ne peut
donner à un run automatisé. Les changements à `outils/handoff.js` ont été
retracés à la main contre `test_handoff_v2_20260905.js` (lu en lecture seule
sur `config-par-environnement`) : son registre sain de référence porte
`author: Claude` (demande) / `author: ChatGPT` (décision) — distincts, donc
la nouvelle garde anti-boucle ne le fait pas échouer — et aucune de ses
14 épreuves de corruption ne touche au champ `author` ni ne déclare `type:`,
donc la garde Guardian Philosophie ne s'y déclenche pas non plus. **Ceci
reste une lecture, pas une exécution** : à confirmer par `node
test_handoff_v2_20260905.js` depuis une session outillée avant fusion.

## Avis des Guardians

### Architecture Guardian
Les deux gardes ajoutées à `outils/handoff.js` réutilisent des structures
existantes (`echanges`, `lireEnveloppe`, `STATE.json`) plutôt que d'ajouter
un nouveau format ou un nouveau fichier d'état. Le rail événementiel réel
(§3) est en revanche une décision de topologie, pas un détail
d'implémentation — elle ne devrait pas être tranchée par défaut.

### Security & Isolation Guardian
Aucun secret, aucune donnée cliente, aucune ref protégée touchée. La garde
anti-boucle (§5) est un ajout net de sécurité protocolaire : elle empêche
mécaniquement une classe d'auto-approbation qui n'était jusqu'ici empêchée
que par convention (Claude n'écrivant jamais de `decision-N.md`).

### Guardian Philosophie NEXUS
Réponse à la question obligatoire pour ce lot lui-même : *pourquoi un humain
doit-il intervenir ici ?* — parce que l'option §3 change la façon dont
Frédéric et ChatGPT interagissent avec Claude au quotidien (canal Issue vs
canal PR), ce qui est exactement le type d'arbitrage stratégique/produit que
le critère 2 réserve à l'humain. Rien d'autre dans ce lot ne le justifie : la
correction de bug (§6), l'anti-boucle (§5) et la garde Guardian Philosophie
(§4) elle-même ne demandent aucune sollicitation de Frédéric au-delà d'une
revue de code normale.

## Questions pour arbitrage

**Q1 — Router le réveil Handoff via une PR `config-par-environnement`
plutôt que via cette Issue (Option A, §3) ?** Recommandation : oui, c'est la
seule option qui restaure une écriture réelle sans nouveau risque de
sécurité. À défaut, tout lot futur continuera de produire du code orphelin
sur des branches `claude/issue-*` jamais rapatrié automatiquement — le
schéma exact des quatre lots précédents de ce fil.

**Q2 — La garde Guardian Philosophie (§4) doit-elle bloquer la CI dès
fusion, ou d'abord observer (comme la garde de portée site, ADR-0001,
`|| true` dans `tests.yml`) ?** Recommandation : observer d'abord — ce lot
lui-même n'y est pas conforme (§4), et l'imposer bloquant immédiatement
romprait sa propre CI sans dérogation déposée au préalable.

**Q3 — Le watchdog horaire (workflow `schedule:` à créer) est un fichier
`.github/workflows/*`, hors du périmètre d'écriture de Claude. Qui le porte —
Frédéric directement, ou un `request-N.md` dédié décrivant le YAML exact
pour que Frédéric n'ait qu'à copier-coller ?** Recommandation : la seconde —
cohérent avec le critère 2 (l'intervention humaine minimale porte sur la
décision, pas sur la rédaction).
