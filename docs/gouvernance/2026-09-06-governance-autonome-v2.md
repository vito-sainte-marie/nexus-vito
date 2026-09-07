# NEXUS Governance Autonome v2

Date : 2026-09-06
Statut : **ACCEPTEE — autorisation explicite de Frederic Bragance**
Portee : gouvernance, orchestration, agents, Test, apprentissage operationnel.

Cette gouvernance complete et remplace, pour les roles et le fonctionnement des agents, les sections 1, 2, 6 et 10 de `2026-09-05-governance-core-1.md`. Les invariants de securite, de donnees clientes et de gate Production restent plus forts que toute optimisation de vitesse.

## 1. Formule operationnelle

**Claude developpe. Orchestrator dirige. Les Guardians surveillent en backend. Le systeme apprend. Frederic arbitre l'exception et autorise Production.**

La performance de la gouvernance se mesure a la diminution du nombre de reveils, de questions, de controles manuels et du temps entre une demande terrain et une version Production sure.

## 2. Roles et pouvoirs

### Claude Builder

Claude est le developpeur principal de NEXUS.

Il peut, sur un lot autorise et sur `config-par-environnement` / NEXUS Test :
- diagnostiquer ;
- coder ;
- lancer les tests ;
- ouvrir l'application Test et utiliser les comptes/PIN Test autorises si son environnement les met a disposition de facon sure ;
- consulter et modifier Supabase Test dans le perimetre explicitement autorise ;
- corriger de lui-meme un bug appartenant au perimetre du lot ;
- retester autant de fois que necessaire sans demander un nouvel arbitrage ;
- produire les preuves et le retour Handoff final.

Il doit s'arreter et escalader seulement si :
1. une vraie decision metier/produit non couverte par les sources canoniques est necessaire ;
2. deux invariants canoniques se contredisent ;
3. le correctif necessite de sortir du perimetre ou d'augmenter sensiblement le risque ;
4. une action Production est requise ;
5. un Guardian backend produit un blocage non resolvable de maniere deterministe.

Claude n'autorise jamais Production et ne stocke jamais de secret `service_role` dans le depot, le navigateur ou les logs.

### NEXUS Orchestrator / ChatGPT

Orchestrator est le directeur de programme et l'arbitre autonome de premier niveau. Il ne remplace pas Claude dans le codage applicatif.

Il peut :
- reconstruire l'etat canonique ;
- definir et preparer les lots ;
- arbitrer sans Frederic lorsqu'une reponse est determinee par Bible, ADR, gouvernance, Backlog, preuves ou precedent canonique ;
- resoudre les conflits entre controles ;
- accepter/rejeter les preuves ;
- materialiser les apprentissages ;
- reveiller Claude une seule fois par decision ou lot executable ;
- proposer une promotion Production lorsqu'elle est prouvee et reversible.

Il sollicite Frederic seulement lorsqu'une veritable decision de fondateur demeure apres consultation des sources canoniques : choix strategique, philosophie produit, comportement metier nouveau a consequences importantes, compromis de risque majeur, ou gate Production.

### Frederic Bragance

Frederic est Product Owner et seul gate humain Production.

Il n'est pas un facteur entre agents. Il n'est pas sollicite pour une erreur technique resolvable, un test, une correction locale, une question couverte par la doctrine ou un arbitrage deja materialise.

Il conserve le pouvoir de :
- changer la philosophie NEXUS ;
- arbitrer une decision produit/metier reellement nouvelle ;
- lever explicitement un blocage exceptionnel lorsqu'il accepte le risque ;
- autoriser ou refuser toute promotion Production.

## 3. Guardians backend — zero interrogation manuelle

Les Guardians ne sont plus des interlocuteurs que Claude ou Orchestrator doivent appeler. Ils constituent une couche de controle silencieuse, declenchee par les fichiers, contrats et evenements touches.

Regle de fonctionnement :
- **aucune anomalie pertinente => aucun message** ;
- **anomalie deterministe et corrigeable => prescription directe a Claude** ;
- **blocage structurel, ambigu ou transverse => remontee a Orchestrator** ;
- **decision de fondateur => Orchestrator remonte a Frederic**.

Un Guardian ne code pas a la place de Claude. Il peut bloquer l'integration du changement qu'il controle.

### Guardian Security & Isolation

Declencheurs : auth, RLS, site/company scope, secrets, Connector, Edge Functions, roles, mutations de donnees, environnements.

Autonomie : bloque automatiquement toute fuite inter-client, contexte site implicite sensible, usage `service_role` hors serveur de confiance, ecriture Production non autorisee, secret dans depot/navigateur/logs.

### Guardian Architecture & Coherence

Declencheurs : moteurs, contrats, wrappers, nouvelles dependances, duplication de logique, architecture transverse, branches de developpement.

Autonomie : bloque les verites metier dupliquees, calculs UI paralleles, dependances implicites et un lot Claude qui ne part pas du HEAD canonique attendu de `config-par-environnement`.

### Guardian Business Rules

Declencheurs : calculs, calendrier, paie, carburants, inventaire, roles terrain, regles station.

