# NEXUS Handoff Fast Track Orchestrator

## Mission

Accélérer le Handoff NEXUS. Ce skill est un **accélérateur d'exécution**, jamais une gate supplémentaire.

Principe : **si la prochaine action est autorisée, prouvée et réversible dans le rail, l'exécuter ; ne pas attendre un GO humain redondant.**

## Autorité

Rail canonique : `handoff-continuite-20260920`.

La délégation Fast Track couvre, **réparties entre deux rôles distincts** (voir
« Séparation des rôles » ci-dessous) :
- production, qualification et préparation des preuves d'une `request-N` ;
- matérialisation et consommation canonique des décisions ;
- transport fast-forward propre vers le rail ;
- déclenchement/obtention des preuves CI sur le HEAD exact du rail ;
- poursuite vers la request suivante ;
- requalification des SHA après mouvements attribués ;
- réveil de Claude/ChatGPT quand le protocole l'exige ;
- arbitrage indépendant (émission du GO `decision-N`) d'une `request-N` dont
  l'auteur n'est pas l'arbitre lui-même.

Elle ne couvre jamais implicitement Production ou Supabase Production.

## Séparation des rôles — règle normative

Cette section fixe qui fait quoi. Elle prime sur toute formulation plus
générale du reste de ce skill, et sur toute doctrine Handoff canonique qui
emploierait une formulation équivalente sans nommer l'acteur.

1. **Claude** peut produire une `request-N`, la qualifier, préparer ses
   preuves, matérialiser et consommer une `decision-N` déjà prononcée,
   transporter sous lease et poursuivre la boucle.
2. **Claude ne doit jamais arbitrer ni approuver une `request-N` dont il est
   l'auteur.** Produire la demande et trancher la demande sont deux rôles
   qui ne peuvent jamais être tenus par le même acteur sur le même échange.
3. Pour toute `request-N` dont Claude est l'auteur et qui est couverte par la
   délégation Fast Track de Frédéric, **ChatGPT est l'arbitre indépendant
   pré-autorisé**. Aucune nouvelle confirmation « GO request-N » de Frédéric
   n'est requise si les gates sont vertes et qu'aucun critère STOP n'est
   présent.
4. ChatGPT prononce l'arbitrage automatique ; Claude matérialise ensuite
   cette décision **exclusivement via `outils/handoff.js decision`**. Aucune
   décision Handoff ne doit jamais être créée à la main.
5. Après matérialisation, la boucle continue sans attente : consommation
   canonique -> transport fast-forward sous lease -> preuve CI réelle sur le
   HEAD exact du rail -> request suivante -> réveil de ChatGPT pour arbitrage
   si la nouvelle request est, elle aussi, de Claude. Ne pas rester inactif
   entre ces étapes.
6. Si ChatGPT dispose d'un canal GitHub autorisé pour un transport Handoff
   déjà délégué, une limitation de canal côté Claude ne doit jamais devenir
   une nouvelle gate humaine : chercher le prochain canal autorisé.
7. Frédéric n'est sollicité que pour le **palier Frédéric** de la liste STOP
   (voir plus bas) : Production, Supabase Production, sécurité/RLS/`site_id`,
   secret ou surface de sécurité, boucle armée en son nom, choix métier non
   arbitré, changement de doctrine. Les autres STOP se tranchent par
   l'arbitre, sans lui (doctrine § 3 bis, 07/10/2026).
8. Cette séparation des rôles ne donne **aucune autorité Production**, ni à
   Claude ni à ChatGPT.

## Boucle nominale — chemin court

`REQUEST -> QUALIFY -> DECISION -> CONSUME -> TRANSPORT -> CI -> NEXT REQUEST`

Ne créer aucune étape d'approbation supplémentaire.

### REQUEST
Lire la demande active et les preuves déjà présentes. Ne recalculer que ce qui est devenu obsolète.

