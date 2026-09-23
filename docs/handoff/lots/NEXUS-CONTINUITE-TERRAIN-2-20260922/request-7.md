---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: refs-protegees
    classe: VERIFIED
    valeur: main-inchange-production-inchange
  - id: methode-lecture-seule
    classe: VERIFIED
    valeur: git-worktree-et-checkout-refuses-a-nouveau-git-show-seul
  - id: cause-commune-16-sur-20
    classe: VERIFIED
    valeur: nexusEstManager-nexusFuseauSite-absents-de-nexus-auth-js-porte
  - id: peut-regulariser-casse
    classe: VERIFIED
    valeur: nexus-carburant-reception-v1-html-ligne-386-appelle-fonction-absente
  - id: gravite-ecart-source-unique
    classe: VERIFIED
    valeur: derive-production-rail-preexistante-sans-lien-avec-le-port
  - id: connexion-nest-pas-presence
    classe: NOT_APPLICABLE
    valeur: cause-exacte-non-reduite-dans-ce-tour
  - id: service-courant-unique
    classe: NOT_APPLICABLE
    valeur: cause-probable-non-confirmee
  - id: cloture-services-obsoletes
    classe: NOT_APPLICABLE
    valeur: famille-probable-symbole-exact-non-verifie
  - id: portage-mecanique-suffisant
    classe: VERIFIED
    valeur: non-rien-a-porter-de-plus-le-rail-a-elimine-ces-primitives
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Classification des 20 échecs nouveaux (`290a217f`→`664af985`) — cause commune identifiée, PAS un portage déjà canonisé

