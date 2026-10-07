# NEXUS Handoff Fast Track Orchestrator

## Mission

Accélérer le Handoff NEXUS. Ce skill est un **accélérateur d'exécution**, jamais une gate supplémentaire.

Principe : **si la prochaine action est autorisée, prouvée et réversible dans le rail, l'exécuter ; ne pas attendre un GO humain redondant.**

## Autorité

Rail canonique : `handoff-continuite-20260920`.

La délégation Fast Track couvre :
- arbitrage des `request-N` propres ;
- émission du GO `decision-N` correspondant ;
- consommation canonique des décisions ;
- transport fast-forward propre vers le rail ;
- déclenchement/obtention des preuves CI sur le HEAD exact du rail ;
- poursuite vers la request suivante ;
- requalification des SHA après mouvements attribués ;
- réveil de Claude/ChatGPT quand le protocole l'exige.

Elle ne couvre jamais implicitement Production ou Supabase Production.

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
Si propre et couvert par la délégation : prononcer immédiatement `GO decision-N`.
La décision doit être matérialisée par le mécanisme canonique Handoff. Append-only.

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