### QUALIFY
Contrôle minimal suffisant :
1. HEAD rail exact ;
2. HEAD production/main seulement si pertinent pour les invariants ou si ces refs ont bougé ;
3. CI/gates exigées par le lot ;
4. périmètre des fichiers ;
5. verifier/Guardians uniquement au niveau requis par le lot ;
6. absence de critère STOP.

Réutiliser les preuves fraîches. Ne pas répéter des audits lourds sans cause.

### DECISION
Si la `request-N` est propre (Claude n'en est pas l'auteur) et couverte par la
délégation : l'arbitre (Claude) prononce immédiatement `GO decision-N`.

Si la `request-N` est **de Claude**, Claude ne prononce jamais son propre
arbitrage (règle 2 de « Séparation des rôles ») : ChatGPT est l'arbitre
pré-autorisé (règle 3). Claude réveille ChatGPT si nécessaire, puis
**matérialise** l'arbitrage de ChatGPT — jamais ne l'invente ni ne le
pré-empte — exclusivement via `outils/handoff.js decision` (règle 4). Append-only.

### CONSUME
Consommer immédiatement la décision selon le protocole canonique si aucune anomalie n'apparaît.

### TRANSPORT
Si le candidat est un fast-forward propre et attribué vers le rail :
- vérifier le lease ;
- transporter sans force ;
- si le canal Claude ne peut pas pousser sur le rail mais ChatGPT dispose d'un canal GitHub autorisé, ChatGPT effectue le transport sous lease ;
- ne jamais transformer une limitation de canal en attente humaine si l'opération est déjà déléguée.

### CI
Obtenir la preuve CI réelle sur le HEAD exact du rail lorsqu'elle est requise. Un CI vert sur une branche source ne remplace pas un CI rail si le protocole exige ce dernier.

### NEXT REQUEST
Si les gates sont vertes, publier la request suivante et poursuivre la boucle. Ne pas rester inactif entre deux états autorisés.

## Règle anti-inertie

**Travail en attente + prochaine action autorisée + preuves suffisantes = exécution immédiate.**

Une limitation d'outil/canal doit déclencher la recherche du prochain canal autorisé, pas une demande de GO humain redondante.

Si aucun canal autorisé n'existe, alors seulement signaler le blocage concret.

## Continuité active — anti-pause

Cette section précise la règle anti-inertie ci-dessus : elle fixe comment ne
jamais s'arrêter en silence entre deux étapes déjà autorisées. Elle ne crée
aucune gate supplémentaire — elle interdit seulement l'attente passive là où
le rail a déjà le droit d'avancer.

**Principe : fin d'étape = action suivante ou relais explicite. Jamais
d'attente passive.**

1. À la fin de chaque étape Fast Track, identifier immédiatement le prochain
   acteur et le prochain geste minimal.
2. Si l'acteur courant peut exécuter ce geste dans son autorité et son
   canal : l'exécuter immédiatement.
3. S'il ne peut pas l'exécuter mais que l'autre acteur le peut : le réveiller
   immédiatement, sans demander de nouveau GO à Frédéric.
4. Claude → ChatGPT : réveil obligatoire dès qu'une `request-N` qualifiée dont
   Claude est l'auteur nécessite l'arbitrage indépendant de ChatGPT (règles 2
   et 3 de « Séparation des rôles »).
5. ChatGPT → Claude : réveil obligatoire immédiatement après arbitrage, pour
   matérialisation via `outils/handoff.js decision`, consommation, transport
   et obtention de la preuve CI.
6. Après CI verte, l'acteur qui constate le vert doit enchaîner lui-même vers
   la `request` suivante, ou réveiller immédiatement l'acteur capable de le
   faire. Ne pas rester inactif entre ces étapes.
7. Tout run qui se termine avec du travail Fast Track encore actionnable,
   mais sans exécution ni relais explicite, est une anomalie
   **`FAST_TRACK_PAUSE`** — à éviter, pas à documenter après coup.
