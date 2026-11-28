# A4-1b : saisir, proposer et valider l'objectif de marge (fiche de conception, sans code)

Statut : conception. Aucune migration, aucun code. Débloque le go-live de #416 (sans cible valide, l'écran dit « objectif non défini »).

## 1. Droits et fonctions
- Aujourd'hui (`20261117020652`) : écriture de `tarif_seuils` réservée au gérant de la station (politique `insertion_roles_meme_site`). **Cette politique ne change pas.** Aucune ouverture directe aux managers.
- Deux RPC `security definer` (`search_path` fixé, `revoke … from public, anon`, `grant execute to authenticated`), insertion seule, la table reste immuable :
  - `proposer_cible_marge(site, niveau, cible_niveau, minimum, cible, commentaire)` : insère une ligne `statut_cible = 'indicatif'`. Droit « proposer » (`objectif_habilite(site, 'proposer')`).
  - `valider_cible_marge(id)` : insère une nouvelle ligne `statut_cible = 'valide'` avec `remplace_id = id`. Droit « valider ». **Refus si `saisi_par` de la proposition = appelant** (jamais sa propre proposition).
- Révision : nouvelle ligne `remplace_id = ancienne`; retrait = `annule_le/annule_par/motif` (motif obligatoire). Rien n'est supprimé.
- Seule une ligne `valide` rend la cible « notante » (A4-1 inchangé). Une proposition `indicatif` s'affiche, ne juge pas.

## 2. Dépendance à R1 / R2 / R2b (#394)
- `objectif_habilitation` et `objectif_habilite(site, droit)` viennent de R1/R2, non fusionnés. **Recommandation : A4-1b réutilise cette habilitation et vient après R2.** Pas de seconde liste de droits.
- Sans R2 : variante gérant seul (RPC `valider` sans `proposer`, le gérant saisit et valide lui-même). Elle contredit la règle « jamais sa propre proposition » : **non recommandée**.
- R2b (première désignation) reste une migration distincte, Production seulement. A4-1b n'en désigne aucun compte.
- Arbitrage demandé : attendre R2, ou livrer d'abord la variante gérant seul avec auto-validation dérogatoire documentée ?

## 3. Où l'on saisit (une seule porte)
- **Recommandation : un panneau « Objectifs de marge » dans l'onglet tarif de Produits**, seule porte d'entrée. Motif : `tarif_seuils` est le registre tarifaire, et l'écran bureau R4 traite d'autres natures d'objectifs. R4 affichera la valeur en lecture seule avec un lien vers ce panneau.
- 375×812 : une carte par niveau (station, famille, rayon), valeur résolue et son niveau d'origine; feuille de saisie plein écran au tap; actions en bas de pouce.
- 1280×800 : tableau à gauche (niveau, minimum, cible, statut, date), volet de saisie et historique à droite.
- Jour et Nuit : jetons de couleur existants, aucun statut porté par la seule couleur (pastille + mot : « indicatif », « valide »).
- Historique : chaîne `remplace_id` affichée du plus récent au plus ancien, avec qui, quand, pourquoi; retraits visibles, barrés, motif lisible.

## 4. Niveaux
- station (`defaut`) → famille → rayon. **`seuilDe` n'est pas modifié** : la résolution reste celle d'aujourd'hui (le plus précis qui existe et est valide l'emporte). Le panneau montre, pour chaque rayon, la valeur retenue et le niveau dont elle vient.
- Contraintes déjà en base : `minimum ≤ cible`, valeurs entre 0 et 1 exclu, au moins une des deux. Le formulaire les reprend, en pourcentage.

## 5. Recette (à passer par Guardian)
- Reprises de R2 : S5, S6, S14, S16 (proposer, valider, refus d'auto-validation, retrait).
- Nouvelles : **M1** une proposition `indicatif` s'affiche mais ne note pas ; **M2** la validation rend la cible notante et fait disparaître « objectif non défini » ; **M3** auto-validation refusée ; **M4** compte sans habilitation refusé (appel RPC direct compris) ; **M5** révision : l'ancienne ligne reste lisible dans l'historique ; **M6** `anon` n'a aucun accès aux RPC ni à la table ; **M7** `seuilDe` renvoie la même valeur qu'avant sur les cas existants.
- Rien en Production sans GO distinct; migration d'abord sur Test.
