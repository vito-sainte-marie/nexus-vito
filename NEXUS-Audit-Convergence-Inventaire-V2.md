# NEXUS — Audit de convergence & nettoyage Inventaire V2

**Date** : 30/08/2026
**Statut** : audit — aucun code modifié dans ce lot. Livrable demandé explicitement par Frédéric avant toute implémentation : « avant toute suppression physique de table/colonne, je veux la liste exacte des éléments considérés obsolètes et leurs consommateurs actuels ».
**Méthode (Article 5)** : chaque affirmation ci-dessous est vérifiée par lecture directe du code réel (grep + lecture de fichier), pas par inférence sur ce que le système « devrait » faire. Quand une vérification n'a pas pu être poussée jusqu'au bout dans ce lot, c'est signalé explicitement plutôt que présenté comme acquis.

---

## Résumé exécutif

Le diagnostic est plus favorable que le risque décrit dans la demande initiale, sur un point précis, et plus préoccupant sur un autre point précis :

- **Bonne nouvelle vérifiée** : l'architecture « plan interne → missions V2 » que vous demandez est déjà en place. Le plan de comptage tournant (`inventaire_plans_comptage`) n'est plus une checklist affichée à l'employé depuis le Sprint 3 (29/08/2026) — il sert uniquement de réservoir interne dont les missions V2 tirent leur périmètre (`nexus-inventaire-missions-donnees.js::genererOuChargerMissions`, commentaire explicite en tête de fonction). Le paramétrage « Criticité / fréquence » (`frequence_controle`, `delai_max_jours_sans_controle`) est une **source unique déjà convergée**, utilisée à la fois par l'ancien plan tournant et par le nouveau mode `intelligent` des missions, via la cascade `NexusInventaireMoteur.construireReglesEffectivesParProduit`.
- **Point de vigilance réel, confirmé par le code** : le seuil d'écart que le manager configure dans Paramètres (site + par catégorie, Sprint 5) **n'est appelé par aucun mécanisme de détection d'écart aujourd'hui**. Le cycle « NEXUS observe avant de conclure » (v2.29x) déclenche une observation dès qu'un écart dépasse une simple tolérance d'arrondi (0,001), indépendamment de ce seuil. C'est un vrai doublon au sens de votre demande — sauf qu'il ne s'agit pas de deux règles qui se contredisent, mais d'une règle configurée qui n'a aucun effet du tout pendant qu'un seuil différent, non configurable, fait le travail en silence.
- **Cinq réglages confirmés inertes** (`controle_aleatoire`, `validation_manager_requise`, `comptage_masque`, `photo_obligatoire`, `reapprovisionnable`) : stockés, modifiables dans l'écran Paramètres, mais consommés par **aucun moteur, aucun écran**. Le code le documente lui-même honnêtement dans un commentaire, mais rien ne le signale au manager qui les règle.

Le reste de ce document détaille chaque point avec ses preuves, puis propose le tableau de convergence et la liste des éléments à traiter.

---

## 1. Audit des réglages — NEXUS-Parametres-Inventaire-v1.html

Écran organisé en 9 onglets (accueil, produits, frequence, parcours, regles, production, missions, simulation, avance — ce dernier regroupant alertes + traçabilité). Classement onglet par onglet.

### Onglet 📦 Produits — conservé V2
Gestion du catalogue suivi (`inventaire_zone_produit`) : ajout, zone, catégorie, sensible, comptage en deux lieux. Aucun chevauchement avec V2 — c'est la brique de base que consomment aussi bien le plan que les missions. **Aucune action.**

