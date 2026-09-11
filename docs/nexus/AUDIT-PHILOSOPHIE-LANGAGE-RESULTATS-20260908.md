# NEXUS | Audit Philosophie, Bible, vocabulaire et langage — Résultats

Date : 2026-09-08
Répond à : `docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-20260908.md` (commit `47b4600`)
Statut : audit et confrontation des sources. Aucune mémoire canonique modifiée par ce document.

## 0. Méthode et périmètre réellement couvert

Conformément à la consigne (« ne pas résoudre silencieusement une contradiction »),
ce document sépare strictement le constat (ce qui a été lu et confronté) de la
proposition (ce qui n'est pas encore décidé).

**Lu intégralement et confronté ligne à ligne** : `docs/nexus/BIBLE.md`,
`NEXUS-Constitution-v1.md` (document fondateur du 23/07/2026), `docs/nexus/CONTINUITY.md`,
`docs/gouvernance/GUARDIAN-PHILOSOPHIE-NEXUS.md`, `docs/learning/RULES.json`,
`docs/nexus/BACKLOG.md` (entrées EVAL-001/DEBUG-001/COACH-001/CARB-007/ARCH-002),
`docs/gouvernance/DOCTRINE-PROPRIETE-CREATEUR-DONNEES-CLIENTS.md`, `nexus-vocabulaire.js`,
`nexus-mesure.js`, `outils/guardian-bible.js`, `outils/guardian-regles-metier.js`,
`outils/guardians-router.js`.

**Confirmé par lecture de commit/git log** : la section « Agents NEXUS » (Directeur
d'Exploitation / Coach Terrain) de `BIBLE.md` existe depuis le commit fondateur
`542ffb6` (« docs: establish NEXUS product bible »), donc **avant** ce cadrage — ce
n'est pas une nouveauté introduite par l'audit.

**Sondé par recherche ciblée, pas relu intégralement** : usage réel du vocabulaire
(`Conseiller NEXUS`, `autonomie X jours`, `Stock physique`, `Prêt pour Production`,
tirets cadratins) à travers les ~150 fichiers `NEXUS-*.html`/`nexus-*.js` du dépôt, et
`docs/gouvernance/2026-09-06-governance-autonome-v2.md` (déjà connu par recoupement
avec Bible/Continuity/ADR-0002, non rouvert en détail).

**Non audité écran par écran dans cette passe** : le contenu textuel complet de
Verify, Inventaire, PAYE, CIN pris individuellement. La doctrine « absence ≠ zéro »
y est déjà couverte par un mécanisme transversal (`outils/guardian-bible.js`,
calibré sur tout le dépôt, cf. §3) plutôt que par une relecture manuelle écran par
écran — refaire cette relecture à la main dupliquerait un contrôle qui existe déjà
et vaut pour ces quatre domaines comme pour les autres. C'est un choix assumé, pas
un oubli : l'auditer une deuxième fois humainement irait contre QA-002 (« calibrer
avant de câbler », pas « revérifier indéfiniment ce qui est déjà mécanisé »).

## 1. Matrice — principes fondateurs (cadrage §3)

| # | Principe (cadrage) | Sources trouvées | Statut |
|---|---|---|---|
| 1 | NEXUS transforme données/signaux en décisions | BIBLE Vision ; Constitution Art.1 | `CONFIRME` |
| 2 | Manager = directeur d'exploitation à ses côtés | BIBLE Philosophie l.11, Agents NEXUS | `CONFIRME` |
| 3 | Employé = accompagnement positif, non punitif | BIBLE Philosophie l.12, Agents NEXUS | `CONFIRME` |
| 4 | Complexité interne acceptable si UX plus simple | BIBLE Philosophie l.13 **et** Architecture l.30 (formulée deux fois, volontairement — la Bible pour le principe, la section Architecture pour sa conséquence technique) | `CONFIRME` / `REDONDANT` (intentionnel) |
| 5 | Donnée sans valeur si pas d'action/compréhension | BIBLE l.14 ; Constitution Art.4 | `CONFIRME` |
| 6 | Preuves terrain priment sur hypothèses | BIBLE l.15 ; Constitution Art.5 | `CONFIRME` |
| 7 | Anomalie jamais masquée par affichage rassurant | BIBLE l.16 ; Guardian Philosophie crit.8 (fail-closed) | `CONFIRME` |
| 8 | Donnée absente jamais transformée en zéro/conformité | **Pas de phrase dédiée dans BIBLE.md actuel.** Présente verbatim sur `index.html:441` (« Jamais un chiffre inventé »), attribuée par le produit lui-même à « sa Constitution » — mais `NEXUS-Constitution-v1.md` ne la porte que par déduction (Art.5 + Art.11 + interdit « IA qui invente »). Concrètement **implémentée** depuis le 08/09/2026 dans `nexus-mesure.js` (bidirectionnel : absence ≠ zéro, ET zéro mesuré ≠ absence) et mécanisée dans `outils/guardian-bible.js`. Corrigée le même jour dans EVAL-001/DEBUG-001/COACH-001 (`docs/nexus/BACKLOG.md`). | `A_ENRICHIR` — le produit revendique publiquement une promesse que la doctrine canonique ne porte qu'implicitement. Candidat direct à devenir une ligne explicite de la Bible (voir §5) |
| 9 | Fait/estimation/prévision/commande/livraison/réalisé distinguables | BIBLE Principes UX l.119 (« états test/réel, prévu/réalisé ») ; `NexusVocab.prevision()` encadre déjà toute projection (« une hypothèse, pas un engagement chiffré ») | `CONFIRME` au niveau du principe ; `MANQUANT` un glossaire unique qui nomme les six états cadrage (voir vocabulaire §2) |
| 10 | Automatiser le fiable, humain réservé à l'exception | BIBLE Philosophie l.17 ; Constitution Art.6 ; Guardian Philosophie (« Principe constitutionnel », **texte identique mot pour mot** à BIBLE l.17) ; CONTINUITY Rôles | `CONFIRME` / `REDONDANT` (intentionnel — Guardian Philosophie cite littéralement la Bible comme source) |
| 11 | Une vérité métier, un propriétaire logique | BIBLE Architecture l.25-27 ; Constitution Art.11 ; `RULES.json` `ARCH-001` ; mécanisé dans `outils/guardian-regles-metier.js` | `CONFIRME` — déjà `CANDIDAT_GUARDIAN` réalisé (voir §3) |
| 12 | Décision canonique non rediscutée par oubli d'un agent | BIBLE « Permanence des décisions » (section dédiée, complète) | `CONFIRME` |
| 13 | Décision humaine sensible non remplacée par sanction auto | **Absente comme ligne explicite de BIBLE.md.** Démontrée en pratique par COACH-001 (« on cesse d'inventer, pas de mesurer ») et par Guardian Philosophie crit.2 (exceptions à l'automatisation), mais aucun des deux ne nomme spécifiquement « décision individuelle sensible envers un salarié » | `MANQUANT` — candidat direct à une ligne Bible explicite (voir §5) |
| 14 | Confiance/sources/limites restent explicables | Guardian Philosophie crit.4 (explicabilité) ; `NexusVocab.fiabilite()`/`prevision()` | `CONFIRME` |
| 15 | Production soumise à autorisation explicite de Frédéric | BIBLE « Environnements » ; `RULES.json` `PROD-001` ; ADR-0003 ; CONTINUITY Rôles | `CONFIRME` — le plus redondant des quinze, volontairement (invariant le plus critique) |

## 2. Vocabulaire NEXUS (cadrage §4) — état réel du dépôt

| Terme cadrage | État constaté | Statut |
|---|---|---|
| **NEXUS Directeur d'Exploitation** | Nom canonique dans `BIBLE.md` depuis le commit fondateur de la Bible (`542ffb6`), donc déjà tranché — **pas** une nouveauté de ce cadrage. Mais le code vivant utilise encore massivement l'ancien nom : `nexus-conseiller.js` (moteur canonique R2/R3/R4 pour Cockpit/Produits/CIN), `nexus-vocabulaire.js` (« le lexique commun du Conseiller NEXUS »), `NEXUS-Data-Dictionary-v2.md`, et une trentaine d'autres fichiers. La Constitution fondatrice elle-même (Art.12, Art.13) ne connaît qu'un « Conseiller NEXUS » unique, antérieur à la scission Directeur d'Exploitation / Coach Terrain. | `EVOLUE` — la doctrine a tranché, la propagation dans le code et dans le document fondateur ne l'a pas suivie. **Ce n'est pas une contradiction à arbitrer** (la Bible l'emporte déjà sur la Constitution plus ancienne par construction — `CONTINUITY.md` la nomme source de doctrine courante) ; c'est une dette de renommage à tracer au Backlog, pas à corriger silencieusement dans ce lot |
| **NEXUS Coach Terrain** | Même statut Bible. Dans le code, seule une instance nommée existe : `nexus-coach-fdj-moteur.js` / `NEXUS-Coach-FDJ-v1.html`, spécifique au module FDJ. Aucune implémentation générique « Coach Terrain » au-delà de ce module | `EVOLUE` côté doctrine, `MANQUANT` côté généralisation produit — à ne pas confondre : le concept existe et fonctionne pour FDJ, il n'a simplement pas encore de porteur transversal |
| **Couverture jusqu'à [jour/quart]** | Absent du dépôt. Le vocabulaire vivant est `autonomie X jours` (`nexus-fdj-moteur.js`, `nexus-carburant-moteur.js`, `nexus-risques-moteur.js`, `NEXUS-Carburants-Pilotage-v1.html`, `NEXUS-FDJ-Manager-v1.html`) | `MANQUANT` — le cadrage le propose comme reformulation *conditionnelle* (« lorsque autonomie X jours est moins utile »), pas comme remplacement obligatoire. Ceci est une décision produit/UX qui reste à trancher, pas une correction déterministe : elle touche des écrans utilisateur déjà en usage et ne relève pas d'un lot outillage/QA au sens Q76 |
| **Présence réelle / Livraison effectuée / Stock physique** | Les concepts sous-jacents existent déjà (distinction test/réel, prévu/réalisé de BIBLE l.119 ; `Stock physique` déjà utilisé dans `NEXUS-Inventaire-v1.html` et les moteurs carburant). Aucun glossaire canonique ne les nomme et ne les définit formellement comme un ensemble cohérent | `A_ENRICHIR` |
| **Prêt pour Production** | Déjà en usage réel : `outils/etat-deploiement.js`, `outils/producteur-evenements-live.js`, `nexus-live-projection.js`, `NEXUS-Live-Developpement-v1.html` — introduit le même jour (08/09) dans le cadre du lot NEXUS Live / GOV-005 | `CONFIRME` — déjà exactement dans le sens voulu par le cadrage (« proposition fondée sur des preuves, jamais une autorisation ») |
| **`NexusVocab.SIGNATURE`** (Levier de valeur, Créateur de valeur, Signal faible…) | Vocabulaire signature existant depuis le 23/07/2026 (`nexus-vocabulaire.js`), non mentionné par le cadrage, actif dans Cockpit/Rayon/Produits | `MANQUANT` du cadrage — ce vocabulaire mérite d'être intégré au dictionnaire final plutôt que découvert séparément une seconde fois |

