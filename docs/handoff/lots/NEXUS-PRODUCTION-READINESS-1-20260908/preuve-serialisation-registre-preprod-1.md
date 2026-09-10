# Sérialisation des six épreuves du registre PREPROD — exécutée

**10/09/2026.** Arbitrage Orchestrator relayé par Frédéric Bragance
(`request-8`) : **voie 2**. Sérialiser le périmètre minimal, ne toucher ni les
gardes, ni le script de release, ni aucune variable d'environnement.

Voie 1 (chemin de registre surchargeable) **rejetée** — élargissement de
surface de sécurité. Voie 3 (durcissement du script de release) **différée**
après la gate.

---

## Ce qui a changé — un seul fichier

`run-tests.js`. Une **voie dédiée** draine les épreuves qui nomment le registre
partagé, une par une ; les autres voies se partagent le reste et gardent le vol
de travail.

```
262 épreuve(s), 8 en parallèle, dont 6 sérialisée(s) sur le registre partagé.
```

**La liste n'est pas écrite à la main.** Elle est déduite du contenu des
fichiers : toute épreuve qui nomme `PREPROD-CYCLE` est exclusive. C'est la
réponse à l'objection que je portais moi-même contre cette voie — « la
protection dépend d'une liste qu'une épreuve future oubliera ». Une épreuve
future qui touchera au registre sera sérialisée sans que personne y pense.
Une source illisible est sérialisée par défaut : ne pas savoir n'autorise pas
à parier.

**Ce qui n'a PAS changé** : `garde-preprod-ephemere.js`,
`garde-mode-environnement.js`, `repetition-release-complete.sh`, le chemin du
registre canonique, et tout secret ou ressource Production. Aucune variable
d'environnement ne peut rediriger ni masquer le registre — c'était la condition
de l'arbitrage, elle est tenue.

---

## Les preuves

`test_serialisation_registre_preprod_20260910.js` — **9/9**.

### Le plan

| | |
|---|---|
| les six sont détectées par leur **contenu**, pas par une liste | ✓ |
| toutes dans la **même voie** — donc jamais simultanées | ✓ |
| aucune ne figure aussi dans la file partagée | ✓ |
| le parallélisme est conservé pour les 256 autres, largeur inchangée | ✓ |
| en `--sequentiel`, rien à sérialiser et rien de perdu | ✓ |
| une source illisible est sérialisée par défaut | ✓ |

**MUTATION** — sans le prédicat, les six retombent dans la file partagée. Sans
ce témoin, un planificateur qui ne sérialiserait **rien** passerait tous les
contrôles ci-dessus dès que la liste est vide.

### Le comportement — le seul qui prouve quelque chose sur le monde

Un plan correct exécuté par un lanceur fautif laisserait le fichier sale quand
même. On mesure donc le fichier, pas le plan.

- **Chaque épreuve rend le registre octet pour octet** tel qu'elle l'a trouvé —
  empreinte SHA-256 avant et après chacune des six, lancées pour de vrai.
- **La restauration tient quand l'épreuve ÉCHOUE.** Un échec *après* la
  restauration ne prouverait rien : le fichier serait déjà revenu. L'échec est
  donc forcé **à l'intérieur du `try`**, entre le vidage du registre et sa
  restitution — le seul instant où un `finally` absent se verrait. La copie
  mutée vit hors du dépôt.
- **Ni `zzzzrefdetestinexistante` ni aucun cycle ouvert** ne subsiste dans le
  registre après la suite.

### La disparition de l'intermittence

**Huit exécutions de la suite parallèle complète**, d'affilée :

| | |
|---|---|
| échecs hors liste connue | **0 sur 8** |
| registre modifié | **0 sur 8** |
| `zzzzrefdetestinexistante` dans le registre | **0 sur 8** |
| fichier orphelin dans l'arbre de travail | **0 sur 8** |
| verdict | 253/262, les 9 échecs connus, à chaque fois |

Les deux modes concordent : `--sequentiel` rend **253/262** également. Si une
épreuve dépendait d'une autre, la comparaison le dirait.

---

## Ce que ces huit exécutions ont trouvé au passage

Les cinq premières ont fait apparaître **une autre** intermittence, 2 fois sur
6 : `test_build_tracabilite_20260905.js`, en `ENOENT ... copyfile`.

**Cause démontrée, et elle était de moi.** Ce test liste les `.js` de la racine
puis les copie. Ma première version de l'épreuve de sérialisation écrivait sa
copie mutée **dans la racine du dépôt**, puis la supprimait quelques secondes
plus tard : listée, puis disparue avant d'être copiée.

C'était exactement le défaut que ce lot répare — *une épreuve qui écrit dans
l'arbre de travail fait tomber une autre épreuve* — reproduit par moi, en le
réparant. La copie mutée vit désormais dans un répertoire temporaire, avec sa
racine passée explicitement. Zéro occurrence sur les huit exécutions suivantes.

---

## Ce que cette décision ne résout pas

**Le défaut `security` observé sur `ea561f6` reste séparé, et son libellé est
inchangé : cause non isolée.**

`reconstruire-base-test.sh` ne lit jamais `PREPROD-CYCLE.json` — la
sérialisation n'a aucun effet démontré sur lui. Une occurrence, non reproduite,
instrumentée pour la prochaine. Le classer comme réglé par ce lot serait faux.

**La voie 3 reste ouverte** — refuser d'inscrire un cycle pour une référence
manifestement bidon, plutôt qu'écrire puis nettoyer. Différée après la gate,
comme arbitré.
