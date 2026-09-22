# Décision 13 — préparée intégralement, non signée

Ce fichier n'est **pas** une enveloppe du registre : il ne porte pas de front-matter
`kind: decision`, le validateur ne le lit pas, et il ne vaut aucun verdict. C'est le geste de
Frédéric, prêt à être exécuté par lui — corps, commande et dérogation compris.

Motif de ne pas le signer moi-même : un verdict porte la signature de son auteur, et la
dérogation qu'il entraîne porte un `autorise_par`. Frédéric a donné le GO de ratification en
session, mais il n'a pas vu la dérogation que le dépôt réclame, et l'inscrire à son nom
reviendrait à lui faire autoriser ce qu'il n'a pas lu. Voir `request-13.md` §5 pour la mesure.

## 1. Corps de la décision

À écrire dans un fichier — ci-dessous, `/tmp/corps-decision-13.md` :

```markdown
# Décision Créateur — ratification de `5b047e0`, et GO de transport vers les deux branches de PR

GO ratification.

## Les mots de la décision

Transcrits du message de Frédéric :

> 1. Ratifier `5b047e0`, en enregistrant la non-conformité procédurale.
> 2. Autoriser explicitement le transport Git vers les deux branches PR non protégées, et
>    uniquement elles : `fdj-vague1-cycle-caisse-20260916` pour #62 et
>    `reception-regularisation-20260919` pour #65.
> 3. Faire pousser les intégrations préparées par Claude, puis considérer les SHA GitHub
>    obtenus comme les nouveaux candidats, pas `fe4e9a2`/`fe36a8e` par confiance implicite.
> 4. Laisser la CI repartir sur chacun et vérifier les preuves ordinaires sur ces SHA exacts.
> 5. Inscrire explicitement au dossier que la recette navigateur profonde n'existe pas pour
>    leur SHA. Ne pas transformer son absence en succès ou en preuve équivalente.
> 6. Une fois les deux dossiers constitués, seulement alors décider de leur promotion
>    Production. Aucune fusion Production automatique.

> Donc oui : je ratifierais toujours `5b047e0`. Et, au vu du rapport de Claude, je donnerais
> également le GO au transport des deux intégrations vers leurs branches PR non protégées,
> strictement pour déclencher et obtenir les preuves CI. Pas de GO Production.

## Ce qui est ratifié

La justesse de `5b047e0` — la suppression du repli silencieux de
`.github/workflows/claude.yml`, telle que mesurée par `request-13` §2.

**La non-conformité procédurale reste explicitement inscrite au registre** : ce commit a été
déposé directement sur `main`, sans pull request, sans enveloppe préalable et sans revue. La
ratification ne transforme pas ce geste en geste conforme, ne réécrit pas l'historique et ne
crée aucun précédent. Le prochain changement de CI passe par une enveloppe.

## Ce qui est autorisé en plus, et rien d'autre

Le transport Git vers **deux branches de PR non protégées, et uniquement elles** :
`fdj-vague1-cycle-caisse-20260916` (#62) et `reception-regularisation-20260919` (#65),
strictement pour déclencher et obtenir les preuves CI. Cette autorisation ne couvre ni `main`,
ni `production`, ni le rail `handoff-continuite-20260920` lui-même.

## Ce qui n'est pas autorisé

**Pas de GO Production.** Aucune fusion vers `production`, aucun déploiement, aucune migration
Supabase Production, aucune écriture de données Production. Les dossiers de décision de #62 et
#65 se constituent d'abord ; la promotion se décide ensuite, séparément, jamais
automatiquement.
```

Pourquoi `APPROVED_WITH_CONDITIONS` et non `APPROVED` : le corps pose des réserves qui
survivent au GO — la non-conformité reste inscrite, le transport est borné à deux refs, et la
Production est exclue. `APPROVED` les effacerait. `GO_RATIFICATION`, employé en
`decision-12.md`, est hors vocabulaire et a coûté une dérogation de plus : ne pas le reprendre.

## 2. Commande de dépôt

```bash
cd /Users/fredericbragance/Documents/nexus-worktree-handoff-continuite && node outils/handoff.js decision NEXUS-CONTINUITE-TERRAIN-1-20260920 /tmp/corps-decision-13.md --decision APPROVED_WITH_CONDITIONS --closes false --en-reponse-a request-13.md --auteur Frederic
```

`closes: false` : le lot reste ouvert — les dossiers #62 et #65 et la question B1 y vivent
encore.

## 3. La dérogation que ce dépôt réclame

Mesure prise : après ce dépôt, `handoff.js verifier` rend **une** violation et une seule,
`SEQUENCE_NON_CONTIGUE` sur `decision-13.md`. Entrée à ajouter à la liste `derogations` de
`docs/handoff/STATE.json` — le champ `le` se met à la date réelle du geste :

