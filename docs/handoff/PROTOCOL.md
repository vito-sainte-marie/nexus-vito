# NEXUS Handoff Protocol v2

Branche de travail autorisée : `config-par-environnement`.
Refs protégées, jamais touchées par un handoff : `main`, `production`.

Objectif inchangé depuis v1 : GitHub est le canal de transmission versionné et
auditable entre Claude et ChatGPT. Ce que v2 ajoute, c'est que **le protocole
ne repose plus sur la discipline de ses acteurs** — il est validé par machine.

## Pourquoi v2

v1 a servi sur deux lots. L'audit de son propre historique a montré quatre
défauts, tous du même genre que ceux que la recette a trouvés dans NEXUS : un
contrat que seule la bonne conduite fait respecter.

1. **Une fenêtre de décision périmée a réellement existé.** Au commit
   `67ecdce`, le dépôt portait une demande S-5 ouverte face à une décision S-4
   déjà consommée et toujours d'apparence autoritaire.
2. **Le vocabulaire a dérivé.** `APPROVED_CLOSED`, absent du protocole, a
   fermé les deux seuls lots aboutis. `APPROVED` n'a jamais servi.
3. **Les deux fentes étaient écrasées** à chaque tour ; aucun lot n'était
   adressable par son identifiant.
4. **Rien ne marquait une décision comme consommée.**

## Structure

```text
docs/handoff/
  CURRENT.md          # MIROIR v1 — compatibilité, jamais la source
  DECISION.md         # MIROIR v1 — compatibilité, jamais la source
  STATE.json          # état machine
  lots/<LOT_ID>/request-N.md, decision-N.md   # source canonique, append-only
```

Le registre est **append-only**. Une correction produit un nouvel échange ;
elle ne modifie pas un échange déjà déposé. Les miroirs restent lisibles tels
quels par qui ne connaît que v1 — leur en-tête dit qu'ils ne sont pas la
source, pour que personne ne les édite en croyant agir sur le protocole.

`legacy_before_v2` : S-4 et S-5 se sont déroulés avant le registre. Ils ne
sont **pas** reconstruits — `STATE.json` les référence par leurs commits.
Fabriquer après coup des échanges qui n'ont jamais existé serait inventer un
passé plausible, ce qu'A18 et S-5/Q7 interdisent.

## Enveloppe

Front-matter en tête de chaque fichier du registre. Grammaire volontairement
étroite : `clef: valeur`, plus des listes d'objets plats. **Une ligne non
reconnue est une erreur, jamais un silence** — ignorer ce qu'on ne comprend
pas est précisément la mécanique qui a laissé le vocabulaire dériver.

Demande : `protocol`, `kind: request`, `lot_id`, `seq`, `author`, `branch`,
`status`, `token_mode`, `preuves`.
Décision : `protocol`, `kind: decision`, `lot_id`, `seq`, `author`, `branch`,
`decision`, `closes`, `in_reply_to`.

Optionnel, sur l'une comme sur l'autre : **`wake_to`**, l'adresse où réveiller
le destinataire du lot. Elle est donnée par l'ordre — Claude la pose en ouvrant
le lot, l'Orchestrateur peut la reposer dans une décision — et la déclaration
la plus récente du lot fait foi. C'est délibérément une **adresse libre** et
non un vocabulaire clos : une URL d'issue aujourd'hui, autre chose demain. La
règle est qu'aucun outil ne code de destinataire en dur ; changer de canal doit
rester un fait écrit dans le rail, jamais une modification de code.

## Vocabulaire clos

| Champ | Valeurs |
|---|---|
| `status` (demande) | `AWAITING_DECISION` |
| `decision` | `APPROVED`, `APPROVED_WITH_CONDITIONS`, `BLOCKED`, `NEEDS_EVIDENCE` |
| `closes` | `true`, `false` |
| `token_mode` | `LEAN`, `STANDARD`, `DEEP` |
| `classe` de preuve | `VERIFIED`, `DECLARED`, `HUMAN`, `NOT_APPLICABLE` |

**`APPROVED_CLOSED` n'est pas canonique.** Il reste *lisible* comme valeur
legacy pour S-4 et S-5, que le validateur normalise en mémoire en
`decision=APPROVED, closes=true` sans jamais réécrire les fichiers. Un fichier
du registre v2 qui l'emploie échoue : la décision d'arbitrage et le cycle de
vie du lot sont deux choses, et les confondre est ce qui a produit la dérive.

## Provenance des preuves

Une preuve porte toujours sa classe, et **une preuve `DECLARED` ne doit jamais
être présentée comme équivalente à une preuve `VERIFIED`**.

- `VERIFIED` — recalculée ou constatée par l'outillage. Aujourd'hui : l'état
  des refs protégées, le résultat de la suite mesuré par la CI.
- `DECLARED` — fournie par l'agent, non revérifiable dans le contexte courant.
  Le commit déployé et l'état Supabase en font partie : la CI n'a ni réseau ni
  identifiants pour les constater. Ils le resteront tant qu'un contrôleur
  indépendant n'existera pas.
- `HUMAN` — dépend d'une observation humaine réelle (rejeu navigateur, PIN).
- `NOT_APPLICABLE`.

