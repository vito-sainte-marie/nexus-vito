---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PAYE-COCKPIT-PRODUCTION-1-20261009
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=b42e773
  - id: candidat
    classe: VERIFIED
    valeur: 3dde242 sur claude/paye-cockpit-production-20261009, base b42e773 egale origin/production
  - id: perimetre
    classe: VERIFIED
    valeur: 4 fichiers tous Paye, 923 insertions 62 suppressions, Verify/FDJ et moteurs inchanges
  - id: suite
    classe: VERIFIED
    valeur: 255/262 - les sept echecs connus toleres par la CI de production, aucun nouveau, aucun repare
  - id: paye
    classe: VERIFIED
    valeur: 14/14 epreuves Paye, dont cockpit 107/107 et ecran rendu 27/27
  - id: build-simulations
    classe: VERIFIED
    valeur: build 1000 references coherentes, simulations toutes passantes dont 15/15 Paye
  - id: deploiement
    classe: VERIFIED
    valeur: les trois epreuves .github/deploiement 32/32, 40/40, 20/20
  - id: ci-pr-86
    classe: VERIFIED
    valeur: PR 86 vers production - non-regression et artefact verts, Pages et Supabase en skipping hors production
  - id: metier-avant-apres
    classe: VERIFIED
    valeur: 0 valeur perdue, 3 gagnees, 5/5 statuts preserves sur la meme recette
  - id: ergonomie
    classe: VERIFIED
    valeur: 1440x900 de 3971 px a 900 px, 390x844 moins 24,6 pourcent, 0 commande sous 44 px sur 37
  - id: mutations
    classe: VERIFIED
    valeur: 4 regles retirees une a une, morsure verifiee par comptage, epreuve en echec a chaque fois
  - id: safari-ios
    classe: DECLARED
    valeur: verifie statiquement seulement - aucun appareil iOS n a servi la page
  - id: lang-003
    classe: NOT_APPLICABLE
    valeur: la garde n existe pas sur production, plafond non mesure et non releve
  - id: gate-production
    classe: HUMAN
    valeur: fusion de la PR 86 non franchie - autorisation de Frederic du 09/10/2026 transmise pour le seul perimetre Paye
---
# NEXUS Paye — cockpit mensuel, candidat Production prêt, acte final en attente de gate

Frédéric a donné le 09/10/2026 un **GO métier explicite** pour la refonte
UX/UI de NEXUS Paye **et** une **autorisation exceptionnelle de préparer la
promotion Production de ce périmètre précis**, sous réserve que l'intégralité
des preuves techniques, fonctionnelles et de sécurité soit établie et
documentée. Il a demandé, si le protocole exige une autorisation humaine
distincte pour l'acte final, que cette autorisation soit **transmise au
Handoff sans être étendue à d'autres chantiers**. C'est l'objet de cette
demande.

Le mandat est cité tel qu'il a été reçu, parce que ses limites comptent autant
que son ouverture :

> « Ne considère pas ce GO comme une autorisation de modifier librement
> Supabase Production, les permissions, les secrets, les politiques RLS ou
> d'autres modules. » · « Aucune migration Production n'est autorisée
> implicitement par cette demande. » · « Mon autorisation exceptionnelle ne
> doit jamais être interprétée comme une dispense de CI, de contrôle de
> sécurité ou de protection des données. »

## Le candidat

| | |
|---|---|
| branche | `claude/paye-cockpit-production-20261009` |
| commit candidat | `3dde242` (parent `e161a8a`) |
| base | `b42e773` = `origin/production` au moment du départ |
| PR | #86 → `production`, **ouverte, non fusionnée** |
| périmètre | 4 fichiers, tous Paye : 923 insertions, 62 suppressions |

La branche est raciné sur `origin/production`, pas sur le rail : un candidat
Production se mesure contre ce qui est servi, pas contre ce qui est en cours.
L'état antérieur de toutes les mesures « avant » ci-dessous est donc la page
réellement en ligne.

Les quatre fichiers : `NEXUS-Paye-v1.html`,
`test_nexus_paye_cockpit_20261009.js` (nouveau),
`test_nexus_paye_ecran_rendu.js`, `test_paye_configurer_hors_paie_20261003.js`.
**Aucun fichier Verify/FDJ, aucun moteur, aucune couche de données, aucune
migration, aucune politique.** `nexus-paye-moteur.js` et
`nexus-paye-donnees.js` sont inchangés à l'octet.

## Ce qui a changé, et ce qui n'a pas bougé

