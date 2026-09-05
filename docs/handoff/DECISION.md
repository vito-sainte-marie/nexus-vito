# NEXUS Handoff — DECISION

LOT_ID: S-5-SHIFT-ID-INVENTAIRE-20260905
DECISION: APPROVED_CLOSED
AUTHOR: ChatGPT
BRANCH: config-par-environnement

## Décision

S-5 est **fermé**.

Les preuves produites suffisent pour valider l'implémentation structurelle S-5. Le chemin applicatif conserve désormais l'identifiant du service déjà résolu par `nexusServiceCourant()` et écrit ce véritable `shift_id` lors de la création réelle de `inventaire_quart_employes`, sans seconde définition ni seconde requête du service courant.

Le garde base protège l'invariant lors des INSERT et des UPDATE concernés : le shift doit appartenir au même employé et au même site que le quart d'inventaire. Les preuves négatives en base montrent le refus des associations inter-employé et inter-site. Les six lignes historiques restent volontairement à `shift_id IS NULL`, sans backfill.

Commit de référence déclaré : `3b795ff80c94df84cb94b691d74667d44256adcc`, environnement `test`, `coherent = true`. Suite déclarée : 183/192, avec uniquement les 9 échecs historiques connus. `main` et `production` restent à `501c0c7` et aucune écriture production n'est déclarée.

## Arbitrage Q9 — preuves navigateur 2 et 5

Décision : **report contrôlé à la gate de fermeture du bloqueur 1**.

Ne pas consommer Employé Test A dans une session séparée uniquement pour S-5. Les deux preuves manquantes sont précisément les premières étapes du rejeu navigateur réel déjà obligatoire pour fermer le bloqueur 1.

S-5 peut donc être fermé maintenant, mais **le bloqueur 1 reste ouvert** tant que le rejeu réel n'a pas produit ces preuves.

Le rejeu doit commencer avec Employé Test A, ou un compte test équivalent réellement vierge pour la journée, et doit prouver dans cet ordre :

1. avant toute prise de poste, ouvrir le parcours Inventaire et confirmer l'état fail-closed : aucun service courant, aucune création réelle de `inventaire_quart_employes` ;
2. effectuer une prise de poste réelle ;
3. ouvrir Inventaire et créer le rattachement réel attendu ; vérifier en base que la nouvelle ligne porte exactement le `shift_id` du service qui vient d'être ouvert ;
4. effectuer le pointage d'arrivée si le parcours normal l'exige ;
5. effectuer le départ réel avec les preuves normales du parcours ;
6. confirmer que S-2 clôt le shift sous RLS réel et qu'aucun service courant ne subsiste ;
7. vérifier la cohérence pointage/shift et l'absence de refus silencieux ou d'écriture partielle ;
8. effectuer une nouvelle prise de poste réelle afin d'exercer S-3 sous session employé ;
9. confirmer que l'ancien service est clos et que le nouveau est l'unique service `en_cours` ;
10. contrôler autant que possible les branches `ROW_COUNT` de S-2/S-3 sous RLS réel.

Si une étape échoue, **ne pas fermer le bloqueur 1** et ne pas masquer l'échec par une correction manuelle en base.

## Anomalies / dettes consignées

- Le résidu historique `inventaire_quarts.quart = '1'` signalé par Claude reste une donnée historique hors S-5. Ne pas la corriger rétroactivement sans arbitrage métier.
- La valeur `serviceCourantId` conservée pendant la session constitue une frontière connue : S-5 ne doit pas être élargi maintenant. Si un futur parcours permet réellement de changer de service sans recharger/réinitialiser le contexte Inventaire, ce comportement devra être traité comme un lot distinct.
- La frontière de traçabilité reste explicite : avant S-5, `shift_id` peut être NULL ; après S-5, les nouvelles lignes réelles créées par le parcours NEXUS doivent porter le vrai shift actif.

## Interdictions

- Ne jamais modifier `main` ou `production` sans autorisation humaine explicite.
- Cette décision n'est pas une autorisation de production.
- Ne pas backfiller les six lignes historiques.
- Ne pas corriger le quart historique `1` dans ce lot.
- Ne pas toucher aux colonnes `shift_id` FDJ.
- Ne pas fermer le bloqueur 1 avant le rejeu navigateur réel ci-dessus.
- Ne pas commencer le bloqueur Verify tant que la gate bloqueur 1 n'est pas arbitrée, sauf nouvelle décision explicite.

## Prochaine gate

S-5 étant fermé, la prochaine étape technique de la recette est la **gate de fermeture du bloqueur 1**, avec le rejeu navigateur réel ci-dessus.

Conformément à la décision humaine prise dans la conversation, une courte parenthèse peut maintenant être consacrée à la conception de **NEXUS Handoff v2 événementiel**, mais elle ne doit ni modifier le comportement métier NEXUS, ni toucher `main`/`production`, ni faire disparaître le protocole v1 `CURRENT.md` / `DECISION.md` qui reste le mode de secours.

Claude doit consommer cette décision uniquement si le `LOT_ID` correspond exactement à `S-5-SHIFT-ID-INVENTAIRE-20260905`.
