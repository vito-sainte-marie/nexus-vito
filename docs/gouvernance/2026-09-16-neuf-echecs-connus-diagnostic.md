# Les neuf échecs tolérés : ce qu'ils disent, et ce qu'ils ne disent pas

Mesuré le 16/09/2026 sur `origin/production` à `faba5628`.

`.github/workflows/tests.yml` porte une liste littérale `CONNUS` de neuf
épreuves autorisées à échouer, et compare chaque exécution à cette liste. Le
comparateur est **strict dans les deux sens** : une épreuve qui casse en plus
fait échouer la CI, une épreuve réparée aussi. C'est une bonne garde — elle
interdit à la fois la régression et l'oubli.

Mais neuf lignes tolérées depuis des semaines finissent par se lire comme neuf
bugs tolérés. Ce document dit, épreuve par épreuve, **ce qui échoue réellement**.
La réponse n'est pas la même pour les neuf, et elle n'est celle que l'on croit
pour aucune.

**Deux des neuf sont déjà réparées — par le train de fusion lui-même, pas par
ce lot.** Je l'ai écrit faux une première fois : « aucune des neuf n'est
réparée ». La mesure dit le contraire, et c'est exactement l'erreur que ce
document est censé combattre — un audit daté lu comme un fait présent. La
section suivante nomme les deux, avec leur preuve. Les **sept** autres restent
entières, et la dernière section dit pourquoi ce lot n'est pas celui qui les
répare.

---

## Statut réel : deux sont réparées par le train en cours

Mesuré sur l'arbre du train fusionné le 16/09/2026 — les neuf de
`origin/production` deviennent **sept** une fois le train passé :

| épreuve | catégorie | réparée par | comment |
|---|---|---|---|
| `test_chaine_temporelle_carburant_20260821.js` | A | lot 2 — PR #48 | une doublure de LISTE (`chainListe`) qui expose `neq/not/lt/order/limit` ; la table absente du scénario répond « aucune ligne », pas une panne |
| `test_inventaire_parcours_depot_boutique_reste.js` | C | lot 1 — PR #47 | les deux compagnons (`nexus-station.js`, `nexus-inventaire-moteur.js`) sont chargés dans le bac à sable dans l'ordre des balises `<script>` de l'écran |

Les deux branches retirent en même temps le nom de leur épreuve du bloc
`CONNUS` — c'est d'ailleurs la cause du seul conflit de contenu du train sur
`.github/workflows/tests.yml`, dont la résolution est l'**union des deux
retraits** : neuf moins deux, sept entrées.

Preuve d'exécution sur l'arbre fusionné : sept échecs mesurés, sept noms
déclarés, aucun `NOUVEAU`, aucun `REPARES`. La garde stricte dans les deux sens
passe — ce qui ne serait pas le cas si un seul des deux retraits manquait.

Ce que cela change au diagnostic : **rien**. La cause décrite pour ces deux
épreuves est celle que les deux lots ont effectivement corrigée — doublure trop
étroite pour l'une, bac à sable incomplet pour l'autre. Ce que cela change au
plan : les deux ne sont plus à faire, et le lot de réparation d'après-train ne
porte plus que sept épreuves.

---

## A — La doublure est trop étroite (2 épreuves, dont 1 déjà réparée)

Le produit a appris un geste que la doublure de test ne sait pas imiter. Le
code testé est correct ; c'est le mannequin qui n'a pas de bras.

### `test_chaine_temporelle_carburant_20260821.js` — RÉPARÉE par le lot 2 (PR #48)
    TypeError: client.from(...).select(...).eq(...).neq is not a function

Le faux client Supabase du test (l. 295-298 et 336-341) expose, sur ses
branches de repli, `select`, `eq`, `lte`, `order`, `limit`, `maybeSingle`.
Depuis, `nexus-carburant-donnees.js:213` a appris à écarter les visites
inabouties :

    .eq('site', siteId).neq('statut', 'en_cours').neq('statut', 'annulee_doublon')

