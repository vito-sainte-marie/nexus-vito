---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 1
author: Frédéric Bragance
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
---
# Décisions humaines de Frédéric — matérialisées depuis l'issue #28

**Les décisions ci-dessous ne viennent pas de Claude.** Frédéric Bragance les a
publiées sur l'issue #28 le 10/10/2026. Claude les recopie ici pour qu'elles
existent comme un échange du lot. Il n'arbitre rien et n'ajoute aucune
interprétation. En cas d'écart, les deux commentaires d'origine font foi :

- 11:36:58Z — https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6097088628
- 11:40:30Z — https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6097114977

Le verdict retenu est `APPROVED_WITH_CONDITIONS` et `closes: false`, pour deux
raisons :

- les décisions posent des conditions impératives avant toute écriture en
  Production ;
- Q2, Q4 et B restent ouvertes, comme Frédéric le dit lui-même.

## Décidé

**Q1 — 8ᵉ heure** (`request-1.md`). Pour les jours à barème 8 h, la 8ᵉ heure
**est** une heure supplémentaire.

- Elle se compte comme 7 h de base + 1 h supplémentaire, sans double comptage
  dans les heures de présence.
- Elle s'affiche séparément dans le dossier comptable et dans les exports.
- Le taux et la majoration suivent le cadre légal et la convention applicable.
  Aucun taux ne doit être inventé.
- Cette décision **inverse** la proposition de `request-1.md`, qui voulait
  retirer la qualification.

**Q3 — Items déjà enregistrés.** Frédéric autorise la remise à zéro des
anciens retards et des heures supplémentaires générés automatiquement. Il les
juge incohérents.

- Cette décision **inverse** la proposition « les laisser visibles tels quels ».
- Le second commentaire en fait un GO **de principe**. Il prend effet le
  2026-10-01 :
  - septembre 2026 et les mois antérieurs sont un historique à préserver, hors
    des calculs actifs ;
  - octobre 2026 et la suite sont à assainir et à recalculer.
- Les sources ne se suppriment jamais : Verify, audits_caisse, planning,
  mouvements, pointages bruts et données des autres moteurs.
- Toute donnée manuelle fiable est préservée.

**A — Durées supérieures à 12 h** (`request-2.md` §5 A). Ces durées viennent
de pointages jamais arrêtés, pas d'heures réellement travaillées.

- Un pointage ouvert ne devient jamais automatiquement une heure payée ou
  supplémentaire.
- L'anomalie est signalée, et le manager la corrige à partir des preuves
  Verify et du planning officiel.
- Aucun plafonnement arbitraire n'est appliqué à une durée réellement
  justifiée.

**Principes posés pour la période qui démarre en octobre 2026.**

- Les données viennent des autorités métier :
  - Verify pour la caisse et la piste ;
  - le planning officiel pour le renfort ;
  - les corrections du manager, qui restent tracées.
- Aucun retard n'est déduit du pointage.

## Conditions impératives avant toute écriture Supabase Production

Ces conditions sont reprises du commentaire de 11:40:30Z :

1. inventaire des tables, lignes, périodes et provenance à modifier ;
2. sauvegarde ou export réversible, et journal d'audit ;
3. analyse des dépendances et preuve de non-régression pour Verify, la caisse,
   le planning, les autres moteurs et les exports ;
4. préflight, plan SQL idempotent à portée limitée et contrôle après
   exécution ;
5. vérification des règles de clôture des mois déjà validés et des effets sur
   les rapports existants.

Le travail s'arrête (**STOP**) dans trois cas :

- une dépendance n'est pas maîtrisée ;
- des données manuelles fiables seraient touchées ;
- le périmètre est ambigu.

Ce GO de principe n'autorise pas une purge SQL. Un plan d'exécution chiffré
doit être présenté pour validation avant toute mutation en Production
(`STOP SUPABASE_PRODUCTION_MUTATION`). Ces décisions n'autorisent non plus
aucune fusion, aucun déploiement et aucune migration en Production.

Mandat donné à Claude : préparer le dossier et les tests sans attendre un
autre GO documentaire. Ensuite, notifier explicitement le STOP dès que
l'exécution en Production est prête.

## Toujours ouvert

- **Q2** — mois déjà validés : faut-il ne recalculer aucun mois clos ? La
  condition 5 ci-dessus y touche sans la trancher.
- **Q4** — le sens d'une case vide au planning.
- **B** (`request-2.md` §5 B) — `heuresExceptionnelles` : colonne de
  provenance ou ligne distincte ?
