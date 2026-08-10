# NEXUS — PREMIÈRE IMPRESSION & DÉCOUVERTE PROSPECT

Document d'architecture fonctionnelle — 10/08/2026, à partir de la vision de Frédéric suite à une
présentation de NEXUS le matin même.

## Principe directeur

NEXUS ne doit pas impressionner un prospect par le nombre de ses fonctionnalités. Il doit
l'impressionner par la simplicité avec laquelle il maîtrise une complexité énorme. La meilleure
réaction visée n'est pas *"Waouh, il y a beaucoup de modules"*, mais *"Comment NEXUS a-t-il réussi à
voir tout ça aussi simplement ?"*.

On ne change pas l'architecture ni les fonctionnalités. On change la porte d'entrée.

## Constat déclencheur

Frédéric, en présentant NEXUS ce matin à un prospect : *"beaucoup de fonctionnalités utiles, mais
lorsqu'on ne connaît pas, ça peut intimider."* Le problème n'est pas la puissance du produit, c'est
son exposition brute et immédiate à quelqu'un qui n'a pas encore le vocabulaire pour la comprendre.

## État des lieux — ce qui existe déjà dans le code réel

Avant de proposer quoi que ce soit, audit de ce qui existe déjà autour de la découverte et de la
première connexion — deux surprises importantes en ressortent.

