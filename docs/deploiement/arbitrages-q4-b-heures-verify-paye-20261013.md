# Arbitrages Q4 et B — lot NEXUS-HEURES-VERIFY-PAYE-1-20261009

Arbitrage métier relayé par Frédéric le 13/10/2026 (verdict à matérialiser au Handoff avec cette provenance ; ce n'est pas un GO de fusion ni de déploiement). Q2 « mois déjà validés » reste ouverte et n'est pas tranchée ici.

## Q4 — option C : une case vide n'est pas un repos

| Cas | Traitement dans Paye |
|---|---|
| Case vide + présence caisse/piste confirmée par Verify | Présence conservée, heures comptées une fois. Information non bloquante « Présence confirmée sans planning renseigné » (`ecart_verify_planning`, nature `planning_non_renseigne`). |
| Case vide, sans Verify | Rien : ni absence, ni retenue, ni heure de renfort. |
| Repos / absence explicite + Verify | Anomalie à arbitrer (`conflit_planning_verify`), compté, signalé, non bloquant. |

Code : `itemEcart` dans `nexus-paye-moteur.js`. L'ancien comportement silencieux est remplacé par l'information tracée. Le compteur « hors planning » ne compte plus les cases vides.

## B — option 2 : lignes distinctes `horaire_exceptionnel`

Existant conservé : ligne distincte, origine `manuel`, plage (début, fin, pause), motif, auteur, date de saisie, valeur initiale. Durée nette recalculée par le moteur ; `impact_paye` reste faux ; la durée remplace la durée de référence du jour sans toucher aux données Verify ni au planning, et sans heure supplémentaire automatique (qualification indépendante).

Ajouté :
- `justification` obligatoire (distincte du motif), au formulaire et à l'enregistrement ;
- `provenance: 'manuelle'` explicite ;
- `historique` : une nouvelle saisie du même jour empile la précédente au lieu de l'écraser ;
- tuile « Heures exceptionnelles (saisies par le manager) », signalée comme déjà comprise dans les heures, jamais ajoutée.

Aucune migration nécessaire : tout vit dans `nexus_paye_items.detail` (jsonb), déjà prévu par la migration `20261009120000`.

## Épreuves

`test_paye_regles_smu_20261008.js` (30/30, dont 3 scénarios Q4), `test_nexus_paye_ecarts_manager_20261009.js` (61/61, dont 3 épreuves B), et les épreuves `test_nexus_paye*`.

## Limites et gestes restants

- Recette navigateur sur NEXUS Test non faite ; rien de déployé, aucune écriture Supabase.
- Une absence de planning partout (aucun planning du mois) produit aussi l'information `planning_non_renseigne` pour chaque jour Verify : à confirmer si ce bruit est souhaité.
- Fusion et déploiement : GO nominatifs de Frédéric, après PR et CI.
