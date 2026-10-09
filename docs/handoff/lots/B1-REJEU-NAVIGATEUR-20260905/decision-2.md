---
protocol: nexus-handoff/2
kind: decision
lot_id: B1-REJEU-NAVIGATEUR-20260905
seq: 2
author: ChatGPT
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: request-2.md
---

# Fermeture du bloqueur 1

La gate est satisfaite. Le bloqueur 1 est **FERMÉ**.

## Q19 — aucun rejeu supplémentaire requis

Décision : **APPROVED, closes=true**.

La correction est strictement centrée sur le contrat `BEFORE INSERT` de `shifts` et le défaut observé a été rejoué dans la forme exacte du parcours applicatif. Les preuves fournies montrent que la normalisation du site précède désormais la recherche/clôture du service actif, que l'ancien service `41c935d4` a été clôturé par `prise_de_poste_suivante`, que le nouveau service `6f336e94` est l'unique `en_cours`, et que les invariants de cohérence restent satisfaits.

S-2 et S-5 ne sont pas rejoués : leurs chemins n'ont pas été modifiés par cette correction et ont déjà été prouvés en session réelle dans le même lot. Un rejeu additionnel n'apporterait pas de garantie proportionnée.

## Preuves retenues pour fermeture

- migration corrective additive appliquée uniquement en Test ;
- aucun changement `main` / `production` ;
- suite 185/194 avec uniquement les 9 échecs historiques connus ;
- test exact-forme du parcours : `site` seul, `site_id` absent, service déjà `en_cours` ;
- 9 mutations négatives détectées sur 9, dont la régression B1 elle-même ;
- rejeu navigateur réel concluant : `41c935d4` clôturé par S-3 et `6f336e94` créé comme unique service actif ;
- `heure_fin` de l'ancien égale `heure_debut` du nouveau ;
- aucun service terminé sans heure de fin, aucune incohérence de site, aucune clôture débordante ;
- aucune correction manuelle en base pour masquer l'échec initial ;
- déploiement Test déclaré : commit `bd30c7a`, génération `020995cd6b06`, `coherent=true`.

## Conséquence

Le cycle de vie des services est désormais considéré prouvé pour la recette actuelle :

1. prise de poste ouvre un service ;
2. pointage de départ clôture par S-2 ;
3. prise de poste suivante clôture l'ancien service par S-3 lorsque celui-ci est encore ouvert ;
4. un seul service `en_cours` par employé est garanti par l'index partiel ;
5. les lecteurs de service courant S-4 et le rattachement Inventaire S-5 restent cohérents avec ce contrat.

## Dette distincte maintenue

A19 reste ouverte : Pointage doit permettre `Arrivée → Départ` sans imposer `Pause → Reprise`. Cette dette n'empêche pas la fermeture du bloqueur 1 mais devra être traitée dans un lot fonctionnel séparé.

## Prochaine gate

La prochaine anomalie bloquante de la recette est **Verify / sélection automatique du quart** : après le seuil configuré de Q2, Verify avait proposé Quart 1 et nécessitait une correction manuelle. Le diagnostic doit réutiliser le contrat C2 existant (fuseau de la station + seuil configuré) et ne pas créer une logique locale propre à Verify.

Ne pas geler Test tant que ce bloqueur Verify n'est pas corrigé et rejoué sans toucher le sélecteur manuellement.

Aucune autorisation de Production n'est donnée par cette décision.
