# Vocabulaire des quarts : `matin` / `soir` → `quart1` / `quart2` / `quart3`

**09/09/2026.** Demande de Frédéric Bragance, à la suite de l'arbitrage faisant
du renfort un quart de plein droit : « au lieu de dire matin soir, il faudra
dire quart 1, quart 2 et quart 3 ».

---

## D'abord, une nuance qui change l'ordre des choses

**Le renommage ne débloquera pas la participation du renfort à l'inventaire.**

Vérifié en lecture seule sur Production le 09/09/2026 :

- `normaliserRoleCode` connaît déjà `renfort` comme rôle canonique ;
- `inventaire_mission_rules.role_code` n'a **aucune contrainte** ;
- **une règle visant le renfort existe déjà** : `renfort · les deux quarts ·
  moment pendant` ;
- la présence vient de `inventaire_quart_employes`, jamais de `shifts.quart` ;
- et **zéro mission d'inventaire a été affectée au renfort en trente jours.**

La règle est là, le moteur l'accepte, et rien ne sort. La cause la plus probable
est que personne n'a ouvert l'écran Inventaire en renfort — cohérent avec le
reste de la mesure, où seize quarts sur dix-huit ne valident aucune mission.
**Je ne l'affirme pas plus fort que ça** : je n'ai pas prouvé la cause, j'ai
écarté les blocages structurels.

Autrement dit : ce sont deux chantiers distincts. Le vocabulaire est une
cohérence à établir ; la participation du renfort est un problème d'usage.
Renommer d'abord ne ferait pas apparaître les missions.

---

## Ce que le renommage coûte, mesuré

### En base — cinq tables, environ 415 lignes

| Table | `matin` | `soir` | autre |
|---|---|---|---|
| `shifts` | 120 | 124 | — |
| `inventaire_quarts` | 31 | 29 | — |
| `inventaire_missions` | 40 | 42 | — |
| `inventaire_plans_comptage` | 18 | 11 | — |
| `inventaire_mission_rules` | 4 | 3 | 6 sans quart |

Trois contraintes `check (quart in ('matin','soir'))` à réécrire, dans
`inventaire_plans_comptage`, `inventaire_missions` et
`inventaire_mission_rules`. `shifts.quart` n'en a aucune.

### En code — dix fichiers, vingt-deux épreuves

Écrans Inventaire, Inventaire Manager, Paramètres Inventaire, Missions, App,
Prise de poste, plus trois couches de données et la progression. **Vingt-deux
fichiers d'épreuves** gardent aujourd'hui le vocabulaire `matin` / `soir` — dont
celle qui existe précisément parce qu'un renommage antérieur avait cassé la
production le 05/09/2026.

---

## Pourquoi ça ne s'improvise pas

Le 05/09/2026, une réécriture a remplacé le vocabulaire d'Inventaire par celui
de la primitive. La contrainte `inventaire_plans_comptage_quart_check` a rejeté
**tous les plans de comptage**, et aucune épreuve ne gardait ce vocabulaire.
C'est de là que vient la garde qui existe aujourd'hui.

Le renommage demandé est le même geste, en plus large : cinq tables, quatre cent
quinze lignes de données réelles, et un historique qui doit rester lisible.

**C'est exactement ce pour quoi la répétition de release existe.** Elle sait
maintenant reconstruire Test à l'état de Production, y semer les formes réelles,
appliquer les migrations et mesurer l'écart avant et après. Ce changement doit
passer par là, pas par une édition directe.

---

## L'ordre que je recommande

1. **La participation du renfort à l'inventaire** — sans renommer quoi que ce
   soit. La règle existe déjà : il reste à comprendre pourquoi elle ne produit
   rien, et à proposer la participation au renfort dans le parcours. C'est ce
   que tu as demandé en premier, et c'est indépendant du vocabulaire.
2. **La correction des horaires de Production**, prête et non appliquée.
3. **Le renommage**, préparé comme une release : migration de schéma et de
   données, mise à jour des dix fichiers et des vingt-deux épreuves, répétition
   sur Test avec rapport d'impact, puis promotion.

**Une réserve sur le mot lui-même.** `quart3` dit une position dans une suite ;
`renfort` dit ce que la personne fait. Les deux premiers quarts se succèdent, le
troisième les chevauche — il n'est pas « après ». Si le but est l'homogénéité,
`quart1` / `quart2` / `quart3` la donne ; si le but est que l'employé se
reconnaisse, `renfort` reste plus juste. Rien n'oblige à choisir le même mot en
base et à l'écran : la base peut porter `quart3` et l'écran dire « Renfort ».
C'est ton arbitrage, je le pose seulement.