**Conclusion vocabulaire** : aucune contradiction fondatrice. Le principal travail
restant est un inventaire de propagation (nom d'agent) et une décision produit
différée (couverture vs autonomie), pas un arbitrage de doctrine.

## 3. Règles Guardian candidates (cadrage §7) — ce qui existe déjà

| Règle candidate | État réel | Statut |
|---|---|---|
| `PHILO-DATA-001` Absence ≠ zéro | **Déjà mécanisée** : `outils/guardian-bible.js` (« chiffre_invente_repli_zero »), calibré 638→17 findings (QA-002), câblé en **mode rapport** (non bloquant) dans `guardians-router.js` faute d'avoir encore traité les 17 findings résiduels. Doublon fonctionnel de `PHILO-HON-002` pour sa moitié « fait vs zéro » | `CONFIRME`, déjà `CANDIDAT_GUARDIAN` réalisé. Ne pas créer un second identifiant : documenter `PHILO-DATA-001` comme alias doctrinal de `guardian-bible.js`, pas comme nouvelle règle |
| `PHILO-HON-002` Fait ≠ estimation | Partiellement couvert par `NexusVocab.prevision()`/`fiabilite()` (encadrement systématique du texte), aucun contrôle déterministe dédié | `A_ENRICHIR` — reste `CANDIDAT_GUARDIAN`, non mécanisé |
| `PHILO-HUM-003` Pas de sanction auto | Trop dépendant du jugement (« sensible » n'est pas décidable par motif de chemin de fichier) ; couvert au cas par cas (COACH-001) | Reste consultatif, **pas** `CANDIDAT_GUARDIAN` au sens déterministe — relève du Guardian Philosophie (veto sur conception), pas d'un script |
| `PHILO-UX-004` Complexité interne/simplicité externe | Déjà doctrine Bible (l.13, l.30) ; jugement de revue (Guardian Architecture), pas un motif déterministe | `CONFIRME` en doctrine, pas `CANDIDAT_GUARDIAN` |
| `PHILO-AUTO-005` Pas d'utilisateur-middleware | Recouvre exactement le critère 3 du Guardian Philosophie (« absence de double saisie/surveillance ») déjà écrit et en vigueur | `CONFIRME`/`REDONDANT` — ne pas dupliquer l'identifiant, référencer le critère 3 existant |
| `PHILO-TRUTH-006` Une vérité, un propriétaire | **Déjà mécanisée** sous `ARCH-001` / `outils/guardian-regles-metier.js` (calibré 8887→2 findings, QA-002), en mode rapport | `CONFIRME`, doublon exact d'`ARCH-001` — garder l'identifiant existant |
| `LANG-001` Vocabulaire canonique | Aucun glossaire canonique unifié n'existe encore pour servir de référence à un contrôle (voir §2) | `MANQUANT` — prérequis (le glossaire) avant toute mécanisation, même légère |
| `LANG-002` Langage humain professionnel | Jugement sémantique, non déterministe | Consultatif uniquement, pas `CANDIDAT_GUARDIAN` |
| `LANG-003` Sans tiret cadratin | Techniquement trivial à détecter (`grep '—'`). **Mesuré avant toute proposition de câblage**, conformément à QA-002 : voir §4 — le résultat rend cette règle **non câblable en l'état** sans arbitrage de portée | `CANDIDAT_GUARDIAN` réel, **bloqué en attente d'arbitrage**, pas par difficulté technique |

## 4. Point nécessitant réellement un arbitrage de Frédéric

### 4.1 Portée de l'interdiction du tiret cadratin (LANG-003)

**Ce qui n'est pas contesté** : préférer un français sans tiret cadratin dans du
contenu produit nouveau est une préférence claire et applicable dès aujourd'hui.

**Ce qui doit être arbitré avant tout câblage ou toute réécriture** : la mesure
réelle sur le dépôt (comptage `grep`, pas une estimation) donne :

- **4 810 occurrences** dans 62 écrans `NEXUS-*.html` — un sondage sur `NEXUS-Cockpit-v2.html`
  et `NEXUS-App-v1.html` montre que l'écrasante majorité sont des commentaires
  `/* */` de développement (historique de décisions, citations directes de
  Frédéric — ex. « demande de Frédéric — "sur mobile, il faut..." »), mais
  **pas toutes** : `nexus-vocabulaire.js`, `NexusVocab.prevision()` produit une
  phrase réellement affichée à l'utilisateur avec un tiret cadratin (« *une
  hypothèse, pas un engagement chiffré* »).
- **305 occurrences** dans la documentation doctrinale/gouvernance elle-même
  (`docs/nexus/`, `docs/gouvernance/`, `docs/adr/`, `docs/handoff/`) — y compris
  `GUARDIAN-PHILOSOPHIE-NEXUS.md`, les commentaires de `outils/guardian-bible.js`
  et `outils/guardian-regles-metier.js`, et la quasi-totalité des échanges
  Claude ↔ Orchestrator de cette issue #28 (ce commentaire inclus).
- **108 occurrences** dans les moteurs (`nexus-*.js`, hors tests), essentiellement
  en commentaire explicatif.

Une règle appliquée littéralement et rétroactivement toucherait donc trois
couches très différentes en nature : (a) du texte réellement lu par l'utilisateur
final sur un écran vivant, (b) de la documentation d'ingénierie interne citant
Frédéric verbatim, (c) le langage même du canal Handoff/Orchestrator. Réécrire
(a) est un vrai chantier produit ; réécrire ou dériver (b)/(c) changerait la
façon dont Claude et l'Orchestrator rédigent ce protocole lui-même.

**Question explicite à trancher, sans la présumer** :

1. La règle s'applique-t-elle seulement au contenu **produit par NEXUS et lu par
   l'utilisateur final** (écrans, messages générés, notifications) — auquel cas
   les commentaires de code, la documentation doctrinale et les échanges Handoff
   en sont exclus par nature, et la seule dette réelle est un sous-ensemble
   d'affichages comme celui de `nexus-vocabulaire.js` ?
2. S'applique-t-elle aussi à **toute nouvelle documentation NEXUS** (Bible,
   ADR, gouvernance, Handoff) à partir de sa date d'adoption, sans réécrire
   l'historique ?
