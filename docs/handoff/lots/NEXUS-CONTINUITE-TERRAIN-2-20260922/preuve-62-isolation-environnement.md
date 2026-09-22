# Preuve #62 — où vit réellement le défaut d'isolation d'environnement

**Lot** `NEXUS-CONTINUITE-TERRAIN-2-20260922` · **Rail** `handoff-continuite-20260920`
**Objet de la mesure** : la PR #62, tête `fe4e9a2`, branche `fdj-vague1-cycle-caisse-20260916`.
**Rien n'a été poussé, fusionné, déployé, ni écrit en base.** Toutes les mesures
ci-dessous sont des lectures : `git`, et des `GET` HTTP anonymes.

---

## 1. Ce qui était demandé

Le NO GO Production du 22/09 sur #62 n'était pas fonctionnel : il portait sur un
défaut d'architecture. Formulation retenue alors — « son `nexus-auth.js` vise
Supabase **Production** en dur, donc une recette navigateur de cette branche y
écrirait ; à corriger avant qu'il puisse être candidat ».

Ce document mesure ce défaut au lieu de le supposer. Il aboutit à une conclusion
différente de l'énoncé du NO GO, et à la même décision.

---

## 2. Le défaut n'est pas dans #62 — il est hérité

`fe4e9a2` descend de `origin/production` : **30 commits, 42 fichiers,
16 905 insertions / 760 suppressions** (migrations, `supabase/phase-c/*`,
`supabase/recette-vague1/*`, épreuves `test_fdj_*.js`).

Neuf fichiers de cet arbre citent la référence Production
`uzhjpqpctpvxytxpxoqz`. Ils ne sont pas de même nature :

| Fichier | Nature de la citation | Servi au navigateur ? |
|---|---|---|
| `nexus-auth.js` | **client Supabase construit en dur** | oui |
| `NEXUS-Login-v1.html` | `const SUPABASE_URL = "…"` **exécutable** | oui |
| `NEXUS-Admin-API-v1.html` | `const FN_URL = "…"` **exécutable** | oui |
| `NEXUS-API-v1.html` | prose de documentation dans un `<pre>` | oui, mais inerte |
| `.github/deploiement/verifier-artefact-pages.js` | nomme la cible qu'il vérifie | non |
| `.github/deploiement/test_verifier_artefact_pages_20260915.js` | idem, avec la réf Test à côté | non |
| `outils/preuve-projection-mes-ecarts-caisse.js` | commentaire de provenance d'un jeu d'essai | non |
| `test_inventaire_reglages_fantomes_v2307.js` | commentaire | non |
| `test_migration_apres_le_code_20260916.js` | commentaire | non |

**La mesure décisive** — le différentiel des quatre fichiers servis entre la
branche de base et la tête de #62 :

```
$ git diff --stat origin/production fe4e9a2 -- \
    NEXUS-API-v1.html NEXUS-Admin-API-v1.html NEXUS-Login-v1.html nexus-auth.js
(sortie vide)
```

**#62 ne touche aucun des quatre.** Il hérite le `nexus-auth.js` de 932 lignes
de `production`, dont les lignes 6-9 :

```js
const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_…";
const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);
```

Le défaut est une propriété de la lignée `production`, pas un apport de ces
30 commits. Toute branche ouverte depuis `production` le porte à l'identique.

---

## 3. L'exposition est-elle vive ? Trois chemins examinés

### 3.1 La recette navigateur de la CI — **absente de cette branche**

```
$ git show fe4e9a2:.github/workflows/tests.yml | grep -c 'recette-navigateur\|NEXUS_REF_EST_LE_RAIL'
0
```

Le motif du NO GO supposait qu'une recette navigateur de #62 écrirait en
Production. Elle n'y existe pas : les étapes profondes ne sont pas *sautées* sur
cette branche, elles sont **absentes du fichier**. Elles vivent sur le rail,
conditionnées au booléen `NEXUS_REF_EST_LE_RAIL` (`tests.yml:397-689` au rail).
Le raisonnement du NO GO était juste sur le défaut, faux sur le déclencheur.

### 3.2 Les scripts exécutés par la CI — **aucun client Production**

Les trois fichiers non servis qui citent la référence ne construisent aucun
client : `test_inventaire_reglages_fantomes_v2307.js` et
`test_migration_apres_le_code_20260916.js` la citent en commentaire d'en-tête,
`outils/preuve-projection-mes-ecarts-caisse.js` dans un commentaire de
provenance au-dessus d'un SQL qui s'exécute sur un schéma local jetable.
Aucun chemin d'écriture Production exécuté par la CI de #62.

### 3.3 Le site déployé — **aucun déploiement pour cette branche**

Règle d'alias Cloudflare : minuscules, non-alphanumérique → `-`, 28 caractères
au plus. Mesure, avec le rail en **témoin** pour distinguer « alias faux » de
« pas de déploiement » :

