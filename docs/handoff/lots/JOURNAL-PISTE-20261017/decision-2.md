---
protocol: nexus-handoff/2
kind: decision
lot_id: JOURNAL-PISTE-20261017
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
---
# Décision sur request-3.md — arbitrage humain de Frédéric (levée du STOP SECRET_PERMISSION_SURFACE_SECURITE, Supabase Test uniquement)

Cette décision matérialise l'arbitrage humain rendu par Frédéric Bragance dans la conversation du 18/10/2026, en réponse à l'arrêt de l'arbitre sur request-2.md (22:09 UTC) puis sur request-3.md (22:30 UTC) : `DECISION: BLOCKED`, `STOP_REQUIRED: SECRET_PERMISSION_SURFACE_SECURITE`, `OWNER_NEXT: Frédéric`. request-2.md n'a jamais reçu de décision déposée ; cette décision répond à la demande active, request-3.md.

Frédéric valide explicitement le principe d'application sur Supabase Test de la migration corrigée présentée dans request-3.md, sous réserve des contrôles préalables et des conditions ci-dessous.

## 1. Permissions autorisées sur Test

Exclusivement celles définies dans le SQL final de request-3.md :
- `GRANT SELECT` au rôle `authenticated` sur les trois nouvelles tables Journal Piste, avec RLS limitant effectivement la lecture aux managers et gérants habilités de leur station ;
- `GRANT EXECUTE` sur les fonctions clientes expressément prévues par la migration, avec vérification obligatoire du rôle, de l'identité et du site ;
- révocations empêchant les accès non autorisés ;
- fonctions internes non exécutables par `anon` ou `authenticated` ;
- création du job `pg_cron` prévu, exclusivement sur Test, après validation de son rôle d'exécution et de son périmètre.

Aucun droit supplémentaire n'est autorisé.

## 2. Conditions impératives avant exécution

- Vérifier que le SQL exécuté est exactement celui de request-3.md, sans modification ultérieure non arbitrée.
- Confirmer le schéma réel de Test et les dépendances nécessaires.
- Vérifier les droits et les politiques RLS existants susceptibles d'être affectés.
- Confirmer que le plan de retour arrière est exécutable et que les données existantes sont préservées.
- Conserver la preuve 109/109 obtenue sur base jetable, sans la présenter comme une preuve définitive sur Test.

Si une condition échoue ou exige une modification de permissions, interrompre l'opération et revenir à l'arbitrage.

## 3. Exécution et vérification

Après matérialisation conforme de cet arbitrage sur le rail, Claude est autorisé à appliquer la migration exacte sur Supabase Test uniquement, par le canal habilité, puis à exécuter les preuves RLS sur Test. Contrôler notamment les refus `anon`, pompiste et intersites, les autorisations manager/gérant du bon site, l'absence d'écriture directe, les fonctions privilégiées et le job planifié. En cas d'échec, arrêter toute progression et présenter les résultats.

## Périmètre

Test exclusivement. Ni fusion, ni Production, ni déploiement : ils exigent un GO distinct.
