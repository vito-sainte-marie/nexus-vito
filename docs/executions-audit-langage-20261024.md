# Audit du langage, 24/10/2026 (propositions seulement)

Aucune doctrine, aucun écran, aucun plafond n'a été modifié. Ce document propose ; Frédéric décide.
Lecture seule sur le rail `handoff-continuite-20260920` (`a781e9d9`) et sur `production` (`ee426fe4`).

## 1. Ce qui manque à la consigne
- `docs/gouvernance/LEXIQUE-TERRAIN.json` et le skill `nexus-langage-terrain` n'existent ni dans le dépôt ni dans la liste des skills. L'audit s'appuie donc sur `DOCTRINE-LANGAGE-VOCABULAIRE.md`, `outils/garde-langage-nexus.js` (LANG-003) et `LANGAGE-NEXUS-PLAFONDS.json`.
- **Proposition P1** : décider si ce lexique doit être créé (mots du terrain pompiste, à faire valider par Frédéric) ou si la consigne vise un autre nom.

## 2. LANG-003 : la garde est verte sur le rail, pas sur `production`
La garde et ses plafonds vivent sur le rail seulement. Mesurée sur le rail : conforme, 1 476 tirets, aucun plafond au-dessus de la mesure. Mesurée avec les mêmes plafonds sur l'arbre de `production` (`ee426fe4`) :

- 1 578 tirets cadratins dans le contenu affiché, contre 1 481 à la pose (+97 net).
- 25 fichiers dépassent leur plafond. Les plus nets : `NEXUS-Boite-Reception-v1.html` 10→19, `NEXUS-FDJ-v1.html` 18→30, `NEXUS-Parametres-Station-v1.html` 46→61, `NEXUS-Verify-v1.html` 69→80, `nexus-auth.js` 4→15, `NEXUS-Parametres-Rappels-v1.html` 2→7, `NEXUS-Paye-v1.html` 18→24, `NEXUS-Planning-v1.html` 13→18.
- 8 fichiers n'ont aucun plafond (`nexus-paye-regularisations.js` 6, `nexus-regularisation-saisie.js` 4, `nexus-pointage-regles.js` 3, `nexus-regularisation-groupe.js` 2, `nexus-vocabulaire.js` 2, `nexus-ecarts-donnees.js` 1…).
- 2 plafonds orphelins (`NEXUS-Live-Developpement-v1.html`, `nexus-live-projection.js`) : fichiers absents de `production`.
- 8 plafonds à abaisser (Inventaire 35→34, Produits 24→23, Rapport 29→28, Scanner 12→11, etc.).

Lecture : la garde ne mord pas sur ce qui part en Production, car elle n'y est pas câblée (même famille que « les gardes qui ne mordent pas »). Le chiffre « aucun ajout » du rail ne dit rien de `production`.

**Proposition P2** : porter la garde et le fichier de plafonds dans `production` avec un lot dédié (PR vers `production`, GO requis), après avoir arbitré si les 97 tirets ajoutés sont corrigés ou si les plafonds sont relevés par une décision écrite. Je ne recommande pas de relever en silence.

## 3. Écrans du pompiste : écarts à la doctrine (échantillon)
Relevé automatique des chaînes affichées dans Inventaire, Missions et Prise de poste, puis lecture des cas retenus.

| Où | Texte | Écart | Proposition |
|---|---|---|---|
| Inventaire, jaugeage | « Jaugeage non enregistré : saisie en cours » et « Jaugeage enregistré » pour un même état après réouverture | deux libellés voisins (constat du 23/10, `executions-lot-PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022.md` §A) | un seul libellé pour « déjà enregistré, rouvert pour correction » ; à valider avec le pompiste |
| Inventaire l.1036 | « la connexion au serveur a échoué » | jargon (serveur) à un employé | « Impossible de joindre NEXUS pour l'instant. Réessayez dans un moment. » |
| Inventaire l.535, 543 | « Sauvegarde brouillon inventaire » | jargon, surtout s'il est lisible à l'écran | vérifier si c'est un message console ou affiché ; sinon reformuler |
| Inventaire l.1102 | « création refusée pour ne pas produire de ligne sans rattachement » | langage du Créateur affiché à un employé | « Votre quart n'est pas reconnu : prévenez votre manager. » |
| Inventaire l.1285, 1413 | « NexusInventaireProductionDonnees non chargé » | nom de module affiché | message de panne simple, détail en console |
| Missions l.1057 | « elle n'a pas pu être retirée de vos missions assignées » | formulation technique, ton de reproche possible | « Mission enregistrée. Elle reste affichée par erreur : dites-le à votre manager. » |
| Missions l.1376 | « Elle n'est pas validée » | négatif sec, l'état n'est pas dit comme « non enregistré » | « Votre mission n'a pas été enregistrée. Réessayez. » |
| Missions l.1546 | « la checklist … est déjà entièrement cochée » | anglicisme | « la liste de contrôle » ou « les étapes sont toutes cochées » |
| Missions l.2103-2104 | « Strictement interdit » (téléphone sur la piste) | ton d'interdiction ; la règle de sécurité justifie la fermeté, mais le reste de l'écran est positif | garder la règle, adoucir la forme (« Pas de téléphone sur la piste ni pendant une distribution ») ; à arbitrer car c'est une consigne de sécurité |
| Prise de poste l.491 | « Relève absente ou en retard » | ton de surveillance | « Relève pas encore arrivée » |
| Prise de poste l.634 | « NEXUS ne peut pas savoir si vous prenez le matin ou le soir » | correct (l'absence n'est pas devinée), garder | aucune |

Le tiret cadratin reste présent dans plusieurs de ces phrases (Missions 13, Inventaire 22 sur l'échantillon), ce qui rejoint P2.

## 4. Vocabulaire canonique (doctrine du 08/09)
- « Couverture jusqu'à », « Présence réelle », « Livraison effectuée » : non revérifiés écran par écran dans cette passe. Le constat du 08/09 les donnait absents ou à enrichir ; je n'ai pas de preuve qu'ils aient avancé.
- `LANG-004` (propagation du nom des agents, Conseiller NEXUS contre Directeur d'Exploitation) reste ouvert.

## 5. Limites
- Relevé par motifs, donc des faux positifs (noms de classes, messages de console) ; chaque ligne du tableau §3 a été relue, pas l'ensemble du dépôt.
- Aucun écran vu au navigateur dans cette passe.
- Aucune lecture de la Production.

## 6. Décisions demandées à Frédéric
1. P1 : le lexique terrain doit-il être créé, et par qui validé ?
2. P2 : ouvrir un lot « garde LANG-003 dans `production` » ? Corriger les 97 ou relever les plafonds par décision écrite ?
3. §3 : quels libellés je reformule dans un lot de code (PR brouillon, GO avant fusion) ? Je recommande les quatre à risque pour l'employé : serveur, module non chargé, « création refusée », « non validée ».