## Mode de raisonnement

`token_mode` déclare la profondeur de travail : `LEAN` pour une tâche simple,
locale et déterministe ; `STANDARD` par défaut ; `DEEP` pour la sécurité,
l'architecture, la RLS, les migrations, la concurrence, l'intégrité des
données, le multi-site, une anomalie non résolue ou un impact Production.

Partir du niveau le plus faible **compatible avec la sécurité de la tâche** et
escalader si le diagnostic révèle davantage de complexité. Le mode ne réduit
jamais la qualité des preuves : **on économise les tokens sur la prose, jamais
sur les vérifications**. Le validateur ne contrôle que le vocabulaire — juger
si un agent « a assez réfléchi » n'est pas une question qu'une machine tranche.

## Ce que la CI bloque

Immédiatement, sans exception : `lot_id` absent, malformé ou incohérent ;
statut ou décision hors vocabulaire ; `APPROVED_CLOSED` dans un fichier v2 ;
`in_reply_to` absent, inexistant, ou désignant un autre lot ; séquence
trouée ; enveloppe illisible ; `STATE.json` invalide ou en désaccord avec le
registre ; plus d'un lot actif ; consommation sans commit ; **branche
déclarée protégée ou différente de la branche autorisée** ; **refs protégées
déclarées différentes de celles constatées**.

Ces deux derniers points sont des invariants de sécurité : ils ne sont jamais
ramenés à un avertissement, et une ref protégée illisible est un échec, pas
une tolérance.

**Lot d'observation** : l'écart entre le résultat de suite déclaré et celui
mesuré est un simple avertissement, le temps de calibrer. À la fin de ce lot,
Claude doit proposer l'arbitrage décidant quelles preuves recalculées
deviennent bloquantes.

## Format de `in_reply_to`

La forme attendue est le **nom de fichier nu** : `in_reply_to: request-N.md`.
Un chemin complet désignant le même fichier du même lot est normalisé par son
nom de base plutôt que refusé — c'est de la manipulation de chemin, pas du
vocabulaire, et l'accepter n'ouvre aucune ambiguïté de modèle. Un chemin qui
désigne un `lot_id` différent de celui du répertoire courant est en revanche
toujours refusé (`IN_REPLY_TO_AUTRE_LOT`) : une décision n'arbitre que les
demandes de son propre lot.

La validité d'une décision dépend de la demande qu'elle référence
(`in_reply_to` doit exister dans ce même lot) et, si une décision antérieure a
déjà répondu à la même demande, de la relation de supersession explicite
portée par un champ `supersedes_..._of` — **jamais** d'une comparaison
numérique entre le rang de la décision (`decision-N`) et celui de la demande
visée (`request-N`). Ces deux séries sont numérotées indépendamment (voir
« Numérotation » ci-dessous) ; les comparer pour juger une relation a produit
un faux blocage sur `decision-3.md` répondant légitimement à `request-2.md`
du lot `CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906`, corrigé le
2026-09-06. Concrètement, sont légitimes sans dérogation : plusieurs décisions
successives répondant à la même demande tant que chacune au-delà de la
première porte un `supersedes_..._of` vers la précédente ; et une décision
répondant à une demande plus récente que celle visée par la décision
précédente, quel que soit l'écart entre les deux rangs de décision.

Seule la consommation (`handoff.js consommer`) exige que la dernière décision
réponde à la demande **active** (la plus récente du lot) : c'est là, et
seulement là, que la fraîcheur est vérifiée — pas à chaque validation du
registre, où une décision plus ancienne reste un fait historique légitime.

## Numérotation

`request-N.md` et `decision-N.md` sont numérotés par **ordre d'arrivée dans le
registre**, à partir de 1, sans trou, **chacun dans sa propre série**. La
première décision déposée est `decision-1.md`, quel que soit ce qui a précédé
le registre sous v1. La contiguïté est ce qui permet de détecter un échange
supprimé — c'est la garantie d'append-only elle-même, et elle ne se déroge
pas à la légère. Les deux séries ne sont jamais comparées entre elles pour
juger de la validité d'une relation `in_reply_to` (voir ci-dessus).

## Dérogations

Un dépôt non conforme n'est ni renommé ni réécrit : renommer le dépôt d'un
tiers violerait l'append-only, et assouplir la règle la viderait de son sens.
Quand la gate humaine estime l'écart acceptable, il est inscrit dans
`STATE.json` :

```json
"derogations": [
  { "fichier": "…", "regle": "CODE", "motif": "…", "autorise_par": "…", "le": "…" }
]
```

La violation visée devient alors un **avertissement permanent et bruyant**,
réaffiché à chaque exécution. Elle n'est pas effacée : elle est assumée, datée
et attribuée. Une dérogation ne couvre que la règle et le fichier qu'elle
nomme ; les champs sont tous obligatoires, faute de quoi elle n'est pas
auditable et le validateur la refuse.

**Aucune dérogation n'est recevable sur un invariant de sécurité** —
`BRANCHE_PROTEGEE`, `BRANCHE_INATTENDUE`, `REFS_PROTEGEES`,
`REFS_ILLISIBLES`. Sans cette exclusion, le mécanisme d'exception deviendrait
la porte de sortie qu'il est précisément censé ne pas être.