8. Une limitation de canal n'autorise jamais l'attente passive : chercher le
   canal autorisé (voir règle anti-inertie et § TRANSPORT) ou transmettre
   immédiatement au bon acteur.
9. Chaque relais porte un `NEXT_ACTION_CONTRACT` complet (section suivante).
   Un relais incomplet n'est pas un relais.
10. Frédéric n'est réveillé que pour un motif du palier Frédéric ci-dessous,
    nommé par son code (`node outils/escalade-humaine.js --motif <CODE>`). Une simple alternance Claude ↔ ChatGPT n'est jamais,
    à elle seule, un motif de retour humain.
11. Ne jamais créer une boucle de réveils sans progrès : chaque relais doit
    correspondre à un changement d'autorité réellement nécessaire, ou à une
    action concrète non encore exécutée. Si le même relais revient sans
    qu'aucun progrès n'ait eu lieu entre les deux occurrences, classer
    **`FAST_TRACK_STALL`** et diagnostiquer la cause technique avant toute
    nouvelle relance — ne pas simplement répéter le même réveil.
12. Cette règle n'ajoute aucune autorité Production ou Supabase Production,
    ni à Claude ni à ChatGPT (inchangé par rapport à « Séparation des
    rôles » § 8 et à la Frontière absolue ci-dessous).
13. `wake_to` est un rôle (« ChatGPT », « Claude »), pas forcément un canal
    postable. `docs/handoff/CANAUX.json` porte sa résolution vers une adresse
    concrète ; `outils/reveil-orchestrateur.js` la lit avant de publier. Un
    rôle sans entrée résolue, ou un destinataire qui est l'acteur courant lui-
    même, est un **`BLOCKED_TECHNIQUE`** (personne à relayer) — à distinguer
    du **`CHANNEL_LIMITATION`** (un relais résolu existe, exécuter sans
    attendre Frédéric). `outils/classification-canal.js` mécanise cette
    distinction ; aucun STOP de la liste fermée n'est jamais contourné par un
    canal qui marche (GOV-006, FAST-TRACK-ANTI-PAUSE-1-20261007).

## Fast Track v2 — relais, preuves, file de travail

Arbitrage ChatGPT v2, transmis par Frédéric le 07/10/2026. Principe : v2
retire plus d'étapes qu'elle n'en ajoute. Aucune nouvelle plateforme.

**NEXT_ACTION_CONTRACT** — le relais universel. Les champs sont générés par
`outils/escalade-humaine.js` (`CHAMPS_CONTRAT`) et envoyés dans chaque réveil :
`DECISION`, `CLOSES`, `LOT`, `REQUEST`, `HEAD`, `LEASE`, `GATE_STATE`,
`PROOF_STATE`, `CONDITIONS`, `BLOCKER`, `STOP_REQUIRED`, `CAPACITE_REQUISE`,
`OWNER_NEXT`, `EXECUTANT_NEXT`, `ACTION_NEXT`. ChatGPT décide et rend le contrat ; Claude matérialise par
`outils/handoff.js decision --auteur ChatGPT --decision <DECISION> --closes
<CLOSES> --wake-to <OWNER_NEXT>`. Traductions : HOLD → `NEEDS_EVIDENCE` ;
STOP_REQUIRED → `BLOCKED` avec `OWNER_NEXT: Frédéric` et un code du palier
Frédéric.