`neq` n'existe pas sur la doublure. Réparation : ajouter `neq` aux branches de
repli. Le sujet de l'épreuve — la chaîne temporelle du carburant, les faux
écarts de +1022 L SP95 du 21/08 — n'est pas en cause.

### `test_pilotage_qualite_receptions.js`
    TypeError: document.addEventListener is not a function

`documentStub` offre `getElementById`, `querySelectorAll`, `querySelector` et
`body`. L'écran s'est mis depuis à écouter un événement sur le document.
Réparation : ajouter `addEventListener` au stub — le fichier sait déjà le faire,
ses éléments simulés en ont un (l. 25).

---

## B — L'extraction est partielle (4 épreuves)

Quatre épreuves d'inventaire ne rejouent pas l'écran : elles **découpent** des
fonctions nommées dans le `<script>` de `NEXUS-Inventaire-v1.html` avec un
`extraire(nom)`, puis les exécutent dans un `vm`. C'est un choix délibéré et
annoncé en tête de fichier — « jamais réécrites à la main ».

Le prix de ce choix : quand une fonction extraite se met à appeler une voisine,
la voisine doit être ajoutée à la liste. Personne ne l'a fait.

| épreuve | symbole absent du découpage | où il vit réellement |
|---|---|---|
| `test_inventaire_categorie_mixte_deux_lieux.js` | `estComptageDeuxLieuxEmploye` | `NEXUS-Inventaire-v1.html:832` |
| `test_inventaire_sprint4_ux_flash.js` | `estComptageDeuxLieuxEmploye` | idem, appelé l. 1484 et 1510 |
| `test_inventaire_production_journaliere_q1.js` | `modeTestInventaireActif` | `NEXUS-Inventaire-v1.html:488` |
| `test_inventaire_sprint4bis_ecriture_immediate.js` | `modeTestInventaireActif` | idem, appelé l. 627 et 653 |

Les quatre `ReferenceError` ne signalent donc **aucune fonction disparue** : les
deux symboles sont présents dans l'écran, à leur place, utilisés. Réparation :
compléter la liste des `extraire(...)`.

C'est aussi un avertissement sur la technique elle-même. Une épreuve qui
recopie un sous-ensemble du produit se périme dès que le produit tisse un lien
de plus. Le jour où ces quatre-là seront réparées, la vraie question sera :
faut-il continuer à découper, ou sortir ces fonctions de l'écran ?

---

## C — Le bac à sable ne contient pas tout l'écran (1 épreuve, déjà réparée)

### `test_inventaire_parcours_depot_boutique_reste.js` — RÉPARÉE par le lot 1 (PR #47)
    ReferenceError: NexusInventaireMoteur is not defined

Celle-ci ne découpe pas : elle exécute le script inline entier dans un
`vm.createContext` (l. 225-238). L'écran dépend désormais d'un compagnon
chargé séparément — `NexusInventaireMoteur` est défini hors de lui
(`nexus-inventaire-plan-donnees.js`, `nexus-inventaire-rotation-intelligente.js`,
`NEXUS-Inventaire-Manager-v1.html`). Le bac à sable ne le fournit pas.

Réparation : charger le compagnon dans le contexte, ou l'y injecter en
doublure. Le parcours « dépôt → boutique → reste », qui est le sujet de
l'épreuve, n'est pas mis en cause par cet échec.

C'est la première branche qui a été prise : le lot 1 charge `nexus-station.js`
puis `nexus-inventaire-moteur.js` dans le contexte, et fait de `window` et du
bac à sable un seul objet, comme dans un navigateur.

---

## D — L'épreuve est périmée par une refonte du produit (2 épreuves)

Ces deux-là sont d'une autre nature. Ce ne sont pas des harnais à recoller : ce
sont des épreuves qui interrogent une API qui n'existe plus.

