# Matrice des variantes de la boucle Handoff V2

Préparée par Claude Guardian le 19/10/2026. **Lecture seule. Mise à jour le 19/10/2026 avec les propositions de conception de ChatGPT, à confirmer par Frédéric (`PROPOSITIONS-CONCEPTION-20261019.md`) : lignes E10, E11, D2, D6, D8, D11, D12.**

**À quoi elle sert.** C'est la colonne vertébrale de la mise en œuvre :
- chaque comportement de la V2 répond à une ligne ;
- chaque ligne aura son essai ;
- rien n'est déclaré opérationnel tant que sa ligne n'est pas verte au banc.

**Les sources de la colonne « Aujourd'hui »** sont mesurées, pas supposées :
- l'audit de la boucle du 18/10 ;
- l'inventaire de gouvernance ;
- le diagnostic de raccordement du 19/10.

**Légende de la colonne « Aujourd'hui » :**
- ✅ conforme et prouvé ;
- 🟡 partiel ;
- ❌ absent ou contraire ;
- ❔ non vérifié.

**Les références « R » et « GOV »** renvoient aux lots du plan révisé et du plan de conformité.

---

## 0. Invariants : valables pour toutes les lignes

| ID | Invariant | Aujourd'hui |
|---|---|---|
| I1 | Le rail est la seule source d'autorité. Un GO de conversation n'existe qu'une fois déposé | ❌ 3 écritures Test sur GO de conversation (POMPISTE ×2, JOURNAL-PISTE) |
| I2 | Aucune exécution sans décision canonique antérieure | ❌ même constat |
| I3 | Aucun acteur n'élargit une décision reçue | ❌ aucune empreinte de décision, aucun contrôle de domaine |
| I4 | Une décision n'est attribuée qu'à son véritable auteur : arbitre (API), ou Frédéric (son identité) | ❌ décision « humaine » poussée sous identité partagée (`851f31bd`) |
| I5 | Tout arrêt est signalé, sauf repos justifié et listé | ❌ aucun mécanisme de détection (watchdog sans déclencheur). Le nombre d'arrêts silencieux survenus n'est pas mesurable ; « 9 » est le nombre de types d'arrêt relevés dans le code |
| I6 | Un événement ne produit qu'une exécution | 🟡 dépôt protégé ; arbitrages doublés 3 fois |
| I7 | Rien ne touche la Production ni ne contourne une approbation humaine | 🟡 rien n'est arrivé, mais aucun verrou technique (0 approbation, identités partagées) |
| I8 | Un lot a un domaine et un acteur, et n'est modifié que par lui | ❌ champs absents |
| I9 | Un constat de Guardian n'est jamais une décision | ❔ règle absente, aucun essai |
| I10 | Chaque garde est prouvée en la cassant | 🟡 la plupart des gardes ont des mutations ; plusieurs sont dormantes |

---

## 1. Le cycle nominal : états et transitions

Chaque état a :
- un responsable ;
- une sortie normale ;
- un délai au-delà duquel la vigie alerte ;
- une voie de reprise.

