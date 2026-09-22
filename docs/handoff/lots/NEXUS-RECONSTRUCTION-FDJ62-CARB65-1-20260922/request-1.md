---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-RECONSTRUCTION-FDJ62-CARB65-1-20260922
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: refs-rebuild-vides
    classe: VERIFIED
    valeur: rebuild-fdj-62 et rebuild-carburants-65 valent tous deux 2bc7b39, identiques a production
  - id: carb65-migrations
    classe: VERIFIED
    valeur: base=278 candidat=279 diff=1
  - id: fdj62-migrations
    classe: VERIFIED
    valeur: base=278 candidat=290 diff=12
  - id: fdj62-doctrine-textuelle
    classe: VERIFIED
    valeur: grep sur historique complet de la branche fdj-vague1-cycle-caisse-20260916
  - id: obstacle-canal
    classe: VERIFIED
    valeur: checkout worktree archive fetch-refspec et gh requierent tous une approbation indisponible dans ce run
---
# Reconstruction FDJ #62 / Carburants #65 — constat et plan, pas de fusion

## Ce qui a été vérifié dans ce canal, réellement

- HEAD de ce checkout = `a4e86c0` = `origin/handoff-continuite-20260920` = le SHA cité au réveil.
  `node outils/handoff.js verifier` conforme (31 lots, 14 avertissements, 10
  dérogations — tous préexistants). `NEXUS-CONTINUITE-TERRAIN-1-20260920` est
  `DECISION_CONSOMMEE` : aucun verrou de lot actif.
- `origin/production` vaut désormais `2bc7b39` (« Continuité terrain —
  P0-1/P0-3 ») : le merge Production évoqué par `decision-12.md` a bien eu
  lieu. La CI distante du SHA cité n'a pas pu être re-vérifiée depuis ce canal
  (`gh`/`git fetch` y requièrent une approbation qu'aucun humain ne peut
  donner dans ce run automatisé) — je reprends la valeur déclarée au réveil
  sans l'avoir mesurée moi-même, et le dis explicitement.
