# Fiche lot 2 : page employé (v4)

Statut : documentation. Aucune page n'est créée avant la validation de la conception. Rien sur Test ni en Production.

## 1. Objectif

Permettre à un employé autorisé de créer sa propre tournée, de relever librement les produits à date limite, de corriger, de terminer sa tournée et de répondre à une demande de correction du manager.

## 2. Parcours

1. Accueil « Mes tournées » et « Nouvelle tournée » (nom facultatif). Plusieurs tournées peuvent être ouvertes en même temps.
2. Identification du produit : scan caméra, douchette Bluetooth, recherche par nom, saisie de l'EAN.
3. Feuille de saisie : date limite, quantité relevée, photo facultative, Enregistrer.
4. Ajouter des unités, corriger, changer la date, annuler avec motif. Mention « relevé aussi dans la tournée X (M1, 10:15), en historique ». Aucun écran de résolution de conflit.
5. Geste « trouvé et retiré » (cas 43).
6. « Terminer ma tournée » avec récapitulatif. Bouton bloqué tant qu'une saisie est En attente (cas 32, contrôle côté appareil).
7. Réponse à une demande de correction : la tournée repasse à certifier (cas 38).
8. Produit sans EAN trouvé par nom. EAN inconnu : entrée provisoire, aucune référence créée.

Contrôler : l'écran liste les tournées ouvertes de l'auteur (il peut en avoir plusieurs) et affiche le nom de la tournée pendant la saisie, pour qu'il sache dans laquelle il relève.

### Douchette Bluetooth (lot 2)

- Douchette en mode clavier HID ; réglage sur l'appareil « Caméra » / « Douchette » avec suffixe (Entrée) à confirmer.
- Champ de saisie gardant le focus ; pavé numérique à l'écran et boutons + et − pour la quantité.
- Option : préremplissage de la date limite depuis l'identifiant GS1 AI 17 si le code le porte.
- Réglage par défaut par station : option, non décidée.
- 4 cas de recette lot 2 (saisie douchette, suffixe, focus, AI 17) ; maquettes (`outils/maquettes/dates-courtes/lot-2-saisie.html`, avec douchette Bluetooth et clavier de saisie intégré quand le clavier iOS est masqué ; tuile neutre « icône à venir ») Jour et Nuit à 375 et 1280 px selon `nexus-design-experience` et NEXUS-REFERENTIEL-CONCEPTION v1.0.

Accès : renfort, manager, gérant, créateur ; caissier seulement si l'accès de la station est ouvert ; pompiste et vacataire refusés.

## 3. Fiche de conception (11 points, référentiel v1.0 section 7)

1. Tâche : relever, corriger, terminer.
2. Utilisateur et contexte : employé debout, une main, en rayon.
3. Niveau : niveau 3 (saisie guidée, un geste après l'autre). Proposition, à valider par la revue Guardian.
4. Canevas : A identité (nom de la tournée), D navigation et actions (Enregistrer, Terminer ma tournée) et E détails (ligne, historique). B synthèse et C Conseiller écartés : une page de saisie ne synthétise rien. Un bloc = une question : « qu'ai-je relevé ? ».
5. Action principale : Enregistrer.
6. États : Enregistré, En attente, Refusé.
7. Vocabulaire : « quantité relevée ».
8. Cibles tactiles : 44 px au minimum.
9. Thèmes : Jour et Nuit.
10. Compréhension : test Guardian.
11. Preuve : Safari iOS sur appareil réel, ou « non fait ».

## 4. Livrables

- Maquettes à 375 px.
- Démo : 6, puis 4 (10), correction moins 2 (8), terminer.
- Captures 375×812.
- Scan Safari réel, ou « non fait ».
- Tuile neutre « icône à venir » (icône `mod-dates-courtes` à demander sur #160, jamais dessinée).
- Premier écran à 375×812 : nom de la tournée, champ scan ou recherche, dernière ligne enregistrée, bouton Enregistrer. Douchette : champ à focus permanent, même écran à 1280×800.
- États : chargement, aucune donnée, erreur, donnée non fiable (ligne En attente ou Refusé).

## 5. Critères

- Au plus 4 gestes après le scan.
- Aucune cible sous 44 px, aucun débordement horizontal.
- Les 3 états de synchronisation visibles par ligne.
- Cas de recette : 6, 11, 15, 18, 32, 44.

## 6. Limites

- Le détecteur natif manque sur certains navigateurs (ZXing figé en version).
- Niveau et canevas proposés dans la fiche de conception #160, en attente de revue.
- Le blocage de la clôture est un contrôle d'appareil ; le serveur reste l'autorité.
- Rien n'a été joué sur Test.
