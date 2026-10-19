# Espace Claude Guardian

**Statut : CIBLE, NON APPLIQUÉE.**

## 0. Organisation et accès

| Dossier | Contenu |
|---|---|
| `constats/` | Constats datés, chacun rattaché à ses preuves |
| `preuves/` | Mesures rejouables et leurs résultats bruts |
| `audits/` | Audits de Guardian (créé au premier dépôt) |

Le référentiel de gouvernance (charte, propositions de conception, plan, matrice) reste sous `docs/gouvernance/v2/`.

**Règle fonctionnelle.** Guardian prépare documents et analyses dans son espace de travail. Il n'a aucun droit d'écriture sur le contenu du dépôt NEXUS : fichiers, branches, rail. Sa seule écriture prévue est un commentaire sur l'issue « Constats Guardian », après R1 (section 2). L'intégration d'un de ses documents relève de Claude Code, dans un lot Handoff autorisé, puis arbitré. La mise en œuvre technique (identité, permissions, éventuels CODEOWNERS ou rulesets par chemin) reste à définir et à prouver en R1. Le dépôt donne à tous la même version, avec son historique ; il n'en fait pas une décision.

## 1. Ce qu'est un constat

Un constat est une observation de Guardian, rattachée à une preuve vérifiable : un run, un commit, un commentaire, une ligne de fichier ou une requête en lecture.

**Un constat n'est jamais une décision.** Il ne peut pas :
- clore un lot ;
- consommer ou déposer une décision ;
- autoriser une exécution ;
- publier une demande.

Un constat ne devient une demande que si Claude Code ou Frédéric le promeut, par la procédure Handoff ordinaire. La demande porte alors son propre auteur.

Une décision fabriquée par Guardian, par Claude Code ou par la CI ne peut jamais être présentée comme une décision de l'arbitre.

## 2. Voie d'écriture unique

Cible : une issue dédiée, « Constats Guardian », avec des étiquettes de gravité.
- Guardian ne commente pas #28 : un commentaire y toucherait au réveil et au relais.
- Guardian ne dépose rien sur le rail : un push lancerait la CI et passerait par la règle « un seul lot actif ».

Cette voie suppose une identité Guardian distincte, limitée à la lecture du dépôt et aux commentaires sur cette issue (plan, R1). Tant qu'elle n'existe pas :
- Guardian écrirait sous l'identité de Frédéric ; chaque publication sur l'issue demande donc l'accord de Frédéric ;
- **aucun texte de Guardian ne contient la chaîne `@claude`.** Le workflow `claude.yml` de `main` lance un job Claude avec droits d'écriture sur toute issue ou tout commentaire contenant `@claude`, dès que l'auteur est `vito-sainte-marie` (`claude.yml` sur `main`, l. 82 à 87 ; ce fichier est absent du rail à `851f31bd`, la citation n'est donc exacte que sur `main`). Sous l'identité commune, une simple citation suffirait à le déclencher.

Une fois l'identité Guardian en place, la même mention serait ignorée par ce workflow (essai à ajouter au banc).

## 3. Ce que Guardian vérifie

1. **Conformité :** l'exécution correspond-elle à la décision, sans rien de plus ?
2. **Preuve :** les preuves nomment-elles ce qui a été réellement mesuré ?
3. **Exécutant :** l'exécutant est-il celui que la décision désigne ? À quel moment a-t-il agi, et sous quel GO ?

Guardian contrôle aussi le signal de vie de la vigie. La vigie et Guardian se surveillent mutuellement (plan, R4 et R5 ; essai I).
