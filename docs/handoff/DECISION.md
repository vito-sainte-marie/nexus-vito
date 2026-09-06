<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/B1-REJEU-NAVIGATEUR-20260905/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: B1-REJEU-NAVIGATEUR-20260905
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---

# Arbitrage B1 — correction S-3 requise

Le rejeu réel est recevable et met au jour un défaut bloquant authentique. Le bloqueur 1 reste OUVERT.

## Q16 — APPROUVÉ : voie (c)

Fusionner la normalisation du site et la clôture du service précédent dans un contrat BEFORE INSERT déterministe : normaliser d'abord l'identité site, puis rechercher/clôturer le service actif du même employé et du même site, puis laisser l'index partiel garantir l'unicité finale.

Ne pas retenir un renommage alphabétique de trigger comme mécanisme de sûreté. Ne retenir `coalesce(new.site_id,new.site)` comme repli que si l'analyse préalable démontre que la fusion créerait un risque supérieur ; dans ce cas revenir en AWAITING_DECISION avant implémentation du repli.

Préserver les invariants A3-1/A3-2 : `site_id` reste la source de vérité, `site` la copie DB contrôlée ; aucune réintroduction de fallback métier côté application ; aucun défaut production ; aucune écriture main/production.

La migration corrective doit être additive/immutable : ne pas modifier une migration déjà appliquée. Elle doit supprimer/remplacer proprement les triggers concernés uniquement après avoir établi leur comportement et leurs dépendances actuelles.

## Q17 — OUI, BLOQUANT

La fermeture exige un test de régression utilisant la forme exacte du parcours applicatif : INSERT avec `site` seul et `site_id` absent, alors qu'un service du même employé/site est déjà `en_cours`.

Le test doit prouver au minimum : ancien service clôturé exactement une fois avec `cloture_source=prise_de_poste_suivante`; nouveau service inséré et unique `en_cours`; `site_id` normalisé correctement; aucune clôture cross-site/cross-employee; garde temporelle S-3 conservée; index partiel toujours arbitre final; transaction atomique en cas d'échec.

Ajouter aussi une épreuve négative correspondant à une mutation plausible de l'ordre/normalisation afin que le test démontre qu'il attrape précisément la régression observée, et non seulement le happy path.

## Q18 — LAISSER `41c935d4` OUVERT JUSQU'AU REJEU CORRECTIF

Ne pas le clôturer manuellement et ne pas fabriquer de départ. Il constitue l'état réel de l'échec. Après déploiement de la correction en Test, l'utiliser comme précondition du rejeu réel : une nouvelle prise de poste Employé Test A doit fermer `41c935d4` par S-3 et créer le nouveau service. Cette action réelle sera la preuve principale de levée du défaut.

## Gate de fermeture du bloqueur 1

Après correction, revenir en AWAITING_DECISION avec preuves automatisées ET réelles. Sont obligatoires :

1. migration corrective versionnée et appliquée uniquement en Test ;
2. suite CI au niveau attendu, sans nouvel échec ;
3. test exact-forme `site` seul bloquant et test mutationnel/négatif ;
4. rejeu navigateur réel : nouvelle prise de poste ferme `41c935d4` via `prise_de_poste_suivante` et crée un unique nouveau `en_cours` ;
5. cohérence `site/site_id`, employee, quart, heure_debut/heure_fin et source de clôture ;
6. aucune écriture partielle/silencieuse ;
7. aucune requête/écriture Production, refs `main` et `production` inchangées ;
8. état exact commit/génération du déploiement Test ;
9. ne pas masquer un échec par correction manuelle en base.

Le rejeu déjà réussi de S-2 et S-5 reste une preuve valide ; il n'est pas nécessaire de répéter des étapes sans lien avec la correction sauf si la modification corrective les touche.

## Dette fonctionnelle distincte

A19 reste hors de ce correctif : Pointage devra permettre le parcours `Arrivée → Départ` sans imposer `Pause → Reprise`. La pause est facultative et ne doit pas être une précondition technique à la clôture normale d'un service. Ne pas mélanger A19 à la correction S-3 actuelle.

Décision : **APPROVED_WITH_CONDITIONS, closes=false**.
