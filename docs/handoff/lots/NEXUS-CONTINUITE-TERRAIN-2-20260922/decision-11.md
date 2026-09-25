---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 11
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-17.md
---
# Décision Créateur — baseline Test reproductible Production-équivalente pour `#65` (et procédure générique)

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-17.md`.

Frédéric valide l'option structurante : ne pas modifier `#65` pour masquer le drift constaté et
ne pas considérer le Test historique actuel comme baseline absolue tant qu'il n'est pas
Production-équivalent.

**Note de forme, assumée et non corrigée après coup** : le réveil qui porte cette décision la
nomme « Décision Créateur sur request-18 ». Au moment de son dépôt, la demande active du lot est
`request-17.md` (`decision-10.md` déjà consommée, `STATE.json.derniere_demande = request-17.md`) ;
aucun `request-18.md` n'existe. Cette décision répond donc à `request-17.md` — la seule demande
réellement en attente d'arbitrage — et non à un fichier qui n'a jamais été déposé. `request-18.md`
sera le prochain retour canonique de Claude sur ce lot, pas l'objet de cet arbitrage.

## 1. Cible de qualification retenue

Une **baseline Test reproductible = Production de référence + migrations/delta explicites du
candidat**. Le Test historique (`nexus-test`, `udljdqxerrbbbajxubfn`) n'est PAS cette baseline :
sa dérive de schéma déjà mesurée (287 vs 276 côté migrations Git, 11 versions hors dépôt —
`classement-gates-etat-git-62-65-1.md` §2) l'exclut par construction tant qu'elle n'est pas
réconciliée.

## 2. Le projet Supabase Test historique n'est pas détruit

Conservé comme environnement de développement tant que sa dette n'est pas réconciliée. Aucun
`reset`/DROP dessus dans ce lot.

## 3. Sémantique de la recette et correctif Login

Ne pas bypasser la sémantique de la recette authentifiée. Ne pas injecter le correctif Login dans
`#65` : ce correctif et le drift historique sont une dette infrastructure/baseline distincte,
tracée séparément, avec sa propre traçabilité.

## 4. Mécanisme minimal pour `#65`

Concevoir le plus petit mécanisme sûr permettant de prouver, sur une cible jetable/isolée :
reconstruction de la baseline Production, application de la migration `#65`, preuve de
création/rollback (ou équivalent non destructif), puis recette candidate.

**Fail-closed explicite, repris tel quel** : si une ressource externe payante, un nouveau projet
Supabase, une modification de secrets/sécurité, ou une action Production est nécessaire pour aller
plus loin — **STOP** avant toute création, avec le besoin exact décrit dans le retour canonique.

## 5. Généricité

Cette mécanique est pensée comme future procédure générique pour `#62` et les prochaines
candidates, pas comme un bricolage spécifique à `#65`.

## 6. Baseline machine-readable du programme de stabilisation

Claude commence à produire cette baseline : SHA Production, inventaire migrations
Production/Test/dépôt, drift classifié, commande/preuve de reconstruction attendue, limites
actuelles du canal d'exécution.

## Ce que cette décision n'autorise pas

Aucun nouveau module produit. Aucune modification de règle métier/UX/rôle/RLS/sécurité. Aucun
merge/déploiement Production, aucune écriture/migration Supabase Production, aucun reset
destructif Test, aucun secret exposé.

## Suite

Poursuivre automatiquement tout ce qui est déterministe et sans risque dans ce périmètre. Si `#65`
devient entièrement prouvée par ce mécanisme, préparer son dossier de gate Production puis STOP
pour `GO` explicite de Frédéric.
