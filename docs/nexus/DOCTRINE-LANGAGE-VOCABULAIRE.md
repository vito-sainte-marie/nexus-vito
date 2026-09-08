# Doctrine NEXUS : langage et vocabulaire

Date : 2026-09-08
Autorité humaine : Frédéric Bragance
Statut : DÉCISION FONDATRICE
Origine : `docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-20260908.md` (cadrage, §4 à §6), audité par `docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-RESULTATS-20260908.md`, arbitré par `docs/handoff/lots/NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908/decision-1.md` et `decision-2.md`.

## Principe

**Le vocabulaire de NEXUS est un actif produit, pas une préférence de rédaction. Claude, les écrans, l'Orchestrator, les Guardians et les agents à venir doivent employer les mêmes mots pour les mêmes réalités, et un mot ne doit jamais dire plus que ce qui a été mesuré.**

Deux fautes de langage sont graves dans NEXUS, et ce sont les mêmes que ses fautes de calcul :

1. **nommer une chose pour une autre** : appeler « présence » un planning, « livraison » une commande, « stock » une projection ;
2. **affirmer plus que ce qu'on sait** : présenter une estimation comme un fait, une absence comme un zéro, une recette comme une autorisation.

Un mot juste ne rend pas le produit plus élégant. Il empêche une décision fausse.

## Portée de ce document

Ce document dit **comment NEXUS nomme les choses et s'adresse aux humains**. Il ne redéfinit ni les invariants (`docs/nexus/BIBLE.md`), ni l'architecture de vérité, ni les règles de gouvernance.

Il ne recopie aucune liste qui vit déjà dans le code. Une vérité a un propriétaire logique unique : dupliquer ici le vocabulaire porté par `nexus-vocabulaire.js` créerait une seconde source, et les deux divergeraient sans que personne ne s'en aperçoive. Ce document **nomme les propriétaires** et dit ce que les termes engagent.

## 1. Les deux agents, et à qui ils parlent

L'agent unique « Conseiller NEXUS » n'existe plus. `BIBLE.md` l'a scindé en deux agents distincts par leur destinataire, leur ton et leur responsabilité.

### NEXUS Directeur d'Exploitation

S'adresse prioritairement au **manager**. Il transforme les données en jugement, priorités et recommandations opérationnelles de niveau directeur d'exploitation expérimenté.

### NEXUS Coach Terrain

S'adresse prioritairement aux **employés**. Il transforme objectifs, écarts, rappels, progrès et consignes en accompagnement positif, respectueux, motivant et concret, adapté au rôle exercé. Il accompagne sans adopter un ton de surveillance, de sanction ou de direction.

**Ces deux agents ne sont pas deux tons du même agent.** Confondre leurs noms revient à attribuer à l'un des propos destinés à l'autre, ce qui est plus grave que l'ancien nom conservé.

État réel au 08/09/2026 : le code porte encore **69 occurrences de « Conseiller NEXUS » dans 29 fichiers de produit**. C'est une dette de propagation, suivie en `LANG-004` au Backlog, et non un arbitrage en attente. `NEXUS-Constitution-v1.md` porte une note de révision du même jour marquant ses articles 12 et 13 comme partiellement historiques sur ce point, sans les réécrire.

## 2. Vocabulaire canonique

| Terme officiel | Ce qu'il désigne | Ce qu'il ne désigne PAS |
|---|---|---|
| **Présence réelle** | Une présence constatée. | Un planning prévu, une présence supposée, une affectation théorique. |
| **Livraison effectuée** | Un état physique constaté. | Une commande passée, une livraison prévue, une livraison annoncée. |
| **Stock physique** | Une quantité réellement disponible. | Un stock estimé, projeté ou théorique. |
| **Couverture jusqu'à [jour / quart]** | Jusqu'où le stock tient, exprimé en repère de terrain. | À privilégier quand « autonomie X jours » est moins parlant pour celui qui lit. |
| **Prêt pour Production** | Une **proposition** fondée sur des preuves de recette. | Une autorisation de Production. Aucune décision de recette n'en vaut une. |

Deux de ces termes sont aujourd'hui **prescrits mais pas encore employés** : « Couverture jusqu'à » et « Présence réelle » n'apparaissent nulle part dans le code au 08/09/2026. Ce document les pose comme cible, et le dit plutôt que de laisser croire qu'ils sont en place.

### Vocabulaire de signature

Les termes de signature NEXUS (« Levier de valeur », « Signal faible », « Écart silencieux », « Décision prioritaire »…) vivent dans **`nexus-vocabulaire.js`, `NexusVocab.SIGNATURE`**, qui en est le propriétaire unique. Ils ne sont pas recopiés ici. Un écran qui invente son propre libellé pour l'une de ces notions sort du vocabulaire NEXUS, même si sa phrase est juste.

### Glossaire des états d'une mesure

| Mot | Sens |
|---|---|
| **prévu** | Ce qui est planifié, non encore constaté. |
| **réalisé** | Ce qui a été constaté. |
| **test** | Ce qui vient de l'environnement de recette. |
| **réel** | Ce qui vient de l'exploitation. |
| **absent** | Ce qui n'a pas été mesuré. Ne devient jamais zéro (`BIBLE.md`, Philosophie ; `nexus-mesure.js`). |

## 3. Le langage, selon celui qui lit

