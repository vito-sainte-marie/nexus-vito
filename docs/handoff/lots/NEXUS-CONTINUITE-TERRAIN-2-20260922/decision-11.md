---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 11
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-18.md
---
# Décision Créateur — la preuve jetable #65 du 22/09 est recevable pour la gate migration

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

## 1. Ce qui est tranché — et seulement cela

Frédéric valide l'arbitrage recommandé : `preuve-65-schema-jetable.md` (22/09/2026) est reconnue
comme preuve recevable de la gate « Preuve de création réelle de la migration #65 »
(`classement-gates-etat-git-62-65-1.md` §2), sous réserve de son empreinte et de son périmètre
déjà documentés — relus ici, pas rouverts :

- schéma jetable = les **276 migrations `production`** (`git archive origin/production
  supabase/migrations`), rejouées dans l'ordre, zéro erreur ;
- une seule migration ajoutée en 277e position :
  `20260919103000_carburant_reception_regularisation_releve_manuscrit.sql`, sha256
  `1a02adca37af32b6ea3ffa3ec41b43968502d75bd515877b47e1d4073a8d6caf` ;
- 13 objets créés (8 colonnes, 3 contraintes, 1 routine, 1 trigger), **0 objet détruit** ;
  différentiel inverse vide ;
- garde éprouvée par treize cas, dont un contre-témoin réel (T12 : garde retirée, T2 rejoué,
  passe — le rouge de T2 vient bien du trigger, pas d'un artefact du banc) et un cas décisif
  (T10 : le pompiste du jour, laissé passer par la RLS, est refusé par la garde — sans elle la
  réservation au manager n'aurait vécu que dans l'écran).

**Ceci ferme UNIQUEMENT la ligne « Preuve de création réelle de la migration #65 » de
`classement-gates-etat-git-62-65-1.md` §2.** Ce n'est pas un GO de fusion, pas un GO Production,
et cela ne rouvre aucun autre diagnostic déjà rendu sur `#65` ou `#62`.

## 2. Ce qui reste explicitement ouvert, et n'est pas absous par ce verdict

La preuve elle-même liste deux constats à porter au dossier avant tout GO de déploiement
(`preuve-65-schema-jetable.md` §4) — ils ne disparaissent pas ici, ils sont portés au dossier de
gate Production à préparer :

1. `revoke ... from public` ne ferme pas `anon`/`authenticated` sur
   `nexus_garde_regularisation_reception()` — portée mesurée faible (fonction de trigger, appel
   direct déjà refusé par le moteur), mais c'est la **quatrième occurrence** de la même ligne qui
   échoue de la même façon. À arbitrer avant un GO de déploiement, pas avant cette gate.
2. La 277e porte un horodatage (`20260919103000`) antérieur à neuf migrations déjà appliquées en
   Production. Risque outillage (CLI Supabase), pas schéma — la preuve a été menée dans l'ordre
   réel de déploiement, donc le résultat n'en dépend pas. À traiter avant le déploiement, par
   renommage de version ou application explicite.

Aucun des deux n'est une condition de cette gate ; les deux sont des conditions du futur dossier
de gate Production.

## 3. `request-18.md` — la seule question qu'il posait est devenue sans objet

`request-18.md §5` demandait un arbitrage sur `issues: write`. Ce point n'a plus besoin de
réponse ici : Frédéric l'a tranché directement, hors de ce fil de décision, par le commit
`0b3c387` du 26/09/2026 sur `handoff-continuite-20260920` (« Le réveil Claude → Orchestrateur se
poste seul (issues: write, accordé le 26/09) ») — autorisation inscrite à côté de la permission,
datée et nominative, avec quatre refus avant écriture, une garde de boucle et une garde de
provenance de branche, éprouvés par mutation. Cette décision ne rouvre pas ce diagnostic ; elle
constate seulement qu'aucun arbitrage supplémentaire n'y est dû.

## 4. Suite autorisée — les gates restantes de `#65`, dans l'ordre de `decision-10.md` §3

1. **Isolation candidate/preview au SHA exact** : à re-mesurer sur l'état réel de
   `rebuild/carburants-65-20260922`, qui a bougé depuis le 23/09 (portage de la chaîne de build,
   correctif `nexus-auth.js`, réalignement des harnais). Ne pas supposer close sans preuve
   fraîche.
2. **CI attribuée** : déjà close sur son périmètre précis par `decision-10.md` — ne pas rouvrir
   sans preuve contraire.
3. **Recette navigateur authentifiée** : si un mécanisme CI existe déjà sur la branche candidate
   avec les secrets Test réels et une vérification SHA-servi fail-closed, en mesurer le résultat
   réel plutôt que d'en supposer un verdict — sans lire, exposer, copier ni demander la valeur
   d'un PIN.
4. **Dossier de gate Production** : à préparer seulement si les trois points précédents sont
   réellement clos avec preuve, pas avant.

Si un blocage `actions:write`/réseau empêche de déclencher ou de lire un run depuis la session en
cours, ne pas contourner : documenter le geste minimal exact requis, sans redemander l'arbitrage
migration de ce document.

## Interdits

Aucun merge ni déploiement Production, aucune migration/DDL ni écriture Supabase Production,
aucun reset de Test historique, aucun changement métier/UX/rôle/RLS/sécurité, aucun affaiblissement
de tests/`ECHECS-CONNUS`, aucun secret exposé, aucune baisse de gate.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
