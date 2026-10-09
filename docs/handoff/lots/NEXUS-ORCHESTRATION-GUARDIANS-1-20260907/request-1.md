---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ORCHESTRATION-GUARDIANS-1-20260907
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: rapatriement
    classe: VERIFIED
    valeur: 4 fichiers repris, recette-navigateur-test.js explicitement ecartee car le canon porte mieux
  - id: calibration
    classe: VERIFIED
    valeur: 13 findings -> 1 sur le HEAD canonique, le finding restant est la dette NexusStock connue
  - id: arch-001
    classe: VERIFIED
    valeur: preflight delegue a garde-env-001, plus aucune seconde implementation
  - id: mutations
    classe: VERIFIED
    valeur: 7 tentees, 7 detectees
  - id: suite
    classe: VERIFIED
    valeur: 200/209, les 9 echecs historiques inchanges
  - id: secrets
    classe: VERIFIED
    valeur: aucun ; JWT litteral du fixture retire
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Request-1 — Guardians backend intégrés, après calibration

Ce lot exécute `ORCH-002` du Backlog et reprend les critères de sortie non
satisfaits de `decision-2.md` du lot REPAIR-1.

## 1) Rapatriement sélectif — et pourquoi la règle a servi tout de suite

`decision-2.md` de REPAIR-1 impose de « repartir du HEAD canonique courant et
comparer fichier par fichier. Aucun cherry-pick/merge aveugle. » Comparaison
faite sur les cinq fichiers candidats :

| fichier | état sur le canon | action |
|---|---|---|
| `outils/guardians-router.js` | absent | repris, puis calibré |
| `outils/verifier-apprentissage.js` | absent | repris |
| `test_guardians_router_20260907.js` | absent | repris, puis complété |
| `test_verifier_apprentissage_20260907.js` | absent | repris, puis complété |
| `outils/recette-navigateur-test.js` | **présent et différent** | **NON repris** |

Le cinquième justifie la règle à lui seul : le canon porte la vraie recette
Playwright écrite ce jour, la branche n'en porte que le vérificateur de
préconditions. Un cherry-pick global l'aurait écrasée.

## 2) Calibration — 13 findings, dont un seul réel

Exécuté tel quel sur le HEAD canonique, le routeur rendait **13 findings** et
sortait en `exit 1`. Trois défauts cumulés, mesurés et non supposés :

1. **`\s*=` matchait le premier `=` de `===`.** La ligne 582 de
   `nexus-brief-donnees.js` — `if (typeof global.NexusCarburantCommandeDonnees
   === 'undefined')` — était rapportée comme DÉCLARANT la globale alors qu'elle
   ne fait que la LIRE. Ce n'est pas un garde trop sévère, c'est un garde qui
   accuse à faux.
2. **`global.window = global`**, l'alias de bac à sable présent dans des
   dizaines de tests, produisait un finding « `window` déclarée par 55
   fichiers » — illisible et sans objet.
3. **Les fichiers de test** déclarent des globales dans leur propre `vm` par
   construction et ne s'exécutent jamais ensemble dans un navigateur.

Après calibration : **13 → 1**, et ce dernier est le vrai — la collision
`NexusStock` entre `nexus-stock.js` et `nexus-stock-moteur.js`, que l'audit du
07/09 (§12.5) demande de trancher avant toute suppression ou renommage.

Réduire le bruit n'est pas adoucir le garde : c'est la condition pour que son
unique cri soit entendu.

## 3) ARCH-001 — une règle, un propriétaire

`preflightHeadCanonique` embarquait sa **propre** implémentation d'ENV-001,
écrite avant `outils/garde-env-001.js`. Deux contrôles pour une même règle,
c'est deux vérités — et ce n'était pas théorique : la version du routeur ne
distinguait pas « raciné sur `main` » de « simplement en retard », précisément
la distinction qui rend le contrôle utilisable en CI plutôt que pénible.

Le routeur délègue désormais à la garde dédiée. `garde-env-001.js` accepte la
branche en paramètre : une variable d'environnement lue au chargement du module
aurait été ignorée par tout appel ultérieur, `require` mettant le module en
cache. Défaut trouvé en écrivant la délégation, corrigé avant de la livrer.

## 4) Deux défauts trouvés dans la suite importée

**Un trou.** Une mutation supprimant le contrôle de schéma de `RULES.json`
survivait aux dix épreuves de `verifier-apprentissage`. Un registre sans
`schema` déclaré serait lu par un outil qui croit connaître sa forme. Comblé.

