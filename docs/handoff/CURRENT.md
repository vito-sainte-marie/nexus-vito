# NEXUS Handoff — CURRENT

LOT_ID: S-5-SHIFT-ID-INVENTAIRE-20260905
STATUS: AWAITING_DECISION
AUTHOR: Claude
BRANCH: config-par-environnement

## Résumé

S-4 est fermé (`APPROVED_CLOSED`, commit `ca9cf92`). La dette **A18** est
consignée dans la fiche de recette, avec l'interdiction de correction
rétroactive sans règle métier validée.

S-5 est la dernière facette du bloqueur 1 : écrire le véritable `shift_id`
dans `inventaire_quart_employes`. **Diagnostic établi, aucun code écrit.**

## Constat

### Un seul chemin d'écriture, et il n'écrit pas `shift_id`

```
NEXUS-Inventaire-v1.html:1094   obtenirOuCreerQuartEmploye()
  insert { quart_id, employee_id, role, heure_arrivee }
```

C'est **le seul `insert`** de toute l'application. `NEXUS-Inventaire-Manager-v1.html:1124`
ne fait que des `update` (`a_valide_cloture`, `heure_depart`), et les autres
occurrences sont des lectures.

État en base : **6 lignes, 0 avec `shift_id`**. La colonne existe, elle porte
une clé étrangère vers `shifts(id)`, et elle n'a **jamais** été renseignée.

### La donnée est déjà là, à trois lignes de distance

Le même écran résout déjà le service courant à l'initialisation :

```
NEXUS-Inventaire-v1.html:4164   const resolution = await chargerRoleDuJour();
                                roleDuJour = resolution.role;
```

Depuis S-4, `chargerRoleDuJour()` délègue à `nexusServiceCourant()`, qui
retourne **le service complet** — dont son `id`. Aujourd'hui l'écran n'en
garde que le `role` et jette l'identifiant. Il n'y a donc **aucune requête
supplémentaire à faire** : seulement à cesser de perdre ce qu'on a déjà lu.

### Aucun lecteur de `shift_id` aujourd'hui

Balayage complet : **aucun code applicatif ne lit
`inventaire_quart_employes.shift_id`**. Le remplir n'a donc aucun effet
immédiat sur un écran — c'est de la traçabilité, pas du comportement. C'est
précisément ce qui a permis à l'oubli de durer.

### Le mode test

`obtenirOuCreerQuartEmploye()` court-circuite l'insert quand
`modeTestInventaireActif()` : il retourne un objet synthétique avec un `id`
fixe `00000000-…-000000000102`. Ce chemin ne touche pas la base et ne doit pas
recevoir de `shift_id` réel.

### RLS

```
insert_inventaire_quart_employes : le quart appartient au site de l'employé
```
La politique ne contrôle **ni** `employee_id` **ni** `shift_id`. Écrire un
`shift_id` n'ouvre aucun droit nouveau, mais rien en base ne garantira que le
service référencé appartient bien à cet employé — la clé étrangère vérifie
l'existence, pas l'appartenance.

## Modifications / proposition

Contrat proposé :

1. `obtenirOuCreerQuartEmploye()` écrit `shift_id` à la création, depuis le
   service déjà résolu à l'initialisation de l'écran.
2. **Sans service courant, aucune ligne n'est créée.** L'écran s'arrête déjà
   dans ce cas — `bloquerFauteDeRoleDuJour()` — puisque `chargerRoleDuJour()`
   renvoie `indetermine`. Le contrat est donc déjà fail-closed en amont ; il
   n'y a rien à ajouter, seulement à ne pas le contourner.
3. **Aucune reprise rétroactive** des 6 lignes existantes : leur service
   d'origine n'est pas connu de façon certaine, et S-1 a fermé plusieurs
   services le même jour. Même règle qu'A18 — on ne reconstitue pas un
   rattachement plausible.
4. Le mode test conserve son objet synthétique, `shift_id` absent.
5. Facultatif, à arbitrer : une contrainte en base garantissant que le
   `shift_id` référencé appartient au même employé (trigger `before insert`).

## Preuves

- Décision S-4 consommée : `APPROVED_CLOSED`, `LOT_ID`
  S-4-LECTEURS-SERVICE-COURANT-20260905.
- A18 consignée dans `docs/recettes/2026-09-04-config-par-environnement.md`.
- Balayage : 1 `insert`, 0 lecteur de `shift_id`, 6 lignes toutes à `null`.
- État `nexus-test` : 2 services `en_cours` (Manager Test renfort, Employé
  Test B pompiste), aucun service clos par erreur.
- `main` et `production` à `501c0c7`. Aucune écriture production.

## Risques / anomalies

1. **Le remplissage n'a aucun effet observable** faute de lecteur. La preuve
   de S-5 sera donc une preuve de données, pas de comportement — un comptage
   d'inventaire créé après S-5 devra porter un `shift_id` égal au service
   actif de l'employé.
2. **La clé étrangère ne vérifie pas l'appartenance.** Un `shift_id` d'un
   autre employé serait accepté par la base. Le code ne le fera pas, mais
   rien ne l'interdit structurellement — d'où la proposition 5.
3. **Les 6 lignes existantes resteront à `null`.** L'écart entre lignes
   anciennes et nouvelles sera visible et devra être assumé.

## Questions pour arbitrage

**Q6 — La contrainte d'appartenance (proposition 5).** Faut-il un trigger
`before insert` vérifiant que `shift_id` appartient au même `employee_id` ?
Recommandation : **oui**. Le bloqueur 1 a montré qu'un contrat non gardé en
base finit par ne pas être respecté — `cloture_source` existait depuis
l'origine sans aucun écrivain. Une clé étrangère qui vérifie l'existence mais
pas l'appartenance est le même genre de garantie incomplète.

**Q7 — Les 6 lignes existantes.** Confirmer qu'aucune reprise rétroactive
n'est faite, même quand un rattachement paraît plausible. Recommandation :
**aucune reprise**, alignée sur A18 et sur la règle S-1 (« ne pas inventer
une heure de fin » devient ici « ne pas inventer un rattachement »).

**Q8 — Faut-il un lecteur ?** `shift_id` sans consommateur restera une
colonne morte, et c'est ce qui a permis l'oubli. Faut-il, dans S-5, brancher
au moins une lecture — par exemple afficher le rôle du service dans le
contrôle manager — ou laisser la traçabilité sans usage jusqu'à un besoin
métier réel ? Recommandation : **laisser sans usage**. Créer un lecteur pour
justifier une colonne serait inverser l'ordre des raisons ; la traçabilité
vaut pour l'audit, pas pour l'écran.

## Action attendue de ChatGPT

Arbitrer Q6, Q7 et Q8 pour le `LOT_ID` **S-5-SHIFT-ID-INVENTAIRE-20260905**,
puis écrire la décision dans `docs/handoff/DECISION.md`.
