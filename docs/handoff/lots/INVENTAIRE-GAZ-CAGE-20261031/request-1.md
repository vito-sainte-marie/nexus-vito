---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-GAZ-CAGE-20261031
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=facd36eb
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 169-fichiers
  - id: code-origin-production
    classe: DECLARED
    valeur: lecture-seule
---
# INVENTAIRE-GAZ-CAGE-20261031 : request-1 — repère « cage à gaz », avant tout code

BRANCHE_DU_LOT: inventaire-gaz-cage-20261031

## Demande de Frédéric (31/10, 15 h 27)

Orienter le pompiste sur la cage à compter. Le repère dit **où commencer à compter**, jamais **la quantité** : il ne remplace pas le comptage à l'aveugle. Ce lot passe avant INVENTAIRE-CAISSE-RENFORT-20261031.

## Ce que cette demande fait et ne fait pas

Aucun code, aucune opération en Production. Elle répond aux trois points exigés par Guardian (comments 6545939347, 6545968413, 6547988142) avant tout développement.

## 1. Origine de la ligne « 0 » en double pour Gaz 12,5 kg (Production)

Constats observés par Guardian : 30/10 6 h 41, lignes 132 et 0 ; 31/10 5 h 52, lignes 118 et 0.

**Prouvé par le code (origin/production, lecture seule)**

- `chargerDerniersStocks` (`NEXUS-Inventaire-v1.html` ~1208) ne lit que les `cloture` valides, triées par `compte_le` décroissant, et garde la première par produit. Elle **ne peut pas** produire une ligne d'ouverture : ce n'est pas la source du doublon.
- Les lignes d'ouverture viennent de `ecrireOuvertureImmediat` (~750) via `ecrireComptageImmediat` (~639). La clé d'idempotence est `quartId|produitId|type|valeur` : **la valeur fait partie de la clé** (voulu : une vraie correction crée une nouvelle ligne, « le plus récent gagne »). Conséquence : deux écritures avec des valeurs différentes pour le même produit et le même quart donnent **deux lignes**, par construction.
- `ecrireOuvertureImmediat` s'exécute à chaque geste de validation du produit. Une ligne à 0 apparaît donc si, à un geste de validation, `saisie.compte` valait 0 (champ non encore saisi traité comme 0, ou geste sur la ligne avant la saisie) avant ou après le vrai chiffre.

**Non prouvé (hypothèses)**

- H1 : une première validation avec `compte = 0`, puis la saisie réelle (132 / 118), ou l'inverse. Les deux lignes coexistent, et la lecture « la plus récente » prend 0 si le 0 est écrit en dernier.
- H2 : deux lignes produit « Gaz 12,5KG » dans `inventaire_zone_produit` (doublon de catalogue). Le seed n'en crée qu'une.

**Ce qu'il faut pour trancher** : une lecture de Production, **filtrée par site**, de `inventaire_comptages` (Gaz 12,5 kg, quarts des 30 et 31/10 : `compte_le`, `type_comptage`, `statut`, `source`, `employee_id`, `quantite`, `produit_id`) et du nombre de lignes « Gaz 12,5KG » dans `inventaire_zone_produit`. **GO de Frédéric demandé** pour cette lecture seule, sinon je reproduis sur Test (site `nexus-station-test`) en validant Gaz à 0 puis à N, et l'inverse.

**Règle proposée pour choisir le dernier comptage valide** (à confirmer après la lecture)

- ne considérer que `statut = valide` ;
- écarter les lignes `source = auto` (`transmis`) ;
- trier par `compte_le` décroissant ;
- à égalité d'instant, préférer la ligne portant un `employee_id` et une quantité saisie ; un 0 reste admis seulement s'il est la seule ligne saisie, ou la plus récente par un instant distinct ;
- si la lecture montre que le 0 est un artefact d'écriture (H1), corriger à la source : ne pas écrire de `ouverture` tant que le produit n'est pas réellement compté (`produitEstCompte`), plutôt que filtrer à la lecture.

## 2. Où le repère s'affiche

- **Fin de quart (clôture)** : sur la consigne d'inventaire de clôture (`renderCloture` ~3594, `renderLigneCloture` ~3677), sous le nom du produit Gaz, avant le champ « Stock final ». C'est la demande de Frédéric.
- **Proposition à Frédéric** : l'afficher aussi **à l'ouverture** (`renderLigneOuverture` ~3236), car le pompiste compte aussi le gaz à l'ouverture. Même module, même texte. À accepter ou refuser.
- Contraintes : le repère indique le point de départ (par exemple « Commencez par la cage de gauche »), jamais un chiffre. Le tableau, les conditions d'affichage et les tests d'acceptation sont ceux de Guardian (stocks 127, 27, 150, 0 et une livraison enregistrée), repris tels quels.

## 3. Fichiers touchés

- `NEXUS-Inventaire-v1.html` : affichage du repère (clôture, et ouverture si accepté) ; correction du doublon « 0 » selon la cause établie.
- nouveau module pur `nexus-inventaire-repere-cage.js` et son test `test_inventaire_repere_cage.js` ;
- `NEXUS-Parametres-Inventaire-v1.html` : saisie du réglage par site.

### Écart avec « pas de migration »

`inventaire_regles_produit.champs_specifiques` est un `text[]` géré par le déclencheur `nexus_inventaire_detecter_champs_specifiques` (migration 20260830211432) : il liste des **noms** de champs surchargés, il ne peut pas porter un texte libre. Le réglage Sainte-Marie ne peut donc pas y vivre. Options :

- A (recommandée) : colonne `jsonb` sur `inventaire_zone_produit` ou table de réglage par site, **migration sur Test d'abord** ;
- B : un réglage jsonb de station déjà existant, si Guardian en désigne un ;
- C : constante dans le code (écartée par Guardian).

Arbitrage demandé : A ou B. Si B, aucune migration.

## 4. Données et processus

- Écriture du réglage Sainte-Marie en **Production = GO de Frédéric**. Sur **Test** : pré-autorisation 1.
- PR de base `production` ; recette Test par Guardian (stocks 127, 27, 150, 0 et une livraison enregistrée) ; fusion par Frédéric.
- Je lance chaque fichier de test touché isolément et compare `node run-tests.js` aux 7 échecs connus avant d'ouvrir la PR.

## Preuve des conditions

- Lecture du code : `origin/production`, fichiers cités ci-dessus.
- Aucune lecture ni écriture Production effectuée.
- Hypothèses H1/H2 : non prouvées, dépendent d'un GO.

## À arbitrer

1. GO de Frédéric pour la lecture seule de Production, filtrée par site, décrite en 1.
2. Option A ou B pour le stockage du réglage (3).
3. Affichage aussi à l'ouverture : oui ou non (2).
4. Validation de ce périmètre comme base du lot, étape 1 = correction du doublon « 0 » + migration du réglage sur Test. Aucun code avant la décision.