## Consommation

`consommer` **valide le registre avant d'écrire quoi que ce soit**. Enregistrer
la consommation d'une décision que le protocole refuse serait exactement le
silence que ce protocole existe pour supprimer.

## Couche événementielle — et sa limite

- `event detected` — la CI a validé une demande ou une décision.
- `session resumed` — une session vivante a repris sur cet événement.
- `session unavailable` — **rien ne réveille une session éteinte.**

Cette architecture est événementielle ; elle **n'est pas** une autonomie 24/7,
et ne doit jamais être présentée comme telle. Aucun runner externe ne démarre
aujourd'hui une session Claude. Le futur NEXUS Orchestrator pourra fournir ce
réveil ; **ne pas simuler cette capacité avant qu'elle existe**. Jusque-là, le
secours est humain, et c'est une raison de plus pour que les miroirs v1
survivent.

## Cycle

Le cycle complet, de la demande au réveil :

```
Claude
  │  handoff.js demande <LOT_ID> <corps.md>
  ▼
request-N.md  (+ miroirs v1 régénérés)
  │  git push
  ▼
GitHub
  │  tests.yml sur push: ['**']
  ▼
handoff.js verifier  —  l'enveloppe est-elle recevable ?
  │
  ▼
watcher ChatGPT      —  HORS DÉPÔT : lit la branche, arbitre
  │  commit
  ▼
decision-N.md
  │  @claude          —  GESTE : un commentaire, posté par quelqu'un
  ▼
claude.yml (sur main)
  │  issue_comment · pull_request_review_comment
  │  pull_request_review · issues
  ▼
Claude
  │  handoff.js consommer <LOT_ID>
  ▼
STATE.json marque la consommation
```

Les maillons ne sont pas de même nature, et les confondre est la façon la plus
simple de croire le rail automatique alors qu'il ne l'est pas. Chacun se classe
avec le vocabulaire de preuve du protocole lui-même :

| Maillon | Ce qui le porte | Classe |
| --- | --- | --- |
| `request-N.md` | `outils/handoff.js demande` | `VERIFIED` |
| Contrôle d'enveloppe | `tests.yml` → `handoff.js verifier` | `VERIFIED` |
| Épreuves du validateur | `tests.yml` → `test_handoff_v2_20260905.js` | `VERIFIED` |
| `decision-N.md` | watcher ChatGPT, hors de ce dépôt | `DECLARED` |
| Mention `@claude` | personne ; c'est un geste | `HUMAN` |
| Réveil sur mention | `.github/workflows/claude.yml`, sur `main` | `VERIFIED` |
| Consommation | `outils/handoff.js consommer` | `VERIFIED` |
| Réveil de l'Orchestrateur | `tests.yml` → `reveil-orchestrateur.js`, publié sur #28 | `VERIFIED` |
| Qualification d'un retour | `tests.yml` → `qualifier-rapatriement.js` | `VERIFIED` |
| Transport vers le rail | `tests.yml` → `rapatrier-vers-rail.js` | `VERIFIED` |
| Vérification destination | `git ls-remote` dans `pousser()` | `VERIFIED` |
| Veille de stagnation | `outils/watchdog-stagnation.js` | `DECLARED` |

La ligne « Veille de stagnation » est `DECLARED` et non `VERIFIED` pour une
raison précise : le code est éprouvé, mais aucun workflow ne l'appelle. Voir
« Ce que l'autonomie n'autorise pas » plus bas.

**Le 30/09/2026, l'armement a été accordé, puis le geste a été posé** (voir
« L'armement du transport » plus bas). Les deux lignes « Transport vers le
rail » et « Vérification destination » passent à `VERIFIED` parce qu'un run
réel a été franchi, et ce document le nomme, comme il s'y était engagé :

| Ce qui a été mesuré | Valeur relevée |
| --- | --- |
| Run | `36805064153`, étape « Rapatriement vers le rail », `completed/success` |
| Branche source | `claude/issue-28-20260930-1350` |
| Destination | `handoff-continuite-20260920` |
| SHA transporté | `eea776a2a3e2e7b8dc148329c4208202d089ace9` |
| Destination avant | `4f30d17e…` |
| Destination relue après | `eea776a2a3e2e7b8dc148329c4208202d089ace9` |
| État publié | `EXECUTE` / `TRANSPORTE` |

La relecture de destination a été refaite une seconde fois hors du run, par un
`git ls-remote origin refs/heads/handoff-continuite-20260920` indépendant : elle
rend le même SHA. C'est ce qui distingue ici `VERIFIED` de `DECLARED` — non pas
que l'outil l'affirme, mais que la destination le porte quand on la rouvre.

Deux réserves, qui ne retirent rien à la classe mais la bornent.

**Une capacité constatée n'est pas une autorisation.** Ce transport a été
possible parce que `NEXUS_RAPATRIEMENT_ARME` valait `oui` et que `tests.yml`
déclarait `contents: write`. Retirer l'un des deux rend le maillon
`HUMAN_DECISION_REQUIRED`, et c'est le comportement voulu : la permission
technique ne décide de rien, l'autorité déclarée dans la mission décide.

