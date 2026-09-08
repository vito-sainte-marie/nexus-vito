# NEXUS — Backlog canonique

Ce fichier est la mémoire durable des observations terrain, anomalies, besoins et évolutions futures. Il ne remplace pas le Handoff : il alimente les futurs lots.

## États

- `TERRAIN` : observation réelle non encore arbitrée.
- `A_ETUDIER` : besoin compris, solution à définir ou dépendances à analyser.
- `PRET_POUR_DEV` : périmètre et critères d'acceptation suffisamment définis pour ouvrir un lot.
- `TERMINE` : correction validée avec preuve.

## Priorité immédiate — continuité et sécurité

| ID | État | Priorité | Sujet | Critère de sortie |
|---|---|---:|---|---|
| CONT-001 | PRET_POUR_DEV | P0 | Continuité NEXUS indépendante des conversations/sessions | Reprise possible depuis dépôt canonique uniquement |
| SEC-001 | TERMINE | P0 | Fermer `est_pompiste_du_jour` timezone + `en_cours` et les 7 policies dépendantes | Preuves comportementales Test vertes, registre aide conforme |
| ARCH-001 | A_ETUDIER | P0 | Terminer isolation multisite/site explicite | Aucun chemin actif ne peut dériver silencieusement un site ou croiser les données clients |
| SHIFT-001 | A_ETUDIER | P0 | Lifecycle des prises de poste et clôture des services | Un service courant est unique, borné et clôturé selon contrat métier |
| ORCH-001 | PRET_POUR_DEV | P0 | Réveil Handoff autonome sans modification de `main` | Un control-plane externe auditable lit `config-par-environnement`, ne déclenche Claude que sur décision fraîche non consommée, respecte GOV-001/GOV-004, n'expose aucun secret et ne touche pas Production |
| ORCH-002 | TERMINE | P0 | Guardians backend + apprentissage intégrés canoniquement | Outils présents sur `config-par-environnement`, tests ciblés + mutation négative verts, CI réellement câblée, régression complète sans nouvel échec, aucun secret ni accès Production |
| ARCH-002 | PRET_POUR_DEV | P1 | Résoudre la collision d'identité globale `NexusStock` (`nexus-stock.js` vs `nexus-stock-moteur.js`) avant activation bloquante du routeur Architecture | Propriétaire unique déterminé, collision supprimée/renommée sans logique parallèle, consommateurs prouvés, aucune régression |

## Observations terrain à traiter

| ID | État | Priorité | Module | Observation / besoin | Critère d'acceptation initial |
|---|---|---:|---|---|---|
| INV-001 | TERRAIN | P0 | Inventaire | Passage mode test → inventaire réel peu clair | L'utilisateur sait sans ambiguïté s'il est en test ou en réel |
| INV-002 | TERRAIN | P0 | Inventaire | Cigarettes : caisse gérée par l'employé, bureau réservé manager | La caissière ne voit ni ne gère le stock bureau |
| INV-003 | TERRAIN | P1 | Inventaire | Libellés « stock par emplacement » / « transfert interne » peu cohérents avec la signature NEXUS | Vocabulaire simple, métier et contextualisé |
| PAYE-001 | TERRAIN | P0 | PAYE / Absences | Vanessa en congé maternité nécessite plusieurs lignes | Une absence longue se saisit sur une période du/au en une action |
| PAYE-002 | TERRAIN | P1 | PAYE | Besoin d'actions de date à date | Sélection de période disponible pour les opérations concernées |
| PAYE-003 | TERRAIN | P1 | PAYE | Les écarts Verify doivent remonter clairement dans NEXUS PAYE | Variables visibles avec source et statut d'arbitrage |
| CARB-001 | TERRAIN | P0 | Carburants Performance | Après livraison, une estimation ancienne comme « mardi Q2 » peut rester affichée | Projection recalculée avec livraison effectuée ou attendue explicitement distinguée |
| CARB-002 | TERRAIN | P0 | Carburants Performance | Couverture doit être lisible en jour/semaine/quart plutôt qu'en jours décimaux | Affichage métier cohérent sur tous les écrans concernés |
| CARB-003 | TERRAIN | P1 | Carburants / Verify | Les états contrôle caisse / jaugeage doivent rester visibles et cohérents | Bandeaux et liens Verify présents selon état réel |
| CARB-004 | PRET_POUR_DEV | P0 | Carburants Performance / Commande | La recommandation terrain peut proposer un total inférieur à 36 000 L et afficher une préparation de commande le samedi pour une livraison lundi impossible | Le moteur respecte les contraintes opérationnelles de commande/livraison de la station ; aucune recommandation impossible n'est présentée comme action directe |
| CARB-005 | PRET_POUR_DEV | P0 | Carburants Performance / Commande | Dans ce contexte, Frédéric préfère explorer la quantité avant de préparer une commande ; le bouton inférieur « Simuler une commande » fait doublon avec l'action attendue | L'action principale devient « Simuler ma commande » lorsque la recommandation doit être ajustée ; le second bouton redondant est supprimé ou contextualisé sans double action |
| CARB-006 | PRET_POUR_DEV | P0 | Carburants Performance / Capacité | Si le stock projeté à la livraison est négatif, `limite - stockPrevu` peut dépasser la limite physique et recommander un volume non réceptionnable | La capacité réceptionnable reste toujours bornée par la limite physique de la cuve ; cas stock projeté négatif testé ; aucune régression réserve/rotation/arrondi/GNR/double intégration ; preuve NEXUS Test |
| FDJ-001 | PRET_POUR_DEV | P0 | FDJ Opérations / Réception | Le champ actuel « Provenance » est ambigu et optionnel alors que le numéro de colis FDJ est la référence attendue (ex. 169720001) | Champ renommé « Numéro de colis », obligatoire ; validation impossible s'il est vide ; erreur claire et focus/retour sur le champ |
| FDJ-002 | PRET_POUR_DEV | P0 | FDJ Opérations / Réception | Cliquer sur « Réceptionner » ne doit pas enregistrer immédiatement sans contrôle visuel des carnets saisis | Avant validation définitive, afficher un récapitulatif des carnets livrés par jeu et quantités, avec possibilité de revenir corriger ; aucune écriture définitive avant confirmation |
| FDJ-003 | PRET_POUR_DEV | P1 | FDJ / Relevé de clôture PDF | Le PDF tronque « Stock par jeu » avec « +19 autres » et place la synthèse caisse en bas à gauche | Le PDF affiche l'intégralité du stock par jeu ; colonne droite : Synthèse caisse en haut, Historique des versions en bas ; mise en page lisible sur une ou plusieurs pages si nécessaire |
| EMP-001 | TERRAIN | P0 | Employés / Shift | Prise de poste doit être séparée par date/quart/site | Aucun service d'un autre quart/site/date ne peut être réutilisé par erreur |
| EMP-002 | TERRAIN | P0 | Employés / Shift | Services historiques restent `en_cours` faute de clôture fiable | Mécanisme de clôture conforme au lifecycle validé |
| EVAL-001 | PRET_POUR_DEV | P0 | Évaluation Employé | `NEXUS-Evaluation-Employe-v1.html:487-488` affiche `0.0 / 5` et `0 %` quand aucune évaluation n'existe — le salarié lit une sanction là où il n'y a pas de donnée | Absence d'évaluation affiche un état neutre explicite, jamais une note/pourcentage chiffré |
| DEBUG-001 | PRET_POUR_DEV | P0 | Debug Créateur | `NEXUS-Debug-v1.html:560` : un écart de caisse jamais mesuré vaut `0`, s'affiche `+0 €` et se peint en vert — l'absence de mesure se lit comme une conformité parfaite | Une mesure absente ne peut jamais s'afficher comme `+0 €` vert ; état neutre distinct exigé |
| COACH-001 | PRET_POUR_DEV | P0 | Coach FDJ | `nexus-coach-fdj-moteur.js:85` : « conformes sur 0 % de vos quarts » — un reproche fabriqué à partir d'une absence de donnée | Aucune absence de donnée ne peut produire un pourcentage de non-conformité ; état neutre explicite |
| CARB-007 | PRET_POUR_DEV | P0 | Carburants Performance / Rappels | `NEXUS-Parametres-Rappels-v1.html:608` réimplémente un moteur carburant parallèle complet (`CAPACITE_CUVE`, `CAMION_CAPACITE=36000`, calcul de moyenne propre) au lieu du moteur canonique (`MAXIMUM_CAMION_LITRES`) — même famille de défaut que CARB-004 | L'écran consomme la vérité unique du moteur canonique, aucune réimplémentation locale du calcul |

