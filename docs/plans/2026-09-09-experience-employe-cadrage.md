# Expérience employé — cadrage

**09/09/2026 · Frédéric Bragance : « il faudra intégrer un parcours employé au lieu qu'il navigue seul, créer une expérience employé. »**

Ce document cadre. Il ne décide pas de l'ordre des gestes : cet ordre est du
métier, et le métier appartient à Frédéric. Ce qu'il fixe, ce sont le problème
mesuré, ce que le parcours doit et ne doit pas faire, ce qui se passe quand il
casse, comment on le prouvera, et à quoi on verra qu'il a marché.

---

## 1. Le problème, mesuré — pas supposé

Production, lecture seule, 09/09/2026. Fenêtre **depuis le 04/09**, date à
laquelle `mission_progress.shift_id` existe : avant, les coches n'étaient
rattachées à aucun service et ont été archivées, et les compter donnerait
« zéro mission » à des quarts qui en avaient.

| | |
|---|---|
| quarts | 18 |
| **sans aucune mission validée** | **16** |
| avec 1 ou 2 missions | **0** |
| avec 3 missions ou plus | 2 |

Les deux quarts engagés : **16 missions** (pompiste, 07/09) et **64** (renfort,
08/09).

**Trois lectures, et elles orientent tout le reste.**

**Le décrochage est binaire.** Zéro quart entre 1 et 2 missions. Personne ne
commence puis abandonne : soit rien, soit la tournée complète. Si un écran
cassait au milieu du parcours, on verrait des abandons à mi-course. Il n'y en a
aucun. **Le problème n'est donc pas dans la liste des missions — il est avant
elle.**

**Ce n'est pas une panne.** 80 coches depuis le 04/09 : le mécanisme fonctionne
parfaitement quand quelqu'un s'en sert. Le chemin existe et n'est pas emprunté.

**Même les engagés ne referment pas.** Les deux quarts à 16 et 64 missions sont
restés `en_cours`. Clôturer son service est un problème **séparé** de faire ses
missions, et il touche jusqu'à ceux qui adhèrent.

### Ce que l'employé a sous les yeux aujourd'hui

Après « Prise de poste confirmée », il revient à un accueil qui référence
Missions, Inventaire, Pointage, Brief, Tempo, Produits, Scanner et une douzaine
d'autres écrans. **Rien n'est cassé et rien ne manque** — l'accueil ne mène pas
dans un cul-de-sac, la vérification l'a confirmé.

Ce qui manque n'est pas un chemin : c'est une **suite**. NEXUS propose un
catalogue et laisse la personne choisir, pendant qu'elle a du travail réel à
faire, dans un outil dont elle pense déjà qu'il ne fonctionne pas. Le taux de
gens qui font cette démarche seuls est de **2 sur 18**.

---

## 2. Ce que le parcours doit faire — et ce qu'il ne doit pas faire

**Il doit remplacer une décision par un enchaînement.** C'est son seul objet.
À tout instant du service, l'employé doit avoir sous les yeux **une action
suivante**, pas un menu.

**Il ne doit PAS :**

- **ajouter des écrans.** Les écrans existent et fonctionnent. Le parcours
  *orchestre* ce qui est là ; il ne le remplace pas et ne le double pas ;
- **forcer.** Voir la contrainte de sécurité ci-dessous : un parcours qui exige
  l'attention au mauvais moment est dangereux, pas seulement agaçant ;
- **récompenser pour récompenser.** La station a déjà Progression, séries et
  Résultats d'équipe. Le problème mesuré n'est pas la motivation en cours de
  tournée — puisque personne n'abandonne en cours de tournée — c'est le
  démarrage ;
- **inventer une mesure du travail.** Le parcours conduit vers les gestes
  existants et enregistre ce qu'ils enregistrent déjà. Aucune nouvelle notion.

### La contrainte de sécurité, qui prime sur l'ergonomie

`NEXUS-Prise-De-Poste-v1.html` affiche déjà, pour le rôle pompiste :

> « N'utilisez jamais NEXUS ni votre téléphone à la vue d'un client.
> Strictement interdit sur la piste de distribution de carburant, encore plus
> pendant une distribution en cours. »

Un parcours guidé travaille contre cette règle par nature : il pousse à
regarder l'écran. **Il doit donc être interruptible à tout moment et reprenable
sans rien perdre**, jamais chronométré, jamais assorti d'une relance qui
s'affiche pendant le service. Ce point n'est pas négociable contre du confort
d'usage.

### Reprenable, parce qu'un quart dure des heures

Le parcours s'étale sur un service entier. Il doit survivre à un téléphone
verrouillé, à une application fermée, à une coupure réseau, à un changement
d'appareil. À la reprise, il doit dire **où l'on en est**, jamais recommencer.

---

## 3. Le squelette — l'ossature est ici, l'ordre est à Frédéric

Quatre temps. Ce qu'ils contiennent relève du métier ; ce document n'en décide
pas et laisse les contenus explicitement ouverts.

**1 · L'ancrage.** Immédiatement après la prise de poste : ce que je fais
maintenant, en une phrase et une action. Aujourd'hui, ce moment renvoie à un
catalogue — c'est là que 16 quarts sur 18 s'arrêtent.

