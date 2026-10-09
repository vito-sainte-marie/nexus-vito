---
protocol: nexus-handoff/2
kind: request
lot_id: CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=1a60a8f production=501c0c7
  - id: commit-implementation
    classe: VERIFIED
    valeur: a6b9f98
  - id: commit-consommation
    classe: VERIFIED
    valeur: 61c24b2
  - id: tests-cibles
    classe: VERIFIED
    valeur: 14/14 nouveau + 18/18 moteur_v2238 + 45/45 handoff_v2
  - id: regression
    classe: VERIFIED
    valeur: 193/202 run-tests.js, 9 echecs pre-existants sans rapport avec ce lot
---
# Demande — Retour d'implémentation, correction calendrier/CTA Commande Carburant

## Contexte

Réponse à `decision-2.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`,
`commit_decision: 8211734`, consommée le 2026-09-06). Autorisation
d'exécution reçue explicitement de Frédéric via commentaire GitHub PR #30
(gate humaine, canal relais NEXUS Orchestrator).

## Ce qui a été implémenté (commit `a6b9f98`, branche `config-par-environnement`)

### `nexus-carburant-commande-moteur.js`

- `estJourCommandePossible(dateISO, config, joursFeriesISO)` (nouveau) :
  distingue explicitement un jour de **commande** d'un jour de
  **livraison**. Retourne `null` quand `config.jours_commande_iso` est
  absent — signal explicite de compatibilité ascendante.
- `prochainJourCommandePossibleApres(dateDepartISO, config, joursFeriesISO)`
  (nouveau) : même garde-fou de recherche (21 jours) que
  `prochainJourLivraisonPossible`.
- `calculerFenetreLivraison` réécrite : quand `jours_commande_iso` est
  configuré, un jour non commandable (samedi/dimanche/férié) OU un cutoff
  dépassé font basculer vers le **prochain jour de commande réellement
  ouvrable** (jamais le jour même, jamais un simple jour calendaire +1),
  puis la livraison se calcule à partir de ce jour effectif. Absent ->
  formule historique strictement inchangée (vérifié explicitement par
  test, y compris pour un samedi).
- `completerVersCamionPlein` : nouveau motif structuré
  `motifsNonCompletion` (`capacite_insuffisante` / `plafond_anti_surstock`)
  exposé quand le camion reste sous `maximumCamionL`, propagé par
  `optimiserCommandeMultiCarburant`.
- `determinerCtaCommande(evaluationGlobale)` (nouveau, exporté) : CTA
  structuré — `preparer` uniquement si une commande a pu être établie ET
  que `commandableMaintenant !== false` ET qu'aucun `motifsNonCompletion`
  ne subsiste ; sinon `simuler`.
- `construireEvaluationGlobale` expose désormais `commandableMaintenant`,
  `motifNonCommandable` et `cta` sur l'objet complet.
- `calculerCandidatCommande` (notification Cockpit/Brief, partagée avec
  `NEXUS-Cockpit-v2.html`/`nexus-conseiller.js`) : ne dit plus jamais
  « Préparez la commande » quand `evaluation.cta.action === 'simuler'` —
  reformule en « Simulez la commande… à confirmer avant préparation ».
  Rétrocompatible : un appelant qui ne fournit pas `cta` conserve le
  libellé d'origine (vérifié par test contre
  `test_carburant_commande_notification_v2239.js`, inchangé et vert).

### `NEXUS-Carburants-Pilotage-v1.html`

- Le bouton d'action de la carte "Prochaine commande" traduit
  `ctx.cta.action` (jamais un second calcul métier) : `🚚 Préparer ma
  commande →` si `preparer`, `🧪 Simuler ma commande →` si `simuler` — un
  seul bouton rendu, jamais les deux à la fois.
- Le CTA "Simuler ma commande" ouvre le simulateur déjà existant
  (`ouvrirSimulateurCommande()`, réutilise `#simulateurCommandePanel` /
  `SIMULATEUR_COMMANDE_OUVERT`, aucun second mécanisme).
- Note de transparence ajoutée sous le total : quand
  `ctx.optimisation.motifsNonCompletion` contient une entrée, affiche
  "Camion non complété au maximum — <carburant> : capacité disponible
  insuffisante / plafond anti-surstock atteint." (audit E2).

### `nexus-carburant-commande-donnees-core.js`

Aucune modification nécessaire : `construireEvaluationGlobale` retourne
déjà l'objet complet (incluant `cta`, `commandableMaintenant`,
`motifNonCommandable`) et `chargerEvaluationCommandeCarburant` le relaie
tel quel via `...global_` (spread déjà existant, ligne ~881). La
correction timezone déjà en place sur cette branche n'est pas touchée.

## Tests

- **Nouveau** : `test_carburant_commande_correction_decision2_20260906.js`
  — 14/14 vérifications passées. Couvre : mercredi 10:59/11:00/11:01,
  vendredi avant cutoff (avec/sans lundi férié), samedi non commandable
  (avec/sans lundi férié) — le cas exact du bug terrain Sainte-Marie —,
  jour férié en semaine, absence d'heure de livraison fixe, motif
  structuré de non-complétion (capacité vs anti-surstock), CTA
  préparer/simuler dans les 4 configurations de la matrice (36k
  atteignable, créneau non commandable, arbitrage quantité résiduel),
  compatibilité ascendante stricte (`jours_commande_iso` absent),
  Cockpit/Directeur ne dit jamais "Préparez" si `cta.action === 'simuler'`.
