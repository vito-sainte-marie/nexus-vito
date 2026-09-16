# Deux constats mesurés, un seul rapatriement — ARCH-006 et ARCH-003

Mesuré le 16/09/2026 sur `origin/production` à `faba5628`, et nulle part ailleurs.
Aucune de ces deux analyses ne produit de correction dans ce lot. C'est le sujet
du document : dire pourquoi, et laisser au lecteur de quoi trancher sans refaire
le travail.

La décision canonique du 07/09 (`docs/gouvernance/2026-09-07-audit-travaux-claude-branches-isolees.md`,
§6, sur la ligne où ce fichier existe) pose la règle qui gouverne les deux :

> « Ne pas corriger automatiquement les sujets ambigus. »

Un audit rendu sur une autre ligne n'est pas un fait sur celle-ci. Les deux
constats ci-dessous ont donc été **remesurés ici**, avec les commandes citées.

---

## ARCH-006 — rapatrier `e9262da` sur cette ligne : obsolète

### Ce que `e9262da` apportait, là où il a été écrit
Le commit factorisait la résolution de connexion de `outils/reconstruire-base-test.sh` :

- un nouveau `outils/resoudre-connexion-test.sh`, chargé par `source`, appelé
  `nexus_resoudre_connexion_test "$REF" "${2:-}" "${3:-}"` ;
- un mode `--url-env NOM_VARIABLE`, pour qu'un rail CI passe l'URL par une
  variable d'environnement au lieu de la composer ;
- le remplacement mécanique de `psql "$URL"` par `psql`, la connexion devenant
  implicite via les variables `PG*` ;
- son appelant complémentaire `outils/repeter-lot-production-readiness-test.sh`
  et deux épreuves, `test_repetition_preserve_journal_20260909.js` et
  `test_resoudre_connexion_test_20260909.js`.

### Ce qui est vrai ici
Sur `origin/production`, `reconstruire-base-test.sh` **existe** — et rien d'autre
de ce commit n'existe :

    $ git grep -nI -e 'reconstruire-base-test' -e 'SUPABASE_TEST_DB_URL' origin/production
    origin/production:outils/reconstruire-base-test.sh:23:#   outils/reconstruire-base-test.sh <project-ref>

Une seule ligne, et c'est le script qui se cite lui-même dans son propre mode
d'emploi. Autrement dit : **aucun appelant**. Les deux seuls workflows de la
ligne sont `.github/workflows/tests.yml` et
`.github/workflows/deploiement-production.yml` ; ni l'un ni l'autre ne lance ce
script. Le secret `SUPABASE_TEST_DB_URL_WRITE`, que le mode `--url-env` existe
pour consommer, n'est référencé nulle part. `outils/` ne contient ici que
`poser-build-id.js`, `reconstruire-base-test.sh` et
`reinitialiser-scenario-test.sh` : `repeter-lot-production-readiness-test.sh`
et `resoudre-connexion-test.sh` sont absents.

Sur cette ligne, `reconstruire-base-test.sh` est donc un outil **strictement
manuel**, lancé par un humain depuis sa machine.

### Le seul élément critique est déjà là
Ce qui protège Production dans ce script, c'est son refus de pointer la
référence Production. Il est présent et correct sur `origin/production` :

    PROD_REF="uzhjpqpctpvxytxpxoqz"
    …
    exit 3

Le mot de passe vient du trousseau et n'est jamais affiché :

    MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
    export PGPASSWORD="$MDP"; unset MDP

et la connexion est **directe** plutôt que par le pooler, avec la raison écrite
dans le script : le nom d'hôte du pooler dépend de la région et de l'instance.

### Verdict
**Obsolète pour la ligne `production`.** Rapatrier `e9262da` ici, ce serait
installer une indirection de connexion et un mode `--url-env` au service d'un
rail CI qui n'existe pas, pour un script que personne n'appelle
automatiquement. C'est le critère 6 de la doctrine du Guardian Philosophie,
rapatriée le même jour :

> « Prévention de la dérive ERP — chaque brique répond à un besoin démontré,
>   jamais "au cas où". »

Ce verdict est **conditionnel à une mesure**, et la condition est écrite
exprès : le jour où un workflow de cette ligne appellera
`reconstruire-base-test.sh`, ou le jour où le secret
`SUPABASE_TEST_DB_URL_WRITE` y sera déclaré, le besoin deviendra démontré et
`e9262da` redeviendra pertinent. La commande `git grep` ci-dessus est la
vérification à rejouer — elle tient en une ligne, et elle est la réponse.

---

## ARCH-003 / finding 3a — la collision `window.NexusStock` : muette, pas fausse

### L'audit du 06/09 est périmé sur un point
Il disait : « `nexus-stock-moteur.js` n'est inclus par aucune page HTML. »
Littéralement vrai — aucun `<script src>` en dur ne le nomme. Pratiquement
faux : `nexus-auth.js:37-38` l'injecte dynamiquement sur cinq écrans.

    const pagesStockMoteur=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html',
      'NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html',
      'NEXUS-Centre-Intelligence-v1.html'];

### Deux fichiers possèdent le même nom global

| | `nexus-stock.js` | `nexus-stock-moteur.js` |
|---|---|---|
| chargement | `<script src>` en dur | injecté par `nexus-auth.js`, `defer=true` |
| écrans | Brief, Cockpit, Scanner-Stock | App, Cockpit, Scanner, Radar-Manager, CIN |
| affectation | `global.NexusStock = {…}` (l. 180) | `window.NexusStock=Object.freeze({…})` (l. 125) |
| API commune | `calculerAnalyseStock`, `calculerRisqueParRayon` | les deux, **plus** `chargerEtat`, `stockPourUsage`, `comparer`, `expliquer`… |