3. S'applique-t-elle rétroactivement à l'existant, ce qui implique un chantier
   de réécriture des 62 écrans avant toute activation bloquante ?

Ce document ne tranche pas et ne câble rien : le faire silencieusement violerait
directement la consigne de ce cadrage (§11 : « ne pas transformer une préférence
historique... sans vérifier son statut » et « ne pas résoudre silencieusement
une contradiction »). Le candidat `LANG-003` reste donc `CANDIDAT_GUARDIAN`
mesuré mais non câblé tant que la portée n'est pas choisie — exactement la
discipline que QA-002 impose déjà pour tout détecteur avant sa mise en CI.

### 4.2 Point mineur, à confirmer plutôt qu'à arbitrer lourdement

`NEXUS-Constitution-v1.md` (Art.12, Art.13) parle encore d'un « Conseiller
NEXUS » unique, remplacé depuis par la scission Directeur d'Exploitation /
Coach Terrain déjà actée dans `BIBLE.md`. La Bible l'emporte déjà par
construction (`CONTINUITY.md` la nomme source doctrinale courante), donc ce
n'est pas un blocage — mais rien ne marque aujourd'hui la Constitution comme
partiellement historique sur ce point précis, contrairement à sa propre note de
révision qui documente déjà deux autres chantiers ouverts (Art.3, Art.11) en fin
de fichier. Proposition : ajouter une note de révision similaire (pas une
réécriture des articles eux-mêmes), sur confirmation simple de Frédéric.

