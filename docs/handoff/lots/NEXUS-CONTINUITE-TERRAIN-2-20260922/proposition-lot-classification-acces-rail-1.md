# Proposition — lot racine distinct : classification d'accès/navigation absente du rail

Document de préparation, pas une ouverture de lot (le registre refuse `handoff.js demande` sur un
`lot_id` distinct tant que `NEXUS-CONTINUITE-TERRAIN-2-20260922` reste en statut actif —
`outils/handoff.js:481`). Ce texte existe pour qu'une future session n'ait pas à refaire
l'archéologie Git déjà faite dans `request-16.md` §3 avant de pouvoir agir.

## Constat

Production porte une classification d'accès (« consultation / opérationnel / publique / séquence »)
absente du rail `handoff-continuite-20260920` — absente **avant même** le portage `290a217` de
`#65`, donc indépendante de ce candidat. Développée sur la branche `acces-hors-service-20260916`
(16-18/09/2026), jamais rebâtie sur le rail. Nommée « réelle mais distincte » par `decision-9.md`
§2 et `request-11.md` §4/§6 de `NEXUS-CONTINUITE-TERRAIN-2-20260922`, explicitement exclue de la
restauration minimale de `#65` pour ne pas élargir le périmètre UX sans preuve démontrée.

## Composants identifiés dans `nexus-auth.js` (Production)

- `NEXUS_PAGES_CONSULTATION`, `NEXUS_PAGES_OPERATIONNELLES`, `NEXUS_PAGES_PUBLIQUES` — trois listes
  d'écrans par catégorie d'accès.
- `nexusCategorieAcces(page)` — résout la catégorie d'un écran donné.
- `nexusPageExigeServiceOperationnel(page)` — dérive si l'écran exige un service ouvert AUJOURD'HUI
  (notion `enService`, arbitrage du 11/09/2026 : un quart laissé ouvert la veille ne compte pas).
- `nexusEcranOperationnelAtteignable(...)` — la garde de redirection elle-même.
- Couplage identifié par `request-11.md` §4 : la migration de `nexusPointageArriveeManquant`/
  `nexusPriseDePosteManquante`/`nexusDepartPointeAujourdhui` vers `nexusFuseauSite` (au lieu de
  `nexusDateLocaleISO`) est **couplée** à `nexusPageExigeServiceOperationnel` — les deux doivent
  être traités ensemble, pas isolément.

## Tests déjà écrits sur Production, à rejouer comme preuve d'équivalence (pas à réécrire)

`test_acces_hors_service_20260916.js`, `test_accueil_hors_service_20260918.js`,
`test_fuseau_station_20260918.js`, `test_pointage_interrupteur_global.js` (version Production —
la version actuelle du rail pour ce dernier fichier diffère de 83 lignes et devra être réconciliée,
pas simplement écrasée).

## Portée UX

D'après `request-11.md` §4 : « un changement de navigation/redirection sur cinquante écrans ».
Périmètre large — c'est précisément pourquoi ce n'est pas un geste mécanique de portage comme
`nexusEstManager`, et pourquoi cela justifie un lot séparé avec sa propre preuve comportementale,
pas une inclusion opportuniste dans la restauration `#65`.

## Ce que ce document ne fait pas

N'ouvre aucun lot, ne porte aucun fichier, ne modifie aucun test. Écrit pour information et
préparation seulement, à la suite de l'arbitrage demandé par `request-16.md` §8.