### Onglet 🗓️ Fréquence — mécanisme interne à conserver, mais mal nommé pour ce qu'il fait réellement
Deux blocs :
- **Plan de comptage tournant NEXUS** (`planSocleCible`, `planSurprisesCible`) — vérifié consommé par `nexus-inventaire-plan-donnees.js::chargerOuGenererPlan` ET repris tel quel par `selectionnerPerimetreIntelligent` (Rotation Intelligente Étape 1, v2.301, votre propre chantier de la semaine dernière). **Déjà convergé, source unique.** Reclassification recommandée : ce bloc règle un **paramètre du moteur de sélection interne**, pas une fréquence au sens où l'entend un manager (« tous les combien je dois compter cette famille ») — le sous-titre actuel (« Quand faut-il compter chaque famille de produits ? ») prête à confusion avec `frequence_controle` (onglet Règles, qui répond à la VRAIE question de fréquence par famille). Recommandation : renommer ce bloc « Volume du plan de comptage » ou le déplacer dans Réglages avancés, pour ne laisser qu'une seule notion de « fréquence » visible au manager.
- **Ordre des catégories & jours de comptage** (`jours_rotation` sur `inventaire_categories`) — vérifié consommé uniquement par `nexus-inventaire-moteur.js`/`nexus-inventaire-plan-donnees.js` (le plan tournant). C'est un levier de sélection interne légitime (Article 11 : une seule notion de « quels produits sont éligibles aujourd'hui »), pas une checklist. **Conservé, mais à documenter explicitement comme « réglage du moteur de sélection », jamais comme une obligation de comptage du jour.**

### Onglet 📍 Parcours — conservé, hors sujet convergence
Ordre des zones, sens de comptage (`sensComptage`). Concerne le déplacement physique de l'employé, aucun chevauchement avec la logique missions/plan. **Aucune action.**

### Onglet ⚙️ Règles (produit + catégorie) — cœur du sujet, verdict mixte

Champs de `inventaire_regles_produit`/`inventaire_categories`, cascade `regleEffectiveProduit` (produit > catégorie active > défaut) :

| Champ | Consommé par | Verdict |
|---|---|---|
| `frequence_controle`, `delai_max_jours_sans_controle` | `nexus-inventaire-moteur.js::delaiMaxJours`, plan tournant ET missions `intelligent` (Rotation Intelligente) | **Conservé V2 — déjà source unique.** |
| `quarts_comptage` | `nexus-inventaire-moteur.js::produitEligibleQuart`, plan tournant | Actif, mais **chevauche conceptuellement** `mission_rule.quart` (voir §4a ci-dessous — pas le même champ, mais le même terrain : « à quel moment ce produit compte-t-il »). |
| `controle_aleatoire` | **Aucun fichier JS ne lit ce champ** (grep confirmé, 0 résultat hors Paramètres) | **Obsolète — inerte.** Le libellé (« peut être tiré au sort par le Conseiller NEXUS ») décrit un comportement qui n'existe pas. |
| `validation_manager_requise` | Aucun moteur, aucun écran (confirmé) | **Obsolète — inerte.** Vrai risque de confusion avec le cycle V2 « Sous observation → Contrôle manager requis » (§4b), qui lui est bien vivant mais fonctionne différemment (déclenché par le comportement observé, pas par un interrupteur produit). |
| `comptage_masque` | Aucun moteur, aucun écran | **Obsolète — inerte.** |
| `photo_obligatoire` | Aucun moteur, aucun écran | **Obsolète — inerte.** |
| `reapprovisionnable` | Aucun moteur, aucun écran | **Obsolète — inerte.** |
| Seuils d'écart par catégorie (`inventaire_seuils`, Sprint 5) | `nexus-inventaire-moteur.js::seuilEcartEffectif` — **mais cette fonction elle-même n'est appelée nulle part** en dehors de son propre fichier et de son test | **Obsolète de fait — le mécanisme existe mais n'est jamais invoqué par un chemin de détection réel.** Voir §4c. |

Le code du formulaire produit reconnaît lui-même le problème pour 3 des 5 champs inertes : *« "Réapprovisionnable", contrôle aléatoire et photo obligatoire sont enregistrés mais n'ajoutent pas encore de restriction réelle sur l'écran de comptage employé »* — mais cette phrase n'est visible que dans le code source, jamais à l'écran pour le manager, et elle omet `validation_manager_requise`/`comptage_masque` qui sont dans le même cas.

### Onglet 🥐 Production — hors périmètre
Quantités conseillées de préparation (viennoiserie), calendrier, valeurs spéciales. Moteur totalement distinct (`calculerRecommandationPreparation`), aucun chevauchement avec comptage/missions/écarts. **Hors scope de ce chantier**, à ne pas toucher ici.

