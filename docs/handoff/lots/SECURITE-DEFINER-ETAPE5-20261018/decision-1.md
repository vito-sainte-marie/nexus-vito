---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-DEFINER-ETAPE5-20261018
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# DÉCISION HUMAINE — Étape 5 : report en Production (SECURITE-DEFINER-ETAPE5-20261018)

Auteur : Frédéric Bragance (autorité humaine). Décision confirmée personnellement le 18/10/2026 dans la conversation de travail ; matérialisée ici par Claude à sa demande expresse. Ce n'est pas une décision de l'arbitre ChatGPT. La décision antérieure de l'arbitre sur `request-1.md` (`BLOCKED`, `SUPABASE_PRODUCTION_MUTATION`) est conservée.

DECISION: APPROVED_WITH_CONDITIONS — le report en Production décrit dans `request-2.md` est autorisé sous les conditions 1 à 6 ci-dessous. Cette décision n'est pas un GO d'exécution ; celui-ci sera donné séparément. CLOSES: false. OWNER: Frédéric.

## Périmètre (inchangé)
Dans une seule transaction sur Production `uzhjpqpctpvxytxpxoqz` : 17 × `ALTER FUNCTION … SET search_path = public, pg_temp` ; 8 × `REVOKE EXECUTE … FROM public, anon, authenticated` (fonctions de trigger) ; 1 × `INSERT` au registre `20261018200000` / `securite_definer_search_path_et_triggers_fermes`. Exclusions : `nexus_identifiant_de_connexion(text)` (reste exécutable par `anon`), `nexus_garde_regularisation_reception()`, `run_scheduled_inventory_reviews()`.

## Conditions
1. Votre GO d'exécution distinct, daté, après relecture du rail.
2. Reconfirmation visuelle que « Deploy to production » est éteint.
3. Relevé préalable complet (ACL et `proconfig` des 25 fonctions, 9 triggers, job, registre = 319) ; tout écart → arrêt et retour vers vous.
4. Fenêtre hors clôture de caisse.
5. Aucune approbation de la gate Pages, aucun déploiement, dans ce périmètre.
6. Compte rendu des 10 épreuves ; la connexion réelle est constatée par vous (aucun PIN ni identifiant saisi par Claude).

Aucun SQL n'est exécuté, aucun déploiement lancé, la gate Pages n'est pas approuvée par cette décision.
