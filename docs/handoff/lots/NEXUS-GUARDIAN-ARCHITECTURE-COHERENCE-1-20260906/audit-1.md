protocol: nexus-handoff/2
lot_id: NEXUS-GUARDIAN-ARCHITECTURE-COHERENCE-1-20260906
type: audit-1
environment: TEST_ONLY
branch: config-par-environnement
in_reply_to: request-1.md
executed_by: Claude (canal GitHub Issue #28)

# Audit structurel — Guardian Architecture & Cohérence

## Méthode

Audit **statique et documentaire uniquement** (lecture de code + doctrine), sans exécution
(`node`/tests/Supabase indisponibles depuis ce canal — voir « Obstacle » en fin de fichier).
Sources canoniques lues avant analyse, conformément à `docs/nexus/CONTINUITY.md` :
`docs/handoff/STATE.json`, `request-1.md` de ce lot, `docs/nexus/BIBLE.md` (section Guardian
déjà présente — commit `a9431d5c5...` cité dans le réveil), `docs/nexus/CONTINUITY.md`,
`docs/nexus/BACKLOG.md`, `docs/adr/0001-portee-site-des-mutations.md`,
`docs/gouvernance/DOCTRINE-PROPRIETE-CREATEUR-DONNEES-CLIENTS.md`,
`docs/gouvernance/FRONTIERE-CONNECTOR-SERVICE-ROLE.md`.

Aucune décision canonique existante n'est remise en cause par cet audit. Aucun fichier de
code n'a été modifié.

## 1. Cartographie des moteurs (propriétaire de vérité → export)

| Moteur | Vérité métier possédée | Export |
|---|---|---|
| `nexus-boussole-moteur.js` | Statuts/scores par axe (Commerce/Valeur/Équipe/Opérations/Risques) | `NexusBoussoleMoteur` |
| `nexus-carburant-moteur.js` | Stock théorique/écart/statut par cuve | `NexusCarburantMoteur` |
| `nexus-carburant-commande-moteur.js` | Recommandation de commande carburant | `NexusCarburantCommandeMoteur` |
| `nexus-reception-moteur.js` | Écarts BL/compartiments/jaugeage à réception | `NexusReceptionMoteur` |
| `nexus-fdj-moteur.js` | Rapprochement caisse FDJ | `NexusFdjMoteur` |
| `nexus-coach-fdj-moteur.js` | Détection règle → geste employé (Coach FDJ) | `NexusCoachFdj` |
| `nexus-inventaire-moteur.js` | Plan tournant, consolidation lieu→produit | `NexusInventaireMoteur` |
| `nexus-inventaire-snapshot-moteur.js` | Fiabilité d'une photo Decenium | `NexusInventaireSnapshotMoteur` |
| `nexus-paye-moteur.js` | Règles de composition paie | `NexusPayeMoteur` |
| `nexus-planning-sheets-moteur.js` | Lecture/normalisation planning Google Sheets | `NexusPlanningSheets` |
| `nexus-pdf-moteur.js` | Primitives PDF génériques (aucune vérité métier) | `NexusPdfMoteur` |
| `nexus-rapport-direction-moteur.js` | Composition des 18 sections du rapport (ne recalcule pas) | `NexusRapportDirectionMoteur` |
| `nexus-rapport-moteur.js` | Chapitres 1-2 du rapport | `NexusRapportMoteur` |
| `nexus-rayon-moteur.js` | CA/marge/évolution par catégorie | `NexusRayonMoteur` |
| `nexus-ecarts-moteur.js` | Cycle de vie d'un écart caisse | `NexusEcartsMoteur` |
| `nexus-verify-moteur.js` | Classification de gravité d'écart caisse | `NexusVerifyMoteur` |
| `nexus-risques-moteur.js` | Qualification risque | `NexusRisques` |
| `nexus-secteurs-moteur.js` | Contrat commun secteur (assemble, ne recalcule pas) | `NexusSecteursMoteur` |
| `nexus-conseiller.js` | Candidats produits + fusion multi-moteurs | `NexusConseiller` |
| `nexus-moteurs-registre.js` | Registre moteurs possibles/actifs/contributeurs (ne recalcule pas) | `NexusMoteursRegistre` |
| `nexus-periodes.js` | Comparaison de périodes | `NexusPeriodes` |
| `nexus-import-moteur.js` | Pipeline import (mapping, anti-doublon) | `NexusImportMoteur` |
| `nexus-stock.js` | Analyse stock par référence/rayon (vivant, 3 consommateurs) | `NexusStock` |
| `nexus-stock-moteur.js` | Lecture RPC stock (**jamais inclus par une page — voir §3a**) | `NexusStock` (même identité, code distinct) |

Le principe Bible ( « chaque moteur produit sa vérité métier ; le CIN la reçoit sans la
recalculer ») est globalement respecté : `nexus-secteurs-moteur.js` et
`nexus-moteurs-registre.js` assemblent explicitement sans recalculer, et `nexus-conseiller.js`
est déjà la source unique partagée par Cockpit, Produits et le CIN depuis une régression
corrigée le 08/08/2026 (`NEXUS-Data-Dictionary-v2.md:14`, cas exactement du type que ce
Guardian doit surveiller — précédent qui montre que le risque est réel, pas hypothétique).

## 2. Consommateurs — inclusions `<script src="nexus-...">`

- Le **CIN** (`NEXUS-Centre-Intelligence-v1.html`) n'inclut que `nexus-periodes.js` et
  `nexus-conseiller.js` — conforme au rôle d'agrégateur qui ne recrée pas de moteur.
- `NEXUS-Cockpit-v2.html` n'inclut ni `nexus-secteurs-moteur.js` ni
  `nexus-moteurs-registre.js`, alors que `NEXUS-Brief-v1.html` et `NEXUS-Rapport-v1.html` les
  utilisent tous les deux pour la même famille de logique (statuts sectoriels/registre de
  moteurs). Pas nécessairement une anomalie — Cockpit est antérieur et peut avoir un périmètre
  volontairement plus restreint — mais c'est une asymétrie non documentée entre deux écrans qui
  manipulent des candidats/statuts comparables.
- `nexus-stock-moteur.js` **n'est inclus par aucune page HTML** (recherche exhaustive sur
  `*.html`).

