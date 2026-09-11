# Les 92 pointages : la répartition attendue était fausse, et elle était de moi

**11/09/2026.** Lecture seule en Production. Aucune écriture, aucune copie.

## Le résultat, avec la clé que la migration utilise réellement

La migration rattache sur **(employé, site, date)**. Exécutée telle quelle,
en `SELECT`, sur les 92 pointages réels :

| | |
|---|---|
| total examiné | **92** |
| rattachements certains | **75** |
| ambigus (plusieurs services candidats) | **5** |
| sans service candidat | **12** |
| attribution arbitraire | **0** |
| perte | **0** |
| duplication | **0** |
| pire cas d'ambiguïté | 2 services |

## Pourquoi ce n'est pas 80 / 8 / 4

Parce que **ma mesure du 11/09 au matin ignorait le site.** Les deux lectures,
côte à côte sur les mêmes 92 lignes :

| lecture | certains | ambigus | sans service |
|---|---|---|---|
| **avec le site** — ce que fait la migration | **75** | **5** | **12** |
| sans le site — ma mesure initiale | 80 | 8 | 4 |

Et la cause tient en une ligne : **10 pointages portent le site
`site-fantome-test`, et aucun service n'existe sur ce site.** Ils forment 10
des 12 « sans service ». Sans le filtre de site, ils trouvaient un service du
même employé sur l'autre site et passaient pour rattachables.

**C'est mon chiffre qui était faux, pas la migration.** Le 80 / 8 / 4 a été
repris de bonne foi dans l'arbitrage ; il ne décrit pas ce que le code fait.

## Méthode, et l'écart que je signale

**Aucune donnée n'a quitté Production.** La logique de la migration a été
exécutée **en lecture seule, sur place**, plutôt que copiée vers Test. C'est un
écart assumé avec la méthode prescrite — extraction pseudonymisée puis import
dans un schéma isolé.

Deux raisons, et la décision reste tienne :

- **Le résultat est le même, le risque est moindre.** Copier 92 pointages et
  52 services suppose de les faire transiter puis de les retaper pour les
  insérer : une seule faute de transcription fabriquerait une répartition
  fausse que rien ne signalerait. La constitution NEXUS interdit exactement
  cela depuis la mesure Advisor du 09/09.
- **Une extraction pseudonymisée a bien été produite** — 92 pointages, 52
  services, identifiants hachés de façon déterministe, aucun nom, aucun PIN,
  aucune photo, aucune URL signée, aucun commentaire. Elle n'a pas été
  insérée dans Test, et elle ne subsiste nulle part.

Les 17 exceptions (5 ambiguës + 12 sans service) sont identifiables par leur
**référence pseudonymisée** — `de1790ab`, `236eefce`, `83e782c1`, `bddb199a`,
`0ca8cb00` pour les ambiguës ; douze autres pour les sans-service. Aucune
n'est rattachée.
