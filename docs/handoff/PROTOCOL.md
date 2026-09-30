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
| Transport vers le rail | `tests.yml` → `rapatrier-vers-rail.js` | `DECLARED` |
| Vérification destination | `git ls-remote` dans `pousser()` | `DECLARED` |
| Veille de stagnation | `outils/watchdog-stagnation.js` | `DECLARED` |

Les deux dernières lignes sont `DECLARED` et non `VERIFIED` pour une raison
précise : le code est éprouvé, mais le geste réel n'a jamais été posé sur le
dépôt, faute d'armement. Voir « Ce que l'autonomie n'autorise pas » plus bas.

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