- **Suites obligatoires demandées** : `test_carburant_commande_moteur_v2238.js`
  (18/18 ✅), `test_handoff_v2_20260905.js` (45/45 ✅). Les fichiers
  `test_carburant_commande_moteur_20260824.js`,
  `test_carburant_commande_v2307.js` et `test_carburant_commande_v2308.js`
  cités dans l'ordre de mission **n'existent pas dans ce dépôt** — vérifié
  par recherche de fichiers, non inventés, non créés à leur place.
- **Régression ciblée Carburants** (`node run-tests.js carburant`) :
  38/39 verts. Le seul échec, `test_chaine_temporelle_carburant_20260821.js`
  (`TypeError: chargerControleJour : timezone obligatoire`), est
  **pré-existant et sans rapport avec ce lot** : ce fichier ne charge que
  `nexus-carburant-moteur.js`/`nexus-carburant-donnees.js`, ni l'un ni
  l'autre modifiés ici — confirmé par lecture de ses `require()`.
- **Régression complète** (`node run-tests.js`, 202 fichiers) : 193/202
  verts. Les 9 échecs concernent exclusivement Inventaire/Réception/le
  même test de fuseau horaire ci-dessus — aucun ne touche à un fichier
  modifié par ce lot.
- `node outils/handoff.js verifier` exécuté avant écriture (exit 0, déjà
  vert grâce au lot Handoff précédent), puis après implémentation (exit 0,
  inchangé) — voir preuve `suite` ci-dessous.

## Guardians

- **Architecture** : correction strictement localisée au calendrier de
  commande et au CTA (Article 11, moteur pur, un seul calcul par état,
  jamais un second calcul côté HTML/Cockpit). Aucun refactor des chaînes
  stock/jaugeage/ventes/P0/réception/Verify/fiabilité — ces fichiers ne
  sont pas dans le diff.
- **Security & Isolation** : aucun accès Supabase modifié, aucun secret,
  aucune écriture Test/Production. `jours_commande_iso` reste une clé
  JSONB optionnelle de `station_config.carburant_commande_config`, déjà
  couverte par les politiques RLS existantes de cette table — aucune
  migration nécessaire pour le code, uniquement pour activer la
  configuration sur un site donné (limite ci-dessous).
- **Business Rules** : reproduit exactement les 6 exemples canoniques de
  `decision-2.md` (vérifiés un à un par test), préserve 35 000 L comme
  plafond sûr sans jamais forcer 36 000 L, préserve capacité physique/
  anti-surstock/minimum camion/arrondi 1000 L (aucun de ces calculs n'est
  modifié, seul le motif de non-complétion est désormais exposé).
- **QA/Regression** : 193/202 tests globaux verts, 0 régression imputable
  à ce lot (les 9 échecs pré-existent et portent sur des fichiers non
  touchés). Suite dédiée 14/14.
- **Bible/Philosophie** : "NEXUS propose, le manager décide" préservé —
  le CTA structuré rend le moteur plus honnête (jamais "Préparez" quand un
  arbitrage humain reste nécessaire), sans jamais bloquer la décision
  finale du manager (le simulateur reste toujours accessible).

## Limites résiduelles (hors périmètre de ce lot)

1. **Fixture Supabase Test** : `carburant_commande_config.jours_commande_iso`
   n'est configuré pour aucun site en Test à ce jour (vérifié : le champ
   est un ajout de code, pas de donnée). Tant qu'aucun site ne le
   configure, le comportement reste **strictement historique** partout
   (compatibilité ascendante prouvée par test) — la correction du bug
   terrain Sainte-Marie ne devient visible à l'écran qu'une fois ce champ
   renseigné pour `nexus-station-test`. Écrire cette fixture dépasse ce
   lot (aucun accès live à la base Test depuis cette session, et
   `decision-2.md` ne demande la correction que du moteur/CTA, pas la
   configuration de données).
2. Le bouton toggle indépendant "🧪 Simuler une commande" (panneau
   manuel, hors carte de recommandation) n'a pas été retouché — il reste
   une entrée manuelle légitime, distincte du CTA de la carte (aucun
   doublon : la carte ne rend jamais les deux boutons à la fois).
3. `nexus-carburant-commande-donnees-core.js` n'a nécessité aucune
   modification (relais automatique par spread) — signalé explicitement
   car `decision-2.md`/l'ordre de mission l'autorisaient "si nécessaire".

## Rail respecté

`config-par-environnement` uniquement. Aucun changement `main`/`production`,
aucun Supabase Production, aucune promotion Production, aucun secret.
Aucune écriture Supabase Test effectuée.

## Verdict proposé

**CORRECTION CARBURANTS IMPLÉMENTÉE EN TEST — EN ATTENTE DE VALIDATION
CANONIQUE.** Code et tests verts sur `config-par-environnement`
(commit `a6b9f98`), `decision-2.md` consommée (commit `61c24b2`). Une
décision canonique confirmant la clôture du lot (et, séparément, la
fixture Test nécessaire pour rendre la correction visible sur
`nexus-station-test`) reste à rendre avant toute mention de
disponibilité Production.