| ID | État | Responsable | Sortie normale | Délai d'alerte (proposé) | Reprise si dépassé | Aujourd'hui |
|---|---|---|---|---|---|---|
| E1 | Demande en préparation | Claude Code | Demande publiée sur le rail | aucun (travail) | sans objet | ✅ |
| E2 | Demande publiée, réveil à faire | CI | Réveil publié sur #28 | 10 min | Alerte, puis nouveau run | 🟡 réveil bloqué sans alerte (`wake_to` absent) |
| E3 | Réveil publié, arbitrage à faire | CI (relais) → arbitre API | Réponse de l'arbitre sur #28 | 15 min | Alerte, puis nouvel essai unique | 🟡 relais en échec : alerte ; relais non armé : silence |
| E4 | Réponse reçue, dépôt à faire | CI (matérialisation) | `decision-N.md` sur le rail, avec empreinte | 10 min | Nouveau dépôt depuis la réponse sur #28 | ❌ aucun nouveau dépôt après échec ; pas d'empreinte |
| E5 | Décision déposée, exécutant à prévenir | CI (juge) | Relance de l'exécutant désigné, ou repos justifié | 10 min | Alerte | 🟡 5 refus du juge silencieux |
| E6 | Exécutant prévenu, prise en charge | Claude relancé ou Claude Code | Prise en charge inscrite au registre | 30 min (relancé), 4 h (Claude Code) | Alerte, puis nouvel essai unique | ❌ aucun contrôle de réception du dispatch |
| E7 | Exécution en cours | Exécutant | Travail poussé, avec provenance (qui, quand, quel GO, empreinte) | selon le lot | Alerte | ❌ aucune provenance d'exécution |
| E8 | Exécution terminée, consommation à faire | Exécutant | Décision consommée avec preuve d'action | 30 min | Alerte | 🟡 tour vide surveillé ; tour partiel non surveillé |
| E9 | Lot non clos, demande suivante à faire | Exécutant | Nouvelle demande | 30 min | Alerte | ❌ tour sans suite non surveillé |
| E10 | Décision de clôture déposée | CI | Clôture consommée après vérification formelle (contrat, empreintes, preuves attendues), lot libéré ; aucun jugement métier par la CI | 10 min | Consommation automatique | 🟡 consommées, 29 sur 29 depuis le 08/10 (délai de 0 à 7,9 h, mesuré sur `STATE.json` le 19/10) ; mécanisme et auteur de la consommation non attribués ; aucune vérification d'empreinte. L'affirmation antérieure « 15 clôtures jamais consommées » était fausse |
| E11 | Attente d'une décision de Frédéric | Frédéric | Décision déposée sous son identité, avec contrat | 2 h ; rappel à 8 h | Rappel, jamais de décision par défaut | ❌ aucune reprise après sa décision (21 arrêts adressés à Frédéric selon le script, à qualifier, voir `docs/guardian/preuves/MESURES-REFERENCE-20261008-20261018.md`) |
| E12 | Contrôle sémantique | Guardian | Constat publié (conforme, ou écart) | 24 h | Alerte de la vigie | ❌ Guardian non raccordé |

---

## 2. Variantes de décision de l'arbitre