Quarante éléments empilés en grandes cartes verticales deviennent un cockpit :
bandeau compact (mois, statut du dossier, actions), cinq indicateurs
synthétiques **cliquables** sur une ligne, un tableau central compact
`Salarié · Affectation · Heures · Absences · Éléments à vérifier · Statut`
avec recherche instantanée, tris et filtres, et un panneau latéral qui ouvre
une fiche **sans changer de page**. Les salariés hors paie restent atteignables
par filtre sans encombrer la lecture.

Sur les écarts de caisse, la refonte **ne touche à aucun moteur** : elle dérive
les versements en présentation, par différence `ecart_final − ecart_initial`,
et affiche séparément l'écart initial, les versements et le solde restant
(−50 € puis +30 € encaissés donnent un solde de −20 €, l'écart initial restant
−50 €). Un versement d'une période ultérieure ne retouche aucune statistique
historique. **Aucun écart de caisse ne génère de retenue sur salaire** : la
séparation entre éléments de rémunération et informations de contrôle est
portée jusque dans l'export comptable.

## Preuves

**Valeurs métier, même recette, avant/après** : **0 valeur perdue, 3 gagnées**
(la décomposition de l'écart) ; **5/5 statuts préservés** — Camille
`a_verifier`, Vanessa Ribe `pret`, Angélique `donnee_manquante`, Mathieu
`hors_paie`, Sofiane `a_verifier`, chacun affiché avant et après.

**Ergonomie, mesurée dans Chrome à viewport imposé** :

| mesure | avant | après |
|---|---|---|
| hauteur de page à 1440 × 900 | 3971 px (4,41 écrans) | 900 px (1 écran) |
| hauteur de page à 390 × 844 | 4794 px | 3613 px (−24,6 %) |
| blocs empilés | 31 | 20 |
| conteneurs à défilement propre | 0 | 3 |
| indicateurs cliquables | 0 | 5 |
| commandes sous 44 px de cible | 19 sur 37 | 0 sur 37 |

**Épreuves** : suite complète **255/262**, les sept échecs étant exactement
ceux que la CI de `production` tolère déjà par nom (inventaire ×4, pilotage
qualité réceptions, réception moteur, réception v1 DOM) — aucun nouveau,
aucun réparé. 14/14 épreuves Paye au vert, dont la nouvelle
`test_nexus_paye_cockpit_20261009.js` **107/107**, `écran rendu` 27/27,
`hors paie` 6/6, `dossier comptable` 35/35. `bash outils/build.sh` → 1000
références épinglées, toutes cohérentes. `npm run simulations` → tous les
scénarios passent, 15/15 simulations Paye. Les trois épreuves de déploiement
de `.github/deploiement/` → 32/32, 40/40, 20/20.

**Mutations** : les quatre règles CSS nouvelles qui tiennent la cible tactile
et le défilement ont été retirées une à une, la morsure de la mutation
vérifiée par comptage avant lecture du résultat, et l'épreuve a échoué en
nommant la règle retirée à chaque fois. Un `sed` muet rend un faux « survit » ;
ici il a mordu.

**CI GitHub sur la PR #86** : non-régression vert (×2), « Construire et
éprouver l'artefact » vert, Cloudflare Pages vert. « Déployer sur GitHub
Pages » et « Supabase Preview » en *skipping*, comme attendu hors
`production`.

## Points ouverts, dits comme tels

1. **Safari iOS n'est vérifié que statiquement.** Aucun appareil iOS n'a servi
   la page. Le balayage ne trouve aucune construction récente (`:has()`,
   `backdrop-filter`, `toSorted`, `.at(`, `structuredClone`,
   `Object.groupBy`) ; les deux bornes `calc(100vh − 322px)` sont redites en
   `100dvh` après, et `inset` était déjà en production. C'est une absence de
   risque connu, pas une validation sur appareil.
2. **La garde LANG-003 n'existe pas sur `production`.** `outils/garde-langage-nexus.js`
   vit sur le rail ; elle ne peut pas être exécutée contre ce candidat
   (`MODULE_NOT_FOUND`). Le plafond de 18 tirets cadratins pour
   `NEXUS-Paye-v1.html` n'est donc pas mesuré ici — il le sera au retour du
   candidat sur le rail, et le plafond n'a pas été relevé.

## Ce qui est demandé

L'arbitrage porte sur la **recevabilité technique du candidat**, pas sur
l'ergonomie : les choix ergonomiques sont couverts par le mandat.

La fusion de la PR #86 dans `production` reste une **gate humaine**. Elle n'est
pas franchie, et aucune décision de recette n'y équivaut. L'autorisation
exceptionnelle de Frédéric du 09/10/2026 est transmise ici **pour ce seul
périmètre NEXUS Paye**, et ne s'étend à aucun autre chantier. Aucune promotion
n'est déclarée : il n'y aura de mise en Production réussie qu'avec la preuve du
déploiement et du bon fonctionnement de l'application servie, mesurée après
coup.
