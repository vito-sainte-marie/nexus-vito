<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/request-11.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 11
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5751a9b0
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 174-fichiers
---
# request-11 — INVENTAIRE-CAISSE-RENFORT-20261102 : clôture du quart partagée par la vérification serveur

## Branche du lot
handoff-continuite-20260920

## Ce que cette demande remplace
Elle supersede request-10 (arbitrage `STOP_REQUIRED SECURITE_RLS_SITE_ID`, run 41688426571). Frédéric a choisi entre les deux mécanismes proposés (Guardian, commentaire 6611921472, 03/11), cité tel quel :

> « Vérification serveur » : la vérification automatique existante (cron `nexus-inventaire-reviews`, `*/15 * * * *`, `run_scheduled_inventory_reviews()`) ferme le quart partagé quand tous ceux qui ont pris leur poste sur ce quart ont validé leur clôture individuelle, ou à l'heure de fin prévue + `closureDelayMinutes` (30). Aucun nouvel accès pour les employés : pas de policy élargie sur `shifts`, pas de fonction appelable par un employé. L'option « accès limité employé » est écartée.

Le palier `SECURITE_RLS_SITE_ID` est donc levé par ce choix : aucune policy, aucun grant, aucune fonction appelable par un employé. Rien n'est écrit : demande d'arbitrage avant tout code.

## Changement proposé (une migration, Test seulement)
1. **Côté employé** (`NEXUS-Inventaire-v1.html`, `validerCloture`) : n'écrit plus que sa ligne `inventaire_quart_employes` (`a_valide_cloture`, `heure_depart`) et ses comptages. Il ne touche plus `inventaire_quarts.statut` ni `cloture_le`.
2. **Côté serveur** : `run_scheduled_inventory_reviews()` (privilégiée ; elle lit déjà `horaires.quartN.fin_normal` et `closureDelayMinutes`, migration 20260905131500) passe un quart non clos en `cloture` :
   - quand toutes les `shifts` du site, de la date et du quart ont une ligne `a_valide_cloture = true` ; `cloture_le` = max(`heure_depart`) ;
   - sinon à fin + `closureDelayMinutes`, avec l'alerte `cloture_en_retard` déjà émise, et `cloture_le` = l'instant de la limite (ni l'heure de la vérification, ni une heure inventée) — à confirmer.
3. L'employé qui a changé de poste reste attendu sur son quart (arbitrage request-10).

## Lecteurs de `cloture_le` / `statut = 'cloture'` à traiter
| Lecteur | Aujourd'hui | Après |
|---|---|---|
| Accueil caissière/pompiste (`NEXUS-App-v1.html`, `inventaireFait`, `clotureInventaire`) | `inventaire_quarts.cloture_le` | `a_valide_cloture` de **sa propre ligne** (décision 1 de Guardian) |
| Fil caisse (`nexus-fil-caisse.js` `faitsInventaire`, `nexus-fil-caisse-lecture.js`) | `cloture_le` du quart | idem : sa propre ligne |
| Progression (`nexus-progression.js` ~l. 1648) | `a_valide_cloture` ET `cloture_le` | **inchangé en code** : la série reste `PENDING` tant que le serveur n'a pas fermé (≤ 15 min) |
| Snapshot décénium (`nexus-inventaire-snapshot-donnees.js`, moteur) | `cloture_le` (`.or(cloture_le.is.null,…)`) | inchangé : un quart ouvert plus longtemps est lu « ouvert » ; à mesurer |
| Moteur d'écarts (`nexus-inventaire-moteur.js` ~l. 666) | durée ouvert_le→cloture_le | inchangé ; la durée s'allonge de ≤ 15 min |
| Manager : état du quart, « rouvrir » (`rouvrirClotureQuart`, Manager l. 1119) | remet `statut='ouvert'`, `cloture_le=null` | voir point A |
| Manager : clôture directe | écrit `cloture` | voir point B |

## Points à arbitrer
- **A — Réouverture manager.** Après réouverture, `statut='ouvert'` et les lignes gardent `a_valide_cloture=true` : le cron les refermerait au tick suivant (≤ 15 min). Proposition : la réouverture remet aussi `a_valide_cloture=false` pour les lignes concernées (écriture manager déjà permise ? à vérifier, sans nouvelle policy) ; sinon le cron la défait. Alternative : marquer le quart « rouvert » et l'exclure du cron. Choix demandé.
- **B — Clôture manager directe.** Le manager écrit déjà `cloture` : conservée telle quelle, le cron ne touche que `statut <> 'cloture'` (idempotence).
- **C — Population.** `shifts` du site, de la date et du quart. La correspondance exacte shift ↔ quart (matin/soir) sera établie par une lecture seule sur Test avant d'écrire la migration ; un shift renfort ou sans quart est exclu ou non : à trancher. Un shift sans ligne `inventaire_quart_employes` bloque la fermeture anticipée jusqu'à fin + 30 min (prudent, conforme à la règle).
- **D — Fenêtre du cron.** Existante : `date >= aujourd'hui - 2`, un quart par site. Multisite : boucle par site, filtrée `site = r.site` ; épreuve d'isolation à deux sites.
- **E — Idempotence.** `update … where statut <> 'cloture'` ; l'alerte `cloture_en_retard` garde son test d'existence ; relance sans double effet.
- **F — Délai de grâce.** `closureDelayMinutes` absent ⇒ 30 (déjà le cas).

## Conditions avant tout code
Épreuves sur Test (SQL et JS) : les deux ordres de clôture ; repli à fin + 30 ; changement de poste ; deux sites ; relance du cron ; réouverture manager. Mutations sur chaque garde. Recette navigateur : Employé Test B seulement (GOV-012), par Guardian.

## Portes (non franchies)
- Migration : **Test uniquement**. Application en Production : `SUPABASE_PRODUCTION_MUTATION`, GO écrit de Frédéric, appliquée par CC.
- Aucune policy, grant, fonction appelable par un employé, ni nouvelle règle d'alerte.
- Aucune lecture Production.

## Preuve des conditions de decision-4
Inchangées : fil affiché seulement si `piloteCaisseCourant === true` et `roleDuJour === 'caissiere'` ; aucune nouvelle catégorie ni produit ; comptage à l'aveugle ; pas de contournement du défaut A ; le changement de quart s'arrête au libellé.
