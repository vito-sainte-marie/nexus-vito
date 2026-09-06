<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
seq: 3
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
human_clarification: Frederic Bragance 2026-09-06
---

# Décision — validation de l'implémentation et activation fonctionnelle en Test

Le retour `request-2.md` est accepté pour la partie code et Handoff, sous réserve de la validation fonctionnelle finale en environnement Test.

## Éléments validés

- L'implémentation est localisée au moteur de commande, au CTA et au message Cockpit/Directeur.
- La règle canonique de `decision-2.md` est respectée par la matrice de tests annoncée : jours de commande distincts des jours de livraison, cutoff strict avant 11:00, week-ends et jours fériés, aucune heure de livraison inventée.
- Le moteur reste propriétaire de la vérité métier ; l'UI et le Cockpit traduisent l'état structuré sans second calcul métier.
- Le plafond sûr de 35 000 L est préservé ; aucun 36 000 L n'est forcé.
- Aucun changement Production n'est autorisé ni constaté dans ce lot.

## Configuration Test autorisée et appliquée

Frédéric autorise explicitement l'activation de la règle sur Supabase **Test uniquement** pour le site `nexus-station-test`.

Configuration attendue dans `station_config.carburant_commande_config` :

- `jours_commande_iso: [1,2,3,4,5]`
- `cutoff_heure: "11:00"`
- `jours_livraison_iso: [1,2,3,4,5]`
- `fuseau_horaire: "America/Martinique"`

La clé `jours_commande_iso` a été ajoutée dans le projet Supabase Test `nexus-test` (`udljdqxerrbbbajxubfn`) pour `nexus-station-test`, en préservant toutes les autres clés existantes. Aucune écriture Supabase Production.

## Conditions avant clôture

1. Consommer cette décision via le mécanisme canonique Handoff.
2. Vérifier que la branche active reste `config-par-environnement` et que `main`/`production` restent inchangées.
3. Rejouer la matrice calendrier au minimum : mercredi 10:59, mercredi 11:00/11:01, vendredi 10:59, vendredi + lundi férié, samedi, samedi + lundi férié, jour férié en semaine.
4. Vérifier la configuration Test réelle lue par l'application : `jours_commande_iso=[1,2,3,4,5]`, cutoff 11:00, fuseau America/Martinique.
5. Vérifier qu'aucune heure de livraison fixe n'est affichée ou déduite.
6. Vérifier les cas CTA : 35 000 L sûr => simulation si arbitrage résiduel ; 36 000 L réellement atteignable + créneau commandable + aucun arbitrage => préparation ; hors créneau => simulation.
7. Vérifier que GNR non évaluable hors commande ne bloque pas GO/SP95.
8. Vérifier qu'aucune livraison déjà enregistrée n'est intégrée deux fois.
9. Exécuter les tests ciblés Carburants, Handoff et la régression pertinente ; tout nouvel échec imputable au lot bloque la clôture.
10. Déposer un `request-3.md` avec preuves exactes, limites et verdict des cinq Guardians.

## Interdictions

- Aucun changement `main`.
- Aucun changement `production`.
- Aucun Supabase Production.
- Aucune promotion NEXUS Production.
- Aucun secret/service_role.
- Aucun refactor large hors périmètre.

Verdict attendu après preuve complète : **correction validée en Test — prête pour Production**, mais uniquement si toutes les conditions ci-dessus sont réellement prouvées. La présente décision n'autorise pas la Production.