| Sujet | État réel |
|---|---|
| Page publique (`index.html`) | **Existe déjà**, landing marketing pure : hero *"Combien vous coûtent les décisions que vous ne voyez pas ?"*, sections ADN / Offres / Fonctionnement / API / Contact, CTA `mailto:` "demande de démo". Pas de logique applicative, pas de connexion Supabase. |
| Écran de connexion | **N'existe pas.** Aucun fichier `NEXUS-Login-v1.html` nulle part. `index.html` pointe 3 fois vers ce fichier (lien mort). `nexus-auth.js` (`nexusRequireAuth()`) redirige aussi vers ce même lien mort dès qu'une session manque. **Aucun appel `signInWith*` n'existe dans tout le projet** — il n'y a littéralement aucun mécanisme de connexion fonctionnel dans l'app aujourd'hui. À clarifier avec Frédéric : est-ce un chantier oublié, ou la connexion se fait-elle volontairement hors app (provisionnement manuel de compte après la prise de contact, cohérent avec le CTA "demande de démo") ? **Cette réponse conditionne une partie de ce document — voir "Décision préalable" plus bas.** |
| Menu principal (`NEXUS-App-v1.html`) | 6 groupes (Piloter, Performer, Exécuter, Équipe, Administrer, Aide), **33 items au total**. Un filtrage existe déjà : chaque item est cascadé par rôle (`data-role`, masqué tant que le rôle réel de l'employé connecté n'est pas connu) et par forfait (`data-forfait="professional"`, 17 des 33 items grisés avec badge "Professional" si le site n'est pas sur ce forfait). La mécanique de divulgation progressive par palier existe donc déjà dans son principe — juste jamais appliquée à la découverte d'un nouvel utilisateur. |
| Refonte d'accueil déjà conçue | **Existe déjà, jamais mise en production.** `NEXUS-Home-Concept-v1.html` + `NEXUS-Refonte-Accueil-Note-Conception.md` (24/07/2026) : une architecture à 4 niveaux (État du commerce → Conseiller NEXUS 3 décisions → 4 KPI/4 outils → "Tous les outils" replié, 15 écrans) conçue exactement pour transformer l'accueil d'un "menu" en "poste de pilotage". La maquette est une donnée d'exemple non branchée à Supabase ; la note se termine par *"prochaine étape suggérée : brancher l'Indice NEXUS, le Capital NEXUS et les 3 priorités du Conseiller sur les données réelles"* — jamais fait. **Ce concept couvre déjà une grande partie de la vision d'aujourd'hui** (voir rapprochement ci-dessous). |
| Mode démo / données fictives | N'existe pas comme tel. Seule `NEXUS-Home-Concept-v1.html` utilise des données d'exemple, mais dans un but de maquette de conception, pas de démonstration interactive pour prospect. |
| Onboarding / première connexion / wizard | N'existe nulle part dans le code. |
| Redirection post-connexion | Pas de "home" déclarée : `nexusRequireAuth()` ne redirige vers rien de fixe après succès, chaque page l'appelle indépendamment. Le menu (`NEXUS-App-v1.html`) est l'entrée par défaut implicite. |

## Rapprochement important avec le concept d'accueil de juillet

La vision d'aujourd'hui et le concept dormant du 24/07 se recoupent presque entièrement sur la partie
**accueil de l'utilisateur déjà client** :

- *"Brief devient l'accueil naturel du dirigeant"* (vision d'aujourd'hui) ≈ le concept de juillet
  (Indice + Capital + verdict + 3 décisions du Conseiller avant tout menu) — sauf qu'en juillet la
  source était `nexus-indice.js` + Conseiller, et que le document "Brief NEXUS V2" rédigé cet
  après-midi propose désormais le Diagnostic NEXUS (Boussole 5 axes) comme bandeau d'état. **Les deux
  chantiers convergent vers la même conclusion : la page d'accueil post-connexion doit être un état
  interprété + 3 décisions, jamais un menu.** Il serait incohérent de construire deux versions
  différentes de cette même idée. Voir "Décision préalable" plus bas.
- *"Menu à deux niveaux, ☰ Tous les outils NEXUS"* (vision d'aujourd'hui) ≈ exactement le Niveau 4 du
  concept de juillet ("Tous les outils", 15 écrans repliés par défaut, groupés par univers).

Ce que la vision d'aujourd'hui ajoute, et que juillet ne couvrait pas : tout ce qui concerne
spécifiquement un **prospect qui n'a pas encore de compte / pas encore l'habitude du produit** — la
promesse d'ouverture, le mode Découverte à données fictives, le questionnaire de première connexion,
le vocabulaire simplifié, et l'accroche commerciale. Juillet concevait la home d'un utilisateur déjà
là ; aujourd'hui conçoit le chemin qui amène quelqu'un à devenir cet utilisateur.

## Décision préalable à trancher

**Un seul écran d'accueil post-connexion, pas deux versions concurrentes.** Avant de coder quoi que ce
soit ici, il faut décider si l'accueil de l'utilisateur connecté devient le Brief NEXUS repensé (doc
"Brief NEXUS V2" de cet après-midi) ou une version aboutie du concept de juillet — ou, plus
probablement, une fusion des deux puisqu'ils demandent la même chose avec des briques légèrement
différentes. Recommandation : le Diagnostic NEXUS (Brief V2) devient la brique d'état unique, réutilisée
à la fois comme home post-connexion ET comme entrée de Brief — le concept de juillet reste alors
valable pour tout le "dessous" (grille 4 KPI / 4 outils / tous les outils), simplement alimenté par le
nouveau Diagnostic plutôt que par le duo Indice+Capital d'origine.

**Existence d'un vrai mécanisme de connexion.** Sans réponse à la question posée dans le tableau
ci-dessus, impossible de construire un "premier login" à 3 questions — il n'y a rien à quoi
l'accrocher aujourd'hui. Soit ce chantier (créer `NEXUS-Login-v1.html` avec un vrai flux Supabase Auth)
devient un prérequis technique de ce document, soit Frédéric confirme que la connexion reste
volontairement assistée hors app et le "premier login" décrit plus bas se déclenche alors à la
première ouverture de l'app avec une session déjà provisionnée, pas à une inscription libre.

## Architecture cible

### 1. La promesse, avant le menu

Au tout premier accès (prospect ou nouvel utilisateur), pas de menu de 33 items. Une promesse :

```
Bonjour. Voici NEXUS.
Votre entreprise produit déjà beaucoup de données.
NEXUS les transforme en décisions simples.

Découvrez ce que NEXUS peut voir pour vous →
```

Puis trois portes seulement, dans le vocabulaire du dirigeant, jamais celui du produit :

```
👁 Comprendre mon activité      🎯 Savoir quoi faire      🛡️ Garder le contrôle
```

Aucune mention de "Verify", "CIN", "Scanner Stock", "Tempo" à ce stade — ces noms s'apprennent plus
tard, une fois le bénéfice compris.

### 2. Mode Découverte — démonstration par le résultat, pas par la fonctionnalité

Plutôt que de lister des fonctionnalités, un scénario avec données fictives : *"Imaginez que ceci soit
votre entreprise."*

```
NEXUS a détecté 3 choses que le dirigeant devrait savoir aujourd'hui.
📈 Une famille de produits accélère fortement.
⚠️ Une anomalie de caisse se répète.
📦 Une référence importante risque la rupture.

Voir ce que NEXUS recommande →
```

Puis 3 décisions fictives, puis seulement à la fin : *"Voir comment NEXUS l'a détecté →"*, qui révèle
les moteurs réels (Produits, Verify, Stock, FDJ, Marge+…). Inversion volontaire : on ne vend pas les
modules, on fait vivre ce qu'ils permettent de voir, et on ne nomme le module qu'après que son
bénéfice a été compris. Techniquement : un jeu de données statique (pas Supabase), un scénario scripté
fixe — pas un moteur de démonstration dynamique en V1.

### 3. Questionnaire de première connexion (3 questions)

Pour un utilisateur (prospect converti ou nouveau compte) à sa toute première connexion réelle :

1. Quel type d'établissement dirigez-vous ?
2. Combien de personnes composent votre équipe ?
3. Qu'est-ce qui vous prend aujourd'hui le plus de temps ? (caisse, stocks, équipe, marges, ventes,
   organisation…)

Puis : *"Parfait. NEXUS va commencer par vous aider ici."* — l'interface initiale (le "Tous les
outils" et l'ordre des 4 outils principaux du concept de juillet) se réordonne selon la réponse, sans
rien cacher définitivement. Plus tard, découverte progressive suggérée : *"NEXUS peut également vous
aider à contrôler vos stocks. Découvrir →"*.

Donnée à stocker : réponses au questionnaire, rattachées à l'employé/site (nouvelle table légère, ou
extension de `employees`/`sites` — détail laissé au développeur), pour piloter la mise en avant
initiale sans jamais restreindre l'accès réel (P7-like "simplicité visible", même esprit que le
paramétrage FDJ : la personnalisation ne doit jamais devenir une limitation cachée).

