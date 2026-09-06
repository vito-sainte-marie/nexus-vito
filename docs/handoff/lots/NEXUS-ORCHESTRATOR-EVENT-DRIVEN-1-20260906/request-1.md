protocol: nexus-handoff/2
lot_id: NEXUS-ORCHESTRATOR-EVENT-DRIVEN-1-20260906
type: architecture-and-implementation-request
branch: config-par-environnement
environment: TEST_ONLY
requested_by: Frederic Bragance

# Objet
Faire évoluer NEXUS Orchestrator vers une architecture event-driven, avec watchdog horaire conservé comme filet de sécurité, et intégrer la conformité à la philosophie NEXUS comme garde transversale obligatoire.

# Principe constitutionnel à appliquer
NEXUS automatise tout ce qui peut être détecté, vérifié, transmis ou exécuté de manière fiable. L'attention humaine est réservée aux exceptions, arbitrages et décisions où le jugement humain crée réellement de la valeur.

Question Guardian obligatoire pour toute évolution : « Pourquoi un humain doit-il intervenir ici ? » Si aucune justification forte n'existe, la conception doit être revue.

# Objectifs
1. Définir puis implémenter le rail événementiel minimal sûr pour réveiller/orienter le workflow dès qu'un événement GitHub pertinent est matérialisé, sans attendre le prochain polling horaire.
2. Conserver l'Orchestrator horaire comme watchdog/réconciliation afin de détecter événement perdu, état incohérent ou lot bloqué.
3. Rendre le traitement idempotent : un même événement/décision/commit ne doit jamais déclencher deux exécutions équivalentes.
4. Prévenir toute boucle automatique Claude ↔ Orchestrator.
5. Toujours relire STATE.json + lot + décision canonique avant action : un événement réveille, il n'autorise jamais à lui seul.
6. Fail closed si état canonique contradictoire, événement insuffisant ou autorisation absente.
7. Intégrer une garde « Philosophie NEXUS » transversale au workflow de conception/revue : simplicité, automatisation par défaut, humain par exception, absence de double saisie/surveillance inutile, explicabilité, bonne attribution de la décision, prévention de la dérive ERP et contrôle de la complexité cumulative.
8. Donner au Guardian philosophie un veto : CI verte ou code techniquement correct ne suffit pas si l'évolution viole la philosophie NEXUS.
9. Réduire explicitement les sollicitations de Frédéric aux seules gates humaines à valeur réelle : règle métier inconnue, arbitrage stratégique, risque juridique/sécurité majeur, opération irréversible ou autorisation Production.

# Événements à étudier/couvrir
- retour Claude / nouveau request-N.md canonique ;
- nouveau commit Handoff pertinent ;
- fin de CI / changement de statut de contrôle ;
- changement pertinent de PR/lot ;
- autres événements strictement nécessaires démontrés par l'audit d'architecture.

# Critères d'acceptation
- preuve Test qu'un événement pertinent peut déclencher la suite autorisée sans attendre le watchdog horaire ;
- preuve qu'un doublon du même événement n'entraîne pas une seconde action ;
- preuve qu'un événement non autorisant ne contourne pas STATE/decision ;
- preuve anti-boucle ;
- preuve fail-closed ;
- watchdog horaire maintenu ;
- Guardian philosophie documenté et intégré au chemin de validation ;
- aucun besoin de surveillance manuelle de Frédéric dans le flux nominal ;
- documentation de l'architecture, des événements, états, gates et procédures de reprise ;
- tests/CI verts avant demande de clôture.

# Invariants absolus
- aucun changement main ;
- aucun changement production ;
- aucune opération Supabase Production ;
- aucune promotion NEXUS Production ;
- aucun secret/service_role dans navigateur, dépôt ou logs ;
- isolation stricte des données clientes ;
- configuration multi-site, aucun comportement Sainte-Marie codé en dur ;
- Production reste soumise à autorisation humaine explicite de Frédéric.

# Retour attendu
Produire un audit/plan technique minimal avant implémentation si une décision architecturale est nécessaire. Revenir via le protocole nexus-handoff/2 avec preuves, commits, fichiers modifiés, tests, CI et éventuels gates humains réels. Ne pas solliciter Frédéric pour une décision que la Bible, la gouvernance ou les preuves permettent déjà de prendre.