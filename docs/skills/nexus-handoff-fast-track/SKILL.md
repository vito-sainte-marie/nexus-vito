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
7. Frédéric n'est sollicité que pour la liste STOP fermée (voir plus bas) :
   Production/migration/Supabase Production/déploiement, choix métier non
   pré-autorisé, extension substantielle de périmètre, divergence inexpliquée,
   CI rouge nouvelle et inexpliquée, sécurité/RLS/`site_id`, conflit/lease non
   résoluble, preuve obligatoire impossible à obtenir.
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

## Requalification des mouvements

Un mouvement de Production/main/rail n'est pas une anomalie par nature.

Avant STOP :
1. identifier les commits/fichiers/migrations ;
2. attribuer le mouvement à un lot/changement autorisé ;
3. mesurer son impact sur le lot actif ;
4. rafraîchir uniquement les preuves affectées.

Mouvement attribué + invariants intacts = continuer Fast Track.

## STOP humain — liste fermée

Stopper et demander Frédéric uniquement pour :
- opération de fusion/déploiement/promotion Production ;
- migration, écriture, réparation ou mutation Supabase Production ;
- nouvelle décision métier non déjà arbitrée ;
- extension substantielle de périmètre ;
- changement non attribué/inexpliqué ;
- régression CI nouvelle et inexpliquée ;
- conflit/non-fast-forward ou lease divergent non résoluble proprement ;
- violation sécurité/RLS/site_id/multisite ;
- preuve obligatoire impossible à obtenir ;
- modification applicative inattendue hors périmètre.

Ne pas élargir cette liste par prudence abstraite.

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