`Object.freeze` gèle l'objet, **pas** la propriété `window.NexusStock` : le
dernier script exécuté écrase l'autre. Et un script inséré dynamiquement avec
`defer=true` n'est pas ordonné par rapport aux scripts du document. Sur un écran
qui charge les deux, **l'issue est une course.**

### La conséquence n'est pas un chiffre faux, c'est un silence
`nexus-conseiller-donnees.js:102` charge les relevés avec :

    .from('stock_releves').select('article, categorie, quantite_theorique, releve_le')

Le filtre du moteur, `nexus-stock-moteur.js:116`, exige :

    if(r.comparaison_fiable!==true || r.ecart_reference==null
       || Math.abs(Number(r.ecart_reference))<=0.001) continue;

Ni `comparaison_fiable` ni `ecart_reference` ne figurent dans le `select` : les
deux valent `undefined` sur **toutes** les lignes. Quand c'est le moteur qui
possède le nom, `calculerRisqueParRayon` retourne donc **toujours `[]`**.

Pas de « undefined € » à l'écran, pas de risque affiché à 0 € : **aucun candidat
Stock du tout.** Le Conseiller ne se trompe pas, il se tait — et un manager ne
distingue pas « rien à signaler sur le stock » de « le stock n'a pas été
regardé ». C'est exactement le silence ambigu que le Guardian Philosophie
nomme sur les écrans, ici produit par une ligne de `select`.

L'autre implémentation, `nexus-stock.js:164`, ne filtre pas sur la fiabilité :
elle groupe par rayon et ne garde que les rayons où `nbAVerifier > 0`. Avec le
même `select`, elle rend des candidats.

### Écran par écran, tel que mesuré

- **`NEXUS-App-v1.html`** — charge `nexus-conseiller-donnees.js`, ne charge
  **pas** `nexus-stock.js` en dur, reçoit le moteur par injection. Aucun
  concurrent : **déterministe**. Le moteur Stock du Conseiller est muet sur
  l'écran principal.
- **`NEXUS-Cockpit-v2.html`** — charge les deux. **Course.** Si le moteur
  gagne : même silence qu'App. Si `nexus-stock.js` gagne : le Conseiller rend
  des candidats, mais `nexus-conseiller-stock-v3.js` et
  `nexus-cockpit-stock-v3.js`, injectés sur cet écran et consommateurs de
  `stockPourUsage` / `comparer`, résolvent leur attente de `window.NexusStock`
  sur un objet **qui n'a pas ces méthodes**.
- **`NEXUS-Brief-v1.html`** — charge `nexus-conseiller-donnees.js` et
  `nexus-stock.js`, et n'est **pas** dans `pagesStockMoteur`. Aucune collision :
  **correct**, et c'est le seul écran où le Conseiller Stock se comporte comme
  son auteur l'a écrit.
- **`NEXUS-Centre-Intelligence-v1.html`** — reçoit le moteur, mais ne charge pas
  `nexus-conseiller-donnees.js` : `chargerCandidatsStock` n'y tourne pas. **Hors
  sujet.**
- **Scanner-v1, Radar-Manager** — n'utilisent que les satellites de l'API
  moteur. Corrects.

### Pourquoi ce n'est pas un défaut déterministe que je corrige d'office
Le moteur **revendique** ce silence, en commentaire, juste au-dessus du filtre :
aucun rayon n'est remonté tant que l'écart réel/théorique n'est pas fiable.
`nexus-stock.js` invoque la même doctrine à l'endroit exactement symétrique
(l. 160-163) : « N'invente aucune démarque […] NEXUS n'a aujourd'hui aucun
comptage réel en base pour l'affirmer ».

Les deux fichiers appliquent **la même règle à deux sévérités différentes**.
L'un dit : sans comparaison fiable, je ne nomme aucun rayon. L'autre dit : sans
comptage réel, je nomme le rayon mais je n'affirme aucune perte. Choisir entre
les deux, c'est décider ce que le manager doit voir le matin quand personne n'a
compté. C'est une question de produit, pas de code, et aucune des trois issues
ci-dessous ne se déduit du dépôt.

### Les trois options, à arbitrer

1. **Le moteur a raison.** Le candidat « à compter » ne doit pas exister tant
   qu'aucun comptage physique n'est en base. Alors : retirer
   `calculerAnalyseStock` et `calculerRisqueParRayon` de `nexus-stock.js`,
   retirer `chargerCandidatsStock` du Conseiller — et **le dire à l'écran**,
   plutôt que de se taire par accident.
2. **L'ancien a raison.** Le signal par rayon reste utile comme invitation à
   compter. Alors : élargir le `select` de `nexus-conseiller-donnees.js` à
   `comparaison_fiable` et `ecart_reference`, et ne laisser qu'**un seul
   propriétaire** de `window.NexusStock`.
3. **Les deux ont raison, sur deux écrans différents.** Alors il faut deux noms
   distincts — `NexusStock` et `NexusStockMoteur` — et la course disparaît
   d'elle-même.

Dans les trois cas, la course sur Cockpit doit cesser : un écran dont le
comportement dépend de l'ordre d'arrivée de deux scripts n'est pas auditable,
quelle que soit la réponse produit.

**Rien n'est corrigé ici.** Le faire exigerait de choisir, et choisir n'est pas
à moi.