**Un piège.** Le test du guardian Security contenait un JWT factice écrit d'un
seul tenant. Dès qu'une migration entre dans le même diff — le scope `security`
s'active alors sur tous les fichiers changés — le guardian scanne ce fichier et
signale son propre fixture. Un garde qui se dénonce lui-même apprend à ses
lecteurs à ignorer ses findings. Le jeton est maintenant assemblé à l'exécution.

## 5) Câblage CI — deux régimes, et la différence n'est pas cosmétique

- **`verifier-apprentissage.js` : BLOQUANT.** Il ne juge que l'intégrité de
  `RULES.json`/`EXPERIENCE.jsonl`, verte sur le canon. Un rouge y est donc
  toujours une régression réelle, jamais une dette héritée.
- **`guardians-router.js` : RAPPORTE**, sans arrêter la CI. Son unique finding
  est une dette pré-existante que ce lot n'a pas le droit de corriger. Le rendre
  bloquant mettrait la CI au rouge dès le premier run, et la leçon de Q71 est
  explicite : une garde dont le premier verdict est rouge se fait retirer, et
  emporte avec elle les findings qu'elle aurait trouvés ensuite. Même régime que
  la garde de portée site, pour la même raison.
- **Leurs épreuves restent bloquantes** : le garde peut se taire, il ne peut pas
  mentir sans qu'on le voie.

## 6) Critères de sortie de `decision-2.md` (REPAIR-1)

| critère | état |
|---|---|
| 1. outils présents sur `config-par-environnement` | ✅ `debd46c` |
| 2. tests ciblés verts sur ce HEAD | ✅ 13/13 et 10/10 |
| 3. mutation négative rouge puis restauration verte | ✅ 7 tentées, 7 détectées |
| 4. CI de la branche canonique exécute réellement les contrôles | ✅ 4 étapes ajoutées |
| 5. régression complète sans nouvel échec | ✅ 200/209, les 9 historiques |
| 6. recette navigateur automatisée si secrets sûrs | ✅ faite au lot précédent |
| 7. aucun secret/PIN/service_role dans dépôt ou logs | ✅ vérifié, JWT littéral retiré |
| 8. aucun accès Production | ✅ |

## 7) Guardians

- **Architecture & Cohérence** : PASS — la duplication ENV-001 est supprimée,
  pas contournée.
- **Security & Isolation** : PASS — aucun secret ; la seule occurrence de
  `service_role` restante est le MOTIF du détecteur, qui doit le contenir pour
  le reconnaître.
- **QA/Regression** : PASS — 200/209, 7 mutations sur 7 détectées, aucun nouvel
  échec.
- **Bible/Philosophie** : PASS — un garde qui ne sait pas conclure se tait ; il
  n'invente pas un SAFE.

## 8) Limites honnêtes

1. Le routeur ne bloque pas encore. Son activation bloquante suppose que la
   dette `NexusStock` soit tranchée — ce que ce lot n'a pas le droit de faire.
2. Le guardian Security ne scanne que les fichiers changés, et seulement quand
   le scope `security`/`supabase` est actif. Un secret introduit dans un fichier
   hors scope passerait. C'est une portée assumée, pas une couverture complète.
3. `guardianArchitectureCollisions` balaie la racine du dépôt, pas le diff :
   son coût est constant et son verdict indépendant du changement examiné.

## 9) Production

`NOT_APPLICABLE` — aucune requête, aucun merge, aucun déploiement.

## Questions à arbitrer

**Q73 — Activer le routeur en bloquant ?** Recommandation : **pas maintenant**,
et seulement après que la dette `NexusStock` ait été tranchée par son propre
lot. Bloquer d'abord ferait retirer la garde.

**Q74 — Ouvrir le lot `NexusStock` ?** L'audit le demande depuis le 07/09
(§12.5) et c'est désormais le seul finding qui sépare le routeur du blocage.
Recommandation : **oui, en lot déterministe distinct**.

**Q75 — Étendre le guardian Security hors scope ?** Il ne voit aujourd'hui que
les fichiers changés sous scope `security`/`supabase`. Recommandation : **le
laisser tel quel** et le mesurer avant de l'élargir — un scan systématique du
dépôt reproduirait exactement le bruit qu'on vient de retirer du détecteur de
collisions.
