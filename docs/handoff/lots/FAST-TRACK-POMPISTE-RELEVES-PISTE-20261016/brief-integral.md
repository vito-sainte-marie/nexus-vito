<!-- Brief intégral de Frédéric Bragance (GO TEST — Parcours Pompiste), recopié tel quel le 16/10/2026 pour lever la condition 3 de decision-1 et le BLOCKER de decision-2. Document de référence, pas une demande ni une décision. -->

# NEXUS — GO TEST
## Parcours Pompiste : relevés piste, jaugeage Veeder-Root et recopie Decenium

**Statut : GO développement + déploiement Test + recette.**

**Périmètre : NEXUS — ViTO Sainte-Marie Usine, Martinique.**

**Référence de conception :** maquette Claude Artifact  
https://claude.ai/artifact/Lf1EmVZXrTot2S6pm3u2TR

Claude, je souhaite que tu reprennes cette maquette, que tu l'adaptes aux règles métier ci-dessous et que tu réalises une version fonctionnelle dans l'environnement **Test de NEXUS**.

Il ne s'agit pas de créer une nouvelle application ou une démonstration isolée. Le résultat doit être intégré au parcours existant de prise de poste et de fin de quart du pompiste.

Notre objectif est de remplacer le carnet papier par une expérience numérique simple, rapide et fiable.

**Principe fondamental : NEXUS est un carnet numérique d'aide au relevé et à la recopie. Decenium reste le logiciel de caisse de référence. NEXUS ne calcule pas les ventes, ne modifie pas les données Decenium et ne prétend pas vérifier ce qui a été réellement enregistré dans Decenium.**

---

## 1. Comprendre le fonctionnement réel de la station

La station possède quatre pompes Tokheim.

Chaque pompe comporte deux totalisateurs mécaniques à rouleaux, affichant sept chiffres.

La disposition physique est la suivante :

| Pompe | Compteur gauche | Compteur droit |
|---|---|---|
| Pompe 1 | GO | SP |
| Pompe 2 | SP | GO |
| Pompe 3 | GO | SP |
| Pompe 4 | SP | GO |

Le pompiste relève personnellement ces huit index.

Aujourd'hui, il les inscrit sur papier avant de les recopier dans Decenium.

Decenium exige une présentation différente de la disposition physique : **pour chaque pompe, SP d'abord, puis GO**, et enfin GNR.

Decenium attend six chiffres. Les rouleaux en affichent sept, avec un zéro initial dans le cas décrit. Il faut conserver la valeur réellement observée et sécuriser la présentation à six chiffres, sans supprimer aveuglément un chiffre significatif.

La pompe GNR est actuellement hors service. Son dernier index de référence connu est **1191213**.

Cet index ne doit pas être présenté comme un nouveau relevé physique réalisé par l'employé.

### Moments de relevé

Les relevés sont réalisés :

- En fin de quart 1.
- En début de quart 2.
- En fin de quart 2.

Le relevé de fin de quart 1 et celui de début de quart 2 doivent normalement être identiques ou très proches, compte tenu des distributions éventuellement intervenues entre les deux.

Le matin, le pompiste réalise également le jaugeage des cuves depuis le Veeder-Root TLS4B, écran « Aperçu Citerne ».

Il existe quatre réservoirs. Pour la recopie dans Decenium, les informations attendues sont SP, GO (somme des volumes des deux cuves GO) et GNR.

Cette addition des deux cuves GO constitue uniquement une préparation de la valeur à recopier : elle ne doit pas devenir un calcul de ventes ou une écriture comptable dans NEXUS.

### Résultat des expérimentations OCR

- PaddleOCR a correctement lu les 20 valeurs de l'écran Veeder-Root lors du test réalisé.
- Sur les totalisateurs Tokheim, il n'a reconnu correctement que deux index sur huit.

**Décision validée : OCR sur photographie du Veeder-Root ; saisie manuelle pour les index des pompes.**

Aucun service OCR payant, abonnement OCR ou API facturée à l'usage ne doit être ajouté.

Le relevé est effectué lorsque la distribution est interrompue. Le dispositif doit néanmoins respecter les procédures de sécurité applicables à la piste et les règles d'utilisation des appareils.

---

## 2. Philosophie de l'expérience employé

Je ne veux pas une succession de formulaires, de missions, de scores ou de validations administratives.

Je veux que le pompiste ait l'impression d'être accompagné naturellement dans son travail.

L'interface doit être :

