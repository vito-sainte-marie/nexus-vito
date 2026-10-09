---
protocol: nexus-handoff/2
kind: request
lot_id: CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
seq: 3
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=1a60a8f production=501c0c7
  - id: commit-consommation-decision3
    classe: VERIFIED
    valeur: b101fb2
  - id: tests-cibles
    classe: VERIFIED
    valeur: 14/14 correction_decision2 + 18/18 moteur_v2238 + 48/48 handoff_v2
  - id: regression
    classe: VERIFIED
    valeur: 193/202 run-tests.js, 9 echecs pre-existants sans rapport avec ce lot
  - id: config-test-fixture
    classe: HUMAN
    valeur: jours_commande_iso=[1,2,3,4,5] cutoff_heure=11:00 fuseau_horaire=America/Martinique verifie par ChatGPT/Frederic, non relu par Claude
---
# Demande — Retour de validation fonctionnelle finale, correction calendrier/CTA Commande Carburant

## Contexte

Réponse à `decision-3.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`,
`in_reply_to: request-2.md`, `human_clarification: Frederic Bragance
2026-09-06`, `commit_decision: b101fb2`, consommée le 2026-09-06 dans ce
lot). Autorisation d'exécution reçue explicitement de Frédéric via
commentaire GitHub PR #30 (gate humaine, canal relais NEXUS Orchestrator),
après contrôle indépendant ChatGPT confirmant HEAD `c1dbc49`, `main`/
`production` inchangées, et la lecture live de la fixture Supabase Test.

Aucun changement de code n'a été nécessaire dans ce lot : l'implémentation
livrée au commit `a6b9f98` (lot précédent, `request-2.md`) est déjà
pilotée par `config.jours_commande_iso` (lu depuis
`station_config.carburant_commande_config`, sans valeur codée en dur) —
elle satisfait donc directement la configuration Test désormais annoncée
par `decision-3.md` sans modification.

## Conditions de `decision-3.md` — statut de chacune

1. **Consommer cette décision via le mécanisme canonique Handoff** — FAIT.
   `node outils/handoff.js consommer CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906`
   → décision `b101fb2` marquée consommée, `STATE.json.lots.CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906`
   passe à `statut: DECISION_CONSOMMEE`, `derniere_decision: decision-3.md`.
2. **Branche `config-par-environnement` active, `main`/`production` inchangées** —
   VÉRIFIÉ. HEAD `c1dbc49` avant écriture (correspond au contrôle
   indépendant cité dans le commentaire déclencheur) ; `origin/main` =
   `1a60a8f`, `origin/production` = `501c0c7`, aucun des deux touché par ce
   lot.
3. **Matrice calendrier rejouée** (mercredi 10:59 ; mercredi 11:00/11:01 ;
   vendredi 10:59 ; vendredi + lundi férié ; samedi ; samedi + lundi
   férié ; jour férié en semaine) — VÉRIFIÉ par
   `test_carburant_commande_correction_decision2_20260906.js` (14/14 ✅),
   dont la fixture `CONFIG` (`jours_commande_iso: [1,2,3,4,5]`,
   `cutoff_heure: '11:00'`, `jours_livraison_iso: [1,2,3,4,5]`) reproduit
   exactement les valeurs de la fixture Supabase Test annoncée par
   `decision-3.md` pour `nexus-station-test`.
4. **Configuration Test réelle lue par l'application**
   (`jours_commande_iso=[1,2,3,4,5]`, cutoff 11:00, fuseau
   America/Martinique) — preuve **`HUMAN/ChatGPT VERIFIED`** citée dans le
   commentaire déclencheur (lecture live Supabase Test,
   `udljdqxerrbbbajxubfn`, `nexus-station-test`,
   `updated_at=2026-09-06 17:43:18.591976+00`) : cette session n'a **aucun
   accès Supabase** et ne prétend pas avoir relu cette valeur elle-même.
   Vérifié au niveau code : `nexus-carburant-commande-donnees-core.js`
   lit `carburant_commande_config` directement depuis `station_config`
   (`select('carburant_commande_config, cuves_carburants, horaires')`,
   `config: (data && data.carburant_commande_config) || null`) et le
   relaie tel quel au moteur — aucune valeur de site codée en dur,
   confirmé par recherche (`grep "Sainte-Marie"` / `grep "samedi"` dans
   `nexus-carburant-commande-moteur.js` : aucun code de branchement, seuls
   des commentaires explicatifs).
5. **Aucune heure de livraison fixe** — VÉRIFIÉ par le même test dédié
   (« aucune heure de livraison fixe inventée — livraisonISO reste une
   date pure »).
6. **Cas CTA** (35 000 L sûr + arbitrage résiduel → simuler ; 36 000 L
   réellement atteignable + créneau commandable + aucun arbitrage →
   préparer ; hors créneau → simuler) — VÉRIFIÉ, 4 configurations
   couvertes dans le même test dédié (14/14).
