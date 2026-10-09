# C1 client — diagnostic de contrat

**05/09/2026 · diagnostic uniquement · aucune correction, aucun push**

Contrat cible proposé par l'arbitrage :

```js
await NexusStation.fuseauDeLaStation(siteId)
// => { timezone }
// => { indetermine: 'configuration' }
// => { indetermine: 'reseau' }
```

## Écart avec ce qui existe déjà

`nexus-station.js` (poussé en A3-1) expose déjà `fuseauDeLaStation`, mais avec
une autre signature : `fuseauDeLaStation(client, siteId)`, renvoyant
`{ fuseau }` ou `{ indetermine: 'reseau' | 'absent' | 'site' }`.

**Trois alignements à faire** — aucun n'est cosmétique :

| Existant | Cible | Pourquoi cela compte |
|---|---|---|
| `client` en 1ᵉʳ paramètre | supprimé | le client Supabase est un global posé par `nexus-auth.js` ; le passer invite à en passer un autre |
| `{ fuseau }` | `{ timezone }` | même mot que la colonne `sites.timezone` — un synonyme est une invitation à diverger |
| `indetermine: 'absent'` | `'configuration'` | dit *ce qui* manque, pas seulement *qu'il* manque |

`'site'` (appel sans `siteId`) disparaît : c'est une erreur de programmation,
pas un état du système. Elle devient une exception.

---

# Les 8 occurrences

## Frontière retenue

Trois natures, et la règle ne s'applique pas de la même façon :

- **Résolveur** — un écran, au démarrage. Il a le droit d'aller lire.
- **Couche de données** — les `nexus-*-donnees*.js`. Elles font déjà du
  réseau, mais **elles ne doivent pas résoudre le fuseau** : elles le
  reçoivent. Sinon chaque fonction de chargement devient un point d'entrée
  possible vers `sites`, et la dépendance redevient diffuse.
- **Fonction pure** — ne fait aucun réseau. Le fuseau est un argument
  **obligatoire**.

---

### C1-1 · `NEXUS-Parametres-Station-v1.html:1135` — `FUSEAU_DEFAUT`

| | |
|---|---|
| Nature | **Résolveur** (écran de paramétrage) |
| Fournisseur actuel | `station_config.fuseau_horaire`, lu dans `chargerConfig()` |
| Pure / réseau | **Réseau** |
| Signature actuelle | `async chargerConfig() → { horaires, fuseau }` |
| Signature proposée | `async chargerConfig() → { horaires, timezone }` |
| Si indisponible | L'écran affiche le champ fuseau **vide** avec « non configuré ». C'est l'écran qui sert à configurer : il ne bloque pas, il montre le trou. |
| Appelants | 1 (`remplirFormulaire`) |

Cas particulier assumé : c'est le **seul** des huit où l'absence n'est pas
bloquante, parce que l'écran existe précisément pour la combler.

### C1-2 · `NEXUS-Verify-v1.html:823` — `FUSEAU_STATION`