## 3. Findings

### 3a. [PRIORITAIRE — ambiguïté de propriété] Deux fichiers revendiquent l'identité globale `NexusStock`

- `nexus-stock.js` (vivant, inclus par `NEXUS-Brief-v1.html:315`, `NEXUS-Cockpit-v2.html:350`,
  `NEXUS-Scanner-Stock-v1.html:24`) définit `global.NexusStock` avec
  `calculerAnalyseStock/calculerSensibilite/calculerRisqueParRayon` calculés localement à
  partir de tableaux déjà chargés par l'appelant (aucun accès réseau).
- `nexus-stock-moteur.js` (non inclus par aucune page — code mort aujourd'hui) définit **le
  même** `window.NexusStock` avec une implémentation différente : lecture centrale via RPC
  Supabase (`nexus_stock_lire_etat`) + cache mémoire, et sa propre
  `calculerRisqueParRayon(analyse)` (ligne 112) qui **initialise `risqueEur:0` mais ne
  l'incrémente jamais** — un bug latent, actuellement sans effet car le fichier n'est chargé
  nulle part.
- Risque : si une page venait à inclure `nexus-stock-moteur.js` après `nexus-stock.js` (ou
  l'inverse), le dernier `<script>` chargé écraserait silencieusement `window.NexusStock` de
  l'autre — deux vérités concurrentes sous un seul nom, l'une avec un bug non détectable sans
  test comportemental (exactement le risque que l'ADR-0001 documente pour les policies : « on
  découvre le motif par hasard »).
- Ce n'est pas une réouverture d'une décision existante : rien dans le Handoff ne tranche
  lequel des deux fichiers est le remplaçant de l'autre. `nexus-stock.js` date du 28/07/2026 et
  se présente comme consolidant un calcul jusque-là dupliqué dans Scanner Stock ; l'origine et
  le statut voulu de `nexus-stock-moteur.js` (brouillon abandonné ? chantier RPC en cours non
  terminé ?) ne sont pas documentés dans le dépôt à ma connaissance.
- **Décision bornée nécessaire** : confirmer si `nexus-stock-moteur.js` est (a) du code mort à
  supprimer, ou (b) un chantier RPC en cours — auquel cas il doit être renommé pour ne plus
  entrer en collision avec `nexus-stock.js` tant qu'il n'est pas prêt à le remplacer.

### 3b. [BUG CONCRET — duplication divergente] `NEXUS-Mon-Evolution-v1.html` réimplémente localement la classification d'écart, avec un palier manquant

- `NEXUS-Mon-Evolution-v1.html:113-117` définit sa propre fonction locale `classifierEcart`
  (seuils 2€ et 20€, retourne une couleur CSS) sans inclure `nexus-verify-moteur.js` (la page
  ne charge aucun moteur).
- La classification canonique (`nexus-verify-moteur.js:16-21`, seule source de vérité déjà
  partagée par `NEXUS-Verify-v1.html` et le Rapport de Direction) a **quatre** paliers :
  conforme ≤2€, **surveiller ≤5€**, anomalie ≤20€, critique >20€.
- Conséquence observable : un écart de 3€ à 5€ s'affiche en vert (« conforme ») dans
  Mon Évolution, alors qu'il serait classé « à surveiller » partout ailleurs dans NEXUS. C'est
  exactement le type de divergence que le cas CIN/Conseiller du 08/08/2026 a déjà illustré,
  reproduit ici sur un autre écran et un autre moteur.
- Correctif minimal évident, sans arbitrage nécessaire : faire inclure
  `nexus-verify-moteur.js` par `NEXUS-Mon-Evolution-v1.html` et dériver la couleur de
  `NexusVerifyMoteur.classifierEcart()` (qui retourne un statut, pas une couleur — un petit
  mappage statut→couleur reste nécessaire côté écran, ce qui est légitime : la couleur est un
  choix d'affichage, pas une vérité métier).

### 3c. [Lacune de gouvernance, pas une duplication] Pattern-learning du CIN sans moteur nommé

`NEXUS-Centre-Intelligence-v1.html:421-457` (`patternRecurrenceRayon`,
`patternRegularite`, `patternReconnaissance`) contient des seuils métier codés en dur
(`n>=2`, `n>=5`, ratio `>=0.6`) qui ne dupliquent aucune vérité déjà possédée par un moteur
existant — c'est une logique propre au CIN. Le commentaire du fichier reconnaît lui-même un
seuil informellement partagé avec « Mon Évolution » (5 missions minimum) sans qu'il soit
extrait dans un moteur commun. Pas un bug aujourd'hui, mais une vérité métier sans
propriétaire logique nommé, testable isolément — contraire à la Bible («&nbsp;une règle
métier doit avoir un propriétaire logique unique&nbsp;») si cette logique venait à être
réutilisée ailleurs.

### 3d. [Lacune documentaire] Trois moteurs absents de `NEXUS-Data-Dictionary-v2.md`

`nexus-paye-moteur.js`, `nexus-planning-sheets-moteur.js` et `nexus-stock-moteur.js`
n'apparaissent dans aucune ligne du Data Dictionary (recherche exhaustive du nom de fichier).
Pour `nexus-paye-moteur.js`, un chantier NEXUS Paye existant est bien mentionné mais comme
« hors scope » — le fichier a pourtant déjà 731 lignes et un export actif. Conforme à
`docs/nexus/CONTINUITY.md` (« un agent doit d'abord rechercher la décision canonique existante
»)&nbsp;: sans entrée dans le Data Dictionary, un futur agent ne peut pas savoir que ce moteur
existe déjà avant d'en écrire un autre.

## 4. Ce qui est déjà sain (pour ne pas biaiser vers le seul négatif)

- `nexus-conseiller.js` : source unique déjà partagée Cockpit/Produits/CIN, régression connue
  déjà corrigée — le mécanisme de vigilance a déjà fonctionné une fois.
- `nexus-secteurs-moteur.js` et `nexus-moteurs-registre.js` : les deux fichiers documentent
  explicitement dans leur en-tête qu'ils n'ont pas le droit de recalculer une vérité, et leur
  code respecte cette contrainte à la lecture.
- `NEXUS-FDJ-v1.html:755-756` délègue correctement à `NexusFdjMoteur.caisseAttendue/
  ecartCaisse` plutôt que de dupliquer le calcul.
- Le CIN lui-même (hors §3c) n'inclut que des moteurs partagés, pas de copie parallèle.

## 5. Plan d'intégration du Guardian au pipeline de revue

Aucune gate humaine n'est requise pour activer une première version du Guardian : il s'agit
d'ajouter un point de vigilance documentaire et une checklist de revue, pas un changement
d'architecture ni un accès à des systèmes sensibles.

1. **Checklist de revue** (nouveau fichier `docs/gouvernance/GUARDIAN-ARCHITECTURE-COHERENCE-CHECKLIST.md`,
   à créer dans un lot correctif dédié) reprenant les 10 points de `request-1.md` du présent
   lot — à consulter par ChatGPT/Frédéric avant d'arbitrer toute décision qui introduit un
   nouveau moteur, déplace une vérité métier, ou fait grossir le CIN/Brief/Cockpit avec du
   calcul inline.
2. **Garde statique légère**, sur le modèle déjà existant d'`outils/garde-portee-site.js`
   (garde de sécurité déjà éprouvée par mutation) : un script qui (a) liste tous les
   `global.NexusXxx =` déclarés dans les fichiers `nexus-*.js` et signale toute identité
   déclarée plus d'une fois (aurait détecté §3a immédiatement), et (b) signale tout fichier
   `nexus-*-moteur.js` inclus par zéro page HTML (aurait détecté `nexus-stock-moteur.js`).
   Cette garde reste **informative (`WARN`), jamais bloquante**, tant qu'elle n'a pas été
   éprouvée par mutation comme les gardes de sécurité existantes — cohérent avec l'invariant
   « aucune activation bloquante avant preuves ».
3. **Rattachement au cycle Handoff** : la checklist et la garde statique s'exécutent à la
   revue d'une décision (ChatGPT), pas en CI bloquante — le Guardian conseille l'arbitre, il
   ne remplace pas la gate humaine finale de Frédéric sur les décisions structurantes.
4. Ces deux artefacts (checklist + garde) constituent un lot correctif distinct et borné, pas
   une refonte : ils n'ont pas été créés dans ce lot d'audit pour respecter strictement le
   périmètre « cartographier, ne pas corriger » demandé par `request-1.md`.

## 6. Demande de décision bornée

Un seul point nécessite un arbitrage humain, le reste (§3b, §3d) peut être corrigé dans un lot
correctif minimal sans nouvelle gate :

> **Question posée à Frédéric/ChatGPT** : `nexus-stock-moteur.js` doit-il être (a) supprimé
> comme code mort, ou (b) conservé et renommé pour lever la collision d'identité
> `NexusStock` avec `nexus-stock.js`, en tant que chantier RPC distinct non encore activé ?

## Obstacle rencontré (inchangé depuis les lots précédents de ce fil)

Ce checkout reste raciné sur `main` (`c434201`) malgré `ref: config-par-environnement` déclaré
dans le workflow ; `docs/handoff/`, `docs/gouvernance/`, `docs/nexus/` et `docs/adr/` sont
absents de ce répertoire de travail et ont été lus en lecture seule via
`git show origin/config-par-environnement:<path>`. Aucune exécution `node`/tests, aucun accès
Supabase depuis ce canal — sans incidence ici puisque cet audit est purement statique et
documentaire, mais cela signifie que je n'ai pas pu déposer `audit-1.md` directement sur
`config-par-environnement` ni mettre à jour `docs/handoff/STATE.json` via `outils/handoff.js`.
Ce fichier est donc committé sur `claude/issue-28-20260906-1412` ; voir les commandes de
rapatriement dans le commentaire de l'issue.

## Invariants respectés

TEST ONLY (aucune opération, aucune modification de code) ; aucun changement `main`/
`production` ; aucune opération Supabase ; aucune réouverture de décision canonique (les deux
findings actionnables sont de nouveaux constats, pas des préférences architecturales) ; fail
closed sur le point nécessitant réellement un arbitrage (§6) plutôt que de trancher seul.
