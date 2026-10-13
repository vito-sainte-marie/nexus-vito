# Dossier de promotion Production — versements de régularisation groupés (VERIFY / FDJ / PAYE)

| | |
|---|---|
| Branche | `regularisation-differee-groupes-20261013`, PR #109 (base `production`, **non fusionnable en l'état**) |
| Cible | Production `uzhjpqpctpvxytxpxoqz` + GitHub Pages (`production`) |
| Date | 13/10/2026 |
| Verdict demandé | **aucun** : ce dossier prépare, il n'autorise rien. Aucun GO Production n'est implicite. |
| État de Production | inchangé par ce lot — migration, code et données |

## 1. Ce que le lot change

Un versement de régularisation peut désormais être **groupé** : un montant reçu, un tiroir, un mode, affecté — sur confirmation explicite du manager, jamais automatiquement — à un ou plusieurs anciens écarts du même salarié et du même domaine. Le surplus (montant − affectations actives) est suivi à part ; il n'est ni transmis à Paye ni à la comptable. Paye lit en lecture seule, avec deux compteurs séparés (Boutique/Piste, FDJ). Aucune retenue automatique, aucune période close recalculée.

## 2. Migration — `20261013140000_versements_groupes_regularisation.sql`

Mesurée en Production le 13/10/2026 (lecture seule, `begin read only … rollback`) :

| Mesure | Valeur |
|---|---|
| colonne `groupe_id` sur `ecarts_versements_regularisation` et `caisse_transferts_coffre` | absente (0) |
| fonctions du lot (`enregistrer_versement_groupe`, `affecter_surplus_groupe`, `annuler_versement_groupe`, `enregistrer_transfert_coffre_groupe`, `ecarts_ouverts_employe`, `versements_groupes`) | absentes (0) |
| table `versements_regularisation_groupes` | absente (0) |
| migrations appliquées / dernière | 311 / `20261013152155` |

Nature : table neuve, deux colonnes nullables, une contrainte CHECK (`ctc_versement_ou_groupe`) satisfaite par toute ligne existante (`groupe_id` NULL), fonctions neuves, remplacement de `_regul_tiroir_detail`. Aucune donnée supprimée.

**Faux positifs de la garde** : le « DDL destructif » relevé (`drop_column`, `drop_table`, `truncate`) vient du commentaire de retour arrière en tête du fichier et du trigger `vrg_immuable_truncate`, qui *interdit* le TRUNCATE. La migration ne détruit rien. La garde n'est ni modifiée ni affaiblie ; l'état « atomique ou procédure spéciale » est retenu, avec ce dossier pour procédure (même choix que pour `20261013132532`).

Écart d'estampille : le fichier porte `20261013140000`, Test l'a reçue sous `20261013220411`. Production recevra l'estampille posée par le connecteur.

## 3. Ordre de pose

1. **Migration d'abord, code ensuite.** Le nouvel écran appelle des RPC absentes de Production : posé avant la migration, l'écran Écarts échouerait au chargement des groupes.
2. L'ancien code sur le nouveau schéma est sans effet (colonnes nullables, fonctions neuves ; le remplacement de `_regul_tiroir_detail` garde le calcul des versements non groupés).

## 4. Retour arrière

Voir l'en-tête de la migration : retirer les RPC, recréer `_regul_tiroir_detail` depuis `20261008160000`, retirer les triggers, retirer `groupe_id`, supprimer la table des groupes **seulement si vide ou après sauvegarde et accord distinct** (les lignes sont immuables).

## 5. Preuves disponibles

- Banc jetable `outils/epreuve-versements-groupes-20261013/` : 24 scénarios verts, contre-témoins conformes.
- Test : recette navigateur sur l'aperçu de la PR (cas Angélique : 10 € reçus, 8 € affectés, 2 € de surplus) — affectation, imputation du surplus, plafond coffre, annulation de groupe, annulation d'un transfert, vue Paye à deux compteurs, surplus exclu.

## 6. Reste à décider

- Surplus : suivi à part, sans restitution ni écriture associée (décision du 13/10/2026).
- Véhicule de code : la branche part du rail ; une PR vers `production` exige un portage depuis `origin/production`.
- Trois GO distincts de Frédéric : application de la migration, fusion, déploiement Pages.

## Portage depuis `origin/production` (decision-1, conditions 3 et 4)

- Base : `origin/production` à `7e37b88` ; les 9 commits du lot y sont reportés par cherry-pick sans conflit (neuf fichiers modifiés ou ajoutés hors épreuves).
- Blob de la migration inchangé : `eccdbafc53e9e34d365a49aa5c6d3708cc731d03`.
- Écart d'estampille : la migration est appliquée sur Test sous la version `20261013220411` (horodatage d'application), le fichier du dépôt porte `20261013140000`. Production recevra le fichier tel quel ; aucune réécriture du fichier.
- Empreinte : l'arbre de `production` compte 306 migrations, le portage 307 ; les constantes mesurées sur le rail (307, `ca778d6c…`) tiennent dans cet arbre (épreuve 32/32).
- Condition 5 (intervalle « migration posée, nouveau code non déployé ») : analysée le 13/10/2026, lectures seules Production (`begin read only … rollback`).
  - Mesures : `groupe_id` et `versements_regularisation_groupes` absents ; `ecarts_versements_regularisation` et `caisse_transferts_coffre` à 0 ligne ; aucune vue ne les cite ; triggers existants limités à l'immuabilité ; neuf fonctions les citent (`enregistrer_versement_regularisation`, `annuler_*`, `enregistrer_transfert_coffre`, `mes_regularisations`, `_ecarts_regul_situation`, `ecarts_trop_percus`, `enregistrer_restitution_trop_percu`, `_regul_tiroir_detail`).
  - Raisonnement : (1) la migration est additive (colonne nullable, nouvelle table, nouvelles RPC) ; (2) les triggers `evr_groupe_controle`, `evr_a_groupe_annulation` et `ctc_groupe_controle` sortent immédiatement quand `groupe_id` est nul, donc le code actuel, qui n'écrit jamais `groupe_id`, passe inchangé ; (3) le CHECK `ctc_versement_ou_groupe` est vrai pour toute ligne sans `groupe_id` ; (4) `_regul_tiroir_detail` garde sa signature et sa forme de sortie, et ses résultats sont identiques tant qu'aucun groupe n'existe ; (5) les `%rowtype` des fonctions existantes suivent la table ; (6) seules les nouvelles RPC créent un groupe, et aucun écran de la version actuelle ne les appelle.
  - Limites : ce raisonnement est lu dans le code et le catalogue, pas rejoué. Non fait : comparer la définition Production de `_regul_tiroir_detail` (md5 relevé `2dcaf86a…`) au texte de 20261008160000 ; rejouer sur une copie de Production la suite des scénarios existants avec la migration seule.
  - Retour arrière : celui de l'en-tête de la migration. Tant qu'aucun groupe n'existe, la table est vide et le retour arrière est sans perte.
  - Conclusion proposée : l'intervalle est compatible, sous réserve des deux limites ci-dessus. Aucun GO Production (migration, fusion, Pages) n'est accordé.