### 4. Vocabulaire — le bénéfice avant le produit

Pendant la découverte, jamais de nom de module. Le langage du dirigeant d'abord :

```
Mes ventes · Ma marge · Mes caisses · Mes stocks · Mon équipe · Mes priorités
```

Puis NEXUS enseigne progressivement son propre vocabulaire une fois le bénéfice compris : *"Vos
contrôles de caisse sont centralisés dans NEXUS Verify."* Ce n'est pas un renommage des écrans
existants (leurs noms internes/techniques ne changent pas) — c'est une couche de traduction affichée
uniquement pendant la phase de découverte et le questionnaire.

### 5. Accroche commerciale révisée

Remplacer, sur `index.html` et dans l'écran de découverte, l'accroche actuelle du hero par quelque
chose de plus concret pour quelqu'un qui ne connaît pas encore le produit :

```
Vous n'avez pas besoin de plus de données.
Vous avez besoin de savoir quoi en faire.

NEXUS observe votre activité, relie vos informations et vous montre ce qui mérite
réellement votre attention.

Voir NEXUS en action →
```

Puis, après le mode Découverte : *"Vous venez de voir en 60 secondes ce qu'un dirigeant peut mettre
plusieurs heures — parfois plusieurs semaines — à identifier. Bienvenue dans NEXUS."*

### 6. Menu à deux niveaux (utilisateur déjà là)

Reprend directement le Niveau 4 du concept de juillet : l'accueil quotidien propose *Aujourd'hui ·
Piloter · Analyser · Agir* (ou l'équivalent des 4 outils principaux déjà conçus), avec un bouton
discret *"☰ Tous les outils NEXUS"* qui redonne accès aux 33 items existants, groupés par univers
exactement comme documenté en juillet. Rien de nouveau à concevoir ici — à exécuter.

## Anti-patterns à interdire

- Deux versions concurrentes de l'accueil post-connexion (celle de juillet et celle d'aujourd'hui)
  construites en parallèle sans jamais être unifiées.
- Un mode Découverte qui utilise de vraies données d'un vrai site — toujours un jeu de données fictif
  isolé, jamais connecté à Supabase.
- Un vocabulaire "traduit" qui remplace silencieusement les noms réels des écrans ailleurs dans
  l'app — la traduction reste une couche de présentation limitée à la découverte, pas un renommage
  produit.
- Construire le questionnaire de première connexion comme un filtre d'accès (cacher des écrans de
  façon permanente) plutôt que comme une simple mise en avant réordonnable.

## Priorités V1 / V2 / V3

| Phase | Contenu |
|---|---|
| **V1 — indispensable** | Clarifier avec Frédéric le statut du mécanisme de connexion (chantier oublié vs volontairement assisté). Trancher la décision préalable (un seul accueil post-connexion, fusion juillet + Diagnostic NEXUS). Exécuter le concept de juillet (brancher Indice/Diagnostic + Conseiller sur les données réelles, menu à deux niveaux). Nouvelle accroche sur `index.html`. |
| **V2 — industrialisation** | Écran de promesse + 3 portes au premier accès. Questionnaire de première connexion (3 questions) et réordonnancement initial. Vocabulaire traduit pendant la découverte. |
| **V3 — sophistication** | Mode Découverte interactif à données fictives (scénario scripté). Personnalisation progressive ("NEXUS peut aussi vous aider à…", révélée au fil du temps). |

## Ordre de développement recommandé

1. Clarifier le statut réel de la connexion avec Frédéric (question ouverte, pas une hypothèse à coder).
2. Trancher la fusion accueil de juillet / Diagnostic NEXUS (Brief V2) — un seul chantier, pas deux.
3. Exécuter le concept de juillet sur données réelles (déjà entièrement conçu, jamais construit).
4. Nouvelle accroche `index.html`.
5. Écran de promesse + 3 portes (premier accès).
6. Si la connexion est confirmée comme un vrai chantier : construire `NEXUS-Login-v1.html`.
7. Questionnaire de première connexion + réordonnancement initial.
8. Vocabulaire traduit pendant la découverte.
9. Mode Découverte à données fictives (V3).

## Décision finale

On ne vend plus les modules de NEXUS ; on fait découvrir ce qu'ils permettent de voir. La complexité
du produit ne disparaît pas — elle n'apparaît que lorsqu'elle devient utile pour la personne qui la
regarde.

**Test ultime** : un prospect qui n'a jamais entendu parler de NEXUS ouvre la page découverte, vit le
scénario de 60 secondes, et dit *"comment il a fait pour voir tout ça aussi simplement ?"* — pas
*"il y a combien d'écrans là-dedans ?"*.
