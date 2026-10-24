# Exécution de decision-1 — le fil compte la zone piste du site (CATEGORIES-FIL-20261024)

Décision : `decision-1.md` (arbitre ChatGPT, APPROVED_WITH_CONDITIONS, closes:false). Prise en charge : `25a5860b`.
Code : branche `categories-fil-parametrage-20261023` (refaite sur `origin/production`), commit `395400b5`, poussée. **Pas de PR, rien fusionné, rien déployé, aucune écriture Production.**

## A. Ce que le code fait maintenant
- `CATEGORIES_FIL` et `categorieDuFil` sont retirés de `nexus-fil-debut-quart.js`.
- `produitsZoneOuverturePourQuart()` (`NEXUS-Inventaire-v1.html`) part de `produitsZone` : les produits **actifs** de la zone **piste** du site courant. Aucune liste de noms. Le seul filtre restant est celui du quart du soir (profil `production_journaliere`), qui n'est pas une liste métier.
- Écailles reste un produit de Glaçons (règle PROD-002) ; PROD-003 : ce que le pompiste compte vient du paramétrage de la station.
- Aucune liste métier équivalente ailleurs : les épreuves C1, F7 et I3 la cherchent et rougissent si elle revient (mutations vérifiées).

## B. Épreuves et suite
| Épreuve | Résultat |
|---|---|
| produit désactivé absent | verte |
| produit actif de la zone piste présent, Écailles sous Glaçons | verte |
| autre site sans écailles : seulement `['Gaz 6KG']` | verte |
Suite complète `node run-tests.js` : 299 / 306, **7 échecs, les mêmes 7 que sur `origin/production`** (diagnostiqués, non nouveaux) : `test_inventaire_categorie_mixte_deux_lieux`, `test_inventaire_production_journaliere_q1`, `test_inventaire_sprint4_ux_flash`, `test_inventaire_sprint4bis_ecriture_immediate`, `test_pilotage_qualite_receptions`, `test_reception_moteur`, `test_reception_v1_dom`.

## C. Correction de la preuve : le script d'alignement et l'état de Test
La request-1 disait que le script d'alignement n'avait pas été exécuté. C'est exact pour le script, **inexact pour l'état de Test** : le **23/10 vers 14:00**, j'ai déplacé « Huile moteur recette » (`7775b1bc-…`) et « Lave-glace recette » (`4ad5fc4b-…`) en zone boutique sur Test par une **requête SQL équivalente**, sans passer par le script ni consigner l'écriture.

Simulation du script (24/10, rollback, Test `udljdqxerrbbbajxubfn`) : les deux produits sont déjà en `boutique`, **UPDATE 0, ROLLBACK, 0 ligne à modifier**. Cela prouve (1) le bornage : le script ne touche que ces deux identifiants, et il refuse Production (sortie 3) ; (2) l'état de Test : l'alignement est déjà fait. **`--executer` n'a pas été utilisé : il n'avait rien à trouver.**
Premier lancement : délai de connexion dépassé (hôte direct IPv6) ; relancé avec `connect_timeout=12`, réussi.

## D. Constat Production (SELECT seul, projet `uzhjpqpctpvxytxpxoqz`)
La zone `piste` de Production contient, en produits actifs, **Gaz, Glaçons (dont « Glace Ecaille 8kg Crystal »), mais aussi 16 huiles et 9 lave-glace / liquides de refroidissement / AD BLUE** ; les jaugeages carburant y sont inactifs. (Les lignes apparaissent par paire pour plusieurs produits : la requête n'était pas filtrée par site.)
Conséquence : avec ce code, **le fil de Production comptera aussi huiles et lave-glace tant que ces produits restent en zone piste**. Sur Test, l'alignement les a déplacés en boutique ; en Production, ce déplacement serait une **écriture Production** : non faite, réservée au GO de Frédéric. À décider avant toute promotion.

## E. Limites
- Aucune recette navigateur de ce lot. Écran vu seulement par l'épreuve sur faux client.
- Le comptage Production n'est pas mesuré par site (voir D).

## F. Prochaine action unique
Arbitrage de la preuve (request-2).
