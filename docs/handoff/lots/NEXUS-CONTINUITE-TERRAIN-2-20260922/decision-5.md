---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 5
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-6.md
---
# Décision — GO ratification de request-6, avec exigence de correction à la racine

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric ratifie `request-6.md` : le diagnostic mécanique de la « Cohérence des épingles de
cache » (workflow legacy de la candidate appelant `--verifier` sans construire l'arbre au
préalable) est accepté comme cause exacte de cet échec précis, et le patch mécanique proposé
(`bash outils/build.sh` à la place de `node outils/poser-build-id.js --verifier`) reste valide
pour ce symptôme.

Condition explicite posée avant toute nouvelle action : **ne pas réparer uniquement le symptôme
pour obtenir une CI verte**. Une preuve plus récente (run `35838111274`) montre que le portage
complet des 7 fichiers du rail vers la candidate a également supprimé, dans `nexus-auth.js`, des
primitives encore consommées par la lignée #65 (`nexusEstManager`, `nexusFuseauSite`, etc.),
provoquant 20 nouveaux échecs. Le lot doit établir la cause racine de cette divergence — pas
seulement rétablir un vert test par test ni étendre la liste des échecs « connus ».

## Périmètre autorisé (Test uniquement, hors Production)

1. Établir l'arbre causal complet des 20 nouveaux échecs : cause commune, dépendances de
   l'auth/config moderne, primitives candidate-only perdues, échecs réellement indépendants —
   chaque classe prouvée, pas supposée.
2. Comparer architecturalement la lignée #65 avant portage, le rail canonique actuel et la
   Production pertinente : identifier pourquoi le transport d'infrastructure a remplacé une API
   encore consommée au lieu de préserver un contrat compatible.
3. Définir le plus petit correctif de cause racine — idéalement une frontière/contrat d'auth/
   config compatible avec la candidate, conservant les primitives métier nécessaires tout en
   supprimant le ciblage Production en dur. Ne pas réintroduire l'auth legacy complète si une
   couche d'adaptation minimale suffit.
4. Vérifier qu'aucune autre primitive/API candidate-only n'est perdue par les 7 fichiers
   transportés — chercher systématiquement les consommateurs avant de conclure.
5. Rejouer les tests pertinents et la suite complète sur un arbre jetable si le canal le permet.
   Ne requalifier aucun échec en « connu » sans preuve.
6. Si le correctif est architecturalement sûr, minimal, sans règle métier nouvelle et
   déterministe : produire le patch exact et les contre-preuves dans le Handoff. Si son transport
   sur la branche candidate reste impossible depuis le canal d'exécution, ne pas contourner :
   déposer tout ce qui permet son application externe exacte.
7. Après application éventuelle : CI entièrement verte, puis preuve séparée du `nexus-config.js`
   réellement servi et du ciblage exclusif Supabase Test. Aucune recette navigateur avant cette
   preuve Test-only.
8. Si une décision métier/sécurité/RLS s'avère nécessaire : STOP, remonter précisément
   l'arbitrage à Frédéric. Sinon poursuivre automatiquement jusqu'au prochain vrai gate.

## Pourquoi `closes: false`

Le lot n'est pas terminé : la cause racine de la divergence auth/config n'est pas encore établie,
le correctif (s'il existe) n'est ni transporté ni prouvé vert en CI, et la preuve de ciblage
Supabase Test réel reste à faire séparément. `request-6.md` répondait à un sous-diagnostic
mécanique valide mais partiel ; ce verdict le ratifie et étend le périmètre vers la cause racine
demandée par Frédéric.

## Invariants (inchangés)

Aucun merge/push `main`/`production`, aucune migration/écriture Supabase Production, aucun
déploiement Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun affaiblissement de garde,
aucun secret exposé. PR #65 reste NO GO jusqu'à preuves complètes.