## 5. Propositions (non appliquées)

### 5.1 Bible — ajouts minimaux proposés

Deux lignes à ajouter à la section « Philosophie », rendant explicite ce qui est
déjà vrai en pratique (item 8 et 13 du §1) :

> - Une donnée absente n'est jamais transformée en zéro, conformité ou conclusion positive ; une donnée réellement mesurée à zéro reste dite comme telle.
> - Une décision humaine sensible envers un individu (évaluation, sanction, jugement de performance) n'est jamais déduite automatiquement d'une absence de donnée.

Une phrase de renvoi dans « Agents NEXUS » ou une nouvelle sous-section courte :

> Le vocabulaire officiel et le ton par destinataire sont définis dans `docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md`.

Rien de plus : la Bible reste courte, ces deux lignes couvrent un vrai manque
sans l'alourdir.

### 5.2 Nouveau document doctrine séparé

`docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md`, structuré comme
`DOCTRINE-PROPRIETE-CREATEUR-DONNEES-CLIENTS.md` (déjà le bon modèle dans ce
dépôt) : vocabulaire canonique consolidé (cadrage §4 + `NexusVocab.SIGNATURE`
existant + glossaire prévu/réalisé/test/réel), langage par destinataire (cadrage
§5, déjà bien rédigé, à valider tel quel), et la question du tiret cadratin
**avec sa portée explicitement tranchée** une fois §4.1 arbitré — jamais avant.

### 5.3 Règles Guardian — pas de nouveaux identifiants dupliqués

`PHILO-DATA-001` et `PHILO-TRUTH-006` ne doivent pas devenir de nouvelles
entrées `RULES.json` : ce sont des alias doctrinaux d'`ARCH-001` et de
`guardian-bible.js`, déjà tracés avec leur source. Ajouter un doublon romprait
justement le principe qu'ils protègent (une vérité, un propriétaire). Seul
`LANG-003` est un candidat réel à une future entrée `RULES.json`, une fois
§4.1 tranché.

## 6. Ce qui n'a pas été fait dans ce lot

- Aucune ligne de `BIBLE.md`, `NEXUS-Constitution-v1.md`, `CONTINUITY.md` n'a
  été modifiée : ce sont des propositions.
- Aucun renommage `Conseiller NEXUS` → `Directeur d'Exploitation` dans le code
  ou les écrans : c'est une dette de propagation, pas un correctif Test/QA
  déterministe, elle appartient au Backlog produit.
- Aucun câblage de `LANG-003` : bloqué explicitement en attente d'arbitrage
  de portée (§4.1).
- Aucun changement `main`/`production`, aucune opération Supabase.