- `origin/rebuild/fdj-62-20260922` et `origin/rebuild/carburants-65-20260922`
  existent déjà (probablement préparées par l'Orchestrator) et sont toutes
  deux **strictement identiques à `origin/production`** (`2bc7b39`, diff
  vide, 278 migrations) : ce sont des points de départ vides, pas encore des
  candidats.

## Obstacle de canal — confirmé, pas supposé

Toute opération qui matérialiserait un arbre différent du HEAD courant est
bloquée dans cette session : `git checkout --detach <ref>`, `git worktree
add`, `git archive`, `git fetch <refspec>`, `gh` (même `gh --version`)
requièrent tous une approbation qu'aucun humain ne peut donner dans ce run
automatisé. Seules les opérations de lecture pure fonctionnent : `git log`,
`git diff --stat`, `git show <ref>:<chemin>`, `git merge-base`, `git branch
-a`, `git for-each-ref`. Je n'ai donc **ni construit ni poussé** de branche
candidate ; conformément à l'instruction du réveil, je dépose un plan mesuré
plutôt qu'une preuve fabriquée.

## Carburants #65 — le candidat minimal existe déjà, purement technique

`origin/reception-regularisation-20260919` (tête `fe36a8e`, « Integrer la
tete de production dans Regularisation d'une reception passee, et re-mesurer
l'empreinte », commité aujourd'hui 22/09/2026 13:34, avant ce réveil) est
construit **directement sur** `2bc7b39` — la même base que
`rebuild/carburants-65-20260922`. Diff mesuré par `git diff --stat` :

- 17 fichiers, +1600/-35, **un seul commit** au-dessus de la base ;
- une seule migration ajoutée : `supabase/migrations/20260919103000_carburant_reception_regularisation_releve_manuscrit.sql` ;
- comptage réel des migrations par `git show <ref>:supabase/migrations | wc -l` :
  base `2bc7b39` = 278, ce candidat = 279 (+1, exactement la migration
  ajoutée — mesuré, pas déduit) ;
- fichiers touchés : `NEXUS-Carburant-Reception-v1.html`,
  `NEXUS-Carburants-Pilotage-v1.html`, `nexus-carburant-donnees.js`,
  `nexus-reception-donnees.js`, plus 11 fichiers de test (dont le nouveau
  `test_reception_regularisation_20260919.js`, 609 lignes) — aucune touche
  hors du périmètre réception/régularisation.

C'est déjà le candidat minimal demandé : il n'ajoute pas de RLS, ne touche
aucun rôle, ne fusionne pas 30 commits d'un chantier plus large. Ce que ce
canal ne peut pas faire lui-même : le rejouer réellement (checkout bloqué)
pour confirmer les trois temporalités (livraison réelle / relevés terrain
manuscrits / saisie-régularisation NEXUS), la symétrie avant/après et la
traçabilité par une exécution de tests plutôt que par lecture de diff.

**Geste purement technique, non soumis à arbitrage** : faire pointer
`rebuild/carburants-65-20260922` sur `fe36a8e` (fast-forward, aucune
divergence — `fe36a8e` a `2bc7b39` comme unique parent direct), puis faire
tourner la CI réelle dessus.

```
git fetch origin reception-regularisation-20260919
git push origin origin/reception-regularisation-20260919:rebuild/carburants-65-20260922
# ou, depuis une session avec écriture directe :
git push origin fe36a8e:refs/heads/rebuild/carburants-65-20260922
```

## FDJ #62 — l'ancienne PR n'est pas minimale, et elle porte des RLS définitives

`origin/fdj-vague1-cycle-caisse-20260916` (tête `fe4e9a2`, même horodatage
d'intégration que Carburants, aujourd'hui 13:23) est elle aussi rebâtie sur
`2bc7b39` — mais ce n'est **pas** un candidat minimal : c'est l'ancienne PR
elle-même, 30 commits, 42 fichiers, +16905/-760 par rapport à la base.
Comptage réel des migrations : base 278, ce candidat 290 (**+12 migrations**,
dont, d'après les messages de commit lus sur la branche, une phase A
(étendre le cycle de vie de la caisse), une phase B (basculer le front
employé) et une **phase C qui écrit des RLS définitives** (« FDJ Vague 1 —
Phase C (fermer) : les RLS définitives, et les 12 mutations qui les
prouvent »).

J'ai vérifié par recherche dans l'historique complet de cette branche que la
doctrine citée au réveil y est bien présente textuellement, donc déjà
décidée et non inventée par moi : « prise de poste ≠ login » (« Après
connexion et avant toute prise de poste, NEXUS présente deux chemins […]
personne vers la prise de poste »), idempotence (`fdj_cle_idempotence`,
`idempotency_key`, garde d'index dédiée), « L'employé confirme, il ne
valide pas, et il peut corriger » (§3.2/3.4, bouton renommé « CONFIRMER MA
CAISSE ET LA TRANSMETTRE »), première confirmation immuable (journal
`fdj_caisse_evenements`, immuable par trigger), corrections versionnées, et
séparation auteur / employé opérationnel (`auteur_id` distinct de
`employe_responsable_id`).

Ce que je ne fais pas : distiller moi-même un sous-ensemble « minimal » de
ces 12 migrations RLS pour cette session. Le réveil demande explicitement un
STOP et une gate pour tout ce qui touche sécurité/rôles/RLS — et une phase C
qui pose des policies RLS définitives sur un cycle de caisse en est
directement. Les phases A/B/C sont, d'après les messages de commit eux-mêmes,
interdépendantes (le front bascule en phase B sur ce que la phase A a
étendu ; la phase C ferme ce que B a basculé) : couper cette chaîne sans
relecture humaine des policies risquerait exactement le « choix purement
technique déjà couvert » que ce n'est pas.

**Ce point reste donc explicitement soumis à arbitrage** — pas une question
que je pose faute d'avoir cherché, mais le constat que la seule voie de
reconstruction disponible (l'ancienne PR entière) est exactly ce que le
réveil demande de ne pas fusionner en bloc, et que la découper exige une
décision sur les policies RLS, pas un choix technique.

## Item 3 — gate technique sûre déjà classée, identifiée mais non commencée

`ARCH-002` (`docs/nexus/BACKLOG.md`) — collision d'identité globale
`nexus-stock.js` / `nexus-stock-moteur.js` — reste ouverte sur le HEAD
courant : `nexus-stock-moteur.js` existe toujours, n'est inclus par aucun
`.html` (vérifié par recherche), et reste référencé par
`outils/guardians-router.js` comme finding connu non bloquant. C'est une
gate technique sûre (pas de nouveau module, pas de RLS, pas de règle
métier) mais je ne l'ai pas commencée dans cette passe : l'ordre du réveil
place FDJ #62 et Carburants #65 en premier, et leur investigation a occupé
le budget de cette session. À reprendre dans un prochain réveil dédié si
aucun geste plus prioritaire n'apparaît.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
migration appliquée, aucun secret, aucune branche autre que
`claude/issue-28-20260922-1853` créée ou modifiée, aucun geste Production.
