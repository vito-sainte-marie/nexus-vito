# Spécification — futur « Point Zéro Inventaire FDJ » (non exécuté)

Document de spécification uniquement, demandé par la mission du lot
`FDJ-CARNETS-LEDGER-AUDIT-1-20261004` (point 5). Aucune migration, aucun
code, aucune donnée créée par ce document. À exécuter **après Production**,
sur arbitrage distinct.

## 1. Ce qui existe déjà — le point zéro ACTUEL

NEXUS a déjà un point zéro FDJ, vivant depuis le 09/08/2026 :
`fdj_stock_references` + `fdj_stock_reference_lignes`, écrit par
`validerInventaireRef` (`NEXUS-FDJ-Manager-v1.html`). Un contrôle physique du
manager (réserve bureau + carnets non activés en caisse, **par jeu**, jamais
par carnet individuel) devient la nouvelle base de calcul : les mouvements
antérieurs restent dans l'historique (`fdj_stock_movements`, append-only,
jamais réécrit) mais n'entrent plus dans le calcul du stock théorique courant
(`soldesCarnetsAvecReference`, corrigé dans ce lot). Il porte déjà
`created_at` (quand), `controle_par` (qui), et le site est implicite au
contexte de l'écran manager.

**Ce que ce point zéro ne fait pas** : il ne distingue aucun carnet
individuel (numéro de série), aucun état fin par carnet (non activé / activé
non commencé / ouvert en cours / bloqué — le cahier UX en distingue 4,
`NEXUS-FDJ-Manager-v1.html:3458-3473` l'assume explicitement comme limite),
et aucun emplacement physique plus précis que bureau/caisse/bloqué. La table
`fdj_booklets` (carnet nominatif, numéro de série, scanner) existe dans le
schéma depuis sa création mais n'est alimentée par **aucun** écran — confirmé
par l'audit de ce lot (0 ligne, 0 référence dans le code).

## 2. Ce que la mission demande pour le futur

Un « Point Zéro Inventaire FDJ » complet, qui ajouterait à l'inventaire de
référence actuel :

- **carnets** : identité individuelle (numéro de série), pas seulement une
  quantité agrégée par jeu ;
- **états** : les 4 états du cahier UX (non activé / activé non commencé /
  ouvert en cours / bloqué), par carnet ;
- **emplacements** : bureau / caisse / bloqué, par carnet — déjà le niveau
  de granularité des emplacements FDJ existants (`fdj_locations`), mais
  rattaché à chaque carnet plutôt qu'à un total ;
- **date/heure/site/auteur** : déjà acquis par le modèle actuel
  (`created_at`, `controle_par`, contexte de site) ; à reporter à l'identique
  sur le nouveau modèle, rien de neuf à concevoir ici ;
- **historique intégral conservé** : déjà garanti par construction — aucune
  policy `update`/`delete` sur `fdj_stock_movements`/`fdj_stock_references`
  depuis leur création (vérifié par lecture de toutes les migrations qui les
  touchent). Le même principe s'appliquerait au nouveau point zéro : un
  recomptage crée une NOUVELLE ligne de référence, jamais une correction de
  l'ancienne.

## 3. Pourquoi ceci reste une spécification, pas un lot de code

Ce changement n'est pas un changement de calcul (comme la correction
`soldesCarnetsAvecReference` de ce lot) : il exige un **geste physique
différent sur le terrain** — scanner ou saisir le numéro de série de chaque
carnet, au lieu de compter une quantité par jeu. C'est exactement le type de
changement qui doit être validé par un cycle réel avant généralisation, même
doctrine que l'arbitrage C4 du lot `FDJ-VAGUE1-REPRISE-20261003`
(« attendre un cycle réel [...] en Production » plutôt que fabriquer une
preuve synthétique). Le construire maintenant, sans ce cycle, risquerait de
figer une mécanique jamais éprouvée contre l'usage réel d'un bureau FDJ.

## 4. Esquisse de modèle, pour une future décision (non engageante)

Si et quand ce lot est arbitré :

- **Table** : `fdj_booklets` existe déjà ; il resterait à lui ajouter ce qui
  manque pour porter un point zéro (`dernier_controle_id`, `etat`,
  `emplacement_id`), sans dupliquer `fdj_stock_references`/`lignes` — plutôt
  les relier, un carnet appartenant à une ligne de référence par contrôle.
- **Déclenchement** : un nouvel écran manager, cousin de « Inventaire de
  référence FDJ » actuel, qui demande un numéro de série par carnet scanné
  plutôt qu'une quantité globale.
- **Transition** : aucune migration ne doit réinterpréter rétroactivement un
  point zéro agrégé existant en points zéro par carnet — l'historique agrégé
  reste ce qu'il a toujours été, le nouveau modèle ne s'applique qu'à partir
  de son premier contrôle réel.
- **Invariant à transporter** : comme aujourd'hui, un point zéro ne
  réécrit jamais le précédent — il s'y ajoute, append-only, avec son propre
  horodatage et son propre auteur.

## 5. Ce que ce document n'autorise pas

Aucune migration, aucune table modifiée, aucune donnée créée. Ce document
décrit une cible possible, pas une décision prise : la décision d'engager ce
chantier, son calendrier et son périmètre exact restent à trancher par
Frédéric, après Production, sur la base d'un besoin réellement observé —
pas en anticipation.
