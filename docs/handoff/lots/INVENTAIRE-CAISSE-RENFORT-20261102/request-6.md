---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5d9650c9
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 172-fichiers
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-6 — L1 incrément 2 : corrections de la relecture Guardian (6599962667)

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

Guardian a relevé trois points bloquant la recette de l'incrément 2 (PR #174, branche `claude/fil-caisse-l1-20261102`, commits f8ba85fa puis 2f8dd751). Cette request les traite et répond aux deux questions posées.

## Preuve des conditions de decision-4

Inchangées par ce correctif : activation pilote + `caissiere` seulement, aucune catégorie ni produit créé par le code, comptage à l'aveugle, écritures existantes seules, aucune migration, policy, grant ni règle d'alerte, défaut A non contourné, changement de quart non câblé, lectures existantes seules. Les épreuves passent de 16 à 20 contrôles (test_fil_caisse_20261102.js), pilotes 13 contrôles verts.

## Point 1 — request-5 absente du rail

Elle y est : tête du rail 58e2a90c porte request-5 du lot INVENTAIRE-CAISSE-RENFORT-20261102 (écart de délai de lecture, pas d'absence).

## Point 2 — recette sans catégorie caisse sur `nexus-station-test`

Seed posé sur **Test uniquement** (projet nexus-test, DML idempotent, aucune lecture ni écriture Production), copie des noms de Sainte-Marie, zone boutique du site :
- Cigarettes : Marlboro Gold, Marlboro Rouge, Benson (paquet, sensibles, comptage deux lieux)
- CBD : CBD Amnesia 5G, CBD Devil 5G (unité, sensibles)
- Journaux : Courses Paris Turf (unité)
Vérifié par SELECT : ces 6 produits exactement, 3 catégories. Les familles Pains / Sandwichs et Viennoiserie ne sont pas semées.

## Point 3 — liste vide

`demarrerOuvertureComptage` : si le fil est actif et la liste restreinte est vide, écran « Aucun produit caisse à compter, prévenez votre responsable. » avec retour à l'Accueil, sans aucune écriture, avant `chargerDerniersStocks`. Épreuve dédiée + mutation rouge (mut-page4).

## Réponses aux deux questions

a. **Intersection avec le plan de quart** : périmètre caisse complet, pas d'intersection avec `planQuartActif` (decision-1 : les 28 cigarettes à compter à l'aveugle). `restreindreAuPlanQuart` rend le filtre caisse avant le plan ; la purge de `dernierStock` couvre tous les produits caisse (référence d'écart conservée). Épreuves + mutations rouges (mut-page5 purge sans le fil, mut-page6 plan réappliqué).

b. **Ouverture partielle** : `validerOuverture` ne boucle que sur la liste restreinte et ignore les produits sans saisie ; il pose `a_valide_ouverture` et le statut du quart. Lu dans le code : aucune alerte « non compté » n'est créée à l'ouverture pour les produits hors caisse. Le décompte des manquants et l'alerte `cloture_incomplete` n'existent qu'à la clôture (flux existant, liste de zone du quart, non touché par le fil) ; le fil ne change pas la clôture. Lecture du code, pas encore observée en recette.

## Suite complète

317/325 avant correctif ; deux échecs hors les 7 connus : `ecart_aveugle_reference_20261101` (régression de mon fait, harnais corrigé en 2f8dd751, 7 contrôles verts) et `categorie_mixte_deux_lieux` (échoue aussi sur 64f97ff9, antérieur, non lié). Reste : les 7 connus + `categorie_mixte_deux_lieux`.

## Demande

1. Arbitrage de l'incrément 2 corrigé, `closes: false`, puis recette Employé Test B par Guardian.
2. Décision sur « produits du jour » par nom de catégorie (réserve acceptée pour le pilote, à cadrer en L2b).
3. Cadrage du changement de quart avant tout câblage.

## Limites

Rien en Production. Aucune migration, policy, grant, secret.