### Onglet 🎯 Missions de contrôle — le mécanisme V2 lui-même
Écran de configuration de `inventaire_mission_rules` (Sprint 1). C'est la source de vérité voulue par ce chantier. **Rien à changer ici** — c'est la destination, pas une source à faire converger.

### Onglet 🧩 Réglages avancés (Alertes + Traçabilité)
- **Seuils d'alerte** (`quantityAlertThreshold`, `valueAlertThreshold`, `closureDelayMinutes`) — voir §4c : consommés seulement pour ré-afficher leur propre valeur dans le formulaire, jamais pour déclencher une détection réelle.
- **Seuil de démarque / casse** (`seuilDemarquePct`, `seuilCasseUnites`) — le code l'assume lui-même : *« ne sont pas encore utilisés par un moteur de calcul dédié »*. **Historique/en attente**, pas un doublon — à laisser tel quel, ce n'est pas concurrencé par V2, juste pas encore branché.
- **Photo Decenium** (`snapshotMaxDelayMinutes`) — mécanisme Snapshot Decenium actif et récent (v2.30x), aucun chevauchement V1/V2.
- **Catégories à alerte immédiate** (`immediateAlertCategoryIds`) — à vérifier plus finement (non fait dans ce lot) si ce mécanisme fait doublon avec `nexus_risk_signals` domaine `inventaire` (Cadrage risques Phase 6) ou s'il s'agit d'un canal différent (ex. notification immédiate vs signal consolidé). **Point ouvert, à trancher avant toute suppression.**
- **Mode de comptage à l'aveugle par employé**, **Jaugeage carburant** — deux réglages sans rapport avec le sujet missions/plan, présents ici pour des raisons d'organisation d'écran historiques. Hors scope.

### Onglet 🧪 Tester ma configuration (Simulation)
Vérifications de cohérence (`evaluerConfigurationInventaire`) + comparatif papier optionnel. Ne fait référence à aucun ancien mécanisme de blocage. **Aucune action.**

---

## 2. Tableau technique — une source unique par concept

| Concept | Source unique V2 vérifiée | Statut |
|---|---|---|
| Qui compte (rôle) | `inventaire_mission_rules.role_code` / `role_repli` | ✅ Convergé |
| Quand (moment du quart) | `inventaire_mission_rules.moment_code` / `quart` | ✅ Convergé, avec la nuance `quarts_comptage` ci-dessous (§4a) |
| Périmètre du jour | `inventaire_missions.produit_ids`, dérivé du plan (`inventaire_plans_comptage`) — jamais le catalogue brut depuis Sprint 3 | ✅ Convergé |
| Règle produit/catégorie (comment compter, criticité) | Cascade `NexusInventaireMoteur.regleEffectiveProduit` sur `inventaire_regles_produit` / `inventaire_categories` | ✅ Convergé — un seul mécanisme, déjà réutilisé par le plan ET les missions `intelligent` |
| Dernier contrôle | `view_inventaire_dernier_controle_produit` (via `inventaire_comptages`), filtré post-cutover | ✅ Convergé |
| Couverture (physique X/Y) | `NexusInventaireMoteur.couverturePhysique` — dénominateur = catalogue actif total, jamais une checklist de plan_items | ✅ Convergé — le « 112 » d'un ratio de couverture est une taille de catalogue, pas une obligation du jour (vérifié : aucun affichage « produits à compter » basé sur `plan_items` trouvé dans le Manager) |
| Rapprochement Decenium | `inventaire_rapprochements`, découpé par mission (`rapprochementsPourPerimetre`) | ✅ Convergé |
| Photo Decenium | `inventaire_decenium_snapshots` | ✅ Convergé |
| Présence | `inventaire_quart_employes` / rôles présents du quart | ✅ Convergé |
| **État d'un écart (déclenchement)** | ❌ **PAS de source unique** — voir détail ci-dessous | ⚠️ **Non convergé** |