NEXUS ne parle ni comme une console, ni comme un logiciel administratif, ni comme un supérieur qui sanctionne. Son langage est humain, professionnel, naturel, précis, explicable, respectueux et orienté vers l'action.

### Au manager

Posture : directeur d'exploitation expérimenté. Il analyse, hiérarchise, explique le risque, recommande une action. Il ne culpabilise pas.

- À éviter : « Vous avez mal géré votre stock. »
- NEXUS : « Le niveau actuel augmente le risque de rupture vendredi. Je recommande de sécuriser la prochaine livraison avant jeudi. »

### À l'employé

Posture : accompagnement terrain. Le message explique ce qui est attendu, valorise les progrès lorsqu'ils existent, propose la prochaine action utile. Il ne doit donner ni impression de surveillance, ni impression de sanction.

- À éviter : « Écart constaté. »
- NEXUS : « Une vérification de caisse reste à faire avant la clôture. Tu peux reprendre le comptage maintenant si nécessaire. »

**Un reproche ne se fabrique jamais à partir d'une absence de donnée** (`BIBLE.md`, Philosophie). Cette règle protège une personne, pas un chiffre : elle est tenue par `nexus-evaluation-affichage.js` et `nexus-coach-fdj-moteur.js`, qui refusent de rendre un verdict faute de mesure, tout en continuant d'afficher un résultat réellement mesuré, fût-il mauvais. Taire une vraie mauvaise note serait l'erreur symétrique.

### Au Créateur, en supervision

Posture : stratégique, synthétique, factuelle. La première lecture doit répondre à trois questions :

1. qu'est-ce qui avance ?
2. qu'est-ce qui bloque ?
3. qu'est-ce qui attend réellement une décision humaine ?

Le vocabulaire technique (empreintes de commit, identifiants internes, codes de priorité) reste accessible, à un second niveau. Il n'est pas le langage principal du cockpit.

## 4. LANG-003, le tiret cadratin

**Règle.** Le tiret cadratin est proscrit du contenu produit par NEXUS et lu par l'utilisateur final. Préférer le point, la virgule, les deux-points, les parenthèses et les listes.

- À éviter : « Stock faible [tiret cadratin] commande recommandée »
- NEXUS : « Stock faible : commande recommandée. »

Le tiret simple reste employé quand la grammaire l'exige, notamment dans les mots composés. Une citation ou un document historique reproduits fidèlement ne sont pas réécrits.

**Portée : 1, arbitrée le 08/09/2026.** Sont **hors portée** les commentaires de développement, la documentation doctrinale, de gouvernance et de Handoff, y compris les échanges entre Claude et l'Orchestrator.

Cette portée est plus étroite que la formulation du cadrage d'origine, qui visait aussi « la documentation active ». Elle a été **explicitement tranchée**, sur mesure et non sur impression : 1 481 occurrences dans 124 fichiers de contenu affiché, contre plusieurs milliers de plus si la doctrine et les commentaires entraient dans le compte. Câbler la règle sur la portée large aurait produit un mur de signalements au premier passage, et fait désactiver la garde avant qu'elle serve (QA-002).

**Mécanisme.** `outils/garde-langage-nexus.js`, bloquante en CI. Elle n'exige pas zéro : elle pose un **plafond par fichier**, refuse qu'il monte, et n'accorde aucun tiret à un fichier neuf. Le plafond ne peut que descendre, car un plafond laissé au-dessus de la mesure autoriserait à réintroduire en silence. Le chantier de réécriture des occurrences existantes reste ouvert, écran par écran.

Ce document s'astreint à la règle bien qu'il en soit hors portée : une doctrine du langage qui ne s'appliquerait pas à elle-même se lirait mal. Son titre emploie donc les deux points, là où `DOCTRINE-PROPRIETE-CREATEUR-DONNEES-CLIENTS.md` emploie un tiret cadratin. La divergence est assumée et va dans le bon sens ; ce document ne réécrit pas le titre de l'autre.

## 5. Règles Guardian, et pourquoi elles ne sont pas ici

Les intitulés doctrinaux `PHILO-DATA-001` (absence ≠ zéro), `PHILO-HON-002` (fait ≠ estimation) et `PHILO-HUM-003` (pas de sanction automatique) **ne deviennent pas des entrées de `docs/learning/RULES.json`**. Ce sont des alias de règles déjà tracées, tenues par `ARCH-001`, `outils/guardian-bible.js` et `nexus-mesure.js`. Créer un doublon romprait le principe même qu'ils protègent : une vérité, un propriétaire.

`LANG-003` est la seule de ces candidates à être devenue une garde réelle, une fois sa portée tranchée.

## 6. Ce que ce document ne fait pas

Il ne réécrit aucun écran, aucun moteur, aucun texte fondateur. Il ne ferme ni `LANG-004` (propagation du renommage), ni le chantier des 1 481 occurrences. Il dit ce qui est décidé, nomme qui tient chaque règle, et laisse visible ce qui reste à faire.

## Règle d'arbitrage

En cas de conflit entre ce document et un écran, un moteur ou un commentaire, **ce document l'emporte pour le choix des mots**, et `BIBLE.md` l'emporte pour les invariants. Un désaccord sur une règle de langage se tranche par une décision humaine inscrite au registre Handoff, jamais par un usage installé.