| Alias sondé | `GET …/nexus-auth.js` |
|---|---|
| `handoff-continuite-20260920` (**témoin**) | **200** |
| `fdj-vague1-cycle-caisse-2026` (#62, tronqué à 28) | 404 |
| `fdj-vague1-cycle-caisse-20260916` (non tronqué) | 404 |
| `fdj-vague1-cycle-caisse-202` | 404 |
| `reception-regularisation-2026` (#65) | 404 |
| `reception-regularisation-20260919` | 404 |

Le témoin répond : l'hôte et le projet Pages fonctionnent. **Ni #62 ni #65 n'ont
de déploiement Test.** La généralisation « Cloudflare construit chaque branche
poussée », vraie pour le rail, ne se vérifie pas pour ces deux branches poussées
le 22/09.

**Conséquence à énoncer sans l'embellir :** le chemin « un humain ouvre l'adresse
de la branche et parle à la vraie base » n'est pas vif aujourd'hui — par
*accident de configuration*, pas par garde. Un build qui aboutirait demain le
rendrait vif sans qu'aucun contrôle ne s'y oppose.

### 3.4 Le chemin qui reste vif : servir l'arbre en local

Ouvrir `fe4e9a2` depuis un serveur local vise Production, immédiatement et sans
avertissement, puisque l'adresse est dans le fichier. C'est le seul des quatre
chemins qui ne dépend d'aucune infrastructure.

---

## 4. Pourquoi un correctif confiné à #62 est impossible

Trois voies, toutes fermées :

1. **Reprendre le `nexus-auth.js` du rail (305 lignes).** Il lit
   `window.NEXUS_CONFIG` et **échoue fermé** s'il est absent — refus délibéré,
   écrit dans le fichier : « une valeur par défaut serait forcément celle d'un
   environnement, et ferait écrire la recette dans la base de l'autre ». Il
   exige en outre `NexusBuild.versionner` et `NexusPage.est`. Or `nexus-config.js`
   **n'existe dans aucun arbre**, rail compris : il est produit à la construction.
   Production est servie **brute par GitHub Pages, sans build**. Porter ce
   fichier sur une branche issue de `production` ne corrigerait pas l'isolation :
   il provoquerait une **panne totale** au chargement.

2. **Inventer une valeur par défaut** pour survivre à l'absence de
   `nexus-config.js`. C'est exactement ce que le mécanisme refuse par écrit.
   Ce serait réintroduire le défaut sous un autre nom.

3. **Fournir le build.** `outils/build.sh` et le mode d'artefact `construit`
   sont hors mandat.

Il n'y a donc pas de correctif juste à l'échelle de `fe4e9a2`. Colmater ici
serait cosmétique ou fatal.

---

## 5. Le correctif existe déjà — au rail, et complet

Inventaire au rail des fichiers servis citant encore la référence Production :

```
$ git ls-tree -r --name-only HEAD | grep -E '\.(js|html)$' \
    | grep -v '^test_\|^outils/\|^\.github/' | … grep uzhjpqpctpvxytxpxoqz
NEXUS-API-v1.html
```

**Une seule occurrence subsiste**, et elle est légitime :
`NEXUS-API-v1.html:607`, prose de documentation dans un `<pre>` sous l'intitulé
« URL de base / Production », destinée aux intégrateurs du connecteur, assortie
de sa propre justification (« Cette adresse peut être publiée sans risque :
l'accès est protégé par la clé API »). Le fichier ne contient **aucune** balise
`<script>` ni `createClient` : rien n'y est exécutable.

Les trois autres sont convertis : `nexus-auth.js` lit la configuration et échoue
fermé, `NEXUS-Login-v1.html:92-102` refuse de démarrer sans `NEXUS_CONFIG`,
`NEXUS-Admin-API-v1.html:126` dérive son `FN_URL` de `NEXUS_SUPABASE_URL` au
lieu de le coder en dur.

**Le défaut se referme quand le rail arrive en Production — mécanisme de
configuration et build ensemble.** Il ne se referme pas branche par branche.

---

## 6. Correction apportée au motif du NO GO

Le NO GO Production sur #62 **reste juste et reste en vigueur**, mais son motif
se reformule :

- ❌ « une recette navigateur de cette branche écrirait en Production » —
  la recette n'existe pas sur cette branche (§3.1).
- ✅ « l'arbre servi par cette branche parle à Production dès qu'il est servi » —
  vrai, mesuré, et vrai de **toute** branche issue de `production` (§2, §3.4).

Le défaut n'est donc pas une objection *contre #62* : c'est une dette de la
lignée `production`, que #62 révèle sans l'avoir créée. La conséquence pratique
est inchangée — #62 ne peut pas devenir un candidat Production complet tant que
la dette n'est pas close — mais le travail à faire n'est pas sur `fe4e9a2`.

---

## 7. Ce que cette preuve n'autorise pas

Aucune fusion, aucun déploiement, aucune écriture Supabase. Elle ne lève pas le
NO GO de #62 : elle en déplace la charge sur l'arrivée du rail en Production, et
elle écarte l'idée qu'un correctif local à `fe4e9a2` serait possible ou
souhaitable.

Elle ne dit rien de la valeur fonctionnelle des 30 commits de #62, qui n'a pas
été mesurée ici.

---

*Mesures prises le 22/09/2026, en lecture seule, depuis le worktree du rail.*