| ID | Contrat rendu | Comportement attendu | Qui agit ensuite | Qui est prévenu | Aujourd'hui | Correction |
|---|---|---|---|---|---|---|
| D1 | APPROVED, sans clôture, exécutant déclenchable | Dépôt, relance, exécution | Claude relancé | personne | ✅ 9 tours complets | R2 (empreinte) |
| D2 | APPROVED avec clôture, sans action restante | Dépôt ; consommation automatique seulement si le contrat, les empreintes et les preuves attendues sont vérifiés ; sinon renvoi à l'arbitre ; lot libéré | CI | personne | 🟡 consommées, 29 sur 29 depuis le 08/10 (délai de 0 à 7,9 h, mesuré sur `STATE.json` le 19/10) ; mécanisme et auteur de la consommation non attribués ; aucune vérification d'empreinte | GOV-07, E10 |
| D3 | APPROVED avec clôture, action restante | Relance pour l'action, puis consommation | Exécutant | personne | 🟡 même constat que D2 | GOV-07 |
| D4 | APPROVED_WITH_CONDITIONS | Relance ; les conditions doivent être prouvées dans la demande suivante | Exécutant | personne | 🟡 preuve des conditions contrôlée, avec des lectures divergentes | GOV-04 |
| D5 | NEEDS_EVIDENCE | Relance avec la liste des preuves à fournir ; pas d'exécution sur base | Claude Code | personne | 🟡 traité comme un verdict ordinaire | GOV-04 |
| D6 | BLOCKED, motif délégué à l'arbitre sur preuve de sécurité | Arrêt ; correction demandée à l'exécutant ; aucun réveil de Frédéric | Claude Code | Guardian (constat) | ❌ envoyé à Frédéric par la matérialisation | GOV-04 |
| D7 | BLOCKED, motif du palier de Frédéric | Arrêt ; Frédéric prévenu, avec la question et le geste attendu | Frédéric (E11) | Frédéric (Telegram) | 🟡 alerte envoyée ; aucune reprise ensuite | R7, E11 |
| D8 | Exécutant hors registre (« Claude », etc.) | Refus, nouvel arbitrage explicite unique, puis arrêt avec anomalie tracée ; jamais de correction par la CI | CI | Frédéric si second échec | 🟡 accepté par le relais, refusé en silence par le juge | GOV-04 |
| D9 | Exécutant valide mais non déclenchable (Claude Code) | Ajout à la file « actions pour Claude Code », plus notification | Claude Code | Claude Code (file et Telegram) | 🟡 Telegram seul ; pas de file | R6 |
| D10 | Capacité demandée sans ordre | Refusé dès la publication de la demande, pas au dépôt | Claude Code | Claude Code (refus local) | ❌ détecté au dépôt (3 fois) | GOV-04 |
| D11 | Contrat non conforme (forme) | Refus, nouvel arbitrage explicite unique, puis arrêt avec anomalie tracée | CI | Frédéric si second échec | 🟡 alerte, sans nouvel essai | R2, GOV-04 |
| D12 | « Pas de STOP » écrit différemment (`none`, `n/a`, `-`) | Une seule valeur admise, fixée au registre et lue de la même façon par toutes les gardes ; toute autre graphie est refusée (traitée comme D11), jamais normalisée en silence | CI | personne | ❌ 4 définitions, verdicts opposés | GOV-04 |
| D13 | L'arbitre ne peut pas lire le rail (RAIL_LU INACCESSIBLE) | NEEDS_EVIDENCE et nouveau réveil intégral | CI | Guardian (constat) | 🟡 relais en échec le 13/10 | GOV-04 |
| D14 | Même verdict répété (arbitre bloqué en boucle) | Arrêt au second verdict identique ; alerte | CI | Frédéric | ✅ contrôle présent (seuil 1) | aucune |

---

## 3. Variantes selon le type d'action