7. **GNR non évaluable hors commande ne bloque pas GO/SP95** — VÉRIFIÉ par
   lecture de code : `resumerCausesConfirmationCommande` (fonction
   inchangée depuis v2.264, retour Frédéric du 28/08/2026) filtre déjà les
   carburants non inclus dans la commande réelle via `carburantsInclus`
   avant de décider si la commande est confirmable.
8. **Aucune livraison déjà enregistrée intégrée deux fois** — VÉRIFIÉ par
   `test_carburant_commande_moteur_v2238.js` (« stock prévisionnel à la
   livraison + intégration d'une commande déjà en cours — reproduit
   l'exemple exact du cahier §10 »), 18/18 ✅, fichier non modifié par ce
   lot.
9. **Tests ciblés Carburants, Handoff et régression pertinente** —
   VÉRIFIÉ, voir section Tests ci-dessous ; aucun nouvel échec imputable à
   ce lot.
10. **Déposer `request-3.md`** — ce fichier.

## Tests exécutés dans cette session

- `test_carburant_commande_correction_decision2_20260906.js` : **14/14 ✅**
  (matrice calendrier + CTA, config identique à la fixture Test annoncée).
- `test_carburant_commande_moteur_v2238.js` : **18/18 ✅** (régression
  moteur, non touché par ce lot).
- `test_handoff_v2_20260905.js` : **48/48 ✅** (registre + correctif
  structurel `in_reply_to` du lot Handoff précédent, inclut désormais un
  cas dédié `request-2 -> decision-3` valide sans dérogation).
- `node run-tests.js carburant` : **38/39 ✅** — seul échec
  `test_chaine_temporelle_carburant_20260821.js`, pré-existant et sans
  rapport (ne charge que `nexus-carburant-moteur.js`/
  `nexus-carburant-donnees.js`, ni l'un ni l'autre touché ici).
- `node run-tests.js` (202 fichiers) : **193/202 ✅** — les 9 échecs
  concernent exclusivement Inventaire/Réception + le même test de fuseau
  horaire ci-dessus ; identiques à ceux déjà documentés dans
  `request-2.md`, aucun nouveau, aucun fichier touché par ce lot.
- `node outils/handoff.js verifier` : **exit 0** avant consommation, après
  consommation, et après ce dépôt — 23 lots, 7 avertissements documentés,
  3 dérogations déjà actées, 0 échec.

## Ce qui n'a PAS pu être prouvé dans cette session (limite explicite)

- **Aucune lecture live Supabase Test par cette session** : la
  configuration réelle du site `nexus-station-test` est une preuve
  `HUMAN/ChatGPT VERIFIED` fournie dans le commentaire déclencheur, jamais
  relue directement ici (aucun accès réseau/DB dans cet environnement).
- **Aucune validation UI/navigateur runtime** : le rendu réel de la carte
  "Prochaine commande" sur `NEXUS-Carburants-Pilotage-v1.html` contre la
  fixture Test n'a pas été observé dans un navigateur par cette session —
  seule la preuve code/tests ci-dessus est apportée. Ces deux limites sont
  distinctes et ne sont pas comblées l'une par l'autre.

## Guardians

- **Architecture** : aucun fichier modifié dans ce lot au-delà de
  `STATE.json` (consommation) ; le moteur reste l'unique source de vérité,
  l'UI ne recalcule rien.
- **Security & Isolation** : aucun accès Supabase depuis cette session,
  aucun secret, aucune écriture Test/Production, aucun changement
  `main`/`production`.
- **Business Rules** : 35 000 L préservé comme plafond sûr, 36 000 L
  jamais forcé, GNR non-bloquant confirmé inchangé, aucune double
  intégration de livraison confirmée inchangée.
- **QA/Regression** : 193/202 global, 48/48 Handoff, 0 régression
  imputable à ce lot ; les 9 échecs Inventaire/Réception/fuseau
  pré-existent et sont sans rapport (fichiers non touchés).
- **Bible/Philosophie** : transparence sur les deux limites résiduelles
  (lecture Supabase live, validation navigateur) plutôt que de les
  masquer ou de les inventer comme prouvées (Article 5 — jamais un
  chiffre/résultat inventé).

## Verdict proposé

**CORRECTION CARBURANTS VALIDÉE EN TEST AU NIVEAU CODE/CONFIGURATION —
PREUVE UI/NAVIGATEUR NON APPORTÉE PAR CETTE SESSION.** La décision
`decision-3.md` est consommée (commit `b101fb2`) et toutes ses conditions
vérifiables depuis cet environnement (calendrier, CTA, GNR, non-double-
intégration, chaîne de lecture de configuration, régression) sont
prouvées vertes. La lecture live Supabase Test reste une preuve
`HUMAN/ChatGPT VERIFIED` non re-vérifiée ici, et aucune observation
navigateur réelle n'a été faite. Ce lot reste donc ouvert dans l'attente
d'une décision canonique statuant sur la suffisance de ces preuves avant
toute mention de disponibilité Production — conformément à l'instruction
explicite de ne pas fabriquer une clôture ni un verdict Production.