**Et c'est une observation datée.** `VERIFIED` ici veut dire « franchi le
30/09/2026 », pas « franchissable ». Un transport qui échouerait en octobre ne
contredirait pas cette ligne : il demanderait une nouvelle mesure.

**Ce que le run ne montre pas encore.** Depuis le 30/09/2026, la qualification
publie `details.ci_requises` et `details.ci_non_requises` — qui exigeait quoi,
et sous quelle autorité. Ces deux listes vont dans l'état machine
(`$NEXUS_ETAT_FICHIER`), qu'aucune étape ne recopie dans le journal. Un humain
qui lit le run voit donc le verdict du transport, mais pas ce qui l'a rendu
vert. La preuve existe et reste illisible à l'œil : c'est une lacune
d'observabilité nommée, pas un transport non prouvé.

Quatre remarques que le schéma seul ne dit pas.

**Le watcher n'est pas dans ce dépôt.** Rien ici ne le démarre, ne le surveille
ni ne prouve qu'il tourne. Son absence ne produit aucun rouge : elle produit un
lot qui attend indéfiniment. Un lot sans décision depuis longtemps est le seul
symptôme, et il faut aller le chercher.

**La mention `@claude` est un geste, pas un maillon outillé.** `claude.yml`
réagit à un commentaire ; il n'en poste aucun. C'est le même mur que
« Couche événementielle — et sa limite » : la décision peut être déposée,
validée, et rester sans effet tant que personne ne mentionne Claude. Écrire un
outil qui poste la mention à la place de l'humain reviendrait à simuler le
réveil que le protocole interdit de simuler.

**Le sens retour a maintenant un déclencheur — ce paragraphe disait le
contraire jusqu'au 30/09/2026.** `outils/reveil-orchestrateur.js` répond à la
question symétrique de `reveil-handoff.js` : « reste-t-il une demande que
personne n'a arbitrée ? ». Il lit le registre, dit où la demande se lit
réellement — en interrogeant git, car le champ `branch` d'une enveloppe est une
intention, pas une adresse — et compose le corps du réveil. Il n'écrit toujours
rien lui-même ; c'est `tests.yml` qui l'appelle à chaque passage sur le rail et
qui **publie** le corps obtenu sur l'issue #28, grâce au `issues: write` accordé
le 28/09/2026. La publication est **dédoublée par empreinte de contenu** et non
par horodatage : republier deux fois le même réveil rend `NO_WORK`, pas un
second commentaire.

Deux précisions, parce que la formulation précédente s'est révélée fausse et
qu'on ne veut pas la remplacer par une autre affirmation non mesurée. D'une
part, ce qui manquait n'était pas un droit mais un câblage : le droit existait
depuis deux jours quand ce texte affirmait encore « le jeton de `tests.yml` ne
peut pas écrire de commentaire ». Une documentation qui **affirme** un état du
monde au lieu de le **mesurer** finit toujours par mentir ; c'est exactement le
défaut que la suite de ce document outille. D'autre part, publier le réveil ne
publie pas la mention : le commentaire posté par le jeton intégré ne déclenche
aucun run, et écrire « @claude » dedans serait de toute façon refusé par
l'étape elle-même. Le maillon humain se déplace d'un cran — il ne disparaît
pas.

**Le réveil vit sur `main`, pas sur la branche de travail.** C'est le
fonctionnement normal de `issue_comment` et `issues`, qui ne connaissent que la
branche par défaut. Modifier `claude.yml` sur une branche de handoff ne change
donc rien au réveil : seule la version présente sur `main` s'exécute.

Une décision déjà consommée ne se rejoue pas : la commande refuse et n'écrit
rien.

## Retour de travail — de la branche Claude au rail

Le cycle ci-dessus s'arrête à la consommation d'une décision. Il ne dit rien du
chemin inverse : **le travail produit par Claude doit revenir sur le rail**, et
jusqu'au 30/09/2026 ce maillon n'existait pas. Claude travaillait sur
`claude/issue-*`, la CI passait au vert, et plus rien ne bougeait : quelqu'un
devait le remarquer, rapatrier à la main, et relancer. C'est là que la chaîne
s'arrêtait — pas sur une panne, sur une absence.

**Une tâche n'est jamais livrée parce qu'un commit existe sur une branche
Claude.** Elle est livrée quand la destination porte le SHA attendu, et que
cette destination a été **relue**. Tout lot passe donc obligatoirement par sept
étapes, dans cet ordre :

| # | Étape | Ce qui la porte | Ce qu'elle prouve |
| --- | --- | --- | --- |
| 1 | **demande** | `outils/handoff.js demande` | l'intention est écrite, datée, attribuée à un lot |
| 2 | **exécution** | le run Claude sur `claude/issue-*` | un travail existe, à un SHA nommé |
| 3 | **preuve** | `tests.yml` sur `push: ['**']` | les épreuves déterministes passent sur ce SHA |
| 4 | **qualification** | `outils/qualifier-rapatriement.js` | douze conditions nécessaires sont mesurées, pas supposées |
| 5 | **transport** | `outils/rapatrier-vers-rail.js` | avance rapide vers le rail, ou refus explicite |
| 6 | **vérification destination** | `git ls-remote` dans `pousser()` | le rail porte réellement le SHA attendu |
| 7 | **continuation** | `outils/reveil-orchestrateur.js` | le rail ayant bougé, le signal suivant est calculé |