### `test_reception_moteur.js` (14/08/2026)
    TypeError: Mod.calculerReceptionCorrigee is not a function

L'épreuve appelle `calculerReceptionCorrigee` et `calculerEcartTerrainBl`.
**Aucun des deux noms n'existe nulle part dans le dépôt.** Le moteur expose
aujourd'hui `calculerReceptionCarburant({ attenduL, compartimentsL, mesureL,
seuilPct })`, qui traite la même matière autrement. Les assertions encore
valides du fichier — `calculerDeltaMesure`, `calculerEcartRatio` — passent.

### `test_reception_v1_dom.js` (14/08/2026)
    ReferenceError: demarrerReception is not defined

L'épreuve attend `demarrerReception` dans
`NEXUS-Carburant-Reception-v1.html`. Ce nom n'y figure pas ; il existe ailleurs,
dans `NEXUS-Inventaire-v1.html`, ce qui n'est pas le même écran. L'écran de
réception carburant a été réécrit sans que son épreuve DOM suive.

**Ces deux-là ne se suppriment pas d'un trait.** Une épreuve écrite est souvent
la seule trace écrite d'une intention : ici, « le delta de mesure est nul si un
jaugeage manque », « l'écart terrain/BL se calcule ainsi ». Avant d'effacer,
il faut vérifier que la refonte a bien emporté ces règles avec elle. Si oui,
l'épreuve se réécrit sur la nouvelle API. Si non, l'échec n'était pas un échec
de test : c'était une régression qui attendait depuis un mois qu'on la lise.

C'est la seule des quatre catégories où le produit lui-même est en question, et
c'est la raison d'être de ce document.

---

## Pourquoi ce lot ne répare pas les sept qui restent

Parce que réparer une de ces épreuves oblige à retirer son nom de la liste
`CONNUS` dans `.github/workflows/tests.yml` — sans quoi le comparateur, strict
dans les deux sens, fait échouer la CI **pour cause de réparation**.

Or ce bloc `CONNUS` est exactement celui que les lots du train de livraison en
cours modifient déjà, et le train y produit déjà son seul conflit de contenu.
Y toucher depuis ce lot-ci, c'est ajouter un troisième prétendant au même bloc
pour un gain qui n'est pas urgent : ces échecs sont tolérés depuis des
semaines, un jour de plus ne coûte rien.

La démonstration que la règle est la bonne, c'est justement le lot 1 et le
lot 2 : chacun répare une épreuve **et** retire son nom dans le même commit,
parce que chacun corrigeait par ailleurs le produit que l'épreuve couvre. Une
réparation de harnais qui n'accompagne aucune correction de produit n'a pas
cette raison d'être là, et n'a donc pas à s'insérer dans le train.

**Ordre à respecter :** les sept réparations restantes viennent **après** le
train de fusion, en un lot par catégorie : A et B d'un côté — mécaniques et
vérifiables ; D de l'autre — qui demande de statuer sur ce que la refonte du
produit a emporté.

**Reste réellement à réparer, après le train — sept :**

| # | épreuve | catégorie |
|---|---|---|
| 1 | `test_pilotage_qualite_receptions.js` | A |
| 2 | `test_inventaire_categorie_mixte_deux_lieux.js` | B |
| 3 | `test_inventaire_production_journaliere_q1.js` | B |
| 4 | `test_inventaire_sprint4_ux_flash.js` | B |
| 5 | `test_inventaire_sprint4bis_ecriture_immediate.js` | B |
| 6 | `test_reception_moteur.js` | D |
| 7 | `test_reception_v1_dom.js` | D |

Et une règle pour ce lot futur, tirée des erreurs de cette série : une épreuve
réparée doit échouer si on défait la correction du produit qu'elle prétend
couvrir. Recoller un harnais jusqu'à obtenir du vert, sans vérifier ce que ce
vert interdit, c'est ajouter une épreuve inutile de plus à celles qu'on vient
de sortir de la liste.