### ⚠️ Détail — « État d'un écart » : trois mécanismes non coordonnés

C'est le point le plus important de cet audit, vérifié ligne par ligne dans le code :

1. **`ecartNonNul`** (`NEXUS-Inventaire-v1.html`, saisie employé) : `Math.abs(ecart) > 0.001` — une simple tolérance d'arrondi flottant, **jamais** le seuil configuré par le manager. C'est CE gate qui décide si le cycle « Sous observation » (`qualifierObservationEcart`) se déclenche du tout.
2. **`gravite`** (même fichier, ligne ~3072) : `Math.abs(ecartVal) > 2 ? 'critique' : 'attention'` — un seuil différent, littéral, codé en dur, distinct des deux seuils configurables du site (`quantityAlertThreshold`/`valueAlertThreshold`) et de leurs surcharges par catégorie.
3. **`seuilEcartEffectif`** (`nexus-inventaire-moteur.js`, Sprint 5) : la cascade site → catégorie que le manager croit régler dans Paramètres. **Vérifié non appelée** par aucun des deux mécanismes ci-dessus, ni par `nexus-risques-donnees.js::chargerAlertesInventaireAQualifier`.

Conséquence concrète : un manager qui règle un seuil d'écart à 5 unités pour la catégorie Huiles verra quand même une observation se déclencher au premier écart de 0,01 unité — le réglage qu'il vient de faire n'a aucun effet. Ce n'est pas une « fausse précision » de ma part : je l'ai vérifié par lecture directe des trois chemins de code, pas par supposition.