Aucune étape ne se déduit de la précédente. L'étape 6 existe parce qu'un
`git push` qui rend 0 dit que la commande s'est bien passée, pas que la branche
distante porte ce SHA ; l'étape 4 existe parce qu'un vert de CI dit que les
épreuves passent, pas que le diff appartient au lot.

### Ce qui est mesuré avant tout transport

`qualifier-rapatriement.js` refuse tant qu'une seule de ces conditions n'est pas
**prouvée** : branche rattachable sans ambiguïté au lot et au rail déclarés ;
`NEXUS_BASE_BRANCH` explicite et concordante ; SHA de base connu ; HEAD Claude
exact et non ambigu ; destination rail exacte ; aucun changement Production ;
aucun changement hors périmètre autorisé ; aucun secret ; aucun affaiblissement
de garde ; épreuves déterministes vertes ; absence de divergence incompatible ;
diff inspectable et attribuable.

Deux règles de lecture valent pour tout le mécanisme :

- **`null` veut dire « non mesuré », jamais « non ».** Une ascendance qu'on n'a
  pas pu calculer donne `ASCENDANCE_NON_MESUREE`, pas « pas d'ascendance ». Un
  corpus tronqué donne `CORPUS_NON_MESURE`, pas « rien trouvé ». Répondre n'est
  pas résoudre.
- **En cas de divergence, conflit, ambiguïté ou modification hors périmètre :
  refus explicite.** Jamais de rebase, de merge ni de résolution automatique :
  cela produirait un arbre que personne n'a testé.

### Aucun refus silencieux

Règle permanente de la procédure NEXUS. Un workflow ne peut plus apparaître
`success` en ayant refusé l'action essentielle sans signal exploitable. Chaque
maillon publie un **état machine** pris dans une liste fermée :

| État | Sens | Rougit la CI ? |
| --- | --- | --- |
| `EXECUTE` | le geste a été fait | non |
| `NO_WORK` | il n'y a légitimement rien à faire | non |
| `BLOCKED` | quelque chose attend et n'avancera pas seul | non |
| `HUMAN_DECISION_REQUIRED` | un geste réservé à Frédéric est nécessaire | non |
| `FAILED` | le maillon est en panne | **oui** |

La couleur n'est pas le signal — l'état l'est. Transformer chaque `NO_WORK` en
rouge apprendrait à l'équipe à ignorer le rouge, et on retomberait sur le même
aveuglement par l'autre bout. En contrepartie, tout état qui arrête la chaîne
(`BLOCKED`, `HUMAN_DECISION_REQUIRED`, `FAILED`) **doit** nommer ses six
champs : `condition`, `sha`, `branche`, `lot`, `maillon`, `prochaine_action`.
`outils/etat-maillon.js` lève si l'un manque, et publie sur quatre canaux —
annotation de run, résumé de job, sortie d'étape, fichier JSON.

### Un refus audible peut être faux — la classe de panne du 01/10/2026

« Aucun refus silencieux » répond à une panne : le système se tait. Il en existe
une seconde, qui se présente exactement comme un fonctionnement correct — le
système parle, sur les quatre canaux, avec cause et prochaine action, **et il a
tort**.

Le 30/09/2026, le travail `119b2f8f` était terminé, sa CI verte, le transport
armé, et il était fast-forwardable depuis le rail. Il n'est jamais parti.
L'étape de rapatriement a publié, dans un run vert :

> `[HUMAN_DECISION_REQUIRED] rapatriement-claude-vers-rail (CHANGEMENT_PRODUCTION)`
> `— Le diff introduit une cible Production dans 5 fichier(s).`

Aucun maillon n'était muet, aucune permission ne manquait, aucun `exit 0` ne
masquait quoi que ce soit. Les cinq lignes accusées étaient une cellule de
tableau Markdown, deux phrases de prose, un commentaire `//` et une fixture de
test : la garde confondait **nommer** Production et **la viser**. Le fichier le
plus abusivement accusé était `outils/garde-ordre-migration-code.js` — la garde
qui protège la migration Production, refusée au transport pour avoir nommé
Production dans un commentaire.

**La portée est ce qui compte.** Ce n'était pas un incident : tout travail
*portant sur* la procédure Production devenait non transportable, puisqu'un tel
travail doit nommer Production pour exister. La documentation de Production, ses
gardes et ses épreuves étaient structurellement exclues du rail.

Trois règles en sortent, toutes vérifiées par
`test_cible_production_vs_mention_20261001.js` et gardées par quatre mutations.

1. **Une écriture vers Production exige une adresse ou un pointeur.** Le nom nu
   du projet n'est ni l'un ni l'autre. Sont refusées partout, commentaires et
   prose compris, les formes actionnables : adresse `….supabase.…`, chaîne de
   connexion, URL de l'hôte, drapeau d'outil ou réglage pointé vers Production —
   un commentaire se décommente, une URL se copie. Le nom nu n'est une cible que
   là où une machine exécute la ligne : hors commentaire, et hors **position de
   parole** (`docs/`, `*.md`, `test_*.js`, `outils/garde-*.js`), dont le rôle
   est précisément de parler de Production.