- Élégante, contemporaine, sobre, dans l'esprit NEXUS.
- Optimisée pour un usage mobile, avec de grands chiffres et des zones tactiles confortables.
- Rapide à comprendre, même par un employé peu à l'aise avec les outils numériques.
- Adaptée au travail réel, aux interruptions et aux reprises.
- Cohérente avec les autres écrans NEXUS.

Le parcours doit suivre le terrain, pas obliger le terrain à suivre une organisation informatique artificielle.

Ne crée pas un module parallèle si les structures existantes peuvent être réutilisées proprement.

---

## 3. Parcours d'entrée contextuel

À la prise de poste Piste, NEXUS doit identifier le contexte réel :

**Ouverture / matin :** proposer le jaugeage Veeder-Root et les opérations pertinentes du début de service.

**Début du quart 2 :** présenter la relève et les derniers index transmis, puis guider vers le relevé de contrôle du nouvel employé.

**Fin de quart :** proposer directement le relevé des volucompteurs et la recopie Decenium.

Attention : les données d'un collègue ne deviennent jamais automatiquement une mesure personnellement vérifiée par le nouvel employé.

Ne pas ajouter de pointage horaire : Sainte-Marie Usine n'utilise actuellement pas le pointage NEXUS.

Les relevés doivent être associés au quart réel, sans déduire d'heures de travail ni modifier les règles de NEXUS Paye.

---

## 4. Jaugeage Veeder-Root : OCR gratuit

Prévoir une interface de photographie de l'écran « Aperçu Citerne ».

Le système doit :

1. Guider le cadrage de l'écran.
2. Lancer le traitement OCR avec une solution open source ou locale, sans service payant.
3. Identifier les quatre cuves et leurs volumes.
4. Permettre une vérification visuelle des valeurs reconnues.
5. Permettre la correction manuelle de toute valeur.
6. Présenter SP, GO total des deux cuves et GNR dans le format utile à Decenium.
7. Conserver la traçabilité du relevé et de ses éventuelles corrections.

Ne pas interpréter une lecture OCR comme une validation humaine.

Ne pas considérer le succès d'un seul test OCR comme une garantie de précision générale.

Si le traitement échoue ou si une cuve n'est pas reconnue, la saisie manuelle doit rester possible.

Éviter les confirmations redondantes : une vérification claire, puis une validation.

Vérifier également les contraintes de confidentialité, de performance et de compatibilité Safari iOS.

---

## 5. Index Tokheim : reproduire exactement la disposition réelle

Créer une interface de relevé avec **un écran par pompe**.

Chaque écran doit montrer les deux index dans le même ordre que les compteurs physiques :

- Pompe 1 : GO gauche / SP droite.
- Pompe 2 : SP gauche / GO droite.
- Pompe 3 : GO gauche / SP droite.
- Pompe 4 : SP gauche / GO droite.

Les champs doivent être grands, très lisibles et faciles à corriger.

Prévoir un pavé numérique adapté à la saisie rapide.

Le passage d'une pompe à la suivante doit être naturel.

Éviter une confirmation supplémentaire pour chaque champ si elle n'apporte aucune sécurité réelle.

### Préremplissage

La maquette actuelle propose de préremplir les trois premiers chiffres à partir du relevé précédent.

Je veux modifier cette approche.

**Ne pas préremplir silencieusement les trois premiers chiffres comme s'ils étaient déjà vérifiés.**

Pour la première version Test, privilégier la saisie complète des sept chiffres, tout en affichant discrètement le dernier index comme référence.

Si tu estimes qu'une suggestion de préfixe est réellement préférable, propose-la comme variante expérimentale, avec confirmation explicite des chiffres et protection contre les changements de palier.

Ne sacrifie jamais la fiabilité au gain de quelques frappes.

---

## 6. Contrôles de cohérence

Les contrôles doivent protéger contre les erreurs importantes sans interrompre inutilement le pompiste.

### Index inférieur au précédent

Déclencher une alerte forte.

Permettre la correction ou une confirmation exceptionnelle justifiée et traçable.

Ne pas écraser l'historique.

### Écart supérieur à 4 000 litres

Conserver provisoirement ce seuil comme **alerte indicative, non bloquante, par totalisateur**, et non comme règle définitive de la station.

Prévoir un paramétrage ultérieur.

Ne pas prétendre que ce seuil est validé par les volumes historiques de vente.

### Fin de quart 1 / début de quart 2

Comparer les deux déclarations, compteur par compteur.

Afficher clairement les valeurs et les écarts.