**Recommandation** (à valider avant implémentation, hors scope de ce lot d'audit) : faire du cycle d'observation (`qualifierObservationEcart`) le SEUL point de décision, et lui faire consommer `seuilEcartEffectif` pour peupler `ecart`/`ecartPourCycle` au lieu du test `> 0.001` — la classification `gravite` `critique`/`attention` pourrait alors dériver du même seuil plutôt que du littéral `2`.

---

## 3. Ancien plan de comptage — déjà dans l'état souhaité

Vérifié : `inventaire_plans_comptage`/`inventaire_plan_items` ne sont plus lus comme une checklist par aucun écran employé/manager identifié dans ce lot. Le commentaire de tête de `genererOuChargerMissions` (nexus-inventaire-missions-donnees.js, 29/08/2026) documente explicitement ce choix architectural : *« le périmètre d'une mission doit TOUJOURS être un sous-ensemble du besoin déjà décidé par NEXUS pour ce quart — le plan de comptage [...] jamais un recalcul indépendant sur tout le catalogue actif »*.

Point non vérifié dans ce lot (à faire avant toute décision définitive) : la logique exacte de validation de clôture (`validerOuverture`/fonctions équivalentes en clôture dans NEXUS-Inventaire-v1.html) n'a pas été tracée ligne à ligne pour confirmer qu'aucun chemin ne bloque sur une complétion à 100 % des `plan_items`. Les indices trouvés vont dans le bon sens (commentaires explicites de « dégradation gracieuse » et de périmètre complet plutôt que blocage en cas de moteur non chargé), mais je préfère le signaler comme **probable et non certain** plutôt que de l'affirmer, conformément à l'Article 5.

**Conclusion** : ne pas toucher au plan physiquement — il reste la couche de sélection interne, exactement comme vous le demandez. Aucune action de suppression nécessaire ici.

---

## 4. Branchements des écrans consommateurs

| Écran | Tables lues (Inventaire) | Moteur(s) | Couverture | Produits restants | Alertes |
|---|---|---|---|---|---|
| NEXUS-Inventaire-v1.html (employé) | `inventaire_missions`, `inventaire_plans_comptage`, `inventaire_comptages`, `inventaire_alertes` | `NexusInventaireMoteur`, `NexusInventaireMissionsDonnees` | Jauges missions (Sprint 3/4) | Missions V2 assignées au rôle | Cycle observation (`qualifierObservationEcart`) — seuil non configurable, voir §2 |
| NEXUS-Inventaire-Manager-v1.html | `inventaire_alertes`, `inventaire_comptages`, `inventaire_missions`, `inventaire_rapprochements`, `inventaire_decenium_snapshots` | `NexusInventaireMoteur`, `NexusInventaireManagerDonnees` | `couverturePhysique` (catalogue actif, post-cutover) | Missions V2 + rapprochements | Alertes du cycle observation, qualité rapprochement |
| NEXUS-Parametres-Inventaire-v1.html | Toutes les tables de config (produits, catégories, règles, mission_rules, seuils, production) | `NexusInventaireMoteur` (cascade, verdict config) | — (pas d'affichage opérationnel) | — | — |
| Cockpit / Brief | `inventaire_alertes` (critiques ouvertes), `nexus_risk_signals` domaine `inventaire` | `nexus-inventaire-manager-donnees.js::chargerAlertesInventaireCritiquesOuvertes`, `NexusRisquesDonnees` (v2.304/v2.305, cette semaine) | — | — | Alertes critiques ouvertes + signaux de risque qualifiés en lot |
| Progression employé | Références au mot « inventaire » trouvées (26 occurrences) | Non tracé en détail dans ce lot | — | — | **Point ouvert** : à vérifier si ce sont des références réelles au domaine Inventaire ou des mentions incidentes (le reste de l'écran porte historiquement sur les écarts caisse/FDJ, `nexus-ecarts-*`) |
| Conseiller NEXUS (Brief) | `nexus_risk_signals` via `qualifierEtEnregistrerRisquesPilote` | `NexusRisquesDonnees`/`NexusRisquesMoteur` | — | — | Recommandations basées sur les alertes ouvertes qualifiées, **pas** sur un ancien périmètre catalogue complet (vérifié : `chargerAlertesInventaireAQualifier` part des alertes ouvertes réelles, jamais d'un balayage de tout le catalogue) |

**Aucun écran vérifié dans ce lot ne reconstruit localement une ancienne logique de sélection** — chacun délègue à `NexusInventaireMoteur`/`NexusInventaireMissionsDonnees`/`NexusRisquesDonnees`. Le seul écran nécessitant une vérification plus poussée est Progression employé (26 mentions non qualifiées) — à faire avant de considérer ce point du chantier clos.

---

## 5. Nettoyage UI — proposition de découpage

Le découpage A–E que vous proposez correspond presque exactement à ce qui existe déjà, avec deux ajustements :

- **A. Produits et emplacements** → onglet Produits actuel, inchangé.
- **B. Règles par catégorie** → onglet Règles actuel, **moins les 5 champs inertes** (§1) à retirer ou marquer clairement « pas encore actif » tant qu'ils ne pilotent rien.
- **C. Missions de contrôle** → onglet Missions actuel, inchangé.
- **D. Rapprochement / Photo Decenium** → aujourd'hui dispersé (Photo Decenium dans Réglages avancés, rapprochement consulté uniquement côté Manager) — regroupement à faire dans un futur lot d'implémentation.
- **E. Réglages avancés** → existe déjà (fusion Alertes + Traçabilité, 21/08/2026), à faire hériter du même nettoyage que B.

Onglets sans équivalent dans votre découpage à 5 : **Fréquence** (à fusionner dans Réglages avancés une fois reclassifié « paramètre moteur » — §1) et **Production** (hors scope, sous-domaine distinct qui mériterait son propre regroupement, pas forcément dans cet écran).

---

## 6. Principe de migration retenu

Confirmé et appliqué dans tout ce document : **aucune suppression physique proposée ici**. Pour chaque champ classé « obsolète — inerte » (§1), la recommandation est de le retirer de l'écran (ou de le griser avec une mention explicite) plutôt que de supprimer la colonne — elle ne coûte rien à conserver et pourrait redevenir utile si la fonctionnalité est un jour implémentée pour de vrai.

---

## 7. Schéma cible vs état réel vérifié

Le flux cible que vous décrivez :

```
Présences → Paramètres station → Moteur de sélection → Missions V2 →
Comptages physiques → Snapshot/rapprochement → Observation/décision → Cockpit/progression
```

est **déjà en place pour tout, sauf le maillon « Observation/décision »**, qui a un chemin parallèle non coordonné (les 3 seuils du §2) plutôt qu'une vraie bifurcation « ancien plan → ancienne checklist → ancienne alerte → ancien blocage clôture ». Autrement dit : il n'existe pas un second CHEMIN complet concurrent comme vous le craigniez (bonne nouvelle, vérifiée) — il existe un maillon du chemin unique qui n'écoute pas un réglage que le manager croit actif (le point à corriger).

---

## 8. Tests de non-régression — à préparer pour le prochain lot d'implémentation

Liste reprise telle quelle, à couvrir quand la correction du §2 sera implémentée (pas dans ce lot d'audit) :
quart avec caissier+pompiste+renfort ; quart sans renfort ; deux employés même rôle ; mission tournante ; produit multi-emplacements ; catégorie critique ; catégorie faible rotation ; quart sans comptage ; Snapshot absent ; Snapshot présent ; clôture avec missions terminées mais plan interne non totalement couvert ; historique toujours consultable.

---

## Liste des éléments obsolètes et leurs consommateurs (avant toute suppression)

| Élément | Table/colonne | Consommateurs actuels (vérifiés) | Action proposée |
|---|---|---|---|
| Contrôle aléatoire | `inventaire_regles_produit.controle_aleatoire`, `inventaire_categories.controle_aleatoire` | Aucun (0 lecture hors formulaire Paramètres) | Retirer le champ de l'écran, ou l'implémenter réellement dans le Conseiller NEXUS s'il reste voulu. Ne pas supprimer la colonne (données existantes sur des produits déjà configurés). |
| Validation manager requise | `inventaire_regles_produit.validation_manager_requise`, idem catégorie | Aucun | Retirer de l'écran — le cycle d'observation (v2.29x) couvre déjà ce besoin dynamiquement. Ne pas supprimer la colonne. |
| Comptage à l'aveugle (produit) | `.comptage_masque` | Aucun | Retirer de l'écran. Ne pas supprimer la colonne. |
| Photo obligatoire | `.photo_obligatoire` | Aucun | Retirer de l'écran, ou l'implémenter si c'est prioritaire. Ne pas supprimer la colonne. |
| Réapprovisionnable | `.reapprovisionnable` | Aucun | Retirer de l'écran. Ne pas supprimer la colonne. |
| Seuils d'écart par catégorie | `inventaire_seuils` | `seuilEcartEffectif` (définie mais jamais appelée) | **Ne pas retirer** — c'est la bonne mécanique, il manque juste son branchement. À câbler dans le cycle d'observation (voir §2), pas à supprimer. |
| Seuils d'alerte site (quantité/valeur/clôture) | `station_config.parametres_inventaire.{quantityAlertThreshold,valueAlertThreshold,closureDelayMinutes}` | Réaffichage uniquement (placeholders du formulaire) | Idem — à câbler comme valeur par défaut de `seuilEcartEffectif`, pas à supprimer. |

---

## Ce que cet audit NE couvre PAS (points ouverts pour un prochain passage)

- Traçabilité fine des 26 mentions « inventaire » dans NEXUS-Progression-v1.html — à qualifier avant de clore le point 4 pour cet écran.
- Lecture ligne à ligne de la validation de clôture (`validerOuverture` et son équivalent clôture) dans NEXUS-Inventaire-v1.html pour confirmer à 100 % l'absence de blocage sur complétion du plan interne (indices favorables trouvés, non exhaustifs).
- Vérification fine de `immediateAlertCategoryIds` vs `nexus_risk_signals` domaine `inventaire` (doublon possible, non tranché).
- Aucun code n'a été modifié dans ce lot — les recommandations ci-dessus (retrait des 5 champs inertes de l'UI, branchement de `seuilEcartEffectif` dans le cycle d'observation) sont des propositions à valider avant implémentation, comme pour le lot « rafale » précédent.

Dites-moi lesquels de ces chantiers vous voulez que j'attaque en premier — je recommande de commencer par le branchement du seuil d'écart (§2), c'est le seul point où un réglage manager n'a aujourd'hui aucun effet réel.
