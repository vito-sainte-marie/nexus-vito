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
**Décision de Frédéric (23/10)** : pas de filtre de zone à la génération. Le plan couvre le quart entier, chaque écran filtre selon la zone de l'employé ; l'huile et le lave-glace dans le plan sont normaux (la boutique les compte). Critère retenu : « l'écran du pompiste ne contient que les produits actifs de la zone piste » ; il est porté par le lot CATEGORIES_FIL.

## D. Missions
- Code : « disponibles » n'est déplié que si aucune mission obligatoire n'existe et qu'il y a des disponibles ; sinon comportement inchangé. Épreuve `test_parcours_pompiste_lot3_20261023.js` (M1).
- **Vu au navigateur, avec missions obligatoires** (aperçu `e87ca738`, code `e444e46`, Employé Test B, pompiste, 375 px) : « Obligatoires avant le départ (2) » affiché ; « Disponibles pendant le service (1) » **replié**. Comportement existant conservé. Revu après restauration du catalogue : même constat.
- **Vu au navigateur, sans mission obligatoire** (24/10) : après avoir désactivé TST-001 et TST-002 sur Test (accord de Frédéric), même compte, rôle « pompiste » : « Aucune mission obligatoire pour l'instant » et « Disponibles pendant le service (1) » **dépliée d'elle-même**, avec « Vider les poubelles exterieures ». Catalogue ensuite restauré (TST-001 à TST-005 `actif=true`, relu).
- **Erreur de départ corrigée** : solder les deux missions obligatoires ne déplie pas « Disponibles ». Le dépliage dépend du catalogue (`disponibilite = obligatoire` pour le rôle), pas de l'achèvement : les missions validées restent listées. Ce n'est pas un défaut du Lot 3 ; c'est l'objet du lot de suite (point 4 de la section F).
- **Renfort** : l'écran Missions du renfort suit une branche de mise en page distincte (4 blocs), que le Lot 3 ne touche pas. Vu comme simple témoin que cette branche est inchangée ; il ne prouve pas le correctif.

## E. Écritures sur Test (jamais Production)
- Nettoyage du quart du matin 10:00 (quart `7568f3b4`, rattachement `71edc336`, plan `22960f98`, 6 lignes), par un bloc SQL borné, pas par le script versionné ; service `ed1cc859` conservé.
- Services de recette encore présents : pompiste matin `ed1cc859`, `d4f52c83`, renfort soir `8497d450` (clos sans pointage au changement de rôle), pompiste soir `a97e191d` (en cours, créé par ce changement de rôle).
- Validations de missions : `2e8d8961`, `3c8f7316`.
- Catalogue : TST-001 et TST-002 désactivés puis restaurés (état final identique à l'initial).
- Script de retrait `outils/nettoyage-services-recette-pompiste-20261023.sh` : refuse Production (code 3) et tout autre projet, simulation par défaut (rollback), `--executer` pour valider, bornes par identifiants, aucun service d'un autre auteur. **Non exécuté** : à lancer après la fin des mesures. Ses gardes n'ont pas été exercées par moi (ma lecture et mes écritures sur Test sont passées par l'outil SQL du connecteur, pas par `psql` ni par le script).

## F. Limites et suite
1. L'objectif de 3 s n'est **pas atteint** (5,0 s). Volet Inventaire clos par Frédéric avec ces chiffres.
2. Suite des suites `run-tests.js` : 7 échecs sur la branche (298/305) et **les mêmes 7** sur `origin/production` `7cbbb479` (297/304). Les « 9 » étaient la base du 3 oct. Les 7, hors périmètre du lot : `test_inventaire_categorie_mixte_deux_lieux`, `test_inventaire_production_journaliere_q1`, `test_inventaire_sprint4_ux_flash`, `test_inventaire_sprint4bis_ecriture_immediate`, `test_pilotage_qualite_receptions`, `test_reception_moteur`, `test_reception_v1_dom`. Le lot n'en ajoute aucun.
3. Rien vu sur iPhone réel.
4. **Lot de suite** (préparé, non déposé avant la clôture) : relectures restantes (`chargerIngredientsSelection` lue deux fois par la voie des missions, `station_config` ×3, `sites` ×2, `shifts` ×2) avec la même mesure Guardian avant/après ; et « déplier Disponibles aussi quand toutes les missions obligatoires du jour sont validées ».

## G. Prochaine action unique
Ton GO pour fusionner la PR en brouillon (aucune fusion sans lui).
