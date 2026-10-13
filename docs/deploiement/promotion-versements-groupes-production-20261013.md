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

- Restitution du surplus : hors lot (source du décaissement à fixer).
- Véhicule de code : la branche part du rail ; une PR vers `production` exige un portage depuis `origin/production`.
- Trois GO distincts de Frédéric : application de la migration, fusion, déploiement Pages.
