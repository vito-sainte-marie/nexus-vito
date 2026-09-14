---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-CREATEUR-SITES-GUARD-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Créateur Sites Guard

## Verdict

**APPROVED_WITH_CONDITIONS — la distinction plateforme / données client est acceptée, les gardes explicites sont validées en Test, et la garde statique est prête pour sa dernière preuve avant activation bloquante.**

La résolution de la tension Q55/doctrine est approuvée : le créateur conserve l'autorité d'administration de la plateforme NEXUS ; le client conserve le contrôle sur l'usage et le partage de ses données métier.

## Q58 — dérogations `createur_update_sites` et `createur_delete_sites`

**OUI. Elles sont correctement fondées par la doctrine explicitement confirmée par Frédéric.**

Frédéric a précisé : « NEXUS est la propriété du créateur donc il a tous les droits sauf utiliser, partager les données d'un site (d'une entreprise cliente). » Cette gate humaine couvre l'autorité d'administration structurelle de la plateforme, donc INSERT / UPDATE / DELETE de la structure `sites`, sous les protections destinées à empêcher l'appropriation ou la destruction abusive des données clientes.

Les trois dérogations peuvent donc nommer **Frédéric Bragance** comme autorité humaine, avec cette doctrine comme fondement.

Conditions permanentes :
- l'autorité plateforme n'est jamais assimilée à un droit d'exploiter les données métier du client ;
- `acces_createur_autorise` reste un contrôle client et ne peut être contourné par une mutation authentifiée ordinaire ;
- supprimer une structure NEXUS ne doit pas supprimer implicitement les données d'une entreprise cliente ;
- les opérations structurelles sensibles doivent rester auditables et réversibles lorsque le contrat le permet.

## Q59 — preuve comportementale de `est_pompiste_du_jour`

**OUI. OBLIGATOIRE avant activation bloquante.**

Ouvrir un sous-lot court `SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF`.

Éprouver au minimum `est_pompiste_du_jour(p_site)` avec des identités et services Test réels/synthétiques transactionnels :
1. pompiste du jour sur son site : autorisé selon le contrat métier ;
2. même acteur sur autre site : refusé ;
3. acteur sans service pompiste ouvert ce jour : refusé ;
4. service pompiste fermé : refusé ;
5. renfort/caissier ne doit pas devenir pompiste par simple appartenance au site ;
6. distinguer les codes d'erreur de sécurité des erreurs de données/schéma.

Éprouver également `est_receptionniste_livraison_du_jour(p_site,p_date)` si le coût reste faible dans ce même lot, car elle a été découverte par le même mécanisme et doit éviter de devenir une dette immédiatement après la première preuve. Si son contrat nécessite des fixtures métier trop lourdes, revenir Handoff avec justification plutôt que fabriquer un faux scénario.

Aucune correction opportuniste pendant la mesure : une anomalie revient au Handoff avant correction.

## Q60 — activation bloquante

**OUI EN CIBLE, MAIS APRÈS Q59.**

Une fois les aides nommées éprouvées conformément au lot précédent, Claude est autorisé à préparer l'activation bloquante de la garde, sous réserve d'une démonstration explicite :
- état accepté : workflow vert ;
- mutation volontaire connue : workflow rouge ;
- restauration : workflow vert ;
- aucune dépendance à un secret Production ;
- temps CI mesuré et raisonnable ;
- mécanisme de désactivation/rollback documenté ;
- Architecture, Security & Isolation et QA rendent chacun un avis séparé.

Le rapport de garde ne devient bloquant qu'après cette preuve. Le test propre de la garde reste bloquant.

## NEXUS Connector

La frontière inscrite est confirmée et devient une dépendance d'architecture future de **NEXUS Connector**.

Doctrine : **une identité machine peut disposer de droits techniques étendus pour exécuter une opération autorisée, mais ces droits ne lui confèrent aucun droit de réutilisation, mutualisation ou partage des données d'une entreprise cliente.**

Quand Connector sera implémenté, les exigences déjà inscrites restent obligatoires : site explicite, provenance, identité machine, journalisation, idempotence, fail closed, secrets serveur, isolation multi-site, permissions minimales et séparation import / validation / écriture.

Aucune implémentation Connector n'est autorisée dans ce lot.

## Classe D

**TOUJOURS FERMÉE.**

Après la preuve des aides et l'activation bloquante réussie, revenir au Handoff. La prochaine décision pourra alors arbitrer l'ouverture du travail préparatoire Architecture + Security sur le mécanisme classe D/defaults. Cela ne vaut pas autorisation automatique de supprimer les defaults.

## Gate suivante

Claude peut exécuter `SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF` en Test uniquement puis, si et seulement si les preuves sont conformes, préparer/démontrer l'activation bloquante de la garde dans le même cycle sans corriger d'anomalie nouvelle.

Retour Handoff obligatoire avant classe D.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé.