2. **Un refus doit désigner.** Le motif nomme les fichiers et le marqueur qui a
   mordu ; « 5 fichier(s) » a obligé à rejouer la qualification en local pour
   savoir quoi corriger. Un refus qu'on ne peut pas instruire n'est pas
   actionnable.
3. **Ce qu'une garde laisse passer se publie.** Les mentions classées comme
   vocabulaire figurent dans `details.mentions_production` de l'état `EXECUTE`.
   Une garde qui laisse passer sans le dire redevient indistinguable d'une garde
   absente.

**La correction s'est heurtée à elle-même, et c'est le meilleur contrôle qu'on
en ait.** Mesurée sur son propre diff, elle se refusait son propre transport :
la garde porte les cinq motifs d'adresse, et l'épreuve qui prouve qu'elle mord
porte quatre vraies adresses en contre-témoins. On ne reconnaît pas une adresse
sans l'écrire. D'où un **corpus de reconnaissance** — une liste **close et
nommée** de deux chemins, jamais un motif : `test_*.js` laisserait n'importe
quelle épreuve future embarquer une chaîne de connexion. Dans ces deux fichiers
seulement, la forme actionnable est un spécimen, publié sous
`details.specimens`. Un cliquet épingle le contenu exact de la liste : toute
entrée supplémentaire rougit la suite et appelle un humain. Le corpus excuse
l'adresse — publique dans ce dépôt — jamais ce qui permet d'y entrer : la garde
des secrets reste entière au-dessus.

**Et la même mesure a trouvé l'étage d'après — qui se règle autrement.** La
version portant le corpus a été refusée à son tour, `BLOCKED
(SECRET_DETECTE)` : le contre-témoin qui prouve qu'un secret reste un secret
écrivait une chaîne de connexion en toutes lettres. La garde avait raison, et le
corpus ne l'excusait pas — par construction, puisque ce contre-témoin-là l'exige.
Élargir `MOTIFS_SECRET` pour faire passer son propre test aurait été affaiblir la
garde : `MOTIFS_SECRET` est inchangé. Le contre-témoin **compose** désormais la
chaîne à l'exécution ; la garde reçoit exactement ce qu'elle doit refuser, et le
fichier n'en porte aucune forme. Un cliquet lit la source de l'épreuve et rougit
si le littéral revient. **La ligne de partage est là, et elle vaut au-delà de ce
cas** : nommer une adresse publique est du vocabulaire et s'excuse par une liste
close ; écrire ce qui permet d'entrer ne s'excuse jamais, et se contourne en ne
l'écrivant pas.

**Comment cette classe se détecte désormais.** Le capteur `branches-en-rade`
publie à chaque run la liste des branches Claude non rapatriées. Une branche qui
reste `EN RADE` alors qu'elle est **verte, destinée au rail et fast-forwardable**
est le signal : le transport a conclu, et il a conclu faux. On ne la rapatrie
pas à la main — on relit l'état machine du run qui l'a refusée, on reproduit la
qualification sur la vraie plage, et on corrige la règle. Rapatrier à la main
masquerait la classe de panne au lieu de la fermer.

### Un maillon bloqué n'est pas une chaîne bloquée — la classe de panne du 02/10/2026

**Le geste manquant existait ; c'est son acheminement qui manquait.** Le 02/10/2026, le
correctif `station_config.fuseau_horaire` était écrit, prouvé par deux épreuves et présent
sur le rail. Son application sur `nexus-test` a été **refusée à ce maillon-ci** — refus
audible, motif `[Modify Shared Resources]`, aucune tentative de contournement. La chaîne
s'est arrêtée là. Elle n'a repris que parce qu'un humain a relayé le refus en conversation
et a demandé le geste à un autre maillon, qui l'a fait sans difficulté. **Ce relais humain
n'est pas un rail : c'est son absence qui s'est fait sentir.**

La classe de panne n'est donc pas « un agent n'a pas le droit ». C'est : *un agent sans le
droit s'arrête au lieu de désigner qui l'a.*

**1. Deux états que rien ne distinguait, et qui ne valent pas la même chose.**
« Droits réellement absents » est un des cinq seuls motifs d'interruption anticipée — mais
c'est une propriété de **la chaîne** : personne, nulle part, ne peut faire le geste. « Ce
maillon-ci ne peut pas » est une propriété **du maillon**, et ce n'est pas un motif
d'interruption : c'est une obligation d'acheminement. Les confondre transforme une
permission locale en blocage global. Le refus du 02/10 était du second type, et a été traité
comme du premier.

**2. Un maillon bloqué doit émettre une demande routable, avec l'enveloppe qui existe
déjà.** Rien n'est à construire — `outils/handoff.js` porte le véhicule complet :

    node outils/handoff.js demande <LOT> <corps.md> \
      --wake-to <destinataire> \
      --preuve <id>:HUMAN:<ce que le geste exige>