**2 · La suite.** Une action à la fois, l'action suivante toujours visible, la
progression toujours lisible. *Quels gestes, dans quel ordre, pour quel rôle :
à décider par Frédéric.* Les rôles existants sont `pompiste`, `caissiere`,
`renfort`, `manager`, `polyvalent`, et la suite n'a aucune raison d'être la
même pour tous.

**3 · Les moments imposés par le commerce.** Une livraison de carburant, un
inventaire, un contrôle de caisse n'arrivent pas quand le parcours voudrait :
ils s'imposent. Le parcours doit savoir être **interrompu par le réel** et
reprendre après, sans considérer l'interruption comme un échec.

**4 · La clôture.** Le pointage de départ ferme le service — le déclencheur
`nexus_cloturer_shift_au_depart` existe déjà et fonctionne. **La clôture doit
faire partie du parcours**, pas en être la sortie facultative : c'est
aujourd'hui le seul geste que même les employés engagés ne font pas.

---

## 4. Ce qui se passe quand une étape casse — le point le plus important

Pour une équipe qui pense déjà que NEXUS ne fonctionne pas, **un parcours guidé
qui casse est pire que pas de parcours.** Aujourd'hui, celui qui n'utilise pas
NEXUS ne rencontre rien. Demain, s'il est conduit dans un chemin qui casse au
troisième écran, il tiendra la preuve de ce qu'il croit.

Trois règles, non négociables :

**Jamais « Un problème est survenu, réessayez ».** C'est le message actuel de la
prise de poste en cas d'échec — et quand la cause est une contrainte de base,
réessayer échoue indéfiniment. Un message doit **nommer** ce qui a échoué et
dire quoi faire.

**Une étape cassée ne casse pas le parcours.** Elle se déclare indisponible,
elle est marquée comme telle, et la suite continue. Le service de l'employé ne
s'arrête pas parce qu'un écran s'arrête.

**Ce qui a été fait est conservé, toujours.** Aucune erreur ne doit coûter à
l'employé un travail déjà accompli. C'est ce qui distingue un outil d'un
obstacle.

---

## 5. Ce qui ne doit pas bouger

- **La prise de poste.** Elle vient d'être prouvée à l'écran, y compris le cas
  du quart laissé ouvert la veille (recette navigateur, 09/09/2026). On ne la
  réécrit pas pour lui ajouter un parcours : on part d'elle.
- **Les écrans métier.** Missions, Inventaire, Réception, Pointage restent la
  source de vérité de ce qu'ils enregistrent.
- **La séparation des rôles.** Un employé ne doit rien voir de plus qu'avant.
  Le parcours ne crée aucune autorisation.

---

## 6. Comment on le prouve — dès la conception, pas après

La recette navigateur juge aujourd'hui six points, dont deux du parcours
employé, et elle tourne sur la version réellement servie. **Chaque étape
ajoutée au parcours doit y entrer en même temps qu'elle est écrite**, avec son
cas d'échec.

La raison est dans la mesure : le décrochage est binaire, donc invisible à un
test qui vérifierait seulement que chaque écran s'ouvre. Ce qu'il faut éprouver
est **l'enchaînement** — qu'après l'étape N, l'étape N+1 est atteignable sans
décision, et que si N casse, N+1 l'est quand même.

Le compte `NEXUS_TEST_EMPLOYEE_B_PIN` existe et dort. Il attend un second
employé dans un scénario ; l'injecter sans usage fabriquerait une preuve vide.

---

## 7. La mesure du succès — fixée MAINTENANT

> **Proportion de quarts avec au moins une mission validée.**
> **Aujourd'hui : 2 sur 18.**

Elle est fixée avant d'écrire une ligne, parce que la décider après coup
laisserait la place de conclure ce qui arrange. Deux mesures secondaires, à
relever de la même façon :

- proportion de quarts **clôturés** par pointage de départ — aujourd'hui, même
  les engagés ne referment pas ;
- **répartition** du nombre de missions par quart : si le trou entre 1 et 2 se
  remplit, le parcours a commencé à conduire des gens ; s'il reste vide et que
  seul le nombre de quarts à zéro baisse, quelque chose d'autre s'est passé.

Toute re-mesure se fait sur la fenêtre valide et se compare au même étalon —
des quarts, pas des coches.

---

## 8. Ce que je ne peux pas décider

1. **L'ordre des gestes**, par rôle. C'est le cœur du parcours et c'est du
   métier. Que fait un pompiste en arrivant ? Une caissière ? Dans quel ordre,
   et qu'est-ce qui est vraiment obligatoire ?
2. **Ce qui déclenche un moment imposé** — livraison, inventaire, contrôle de
   caisse : qui le décide, et le parcours doit-il le proposer ou l'imposer ?
3. **Ce qu'on fait des 16 quarts sans mission déjà en base** : ils resteront
   dans la mesure de référence. Faut-il les qualifier, ou les laisser tels
   quels comme point de départ honnête ?
4. **Jusqu'où va la clôture.** Le pointage de départ ferme le service. Le
   parcours doit-il refuser de se terminer sans lui, ou seulement le proposer ?
   Refuser serait cohérent avec le problème mesuré, et contraire à la règle
   « ne pas forcer ».

---

**Aucune ligne de code n'accompagne ce document, volontairement.** Le prochain
geste est un arbitrage de Frédéric sur les quatre points ci-dessus.