## Règle d'entrée

Toute nouvelle observation terrain importante de Frédéric doit être ajoutée ici avant d'être considérée comme durablement capturée.

## Règle de sortie

Un item ne passe à `TERMINE` que si :

1. la correction est intégrée sur le rail autorisé ;
2. les tests/recettes nécessaires sont passés ;
3. la preuve est enregistrée ;
4. aucun invariant NEXUS n'a été cassé ;
5. lorsqu'une validation terrain est nécessaire, Frédéric l'a confirmée.
| SEC-010 | FAIT | P0 | Secret `SUPABASE_TEST_DB_URL_WRITE` à créer | Rôle Supabase Test en écriture au moindre privilège, jamais `service_role` ; l'étape CI de semis cesse de se déclarer indisponible |
| SEC-011 | FAIT | P0 | PIN de recette à changer | `NEXUS_TEST_PIN` a été écrit en clair en conversation le 07/09/2026, sur un dépôt public dont les noms de connexion sont lisibles. Traité le 08/09/2026 AUTREMENT que par une rotation : un PIN distinct par compte de recette, ce qui ferme la divulgation ET supprime le partage d'un même secret entre profils d'autorisation différentes |
| SEC-014 | ATTENTE_FREDERIC | P0 | Pointer `SUPABASE_TEST_DB_URL_WRITE` sur le pooler de session Supabase | L'hôte direct `db.udljdqxerrbbbajxubfn.supabase.co` ne publie plus qu'une adresse IPv6 (vérifié le 08/09/2026 : aucun enregistrement A) et les runners GitHub n'ont pas d'IPv6 — le semis du jeu de recette est injoignable. Le pooler de session est en IPv4. Rôle inchangé (`nexus_ci_recette`, moindre privilège), seuls l'hôte, le port et le préfixe d'utilisateur changent. Modification d'un secret : geste humain |
| SEC-013 | ATTENTE_FREDERIC | P1 | Supprimer le secret partagé `NEXUS_TEST_PIN` | Plus aucun usage actif depuis le passage à un PIN par profil, mais il porte encore la valeur divulguée et reste injectable dans n'importe quel workflow. Suppression d'un secret : geste humain. Vérifié par `outils/etat-deploiement.js` (`PIN_PARTAGE_RESIDUEL`) |
| SEC-012 | ATTENTE_FREDERIC | P1 | Compte Créateur de recette non connectable | `test-createur` existe dans `employees` mais sans identité `auth.users` ; la preuve d'accès POSITIVE à NEXUS Live reste non satisfaite tant qu'on ne peut pas s'y connecter. Créer le compte suppose de fixer un PIN — geste humain |