```json
{
  "fichier": "NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-13.md",
  "regle": "SEQUENCE_NON_CONTIGUE",
  "motif": "decision-13.md est la 11e decision reelle du lot et porte le rang 13, parce que decision-12.md porte deja le rang 12 pour la 10e — decision-10.md et decision-11.md n'ont jamais existe. Defaut de FORME seulement, et HERITE : ce n'est pas un ecart de ce depot mais la consequence mecanique de la mauvaise numerotation de decision-12.md, deja derogee le 22/09/2026. L'outil handoff.js decision numerote derniere+1, donc 13 ; la seule numerotation contigue serait 11, c'est-a-dire glisser cette decision AVANT decision-12.md alors qu'elle est deposee apres — fabriquer un ordre qui n'a pas eu lieu, ce que l'append-only interdit. Le fichier n'est ni renomme ni reecrit. Consequence a assumer : ce lot ne peut plus produire une decision contigue, et chaque decision suivante appellera la meme derogation.",
  "autorise_par": "Frédéric Bragance (gate humaine)",
  "le": "2026-09-22"
}
```

## 4. Après le dépôt

```bash
cd /Users/fredericbragance/Documents/nexus-worktree-handoff-continuite && node outils/handoff.js verifier && node outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-1-20260920
```

## 5. Ce que la dérogation rend permanent — réponse à la revue du 22/09/2026

Frédéric : « Je ne signerais pas encore une dérogation à ton nom sans lire
`preparation-du-verdict-13.md` et vérifier précisément ce qu'elle rend permanent. Il faut éviter
de réparer une anomalie de gouvernance en créant une nouvelle exception mal cadrée. »

### 5.1 Sa portée exacte, mesurée dans le code

La règle est `outils/handoff.js:250` : `decisions.forEach((e, i) => { if (e.seq !== i + 1) … })`.
Le `seq` est lu **du nom de fichier** (`outils/handoff.js:181`), et le contrôle est **positionnel**
sur la liste triée. Les décisions du lot courent 1..9 puis 12 : le 12 occupe l'index 9, attendu
10 — `decision-12.md` est donc **déjà** en violation, et c'est ce que couvre la dérogation
accordée le 22/09. Déposer `decision-13.md` ajoute une **deuxième** violation, à l'index 10.

Une dérogation est indexée par `fichier` **et** `regle`. Celle-ci nommerait
`NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-13.md` + `SEQUENCE_NON_CONTIGUE`, qualifiée par le
lot et non par le seul basename. Elle ne crée donc **aucune règle générale** : elle ne tolère pas
`SEQUENCE_NON_CONTIGUE` ailleurs, ni dans un autre lot, ni pour un autre fichier de ce lot. Sur
ce point, l'exception est bien cadrée — elle est aussi étroite que l'outil le permet.

### 5.2 Ce qui n'est pas cadré : la récurrence

Le défaut n'est pas dans la portée d'une dérogation, il est dans leur **nombre**. Le contrôle
étant positionnel, **chaque décision future de ce lot ajoutera une violation de plus**, et donc
une dérogation de plus. Le motif préparé au §3 le concède déjà : « ce lot ne peut plus produire
une decision contigue, et chaque decision suivante appellera la meme derogation. »

Or ce lot a au moins trois décisions en attente : **B1** (l'accès du remplaçant), et les **deux
GO/NO GO** de #62 et #65. Signer aujourd'hui sans rien changer, c'est donc s'engager à signer
quatre dérogations au total pour un seul défaut de numérotation. C'est la définition du
colmatage qui récidive.

Le registre porte d'ailleurs déjà sa propre doctrine sur ce point, dans le motif d'une dérogation
existante : « le contrat n'est manifestement pas assez découvrable, ce qui est posé en question
au lot suivant plutôt que dérogé indéfiniment. »

### 5.3 La réparation à la base

Elle ne demande aucun code neuf et aucun module neuf. `echanges()` ne compte que les
`decision-N.md` **du répertoire du lot** : un lot neuf repart à `decision-1` et est contigu par
construction. `enregistrer-lot` rejoue `validerEnveloppesLot` avant d'inscrire, donc la
contiguïté d'un lot successeur est vérifiée, pas supposée.

La contrainte qui demeure : `in_reply_to` doit désigner une demande **du même lot**
(`IN_REPLY_TO_AUTRE_LOT`, `outils/handoff.js:290`). `request-13.md` vivant ici, le verdict 13 doit
être déposé ici. **Cette dérogation-ci est donc inévitable** si l'on veut répondre à la demande
13 sans fabriquer après coup une enveloppe qui n'a jamais existé — ce que le protocole interdit.

Ce qui est évitable, ce sont les trois suivantes. D'où la correction proposée à la commande du §2 :

- `--closes true` au lieu de `--closes false` : `decision-13.md` **ferme** le lot. Le code ne
  l'interdit pas — `closes` n'exige pas que toutes les demandes soient répondues
  (`outils/handoff.js:274` ne valide que `true|false`).
- les trois questions encore ouvertes (B1, GO/NO GO #62, GO/NO GO #65) sont reposées dans un lot
  successeur, numéroté proprement à partir de `request-1`.

**Bilan des deux voies :** une seule dérogation et le défaut s'arrête à 13 ; ou quatre
dérogations et un lot qui ne peut plus jamais être conforme. La première est ce que demande
l'instruction permanente : réparer à la base, ne pas colmater.

**Ce document reste non signé.** Le choix entre `--closes true` et `--closes false` appartient à
Frédéric, comme la signature elle-même et le `autorise_par` de la dérogation.