Prévoir un contrôle distinct du seuil de 4 000 L.

Ne pas décider arbitrairement qu'un écart non nul constitue nécessairement une erreur : il peut exister des distributions entre deux relevés.

Prévoir une justification ou un signalement au manager lorsque les valeurs divergent de façon inexpliquée.

### Contrôles mal placés

Ne pas multiplier les fenêtres modales pendant la saisie.

Privilégier une indication discrète au moment de l'erreur et une revue des anomalies avant validation finale.

---

## 7. Pompe GNR hors service

La GNR doit apparaître dans le parcours Decenium avec son dernier index connu : **1191213**.

Son état « Hors service » doit être visible.

Ne pas imposer au pompiste une fausse saisie de relevé chaque jour.

Ne pas générer un nouvel événement de mesure physique à partir de la simple reprise de cet index.

Prévoir le traitement d'un changement de statut ou d'une remise en service, avec contrôle explicite et historique.

---

## 8. Recopie dans Decenium

Une fois le relevé terminé, afficher une interface dédiée à la recopie.

Les valeurs doivent être présentées dans l'ordre exact attendu par Decenium :

Pompe 1 : SP puis GO.

Pompe 2 : SP puis GO.

Pompe 3 : SP puis GO.

Pompe 4 : SP puis GO.

Puis GNR.

Les chiffres doivent être grands, stables et faciles à lire.

Le pompiste peut marquer une ligne comme recopiée pour retrouver sa position.

Cette coche constitue uniquement une aide de progression.

**Elle ne prouve pas que Decenium a reçu la bonne valeur.**

La confirmation finale doit indiquer :

**« Je confirme avoir recopié les valeurs dans Decenium. »**

Ne pas utiliser une formulation laissant croire à une synchronisation ou à une vérification automatique.

Si un index est corrigé dans NEXUS après avoir été marqué comme recopié, annuler son statut de recopie et demander une nouvelle vérification dans Decenium.

---

## 9. Interruptions et continuité du service

Le pompiste peut être interrompu par un client, un collègue ou une nécessité d'exploitation.

Le parcours doit donc permettre :

- La sauvegarde automatique du brouillon.
- La reprise sur la même pompe et le même champ.
- La distinction entre relevé commencé et relevé terminé.
- La suspension du relevé si la distribution reprend.
- La vérification des valeurs déjà prises lorsque des mouvements ont pu intervenir pendant l'interruption.
- La conservation des données en cas de fermeture accidentelle de l'écran, dans les limites techniques et de sécurité de l'application.

Aucun brouillon incomplet ne doit être interprété comme un relevé confirmé.

Étudier le comportement en cas de perte momentanée de connexion et proposer une solution réaliste, sans prétendre qu'un enregistrement serveur a réussi lorsqu'il n'a pas eu lieu.

---

## 10. Désaccords entre équipes et traçabilité

Les relevés de fin Q1 et de début Q2 sont deux déclarations indépendantes.

Même lorsqu'ils sont identiques, ils doivent conserver leur propre auteur et leur propre contexte.

En cas de désaccord :

- Afficher les deux valeurs.
- Identifier les quarts et les auteurs concernés.
- Permettre un signalement motivé.
- Préserver l'historique original.
- Réserver les éventuelles régularisations aux droits appropriés.

Une correction ne doit jamais effacer silencieusement la déclaration initiale.

Ne pas créer de rapprochement artificiel en remplaçant la valeur d'un employé par celle de son collègue.

---

## 11. Intégration technique et respect de l'existant

Avant toute modification, audite le code NEXUS existant.

Identifie précisément :

- Les composants de prise de poste et de fin de quart.
- Les tables et structures existantes de relevés carburant.
- Les règles RLS et les droits employé/manager.
- Les données utilisées par Carburants Performance et Verify.
- Les interactions éventuelles avec NEXUS Paye.
- Les règles de validation, de clôture et de régularisation existantes.

**Ne crée pas de deuxième source de vérité si une structure existante convient.**

Ne modifie pas les calculs carburant, les règles de caisse, les écarts Verify, les données de paie ou les procédures Decenium.

NEXUS reste ici un carnet numérique et une aide à la recopie.

Si le stockage des relevés nécessite une migration, présente-la explicitement dans le rapport, avec son périmètre, ses risques et ses preuves de compatibilité.

Les évolutions de base nécessaires au prototype peuvent être préparées et exécutées exclusivement sur Test, selon les autorisations et procédures existantes. Aucun changement en Production.