| ID | Action autorisée | Exécutant | Contrôles avant d'agir | Aujourd'hui | Correction |
|---|---|---|---|---|---|
| A1 | Code et tests seulement (rail) | Claude relancé ou Claude Code | Domaine du lot ; preuve d'action | 🟡 pas de contrôle de domaine | GOV-05 |
| A2 | Documentation ou registre | Claude relancé ou Claude Code | Domaine ; pas de règle active modifiée sans lot de gouvernance | 🟡 | GOV-05 |
| A3 | Mécanique de la boucle (`tests.yml`, outils Handoff) | Guardian prépare, Claude Code ou relancé dépose | Domaine « mécanique » ; mutations ; banc | ❌ tout agent peut la modifier | GOV-05 |
| A4 | Gouvernance (mandat, registres d'autorité) | Lot de gouvernance | GO de Frédéric ; CODEOWNERS | ❌ mandat modifiable par tout agent | R7 |
| A5 | Écriture de données sur Test | Claude Code (voie B plus tard) | Ordre consommé, postérieur au verdict, empreinte du SQL | ❌ 3 écritures avant décision | GOV-06 |
| A6 | Permission ou RLS sur Test | Claude Code | A5 + dossier de preuves complet (base jetable, refus, mutations, inventaire des droits, retour arrière) | ❌ dossier non exigé par le code | GOV-06 |
| A7 | Opération irréversible sur Test | Hors délégation : Frédéric | Champ `REVERSIBILITE` ; remontée obligatoire | ❌ champ absent | GOV-06 |
| A8 | Fusion vers `main` ou `production` | Frédéric (approbation) | PR + CI verte + approbation de son identité | ❌ 0 approbation requise | GOV-01, GOV-02 |
| A9 | Opération Supabase Production | Frédéric | Connecteurs d'agents sans accès Production | ❌ deux agents y ont accès en écriture | GOV-03 |
| A10 | Déploiement | Frédéric | Validation de l'environnement | ❔ réglage non lisible | GOV-02 |
| A11 | Constat de Guardian | Guardian | Seulement sur l'issue « Constats » ; aucun effet sur le registre | ❌ voie inexistante | R0, R1 |

---

## 4. Variantes d'indisponibilité

| ID | Qui est indisponible | Comportement attendu | Rien ne doit se perdre parce que… | Aujourd'hui | Correction |
|---|---|---|---|---|---|
| X1 | GitHub Actions (panne, file d'attente) | Rien n'avance ; la vigie détecte l'absence de run après un push | Le registre et le journal sur le rail font foi ; reprise au prochain run | ❌ pas de vigie | R4 |
| X2 | API OpenAI (panne, délai) | Relais en échec, alerte, nouvel essai au prochain run | La demande reste en ATTENTE_DECISION | 🟡 alerte ; pas de nouvel essai programmé | R4 |
| X3 | Telegram (panne, secret absent) | La vigie consigne l'alerte non remise, et Guardian la reprend dans son résumé | Journal des alertes, avec preuve de remise | ❌ simple avertissement, sans preuve de réception | R3, R4 |
| X4 | Claude relancé (session en échec, quota) | Alerte de fin de tour ; un nouvel essai, puis renvoi vers Claude Code | Décision non consommée, visible par la vigie | ❌ échec silencieux | GOV-07 |
| X5 | Claude Code absent (Mac éteint, pas de session) | Les actions de la file attendent ; rappel quotidien | File « actions pour Claude Code » sur le rail | ❌ pas de file | R6 |
| X6 | Guardian absent | La boucle continue (hors chemin critique) ; résumé rattrapé au retour | Journal des transitions | 🟡 conforme par construction (Guardian hors du chemin), non prouvé par recette | R3 |
| X7 | La vigie elle-même est morte | Guardian constate l'absence du signal de vie et alerte | Signal de vie quotidien | ❌ pas de vigie | R4, R5 |
| X8 | Frédéric absent (nuit, déplacement) | Les lots de son palier attendent ; les autres continuent ; rappel | Un lot en attente ne bloque que lui-même | 🟡 « un seul lot actif » bloque tout | GOV-04 (file d'attente des lots) |
| X9 | Arbitre conversationnel (contre-audit) indisponible | Aucun effet sur la boucle | Il n'est pas dans la boucle | 🟡 conforme par construction, non prouvé par recette | aucune |

---

## 5. Variantes d'incident

| ID | Incident | Comportement attendu | Aujourd'hui | Correction |
|---|---|---|---|---|
| N1 | CI rouge après dépôt de la décision | Aucune relance ; alerte ; reprise au prochain run vert | ❌ arrêt silencieux (`CI_ROUGE`) | GOV-07 |
| N2 | CI verte au moment de la relance, rouge après | La relance attend la fin des gardes | ❌ relance lue avant les gardes | GOV-07 |
| N3 | Conflit de push au dépôt (rail avancé) | Nouveau dépôt automatique au run suivant | ❌ relance manuelle (3 tentatives le 10/10) | R2 |
| N4 | Deux runs simultanés | Un seul réveil, un seul arbitrage, un seul dépôt | 🟡 dépôt protégé ; arbitrages doublés | R3 |
| N5 | Relais déclenché depuis une branche hors rail | Refusé | ❌ 4 cas | GOV-04 |
| N6 | Décision modifiée après dépôt | Refus par empreinte | ❌ non détecté | R2 |
| N7 | Décision « humaine » sous identité d'agent | Refus | ❌ non détecté | R1 |
| N8 | Décision sans contrat d'action | Refus au dépôt | ❌ 4 cas acceptés | R1, GOV-04 |
| N9 | Demande sans adresse de réveil (`wake_to`) | Refus à la publication | ❌ arrêt silencieux (ETAPE3) | GOV-07 |
| N10 | Exécution sans ordre, ou avant le verdict | Refus avant l'écriture | ❌ 3 cas | GOV-06 |
| N11 | Exécutant différent de celui désigné | Refus ; constat de Guardian | ❌ non contrôlé | GOV-05, R3 |
| N12 | Preuve qui ne mesure pas ce qu'elle annonce | Constat de Guardian ; NEEDS_EVIDENCE au tour suivant | 🟡 détecté à la main (faux KO de la preuve Journal Piste) | E12 |
| N13 | Garde dont l'épreuve ne peut pas échouer | Refus en CI (guardian-qa) | ✅ guardian-qa actif | aucune |
| N14 | Garde masquée par `|| true` alors qu'elle échoue | Constat de Guardian ; décision de calibrer ou de bloquer | ❌ `guardian-bible`, 11 constats masqués | GOV-03 (inventaire des gardes) |
| N15 | Plafond quotidien atteint | Arrêt et alerte ; comptage des relances, pas des décisions | 🟡 compte la mauvaise chose | GOV-04 |
| N16 | Tour vide | Alerte ; décision non consommée | ✅ depuis le 15/10 | aucune |
| N17 | Tour partiel (consommation sans suite) | Alerte | ❌ | GOV-07 |
| N18 | Mandat de l'arbitre modifié hors gouvernance | Refus (CODEOWNERS) | ❌ | R7 |
| N19 | Guardian tente de décider, consommer ou clore | Refus | ❔ aucun essai | R1, I9 |
| N20 | Lot pris par deux acteurs | Refus | ❌ | GOV-05 |
| N21 | Agent qui pousse sur `main` ou `production` | Refus | 🟡 PR obligatoire, mais fusion sans approbation possible | GOV-02 |
| N22 | Accès Supabase hors périmètre d'un acteur | Refus par le connecteur | ❌ | GOV-03 |
| N23 | Délai du relais dépassé pendant un nouvel arbitrage | Délai suffisant ; un seul nouvel arbitrage | 🟡 5 min pour deux appels jusqu'à 180 s | GOV-04 |
| N24 | Lot actif ancien bloquant tout nouveau lot | Lots en file ; seul le lot concerné attend | ❌ un seul lot actif au total | GOV-04 |

---

## 5 bis. Lignes ajoutées après contre-audit (19/10/2026)

Aucune n'a encore d'essai. Toutes sont non vérifiées (❔).

| ID | Variante | Attendu | Aujourd'hui | Lot |
|---|---|---|---|---|
| N25 | Exécution hors rail régularisée après coup (cas de l'étape 5 : SQL exécuté hors session, GO invérifiable) | Refus ou signalement ; régularisation tracée avec exécutant, heure, cible et GO | ❔ incident ouvert, non instruit | R3 |
| N26 | Chaîne `@claude` dans un constat Guardian (essai J) | Aucun job lancé par la mention d'un texte de Guardian | ❔ `claude.yml` de `main` filtre sur l'auteur ; non essayé | R1 |
| N27 | Forme canonique d'une décision humaine | Un format unique, vérifié, rattaché à l'identité de Frédéric | ❔ | R1, R2 |
| N28 | Retour arrière d'un lot exécuté | Procédure décrite, décision et trace | ❔ | à cadrer |
| N29 | Clé OpenAI expirée ou quota épuisé | Arrêt signalé, aucune décision fabriquée | ❔ | R4 |
| N30 | Divergence entre le rail et `production` | Détectée et signalée | ❔ | R4 |

## 5 ter. Compléments de lecture

**Cas particuliers.** Certaines lignes d'incident sont des cas particuliers d'un invariant ou d'une action : N6 de I3, N7 de I4, N19 de I9, N21 de I7, A9 de N22. Ce ne sont pas des doublons : chaque exigence garde son propre essai. Par exemple, l'essai de N6 (décision modifiée après dépôt) ne prouve pas le contrôle de domaine exigé par I3.

**Priorité.** *Bloquant V2* : I1 à I4, I7, I9, N6, N7, N19, N21, N22, N25. Les autres lignes sont *à surveiller* jusqu'à décision contraire de Frédéric. Cette répartition est une proposition.

**Ordre.** E11 se traite après N7 (il faut une décision humaine fiable avant de reprendre). D2 et E10 se traitent après R2 (empreinte de décision).

**Délais.** Les délais d'alerte de la colonne « Délai » sont proposés, pas mesurés. Ils sont à calibrer sur des durées réellement mesurées, que le journal Live ne fournit pas aujourd'hui.

**Essais.** Les essais de la matrice sont à regrouper par mécanisme de garde (une vingtaine de familles) plutôt qu'à écrire ligne par ligne.

**Sources et dates.** Chaque statut « Aujourd'hui » date du 19/10/2026 et provient des trois sources listées en tête (audit du 18/10, inventaire de gouvernance, diagnostic du 19/10). Une ligne dont la source n'est pas retrouvée est à lire comme ❔.

**Codes d'arrêt et propriétaires (D6, D7).** Table à établir en R3 : pour chaque code d'arrêt, le code, sa cause, qui le traite, qui est réveillé. Propriétaires **à désigner** ; aucun n'est affirmé ici.

---

## 6. Bilan

| Bloc | Lignes | ✅ | 🟡 | ❌ | ❔ |
|---|---|---|---|---|---|
| Invariants | 10 | 0 | 3 | 6 | 1 |
| Cycle nominal | 12 | 1 | 5 | 6 | 0 |
| Décisions | 14 | 2 | 9 | 3 | 0 |
| Actions | 11 | 0 | 2 | 8 | 1 |
| Indisponibilités | 9 | 0 | 4 | 5 | 0 |
| Incidents | 24 | 2 | 5 | 16 | 1 |
| Lignes ajoutées (5 bis) | 6 | 0 | 0 | 0 | 6 |
| **Total** | **86** | **5** | **28** | **44** | **9** |

Ce bilan remplace celui de 80 lignes (7 ✅ / 23 🟡 / 47 ❌ / 3 ❔). Écarts : E10, D2 et D3 passent de ❌ à 🟡 (clôtures consommées, 29 sur 29 depuis le 08/10, mécanisme non attribué, mesure du 19/10) ; X6 et X9 passent de ✅ à 🟡 (non prouvés par recette) ; six lignes ajoutées.

**Ce que montre ce bilan :** la boucle actuelle tient sur le chemin nominal (D1, D14, N16). Elle est faible sur trois points :
- **ce qui suit une décision :** clôtures, décisions humaines, reprise (E10, E11, D2, D3) ;
- **ce qui se passe hors de la vue de la CI :** indisponibilités, vigie ;
- **l'attribution :** identités, provenance, empreintes.

**Ordre de traitement que la matrice suggère.** Il recoupe le plan révisé :
1. **Verrous d'identité et d'accès** (R1, GOV-01 à GOV-03) : ils conditionnent I4, I7, A8, A9, N7, N21, N22.
2. **Empreinte et journal** (R2, R3) : I3, I6, N3, N4, N6, et toute la colonne « reprise ».
3. **Source unique** (GOV-04) : D4 à D13, N5, N8, N15, N23, N24.
4. **Vigie et alertes** (R4, GOV-07) : E2 à E10, X1 à X7, N1, N2, N9, N17.
5. **Contrôles d'exécution** (GOV-05, GOV-06) : A1 à A7, N10, N11, N20.
6. **Guardian raccordé** (R5) et **canal vers Claude Code** (R6) : E12, D9, X5, N12.

**Critère de passage en V2 :** les 86 lignes au vert sur le banc, sauf les lignes explicitement acceptées comme « hors périmètre » par décision de Frédéric.
