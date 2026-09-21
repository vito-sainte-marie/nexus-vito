<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-1-20260920/decision-9.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 9
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-9.md
wake_to: Claude
creator_gate: GO
creator_go_at: 2026-09-21T13:55:00-04:00
---
# Décision 9 — GO Créateur Production P0-1/P0-3

Frédéric donne explicitement son **GO Production** pour le candidat figé P0-1/P0-3 décrit dans `request-9.md`.

## Candidat autorisé — identité stricte

- Production attendue avant geste : `6c3efccc0167ea6d0537245bc9dfaa1dad329509`
- Candidat autorisé : `f5398a745d2ba831bb09d0e1e99427130912dbfa`
- Parent unique attendu : `6c3efccc0167ea6d0537245bc9dfaa1dad329509`
- Diff attendu : exactement 3 fichiers, 55 insertions / 9 suppressions :
  - `NEXUS-App-v1.html`
  - `nexus-app-donnees.js`
  - `nexus-conseiller-donnees.js`

Toute différence de SHA, parent, diff, ref Production ou contenu => **STOP immédiat** et nouvelle demande.

## Autorisé

1. Refaire juste avant promotion un préflight lecture seule :
   - registre Handoff conforme ;
   - `production == 6c3efccc0167ea6d0537245bc9dfaa1dad329509` ;
   - candidat `f5398a7...` existant, parent unique exact ;
   - diff limité aux 3 fichiers attendus ;
   - aucune migration/Supabase/secret.
2. Si et seulement si tout est identique, faire avancer `production` de `6c3efcc...` vers `f5398a7...` **par fast-forward uniquement**, sans merge commit, rebase, squash ni force-push.
3. Laisser le push Production déclencher le workflow Pages canonique.
4. Observer le déploiement jusqu'à conclusion terminale.
5. Postflight obligatoire :
   - confirmer le SHA réellement servi/déployé ;
   - vérifier que `production == f5398a7...` ;
   - recette non destructive des chemins P0-1/P0-3 et écrans critiques disponibles ;
   - vérifier absence de nouvelle erreur matérielle liée au lot ;
   - confirmer aucune migration/Supabase exécutée.
6. En cas d'échec de déploiement ou anomalie matérielle imputable au candidat : **STOP et rapport immédiat**. Ne pas improviser de correction. Le rollback code vers `6c3efcc...` est autorisé uniquement si l'anomalie est directement imputable au candidat et que le retour arrière est nécessaire pour restaurer le service ; documenter exactement le geste.
7. Déposer `request-10.md` avec SHA avant/après, run/deployment, recette, résultat, rollback éventuel et état final, puis STOP.

## Toujours hors périmètre

P0-2, B1, #62, #65, Brief, NEXUS Live, toute migration/RLS/rôle, toute écriture Supabase ou `station_config`, tout autre refactor.

Ce GO porte **uniquement** sur le candidat `f5398a745d2ba831bb09d0e1e99427130912dbfa`.