`HUMAN` appartient depuis toujours à `CLASSES_PREUVE`
(`VERIFIED | DECLARED | HUMAN | NOT_APPLICABLE`) : c'est exactement la classe d'une preuve
qu'un autre maillon doit produire. La réponse revient par
`handoff.js decision <LOT> <corps.md> --decision … --closes … --en-reponse-a request-N.md`,
où `in_reply_to` « n'est pas qu'une exigence de forme : c'est la désignation ». Le corps doit
nommer **le geste, ses préconditions et la preuve attendue** — pas la gêne du maillon.

**3. L'instrument de détection était déjà là, et il n'avait pas servi.** `handoff.js`
avertit déjà, à chaque invocation, qu'un lot est inacheminable :

> lots/<LOT> attend un arbitrage et aucun de ses échanges ne déclare `wake_to` — le réveil de
> l'Orchestrateur ne peut pas nommer de destinataire, donc il refuse de le composer.

Ce refus de composer est correct : une adresse ne se devine pas, pas plus qu'un rail. Ce qui
manquait n'était donc pas une mesure à construire, mais une mesure à **prendre**. `wake_to`
est une adresse libre, sans vocabulaire clos, précisément pour que désigner un maillon
n'exige pas d'étendre le protocole.

**4. Le maillon qui exécute le geste doit publier son effet mesuré, pas son intention.**
Le geste du 02/10 a bien été fait, et il a été rapporté comme « la migration
`20261002000000` a été appliquée ». Le registre Test porte `20261002233051` ; l'estampille
`20261002000000` n'y existe pas. Le nom du fichier n'est pas l'estampille — douzième
divergence de cette forme. Un rapport d'intention laisse le maillon suivant croire qu'il
peut citer le nom de fichier comme une preuve. Ce qui se publie est ce que le maillon
suivant pourra **re-mesurer** : l'estampille réellement posée, lue à la base.

**La portée est ce qui compte.** Rien de tout cela ne relâche une interdiction. Acheminer un
geste n'est pas l'accomplir : un maillon qui émet une demande ne s'octroie aucun droit, et
une demande acheminée reste sans effet jusqu'à sa décision. Et le refus lui-même reste une
**observation datée** : `[Modify Shared Resources]` le 02/10 ne devient jamais « cet agent ne
peut pas appliquer de migration » en novembre sans nouvelle mesure. La journée le démontre
dans les deux sens — le refus était réel, et le geste a eu lieu le même jour par un autre
maillon.

**Comment cette classe se détecte — et ce qui n'est pas encore gardé.** Un lot sans `wake_to`
est déjà détecté par `handoff.js` et l'avertissement s'imprime en clair, jamais silencieux.
**En revanche, rien ne mesure aujourd'hui qu'un maillon refusé a émis une demande plutôt que
de s'arrêter** : le dire fait partie du contrat, comme pour le watchdog qui n'a pas de
déclencheur. Un refus suivi d'un silence et un refus suivi d'une demande produisent
actuellement le même registre. Fermer la classe demandera une garde qui tienne le maillon
pour responsable de son acheminement, pas de sa permission — et cette garde n'est pas
écrite. Tant qu'elle ne l'est pas, c'est une discipline, pas une garantie.

### Stagnation : la chaîne sait qu'elle est arrêtée

`outils/watchdog-stagnation.js` distingue le repos normal du travail en attente.
Sa notion de **progression réelle** est volontairement aveugle au numéro de run,
à l'horodatage et à l'auteur : elle compare une empreinte
`position | SHA | décision`. Un nouveau run qui ne change rien à ces trois
valeurs n'est pas une progression, c'est une boucle. Au-delà de
`CYCLES_SANS_PROGRES` cycles identiques, ou de `MAX_REPRISES` reprises, le
watchdog produit un signal de stagnation au lieu d'une relance — c'est ce qui
empêche `Claude → CI → Claude` de tourner à vide. La déduplication des réveils
suit le même principe : la marque publiée est une empreinte du **corps** du
réveil, pas de l'instant où il est calculé.

**Et il n'a pas de déclencheur — le dire fait partie du contrat.** Le module
est éprouvé (26 contrôles, 10 mutations) et appelé par aucun workflow. La
raison n'est pas un oubli : un watchdog branché sur `push` ne s'exécute que
lorsque quelque chose bouge, et **c'est précisément le cas qu'il ne sert à
rien d'observer**. Voir qu'une chaîne est arrêtée demande une horloge
indépendante d'elle, donc `schedule` — qui ne s'exécute que depuis la branche
par défaut. Tant que ce déclencheur n'existe pas sur `main`, la stagnation se
constate à la demande et non toute seule, et la ligne « Veille de stagnation »
du tableau des maillons reste `DECLARED`. C'est une limite nommée, pas une
capacité sous-entendue.

### Ce que l'autonomie n'autorise pas

L'autonomie recherchée porte sur les opérations déterministes intermédiaires.
Elle n'accorde **aucune** autorisation supplémentaire. Restent interdits sans
geste explicite de Frédéric : fusion vers `production` ; push sur `production` ;
déploiement Production ; migration ou écriture Supabase Production ;
contournement d'une gate ; affaiblissement d'une garde ; toute décision métier.
Lorsqu'un de ces gestes devient nécessaire, le maillon publie
`HUMAN_DECISION_REQUIRED` et s'arrête proprement, en nommant le geste.

