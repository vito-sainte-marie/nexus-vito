<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE-20260906/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-STATIC-GUARD-UNKNOWN-TRIAGE-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Static Guard UNKNOWN Triage

## Verdict

**APPROVED_WITH_CONDITIONS — le tri 27 → 3 est accepté. Les deux protections incidentes `sites` doivent devenir explicites. Le registre d'aides nommées est autorisé. La dérogation `createur_insert_sites` reste soumise à la gate humaine. La frontière `service_role` doit désormais être conçue en tenant compte de NEXUS Connector.**

Le lot a réduit le bruit sans maquiller l'incertitude. La découverte de `nexus_clients_ecriture_ok`, de la frontière `TO service_role` et de la dépendance incidente entre SELECT et mutation montre que la garde commence à raisonner sur les contrats plutôt que sur de simples motifs syntaxiques.

## Q55 — `createur_update_sites` / `createur_delete_sites`

**OUI. APPROVED.**

Ouvrir un sous-lot `SITE-EXPLICITE-1-CREATEUR-SITES-GUARD` limité à rendre explicite la condition de portée déjà imposée indirectement aujourd'hui :
- UPDATE d'un site par créateur uniquement lorsque le contrat d'accès créateur du site l'autorise ;
- DELETE idem, avec preuve spécifique car l'opération est destructive ;
- aucune extension de visibilité ;
- aucun changement de comportement légitime attendu ;
- preuves avant/après et rollback.

La correction ne doit pas dépendre uniquement de `select_sites`. Chaque mutation sensible porte sa propre condition.

## Q56 — dérogation `createur_insert_sites`

**CONTRAT APPROUVÉ EN PRINCIPE, DÉROGATION NON ENCORE AUTORISÉE.**

Créer un nouveau commerce peut être une capacité constitutive du rôle créateur et n'a, par définition, aucun site préexistant auquel rattacher la création. Une exception à la règle de portée est donc architecturalement plausible.

Mais le registre exige une autorisation humaine nominative. **ChatGPT ne doit pas écrire `autorise_par: Frédéric Bragance` à la place de Frédéric.** La dérogation reste en attente de sa confirmation explicite. Jusqu'à cette confirmation, `createur_insert_sites` reste un cas ouvert et la garde ne devient pas bloquante.

La future demande à la gate humaine doit être formulée simplement : autoriser ou refuser que le rôle créateur puisse créer un nouveau site sans site préexistant, sous audit et sans capacité implicite de modifier/supprimer un site qui lui refuse ensuite l'accès.

## Q57 — registre des aides nommées

**OUI. APPROVED.**

Créer un registre versionné des aides qui encapsulent un contrôle de portée. Chaque entrée doit au minimum documenter :
- nom de l'aide ;
- type de portée contrôlée ;
- acteurs concernés ;
- contrat attendu ;
- preuve/test qui démontre le contrat ;
- propriétaire de maintenance ou domaine ;
- date/revision.

Une aide déclarée sans test de son contrat ne peut pas suffire seule à classer une policy `SAFE`. La garde doit retourner `UNKNOWN/REVIEW` si une aide inconnue apparaît dans une policy de portée.

## NEXUS Connector — frontière à préserver dès maintenant

Le constat `TO service_role` devient particulièrement important pour **NEXUS Connector**, qui doit à terme ingérer/synchroniser des sources externes (Excel, PDF, CSV, API, photos et connecteurs métier) sans affaiblir l'isolation multi-site.

Décision d'architecture : **NEXUS Connector ne doit jamais transformer `service_role` en passe-partout métier.**

Avant toute activation réelle du Connector, son contrat devra imposer :
1. exécution serveur uniquement ; jamais de clé `service_role` dans le navigateur ou le client ;
2. site cible explicite dans chaque job/import/synchronisation ; absence ou contradiction de site = fail closed ;
3. identité machine/connector et provenance de l'opération traçables ;
4. permissions minimales par fonction plutôt qu'un service_role générique lorsque l'architecture le permet ;
5. séparation claire entre import de données, validation métier et écriture finale ;
6. idempotence, journal d'import, erreurs et rollback/rejeu ;
7. aucune déduction silencieuse de Sainte-Marie ou d'un site par défaut ;
8. tests multi-site positifs et négatifs ;
9. secrets hors dépôt/logs et rotation possible ;
10. les policies `TO service_role` ne sont `NOT_APPLICABLE` pour la garde utilisateur que si leur frontière machine est explicitement inventoriée et auditée.

**Aucune implémentation NEXUS Connector n'est autorisée par ce lot.** Cette décision inscrit seulement sa frontière de sécurité afin que le chantier actuel ne crée pas aujourd'hui une exception dangereuse que le Connector exploiterait demain.

## Activation bloquante de la garde

**PAS ENCORE.** Il reste :
- fermer les deux protections incidentes ;
- décision humaine sur `createur_insert_sites` ;
- enregistrer/tester les aides nommées ;
- obtenir 0 UNKNOWN non arbitré et 0 VULNERABLE non accepté ;
- prouver que la CI échoue sur une mutation volontaire et passe sur l'état accepté.

## Classe D

**TOUJOURS FERMÉE.** Aucun retrait de default, aucune correction des 9 écritures classe D, aucune généralisation de trigger.

## Gate suivante

Claude peut exécuter `SITE-EXPLICITE-1-CREATEUR-SITES-GUARD` en Test et mettre en place le registre versionné des aides nommées. Il doit également inscrire dans la documentation de gouvernance la frontière future NEXUS Connector / `service_role`, sans développer le Connector dans ce lot.

Retour Handoff obligatoire avant activation bloquante et avant classe D.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé.