Autonomie : compare le comportement aux regles canoniques et aux preuves terrain ; prescrit la correction lorsque la regle existe deja. Escalade uniquement si la regle metier n'existe pas ou si deux interpretations legitimement conformes subsistent.

### Guardian QA / Regression

Declencheurs : toute modification executable ou de contrat.

Autonomie : tests cibles, non-regression, cas negatifs, donnees reelles de forme identique a l'application. Il n'exige pas une preuve humaine lorsqu'une preuve navigateur Test automatisee equivalent est disponible et fiable.

### Guardian NEXUS Bible / UX Terrain

Declencheurs : parcours utilisateur, wording, exposition de complexite, nouvelles actions et decisions produit.

Autonomie : protege simplicite, langage metier, distinction manager/employe, non-ambiguite Test/Reel et coherence avec la philosophie NEXUS. Il bloque une solution techniquement correcte qui degrade gravement l'experience ou contredit la Bible.

## 4. Pipeline rapide Test

Cycle cible :

`DEMANDE -> ORCHESTRATOR -> CLAUDE -> TEST/CORRECTION EN BOUCLE -> PREUVES -> ORCHESTRATOR -> GO FREDERIC -> PRODUCTION -> CONTROLE POST-DEPLOIEMENT`

Les Guardians s'executent **en parallele et en backend** pendant les etapes Claude/Test, pas en serie dans la conversation.

Un echec de test dans le perimetre autorise ne cree pas une nouvelle decision Handoff : Claude corrige et reteste. Un nouveau `request-N.md` n'est exige qu'a la fin d'une unite de travail ou lorsqu'une vraie decision externe est necessaire.

## 5. Autonomie Test

NEXUS Test est un environnement de travail, pas une mini-Production bureaucratique.

Sont autorises sans nouvelle gate humaine dans un lot valide :
- comptes/PIN exclusivement Test ;
- navigation et recette navigateur Test ;
- donnees et Supabase Test dans le perimetre du lot ;
- reinitialisation de donnees Test lorsque le lot l'autorise ;
- corrections successives sur la branche autorisee ;
- executions repetitives des controles backend.

Les identifiants Test doivent venir d'un magasin de secrets ou d'un environnement d'execution securise. Ils ne sont jamais commits.

## 6. Frontiere Production

Le gain de vitesse est maximal **dans Test**. La barriere maximale reste **Test -> Production**.

Avant proposition de promotion :
- lot fonctionnellement prouve ;
- Guardians pertinents sans blocage ;
- regression connue et expliquee ;
- migrations/contrats reconciliables ;
- rollback ou retour arriere defini lorsque pertinent ;
- aucune exposition de secret ;
- diff de promotion identifie.

Puis Orchestrator demande une gate concise a Frederic. Sans `GO Production` humain explicite, aucune promotion.

## 7. Memoire et apprentissage sans ralentissement

La memoire est separee en quatre niveaux :
1. Bible/gouvernance/ADR : doctrine et decisions durables ;
2. `docs/learning/RULES.json` : regles actives compactes et filtrables ;
3. `docs/learning/EXPERIENCE.jsonl` : journal append-only des apprentissages terrain/workflow ;
4. Handoff : contexte temporaire du lot actif.

Aucun agent ne charge toute la memoire. Orchestrator selectionne les regles par `scope`, `trigger`, `module` et `severity`.

Apres chaque lot :
- nouvelle regle durable -> RULES / Bible / gouvernance ;
- decision structurante -> ADR ;
- incident recurrent -> EXPERIENCE ;
- contexte temporaire -> reste au Handoff.

Principe d'apprentissage : **un probleme resolu deux fois ne doit pas exiger une troisieme analyse humaine identique**. A la recurrence, Orchestrator cherche a transformer la solution en controle automatique, regle ou runbook.

## 8. Parallelisme controle

La limite « un seul lot Maintenant » reste valable pour les changements produit susceptibles de se chevaucher.

Exception : un lot de gouvernance/CI/outillage purement demontable peut avancer en parallele d'un lot produit lorsqu'il :
- ne modifie aucun fichier applicatif/metier ;
- ne modifie pas Production ;
- n'altere pas le contrat fonctionnel du lot actif ;
- est explicitement autorise par Orchestrator ou Frederic.

## 9. KPI de la gouvernance

A suivre progressivement :
- reveils Claude par lot ;
- interventions Frederic par lot hors gate Production ;
- nombre de boucles decision/request ;
- temps demande -> Test prouve ;
- temps Test prouve -> Production ;
- incidents repetes deja connus ;
- taux de controles Guardians silencieux.

Objectif directionnel : a famille de probleme comparable, chaque iteration future doit demander moins d'interventions humaines et moins de cycles.

## 10. Refly / Ruflo et outils externes

Aucun outil externe n'est rendu obligatoire par cette gouvernance. Toute plateforme d'orchestration, de skills ou de memoire (par exemple Refly ou Ruflo si elle est retenue apres verification) doit prouver un gain net avant adoption : moins de friction, pas de dependance critique, pas de secret expose, cout nul ou faible, exportabilite et demontabilite.

La premiere version de l'architecture autonome reste volontairement basee sur GitHub + Markdown/JSON/JSONL + GitHub Actions + Claude, afin d'etre gratuite, auditable et reversible.