Le corollaire tient en une phrase, et il vaut pour tout ce document :
**une capacité constatée n'est jamais une autorisation.** Que le jeton du
workflow puisse écrire ne dit rien de ce qu'il a le droit d'écrire ;
`outils/transport-autorise.js` répond à l'autorité déclarée dans la mission,
indépendamment de toute permission technique.

### L'armement du transport — ce qui a été accordé le 30/09/2026

Frédéric Bragance a accordé, le 30/09/2026, et dans ces termes :

> GO pour armer uniquement le transport déterministe Claude → rail selon le
> mécanisme validé du dossier §10. Autorisation limitée à `contents: write`
> strictement nécessaire au rapatriement vers `handoff-continuite-20260920`,
> avec `NEXUS_RAPATRIEMENT_ARME=oui`. Cette autorisation ne vaut ni push/merge
> Production, ni déploiement Production, ni écriture Supabase Production, ni
> affaiblissement d'une garde.

Deux choses ont donc changé, et deux seulement : `permissions.contents` passe à
`write` dans `.github/workflows/tests.yml`, et la variable de dépôt
`NEXUS_RAPATRIEMENT_ARME` vaut `oui`. L'autorité humaine est inscrite dans le
workflow lui-même, à côté de la permission, comme pour `actions: read`
(08/09/2026) et `issues: write` (26/09/2026) ;
`test_permissions_workflow_20260908.js` l'exige désormais aussi pour
`contents: write` — il en exemptait `contents` tant que la valeur était `read`,
qui est le défaut de tout workflow et n'élargit rien.

**Ce que l'armement ne déplace pas.** La liste des interdits ci-dessus est
inchangée, et aucun des trois verrous du transport n'a été touché : le rail doit
être DÉSIGNÉ par Frédéric dans le commentaire déclencheur — rien dans le dépôt
ne peut le deviner ni l'imposer depuis la CI — les conditions de
`qualifier-rapatriement.js` refusent `main`, `production`, tout diff qui touche
Production et tout diff qui affaiblit une garde, et la destination est RELUE
après le push. Retirer la variable désarme le transport sans toucher au
workflow ; retirer la permission le fait échouer visiblement, pas silencieusement.

**Ce que l'armement a réellement produit, le jour même.** L'armement n'est pas
resté une capacité : le run `36805064153` a transporté
`eea776a2a3e2e7b8dc148329c4208202d089ace9` de
`claude/issue-28-20260930-1350` vers `handoff-continuite-20260920`, et la
destination relue — dans le run, puis une seconde fois hors du run — porte ce
SHA. Le rail a avancé par machine, sans geste humain, pour la première fois.
Le détail de la mesure est au tableau des maillons.

**Et ce transport n'aurait pas pu partir la veille.** Ce n'est pas l'armement
seul qui l'a débloqué : `verificationsDuHead()` rendait les contrôles accrochés
au commit sans dire lesquels étaient *requis*, et le défaut `requis !== false`
les rendait donc tous obligatoires. `Supabase Preview` — structurellement
`skipped`, exigé par aucun ruleset, et dont le `details_url` pointe vers le
projet Supabase de Production — bloquait ainsi tout transport, avec un conseil
que personne ne pouvait suivre. L'autorité requise est désormais LUE sur la
branche de destination, et à défaut de mesure elle retombe sur une déclaration
datée non vide : à défaut de mesure, on exige plus, pas moins.

### Preuve de continuité

`test_continuite_bout_en_bout_20260930.js` rejoue la chaîne entière dans un
dépôt jetable — demande déposée, réveil calculé, rail identifié depuis le
déclencheur humain, branche de travail épinglée à ce déclencheur, CI verte,
qualification, transport armé, destination relue, empreinte de progression
changée. Aucune Production n'y figure, et l'épreuve le vérifie. Casser
volontairement un maillon la rend rouge ; c'est sa raison d'être, et elle porte
ses propres maillons cassés — M1, M3, M4, M5, M6, M7 — sans dépendre d'un
harnais extérieur.

Elle **n'est plus un banc de** `test_mutations_rapatriement_20260930.js`. Elle
l'a été, et l'y laisser coûtait 17 s à chaque mutation pour ne rien démontrer :
depuis que chaque mutation nomme le banc qui doit rougir, aucune ne la désigne,
donc aucune ne la faisait mordre. Ce qui fonde sa nécessité n'est donc pas le
harnais mais un fait mesuré : elle a trouvé un dossier `FAST_FORWARD` qui ne
nommait aucune ref source, que six bancs unitaires avaient laissé passer. Un
câblage ne se prouve pas en prouvant ses pièces.

## Gate humaine

Frédéric intervient pour les décisions produit majeures, les changements de
philosophie NEXUS, les arbitrages métier importants, la sécurité critique et
**toute autorisation de production**. Aucun handoff, aucune décision
d'arbitrage ne vaut autorisation de production.

## Protocole v1 — secours

v1 reste valide comme mode dégradé : `CURRENT.md` et `DECISION.md` portent le
dernier échange et se lisent seuls. Ses dix règles restent vraies ; v2 ne les
remplace pas, il les rend contrôlables. En cas de panne d'outillage, on
retombe sur v1 sans rien perdre.