**CAPACITE_REQUISE / EXECUTANT_NEXT — ajoutés le 09/10/2026.** Un rôle dit
qui tranche ; une capacité dit qui peut agir. Le contrat ne nommait qu'un
rôle, et l'incident G1 du 09/10/2026 est né là : le GO Production était
donné, `OWNER_NEXT` disait `Frédéric`, et le GO est revenu par un
commentaire d'issue — donc dans `claude.yml`, le seul canal dont l'enveloppe
Supabase est Test en lecture seule. La décision était juste, le destinataire
incapable de l'exécuter. Les capacités de chaque canal sont désormais
déclarées et prouvées dans `docs/handoff/CAPACITES-CANAL.json`, lues par
`outils/capacites-canal.js`. `outils/classification-canal.js` pose la
question en quatrième position — après le STOP, avant le destinataire : un
geste qu'un AUTRE canal peut exécuter rend `CHANNEL_LIMITATION`, jamais
`BLOCKED_TECHNIQUE`, car ce qu'il faut n'est pas une décision mais un
exécutant. Une capacité déclarée `OUI` sur un pouvoir sensible exige une
preuve nommée ; l'enveloppe par défaut ne couvre que les `NON`.
`node outils/capacites-canal.js --geste <MOTIF_STOP>` nomme l'exécutant :
entre deux canaux capables, le palier humain passe en dernier —
`PALIER_HUMAIN_RESTREINT` interdit de réveiller Frédéric pour un geste qu'un
autre canal sait faire ; quand il est le seul capable, c'est une vraie gate
humaine et le routage le dit.

**Gates.** G0 : information, aucun arrêt. G1 : contrôle local, Claude. G2 :
arbitrage, ChatGPT. G3 : Frédéric, uniquement pour le palier Frédéric.

**MINIMIZE_HANDOFFS / MAX_SAFE_BATCH.** Un relais par changement d'autorité,
jamais par étape. Regrouper dans une seule request tout ce qui partage le même
TOUCH_SET (fichiers touchés) et la même gate ; séparer ce qui touche une
migration, la sécurité ou un autre module.

**PROOF_CACHE.** Une preuve reste `PROOF_VALID` tant qu'aucun fichier de son
domaine n'a changé. Un changement la rend `PROOF_REFRESH_REQUIRED` pour ce
domaine seulement : `docs/handoff/**` n'invalide pas une preuve Paye ou FDJ. Un
fichier de migration modifié la rend `PROOF_INVALIDATED`.

**PROGRESS_FINGERPRINT.** LOT + REQUEST + HEAD + GATE_STATE + BLOCKER +
ACTION_NEXT. Le même fingerprint deux fois de suite donne `FAST_TRACK_STALL` :
diagnostiquer la cause racine avant tout nouveau réveil (règle 11). Câblé le
09/10/2026 par `outils/empreinte-progression.js`, dont la marque
`<!-- nexus-empreinte: … -->` voyage dans le commentaire publié : l'historique
du canal suffit donc à répondre, sans mémoire d'agent. Jusque-là la règle
n'existait qu'ici, en prose, et la seule garde câblée portait sur le TEXTE du
réveil — qu'une ref de plus porte la demande, et le corps changeait, et le
même réveil repartait sur un Handoff immobile. `HEAD` est pris comme le
dernier commit du DOMAINE `docs/handoff/**`, non comme le SHA du push : pris
au push, il changerait à chaque commit et la garde ne mordrait jamais. C'est
la portée par domaine que PROOF_CACHE applique déjà aux preuves.

**WORK_QUEUE et PRODUCT_FIRST.** Ordre de la file : P1 Paye, P2 Cockpit &
Brief, P3 FDJ, P4 Client en compte, P5 Verify, P6 Planning, P7 Carburants, P8
Inventaire, P9 Pointage. Un chantier en attente (`WAIT_AUTHORITY`,
`WAIT_EXTERNAL`) ne bloque pas le suivant (`ACTIONABLE`). Après une correction
de gouvernance : FIX → PROOF → RETURN_TO_PRODUCT. Le travail Handoff n'est
jamais une fin en soi. Une file sans geste actionnable ne se comble pas par du
travail inventé : l'état se dit, et on attend l'apport terrain.

## Requalification des mouvements

Un mouvement de Production/main/rail n'est pas une anomalie par nature.

Avant STOP :
1. identifier les commits/fichiers/migrations ;
2. attribuer le mouvement à un lot/changement autorisé ;
3. mesurer son impact sur le lot actif ;
4. rafraîchir uniquement les preuves affectées.

Mouvement attribué + invariants intacts = continuer Fast Track.

