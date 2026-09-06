<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-CORRECTION-COMMANDE-20260906
seq: 2
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
human_clarification: Frederic Bragance 2026-09-06
supersedes_calendar_rule_of: decision-1.md
---

# Décision — précision canonique du calendrier de commande carburant

La règle métier fournie par Frédéric remplace toute interprétation antérieure du type « samedi vers lundi non commandable » prise isolément.

## Règle métier exacte

1. **Jours de prise de commande** : uniquement les jours ouvrables fournisseur, aujourd'hui du **lundi au vendredi**, hors jours fériés applicables.
2. **Heure limite** : commande valable pour le cycle normal si elle est passée **avant 11:00** le jour ouvrable de commande.
3. **Jour de livraison** : le **prochain jour ouvrable suivant la date de commande**, en sautant samedi, dimanche et jours fériés.
4. Exemples canoniques :
   - commande mercredi avant 11:00 → livraison jeudi ;
   - commande vendredi avant 11:00 → livraison lundi ;
   - si ce lundi est férié → livraison mardi ;
   - samedi : aucune nouvelle commande ne peut être passée ; le prochain créneau de commande est le prochain jour ouvrable avant 11:00.
5. **Heure de livraison** : aucune heure précise ne doit être déduite ou promise. La livraison peut intervenir à n'importe quel moment exploitable de la journée de livraison, par exemple 06:00 comme 17:00.
6. En conséquence, les calculs de couverture doivent considérer que le stock doit tenir **jusqu'à la livraison réelle au cours de cette journée**, sans inventer une heure d'arrivée certaine. Si le moteur a besoin d'une borne prudente, celle-ci doit être explicite/configurable et ne pas être présentée comme l'heure fournisseur.

## Implications techniques obligatoires

- Séparer clairement : `jour_commandable`, `cutoff_commande`, `prochain_jour_ouvrable_livraison` et éventuelle hypothèse prudente d'heure de réception.
- Ne pas modéliser la règle par un simple calendrier de jours de livraison.
- Ne pas coder Sainte-Marie en dur : jours ouvrables, cutoff et calendrier de jours fériés doivent rester configurables/multi-site.
- Le comportement après 11:00 un jour ouvrable doit basculer vers le **prochain créneau de commande ouvrable**, puis calculer la livraison au jour ouvrable suivant ce nouveau créneau.
- Préserver toutes les autres conditions de `decision-1.md`, notamment sécurité de stock, capacité, anti-surstock, 35 000 L si plafond sûr, UI sans second calcul métier, et interdiction Production.

## Tests minimum ajoutés à la matrice

- mercredi 10:59 → livraison jeudi ;
- mercredi 11:00/11:01 → prochain créneau jeudi, livraison vendredi ;
- vendredi 10:59 → livraison lundi ;
- vendredi 10:59 avec lundi férié → livraison mardi ;
- samedi → non commandable ; prochain créneau lundi (ou mardi si lundi férié), puis livraison le jour ouvrable suivant ;
- aucune assertion d'heure de livraison fixe dans l'UI ou le moteur métier.

Aucune promotion Production autorisée.