---

## 12. Recette terrain obligatoire sur Test

Je veux une recette fonctionnelle qui reproduise les situations réelles, et pas seulement des tests unitaires.

Couvrir au minimum :

1. Jaugeage du matin : photo Veeder-Root, reconnaissance OCR, vérification et recopie.
2. Échec OCR : correction et saisie manuelle.
3. Pompe 1 : GO à gauche et SP à droite.
4. Pompe 2 : SP à gauche et GO à droite.
5. Pompe 3 : GO à gauche et SP à droite.
6. Pompe 4 : SP à gauche et GO à droite.
7. Conversion contrôlée de sept chiffres observés vers six chiffres Decenium.
8. Passage d'un palier sur un totalisateur.
9. Index inférieur au précédent.
10. Écart supérieur à 4 000 L.
11. Fin Q1 et début Q2 identiques.
12. Fin Q1 et début Q2 divergents.
13. GNR hors service à 1191213.
14. Interruption au milieu de la saisie puis reprise.
15. Perte de connexion pendant un brouillon.
16. Correction d'une valeur déjà marquée comme recopiée.
17. Tentative de validation d'un relevé incomplet.
18. Consultation de l'historique par le manager.
19. Vérification des droits et de l'isolation des données.
20. Vérification qu'aucun calcul de vente, mouvement de caisse ou écriture Decenium n'a été effectué.

Inclure une recette navigateur sur les dimensions mobiles et sur Safari iOS lorsque l'environnement de test le permet.

Si un scénario ne peut pas être exécuté réellement, le déclarer **NON TESTÉ** plutôt que de le considérer comme réussi.

---

## 13. Livrables attendus

Je souhaite recevoir :

**A. Audit initial**

État réel de l'existant, composants réutilisables, risques de régression et décisions techniques.

**B. Implémentation Test**

Branche dédiée, commits identifiés, parcours intégré à NEXUS, migrations Test si nécessaires et autorisées.

**C. Preuves de recette**

Tests automatisés, parcours navigateur, captures des écrans principaux, résultats détaillés des scénarios et anomalies restantes.

**D. Rapport UX**

Nombre d'écrans, interactions nécessaires pour relever les huit index, points de friction et améliorations constatées.

**E. Rapport de livraison**

Branche, SHA, environnement déployé, état CI, migrations appliquées sur Test, limites connues et conditions nécessaires avant toute éventuelle promotion.

---

## 14. Autorisations et limites du GO

**GO explicite pour :**

- Auditer l'existant.
- Développer sur une branche dédiée.
- Corriger et adapter la maquette.
- Réaliser les tests automatisés.
- Déployer sur l'environnement Test.
- Effectuer la recette fonctionnelle et navigateur sur Test.
- Produire le rapport complet de preuves.

**NON AUTORISÉ :**

- Fusion vers Production.
- Déploiement Production.
- Migration sur la base Production.
- Modification des données réelles d'exploitation.
- Modification des règles métier Verify, Paye ou FDJ hors du périmètre autorisé.
- Achat ou activation d'un service OCR payant.
- Présentation d'un test simulé comme une validation terrain réelle.

Toute intervention nécessitant une permission supplémentaire ou sortant du périmètre doit faire l'objet d'une demande d'arbitrage dans le Handoff.

Respecter le protocole NEXUS Handoff en vigueur, avec une décision et un NEXT_ACTION_CONTRACT explicites lorsqu'ils sont requis.

---

## 15. Critère de réussite

Je considérerai cette évolution réussie si un pompiste peut :

1. Commencer son relevé sans chercher dans les menus.
2. Lire ses compteurs et saisir les chiffres sans confusion SP/GO.
3. Être interrompu puis reprendre sans perdre son travail.
4. Identifier immédiatement une anomalie importante.
5. Retrouver les valeurs dans l'ordre exact de Decenium.
6. Confirmer sa recopie sans confirmations inutiles.
7. Terminer son quart avec un relevé fiable et consultable par le manager.

**Je ne veux pas simplement une maquette plus jolie. Je veux une expérience opérationnelle réellement meilleure, éprouvée sur Test, avant de prendre la moindre décision concernant la Production.**

Claude, lance l'audit, l'implémentation et la recette dans ce périmètre. Si un arbitrage métier indispensable apparaît, documente-le et soumets-le avant d'introduire une règle non validée.

**Livraison attendue : Test fonctionnel + rapport de preuves + liste des éventuels arbitrages restants.**