## STOP — liste fermée, deux paliers

Le routage fait foi dans `docs/handoff/ARBITRAGES-ACQUIS.json` (`routage`) ;
`outils/escalade-humaine.js` le mécanise et l'épreuve
`test_escalade_humaine_20261007.js` refuse tout motif fermé non routé.

**Palier Frédéric** — stopper et le réveiller uniquement pour :
- opération de fusion/déploiement/promotion Production ;
- migration, écriture, réparation ou mutation Supabase Production ;
- violation sécurité/RLS/site_id/multisite ;
- secret, permission, ou élargissement de la surface de sécurité ;
- armement d'une boucle automatique agissant au nom de Frédéric ;
- nouvelle décision métier non déjà arbitrée ;
- changement de doctrine ou de philosophie NEXUS ;
- opération irréversible significative ;
- divergence d'autorité inexpliquée ;
- régression produit importante restée inexpliquée après diagnostic.

**Palier arbitre** — stopper la boucle, mais l'arbitre (ChatGPT) tranche :
- extension substantielle de périmètre ;
- changement non attribué/inexpliqué ;
- régression CI nouvelle et inexpliquée ;
- conflit/non-fast-forward ou lease divergent non résoluble proprement ;
- preuve obligatoire impossible à obtenir ;
- modification applicative inattendue hors périmètre.

L'arbitre remonte au palier Frédéric seulement en nommant le motif codé qui
l'y autorise. Une inquiétude sans code reste chez l'arbitre.

Ne pas élargir cette liste par prudence abstraite.

## Arbitrages acquis — ne jamais reposer une question tranchée

Avant toute demande d'arbitrage à Frédéric, consulter
`docs/handoff/ARBITRAGES-ACQUIS.json`. Une question qui y figure reçoit la
réponse inscrite, citée par son identifiant (`DEJA_ARBITRE`). Le réveil
Orchestrateur envoie ce registre à l'arbitre à chaque fois ; les consignes à
coller dans le projet ChatGPT sont dans `ARBITRE-CHATGPT.md`, à côté de ce
fichier. Un acquis s'ajoute en citant une décision déjà écrite ailleurs, jamais
en l'inventant dans le registre.

## Fast Track multisite

Priorités : NEXUS Paye ; moteur Cockpit & Brief ; FDJ ; Client en compte ; Verify ; Planning ; Carburants ; Inventaire ; Pointage.

Les lots indépendants ne doivent pas être sérialisés artificiellement.

Qualification : `NON_QUALIFIE -> TESTE -> RECETTE_TERRAIN -> SITE_READY`.

Un module en attente de recette terrain ne bloque pas un autre module indépendant.

Avant `SITE_READY` : prouver isolation `site_id`, RLS, paramétrage par site, absence d'hypothèse Sainte-Marie Usine implicite, compatibilité migrations et parcours critique.

## Discipline de concentration

- privilégier le prochain geste minimal qui débloque le rail ;
- ne pas lancer d'audit global lorsqu'un contrôle ciblé suffit ;
- ne pas rouvrir une décision déjà canonique ;
- ne pas confondre preuve et nouvelle gate ;
- ne pas demander à Frédéric d'exécuter une opération que le canal autorisé peut effectuer ;
- regrouper les contrôles indépendants quand possible ;
- signaler à Frédéric uniquement les changements significatifs ou STOP réels ;
- conserver les SHA/run IDs nécessaires à la traçabilité, sans produire de bruit opérationnel.

## Frontière absolue

Aucune instruction de ce skill n'autorise automatiquement :
- merge vers `production`;
- déploiement Production ;
- mutation Supabase Production ;
- migration Production ;
- réparation/écriture Production.

## Critère de succès

Le skill fonctionne correctement lorsque le rail avance sans attente humaine entre deux étapes déjà déléguées, que les contrôles restent proportionnés au risque, et que Frédéric n'est interrompu que pour une décision réellement réservée.
