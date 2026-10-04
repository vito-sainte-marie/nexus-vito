---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 7
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-9.md
wake_to: Claude
---
# Décision — request-8 et request-9 : dossier FDJ-62 validé, Phase C maintenue ouverte

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Cette décision répond formellement à `request-9.md` et arbitre aussi explicitement la clôture demandée par `request-8.md`.

## Request-8 — quatre gestes FDJ-62

Les preuves rapportées par request-8 sont acceptées pour les quatre gestes déjà autorisés séparément et exécutés :
- fusion PR #73 au candidat verrouillé ;
- déploiement Pages et contrôle du contenu servi ;
- application de `20261004120000` après déploiement ;
- fermeture de l'ancienne RPC à `anon` et `authenticated`.

Le sous-dossier FDJ-62 est considéré terminé sur le fond.

**Le lot Handoff n'est toutefois pas clos**, car la Phase C de la même Vague 1 reste ouverte et request-9 ne peut pas être abandonnée sans lot successeur.

## Request-9 — Phase C

La recette nexus-test du 04/10 est acceptée comme preuve actuelle de préparation : C1, C2, C3, C5, C6 et C7 sont retenues satisfaites sur le fond, sous réserve d'une relecture finale de l'état réellement servi juste avant toute future application Production.

Le libellé fonctionnel proposé pour C5 est retenu : pour l'employé, Ma Progression doit passer par `fdj_ma_progression_caisse()`, aujourd'hui via `nexus-caisse-source.js`; une lecture brute `fdj_shifts` n'est admise que sur le chemin manager. La note C7 est également retenue : `fdj_enregistrer_mouvement_stock` peut être porté par l'écran Manager. Le fichier SQL Phase C reste inchangé afin de préserver le blob déjà recetté.

## Arbitrage C4

Voie retenue : **(b) attendre un cycle réel de caisse en Production**.

Aucune caisse artificielle ne doit être créée en Production pour satisfaire C4. Dès qu'une caisse réelle aura parcouru le cycle complet brouillon → confirmation → correction → validation par les commandes serveur, C4 devra être vérifiée en lecture seule et les conditions C1–C7 recontrôlées contre le code réellement servi et l'état courant avant tout nouvel arbitrage.

Il n'y a pas de limite de temps imposée : l'absence de cycle réel maintient simplement la Phase C bloquée.

## Interdictions / absence de GO Production

Cette décision **n'autorise pas** :
- l'application de `supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql` en Production ;
- la création ou modification d'une caisse de test en Production ;
- une migration, un déploiement ou une fusion Production supplémentaire ;
- toute écriture Production destinée à fabriquer la preuve C4.

La future application de Phase C exigera un **nouveau GO explicite**, après C4 réelle et revalidation finale C1–C7.

## Suite

Consommer cette décision sur le rail canonique puis maintenir le lot ouvert pour la seule dette Phase C/C4. Le prochain événement attendu est soit la détection en lecture seule d'un cycle réel satisfaisant C4, soit un changement de code/base qui invalide une preuve et impose une nouvelle requalification.