Réponse à la preuve externe request-7 (issue #28, commentaire du 23/09/2026) : run GitHub Actions
`35838111274` sur `rebuild/carburants-65-20260922` @ `664af985`, 197/224, 27 échecs (7 connus + 20
nouveaux). Conformément à la consigne, **la liste CONNUS n'a pas été touchée**.

## 1. Méthode

Lecture seule uniquement (`git show`, `git diff --numstat`) : `git worktree add` et `git checkout`
vers la candidate ont été retentés et refusés à nouveau par le harnais de ce canal (cohérent avec
`preuve-cloudflare-humaine-65-portage-1.md` §5, non recontourné). Chaque fichier cité ci-dessous a
été matérialisé et comparé directement entre `HEAD` (rail, `e09616f`) et
`origin/rebuild/carburants-65-20260922` (`664af985`).

## 2. Sur les 20, au moins 16 partagent UNE SEULE cause, vérifiée précisément

Le portage mécanique des 7 fichiers (`decision-2.md`/`decision-3.md`) a remplacé le
`nexus-auth.js` de la candidate (932 lignes, pré-refonte) par celui du rail (305 lignes,
post-refonte du 05/09). `decision-4.md` avait jugé ce remplacement « sans conséquence
fonctionnelle ». **Ce n'est pas exact** : le fichier pré-port définissait `nexusEstManager(employee)`
(ligne 329) et `nexusFuseauSite` — deux primitives que le rail a éliminées de sa propre lignée
(refactor indépendant, inline `employee.role==='manager'||...`), mais que **la candidate elle-même,
au-delà des tests, continue d'appeler** :

```
NEXUS-Carburant-Reception-v1.html:386:  function peutRegulariser() { return nexusEstManager(employeeCourant); }
```

C'est la garde manager de l'écran de régularisation **de #65 lui-même**. Après le port tel que
livré, cet appel lève `ReferenceError: nexusEstManager is not defined` à l'exécution — pas
seulement dans les tests.

Vérifié un par un (`grep` sur le contenu réel des tests, sur `664af985`) — chacun extrait
`nexusEstManager` et/ou `nexusFuseauSite` littéralement depuis `nexus-auth.js`, absent des deux
dans la version portée :

| Test | Primitive absente |
|---|---|
| `reception_compartiments_incomplet` | `nexusEstManager` |
| `reception_compartiments_saut_multiple_v2254` | `nexusEstManager` |
| `reception_entete_partagee` | `nexusEstManager` |
| `reception_jaugeage_correctifs` | `nexusEstManager` |
| `reception_m3_et_vide` | `nexusEstManager` |
| `reception_regularisation_20260919` | `nexusEstManager` |
| `reception_visite_render` | `nexusEstManager` |
| `role_du_jour_20260905` | `nexusEstManager` |
| `regularisation_manager` | `nexusEstManager` |
| `pointage_interrupteur_global` | `nexusEstManager` |
| `acces_hors_service` | `nexusEstManager` |
| `fuseau_parametres_station` | `nexusFuseauSite` |
| `fuseau_station` | `nexusFuseauSite` |
| `jour_metier_pointage` | `nexusFuseauSite` |
| `missions_jour_station` | `nexusFuseauSite` (+ bloc `/* NEXUS-FUSEAU-METIER */`) |
| `accueil_hors_service` | `nexusFuseauSite` |

`cloture_services_obsoletes` référence aussi `nexus-auth.js` (2 occurrences) — probablement la même
famille, non confirmé au symbole exact par manque de budget dans ce tour.

## 3. Deux causes distinctes, confirmées, hors de cette famille

- **`gravite_ecart_source_unique`** — sans lien avec le port : le test exige que
  `NEXUS-Mon-Evolution-v1.html` dérive sa couleur d'écart de `NexusVerifyMoteur.classifierEcart`
  (correctif de l'audit ARCH-003 du 06/09/2026). Ce correctif vit sur le rail ; rien n'indique qu'il
  ait été porté sur `production`. C'est une dérive Production/rail préexistante, révélée — pas
  causée — par #65 devenant le premier candidat à disposer d'une CI Test isolée.
- **`connexion_nest_pas_presence`** — référence `nexus-auth.js` mais pas via `nexusEstManager`/
  `nexusFuseauSite` : c'est une épreuve d'atteignabilité de graphe d'appel sur l'ensemble du dépôt
  (aucune écriture de présence atteignable depuis le chargement d'un écran). Cause exacte **non
  réduite** dans ce tour — nécessite de tracer le graphe réel, hors du budget disponible ici.
- **`service_courant_unique`** — la primitive `nexusServiceCourant` elle-même satisfait les
  assertions sur `nexus-auth.js` (vérifié ligne à ligne), mais le test scanne aussi TOUS les fichiers
  applicatifs de la candidate pour une lecture unique de `shifts` hors la primitive canonique — la
  candidate porte davantage de fichiers (issus de `production`) jamais alignés sur ce refactor du
  rail. Cause probable, non confirmée à 100 %.

## 4. Conclusion — PAS un portage mécanique déjà canonisé qui suffit

Il n'existe rien à porter de plus depuis le rail : `nexusEstManager`/`nexusFuseauSite` n'y existent
plus, ils ont été éliminés sur sa propre lignée. Étendre le portage ne peut donc pas réparer ce
point — au contraire, **le portage tel que livré (`290a217f`) est lui-même la cause** d'une
régression fonctionnelle réelle sur l'écran de régularisation de #65, pas seulement d'un artefact
de test. `decision-4.md` avait classé le remplacement de `nexus-auth.js` comme « sans conséquence
fonctionnelle » sur la seule base du mode Unix de `build.sh` — ce tour montre que ce n'était pas la
bonne vérification.

**#65 reste NO GO.** Remontée du blocage : la correction plausible n'est pas déjà canonisée — elle
consisterait à ne porter, dans `nexus-auth.js`, QUE l'indirection d'environnement
(`window.NEXUS_CONFIG` au lieu de l'URL Production en dur) en conservant `nexusEstManager`,
`nexusFuseauSite` et tout le reste du fichier pré-port de la candidate — un patch plus étroit que
les 7 fichiers actuels, encore à écrire et à faire réviser, pas un geste mécanique déjà approuvé.
Avant de le proposer comme geste exécutable, il faudrait aussi confirmer qu'aucune AUTRE primitive
candidate-only n'est perdue de la même façon (`cloture_services_obsoletes`, `connexion_nest_pas_presence`,
`service_courant_unique` restent à réduire).

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé, aucune nouvelle règle métier/UX/RLS/rôle, PR #65 non modifiée, aucun fichier
applicatif touché (diff limité à `docs/handoff/`), aucune tentative de contournement des refus
d'écriture Git déjà documentés.
