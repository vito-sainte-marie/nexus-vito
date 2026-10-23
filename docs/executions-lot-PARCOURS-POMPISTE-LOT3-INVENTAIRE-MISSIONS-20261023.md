# Exécution de decision-1 — Lot 3 Inventaire et Missions (PARCOURS-POMPISTE-LOT3-INVENTAIRE-MISSIONS-20261023)

Décision : `decision-1` (APPROVED_WITH_CONDITIONS, closes:false, `82c95deb`). Prise en charge : `07cbb9da`.
Branche `lot3-inventaire-missions-20261023`. Aperçu mesuré : `e87ca738` (code `e444e46`). Supabase **Test** seulement ; aucune écriture Production, aucune migration, aucune fusion.

## A. Mesures navigateur (Claude Guardian, Employé Test B, même compte)
| Mesure | Avant | Après (`e444e46`) |
|---|---|---|
| Première ouverture, écran prêt | ~9 s | 5,0 s |
| Requêtes | 46 | 44 |
| Vagues | 27 | 12 |
| Quart déjà ouvert (2,8 / 3,0 / 6,4 s) | | 2,1 / 2,8 / 3,2 s (33 requêtes) |

**L'objectif de 3 s n'est pas atteint** à la première ouverture (5,0 s). Le gain est réel mais partiel.

## B. Plan chargé une fois
Prouvé au navigateur : une seule insertion du plan et de ses lignes, puis une seule relecture du plan avec ses produits (~3,2 s et ~3,3 s).
**Reste en double** : la préparation de la sélection (`inventaire_points_reference`, plans récents, produits du quota), lue vers 1,9 s puis 2,7 s (`chargerIngredientsSelection` par la voie des missions) ; `station_config` ×3, `sites` ×2, `shifts` ×2. Non traités dans ce lot.

## C. Identité des produits (plan généré le 23/10 à 18:13 UTC, quart du soir)
Six lignes, ordre 0 à 5 : Écailles, Gaz 12,5KG, Gaz 3KG, Glaçons recette, Huile moteur recette, Lave-glace recette. Même ensemble de six produits que le plan du matin comparé au tableau de référence. Les lignes du plan ne portent pas de quantité attendue : l'identité des quantités n'est pas comparable à ce niveau.
Constat à noter : le plan contient l'huile et le lave-glace alors que ces produits sont en zone boutique depuis l'alignement du même jour. Le générateur ne filtre pas par zone ; l'écran du pompiste les masque. Décision de Frédéric attendue sur un filtre de zone à la génération.

## D. Missions
- Code : « disponibles » n'est déplié que si aucune mission obligatoire n'existe et qu'il y a des disponibles ; sinon comportement inchangé. Prouvé par l'épreuve `test_parcours_pompiste_lot3_20261023.js` (M1) seulement.
- **Non vu au navigateur** : l'aperçu `e87ca738` demande une connexion que je n'ai pas faite (code PIN non saisi). Les deux cas (avec et sans mission obligatoire) restent à voir.

## E. Écritures sur Test
Nettoyage du quart du matin 10:00 (quart `7568f3b4`, rattachement `71edc336`, plan `22960f98`, 6 lignes), service `ed1cc859` conservé. Exécuté par un bloc SQL borné, pas par le script versionné. Services de recette `d4f52c83` et `ed1cc859` encore présents.

## F. Prochaine action
Voir Missions au navigateur (deux cas), puis décision de Frédéric : clore le volet Inventaire avec ces chiffres, ou continuer dans ce lot. Aucun gain non mesuré n'est annoncé.