| | |
|---|---|
| Nature | **Résolveur** |
| Fournisseur actuel | lecture directe `station_config` ligne 1319, en `.then()` non attendu |
| Pure / réseau | **Réseau** |
| Signature actuelle | variable globale mutable, initialisée à `'America/Martinique'` |
| Signature proposée | `let FUSEAU_STATION = null;` puis `await NexusStation.fuseauDeLaStation(SITE_ACTUEL)` **attendu** avant le premier rendu |
| Si indisponible | Les heures s'affichent « — » et un bandeau dit « fuseau du commerce non configuré ». Aucune heure fausse. |
| Appelants | 1 usage (`:867`, formatage d'heure de validation) |

**Défaut supplémentaire relevé au passage** : la lecture actuelle est un
`.then()` non attendu. Le premier rendu peut donc se faire **avant** la
réponse, à l'heure de Martinique, puis être corrigé sans que rien ne le
signale. Passer par le contrat impose l'`await` et supprime cette course.

### C1-3 · `NEXUS-Carburants-Pilotage-v1.html:806` — `FUSEAU_STATION`

| | |
|---|---|
| Nature | **Résolveur** |
| Fournisseur actuel | `stationConfig.fuseau_horaire`, posé ligne 4566 |
| Pure / réseau | **Réseau** |
| Signature actuelle | globale mutable initialisée à `'America/Martinique'` |
| Signature proposée | idem C1-2 |
| Si indisponible | Les 4 formatages (`:993`, `:994`, `:1246`, `:1247`) affichent « — ». Le pilotage carburant est une décision métier : pas d'heure devinée. |
| Appelants | 4 usages internes |

### C1-4 · `nexus-carburant-donnees.js:296` — `chargerControleJour`

| | |
|---|---|
| Nature | **Couche de données** |
| Fournisseur actuel | sa propre lecture `station_config` (même requête que `horaires`) |
| Pure / réseau | **Réseau** |
| Signature actuelle | `chargerControleJour(client, siteId, date)` |
| Signature proposée | `chargerControleJour(client, siteId, date, timezone)` — **obligatoire** |
| Si indisponible | L'appelant ne l'appelle pas. La fonction lève si `timezone` manque : c'est une erreur de programmation, pas un état métier. |
| Appelants | **8 en production** : Brief, Rapport, Carburants, Carburants-Pilotage, `commande-donnees-core:287`, `p0-fixes:257`, `p0-ui:162`, `app-donnees` — **plus ~15 fichiers de test et 2 simulations** |

**C'est l'occurrence la plus coûteuse des huit**, et de loin. Elle mérite son
propre sous-lot.

### C1-5 · `nexus-carburant-commande-donnees-core.js:40` — `heureHHMMAujourdhui`

| | |
|---|---|
| Nature | **Fonction pure** |
| Fournisseur actuel | argument `fuseau`, avec `|| 'America/Martinique'` |
| Pure / réseau | **Pure** |
| Signature actuelle | `heureHHMMAujourdhui(fuseau)` |
| Signature proposée | `heureHHMMAujourdhui(timezone)` — lève si absent |
| Si indisponible | Lève. Une fonction pure n'a pas à décider quoi faire d'une absence. |
| Appelants | 1 (`:575`) |

**Second défaut, plus grave que le premier** : le `catch` retombe sur
`d.getHours()` — **l'heure du navigateur**. Un manager consultant depuis la
métropole verrait l'heure de son téléphone présentée comme celle de la
station. Ce repli-là n'est pas Sainte-Marie : il est pire, il dépend de
l'appareil. Il doit disparaître avec l'autre.

### C1-6 · `nexus-carburant-commande-donnees-core.js:69` — `chargerConfigEtCuves`

| | |
|---|---|
| Nature | **Couche de données** |
| Fournisseur actuel | sa propre lecture `station_config` |
| Pure / réseau | **Réseau** |
| Signature actuelle | `chargerConfigEtCuves(client, siteId) → { config, cuves, fuseau, horaires }` |
| Signature proposée | `chargerConfigEtCuves(client, siteId) → { config, cuves, horaires }` — **le fuseau sort du contrat** |
| Si indisponible | Sans objet : la fonction ne le fournit plus. |
| Appelants | 1 en production (`:571`), 1 test |

Le fuseau quitte cette fonction. C'est le geste qui applique littéralement la
règle : la couche de données cesse d'être un fournisseur de fuseau.

### C1-7 · `nexus-carburants-p0-performance.js:19` — `dateLocaleISO`

| | |
|---|---|
| Nature | **Fonction pure** |
| Fournisseur actuel | argument `fuseau`, avec `|| 'America/Martinique'` |
| Pure / réseau | **Pure** |
| Signature actuelle | `dateLocaleISO(fuseau)` |
| Signature proposée | `dateLocaleISO(timezone)` — lève si absent |
| Si indisponible | Lève. |
| Appelants | 1 (`:100`) |

Même `catch` vers l'heure du navigateur qu'en C1-5. Même traitement.

### C1-8 · `nexus-carburants-p0-performance.js:99` — `cfg.fuseau_horaire || …`

| | |
|---|---|
| Nature | **Couche de données** |
| Fournisseur actuel | `station_config` lu dans la même fonction |
| Pure / réseau | **Réseau** |
| Signature actuelle | `chargerPerformance(client, siteId, debut, fin)` (fuseau résolu en interne) |
| Signature proposée | `chargerPerformance(client, siteId, debut, fin, timezone)` |
| Si indisponible | L'appelant ne l'appelle pas ; la fonction lève. |
| Appelants | à confirmer avant correction — l'écran Carburants Performance |

---

# Ce que le diagnostic fait apparaître

**1 · Deux natures de repli, pas une.** Six occurrences retombent sur
Sainte-Marie ; **deux retombent sur l'heure du navigateur** (C1-5, C1-7). Le
second est plus insidieux : il n'est pas seulement faux, il est *différent
pour chaque utilisateur*. Ils n'étaient pas dans l'inventaire A3 initial parce
qu'ils vivent dans un `catch`, pas dans une valeur par défaut.

**2 · Une course non signalée.** C1-2 lit le fuseau dans un `.then()` non
attendu : le premier rendu peut être fait à l'heure de Martinique puis corrigé
en silence.

**3 · Le coût est concentré sur une seule fonction.** Sept occurrences ont 1 à
4 appelants. `chargerControleJour` en a 8 en production et ~15 en test.

# Découpage proposé

| Sous-lot | Contenu | Appelants touchés |
|---|---|---|
| **C1c-0** | Aligner le contrat : `fuseauDeLaStation(siteId)`, `{ timezone }`, `'configuration'` | 0 (aucun appelant encore) |
| **C1c-1** | C1-5 et C1-7 — fonctions pures, suppression des deux replis navigateur | 2 |
| **C1c-2** | C1-2 et C1-3 — résolveurs d'écran, `await` avant premier rendu | 5 usages |
| **C1c-3** | C1-1 — écran de paramétrage, champ vide et non bloquant | 1 |
| **C1c-4** | C1-6 et C1-8 — le fuseau sort des couches de données | 2 + à confirmer |
| **C1c-5** | C1-4 — `chargerControleJour`, sous-lot dédié | 8 + ~15 tests |

**Aucune correction engagée. `main` et `production` restent à `501c0c7`.**
