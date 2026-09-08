<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908
seq: 1
author: Frédéric Bragance
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# LANG-003 — portée arbitrée : le contenu lu par l'utilisateur

## Ce qui est tranché

Frédéric Bragance arbitre la **portée 1** proposée en `§4.1` de
`docs/nexus/AUDIT-PHILOSOPHIE-LANGAGE-RESULTATS-20260908.md` :

> l'interdiction du tiret cadratin s'applique au **contenu produit par NEXUS et
> lu par l'utilisateur final**, et à lui seul.

Sont donc **hors portée** : les commentaires de développement, la documentation
doctrinale, de gouvernance et de Handoff — y compris les échanges Claude ↔
Orchestrator — ainsi que les moteurs, tant que leur sortie n'est pas affichée.

## Pourquoi cette portée change tout mécaniquement

La mesure réelle du dépôt donnait 4 810 occurrences dans 62 écrans, 305 dans la
doctrine et 108 dans les moteurs. Câbler la règle sur la portée 3 aurait produit
plusieurs milliers de signalements d'un coup, et QA-002 prévoit exactement ce qui
serait arrivé ensuite : la garde aurait été désactivée avant d'avoir servi, et
elle aurait emporté ses vraies trouvailles avec elle.

La portée 1 réduit la cible à ce que NEXUS **dit**, pas à ce qu'il contient.
C'est aussi la seule des trois portées qui exprime une intention de produit
plutôt qu'une préférence typographique.

## Ce que cette décision n'arbitre PAS

Les deux ajouts à `BIBLE.md` proposés en `§5.1` (« une mesure absente n'est pas
une mesure nulle », « une décision humaine sensible ne s'automatise pas ») et la
note de révision de `NEXUS-Constitution-v1.md` Art.12/13 proposée en `§4.2` **ne
sont pas tranchés ici**. Ils n'ont pas été soumis à Frédéric dans les mêmes
termes, et rien dans son arbitrage ne les mentionne. Les inscrire au motif
qu'ils étaient dans la même demande fabriquerait une approbation qui n'a pas eu
lieu. Ils restent ouverts.

## Ce qui est attendu de Claude

1. Mesurer la portée 1 avant de câbler quoi que ce soit (QA-002) : identifier le
   contenu réellement affiché, et non l'estimer.
2. Corriger les occurrences trouvées dans ce périmètre.
3. Ne câbler la règle en CI que si la mesure le permet — et le dire si elle ne
   le permet pas, plutôt que de câbler une garde qui sera désactivée.
