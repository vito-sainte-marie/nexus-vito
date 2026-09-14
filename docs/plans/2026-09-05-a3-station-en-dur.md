# A3 — le nom et les valeurs d'une station écrits en dur

**Ouvert le 05/09/2026 · diagnostic uniquement · aucune correction**

Source de vérité en base : `sites.nom_entreprise`, clé `sites.site_id` (texte).
Trois sites existent dans `nexus-test` : `nexus-station-test`,
`site-fantome-test`, `vito-sainte-marie`.

## Ce que le comptage brut fait croire, et ce qu'il cache

| Motif | Occurrences |
|---|---|
| `vito-sainte-marie` (l'**identifiant**) | 592 |
| `Vito Sainte-Marie` (le **libellé**) | 135 |
| `Usine` | 50 |

Le chiffre de 592 est trompeur et **doit être écarté comme métrique** :

| Zone | Occurrences | Nature |
|---|---|---|
| `supabase/migrations/*.sql` | 278 | seeds historiques, immuables |
| `test_*.js` | 171 | fixtures |
| `*.md` | 89 | documentation |
| `outils/`, `simulations/` | 6 | outillage |
| `*.sql` racine | 4 | scripts hors chaîne |
| **`NEXUS-*.html` + `nexus-*.js`** | **44** | code applicatif |

Et sur ces 44 : **26 sont des commentaires** `// jamais 'vito-sainte-marie'
par défaut (de-Vito-isation, 11/08/2026)` — la trace d'une correction **déjà
faite**, et 12 sont des commentaires d'observation terrain dans les moteurs
carburant/écarts/risques.

**Il reste 6 occurrences vivantes de l'identifiant dans le code applicatif.**

C'est exactement le piège que tu voulais éviter : un chercher/remplacer sur
`vito-sainte-marie` toucherait 592 endroits pour en corriger 6, effacerait la
mémoire de la dé-Vito-isation, et réécrirait des migrations immuables.

## Et le vrai danger n'est pas le nom

Le nom de la station est presque toujours décoratif. **Ce qui est réellement
en dur, ce sont les valeurs d'exploitation d'une seule station** — fuseau
horaire, horaires de quart, capacités de cuves — utilisées comme repli
silencieux pour n'importe quel site sans configuration. Ces occurrences ne
contiennent ni « Vito » ni « Sainte-Marie » : **un balayage sur le nom ne les
aurait jamais trouvées.**

---

# Inventaire classé

## C — logique ou valeur métier en dur, dangereuse en multi-site

### C1 · Fuseau `America/Martinique` en repli, 9 emplacements vivants

| Fichier | Ligne | Usage |
|---|---|---|
| `NEXUS-Parametres-Station-v1.html` | 1135 | `FUSEAU_DEFAUT` si `station_config` absente |
| `NEXUS-Verify-v1.html` | 823 | `FUSEAU_STATION` avant réponse réseau |
| `NEXUS-Carburants-Pilotage-v1.html` | 806 | idem |
| `nexus-carburant-donnees.js` | 296 | `|| 'America/Martinique'` |
| `nexus-carburant-commande-donnees-core.js` | 40, 69 | formatage d'heure + repli config |
| `nexus-carburants-p0-performance.js` | 19, 99 | date locale du relevé |
| `nexus-tempo.js` | 110 | fuseau des coordonnées station |
| `supabase/migrations/20260803021549_…sql` | 102 | `now() at time zone 'America/Martinique'` |

**Criticité : haute.** Le fuseau ne s'affiche pas, il **découpe les
journées**. En UTC-4 sans heure d'été, un site métropolitain verrait ses
quarts, ses relevés carburant et ses dates de clôture décalés de 5 à 6 heures
— sans aucune erreur, sans aucun message.

**Multi-site :** silencieusement faux. Un relevé de 02:00 heure de Paris est
attribué à la veille.

**Le cas de la migration est le plus grave** : la fonction boucle
`for r in select * from station_config loop` — elle traite **tous les sites**
en heure de Martinique, côté serveur, et cette migration est **appliquée en
production, donc immuable dans son identité**. La corriger demande une
migration nouvelle, pas une réécriture.

**Source correcte :** `station_config.fuseau_horaire` (colonne existante,
`NOT NULL`, défaut `America/Martinique` posé par
`20260824123103_ajouter_fuseau_horaire_station_config.sql`).

**Risque si on remplace naïvement :** remplacer par `Europe/Paris` inverserait
le défaut au détriment de la seule station réelle ; remplacer par le fuseau du
navigateur ferait dépendre un calcul métier de l'appareil du salarié. Le
commentaire de `nexus-carburant-donnees.js:290` avertit explicitement :
« jamais `Europe/Paris` ». Le repli doit devenir **fail-closed** (refuser de
calculer sans fuseau), pas changer de valeur.

### C2 · Horaires de quart d'une station en repli

| Fichier | Ligne | Usage |
|---|---|---|
| `NEXUS-Parametres-Station-v1.html` | 1124-1131 | `HORAIRES_DEFAUT` (05:45 / 12:40 / renfort 09:00-17:00) |
| `NEXUS-App-v1.html` | 2777-2785 | `HORAIRES_DEFAUT_RAPPEL` |

**Criticité : haute.** Ces horaires servent à calculer les **retards** et à
rattacher un événement à un quart.

**Multi-site :** un site ouvrant à 07:00 verrait ses salariés déclarés en
retard d'1 h 15, ou ses relevés rattachés au mauvais quart.

**Source correcte :** `station_config.horaires`.

**Risque :** le commentaire dit que ces valeurs sont « l'ancienne règle
devinée… comme point de départ raisonnable ». Les supprimer sans repli
casserait l'écran de paramétrage avant la première configuration. Il faut un
état « non configuré » explicite, pas un autre jeu de valeurs.

### C3 · Capacités de cuves d'une station en repli

`nexus-carburant-donnees.js:562` — `CUVES_PAR_DEFAUT` : GO 20 000 + 10 000 L,
SP95 30 000 L, GNR 30 000 L.

**Criticité : haute.** Ces capacités alimentent l'autonomie, le seuil de
commande et la recommandation de livraison.

**Multi-site :** une station à 2 × 5 000 L se verrait recommander des
commandes de camion impossibles à recevoir.

**Nuance à porter au crédit du code :** `chargerCuvesConfig` renvoie
`parDefaut: true`, donc l'information « ce n'est pas ta config » **existe
déjà**. Reste à vérifier si les écrans l'exploitent.

**Source correcte :** `station_config.cuves_carburants`.

### C4 · Identifiant de site en repli, 4 emplacements

| Fichier | Ligne | Code |
|---|---|---|
| `NEXUS-Mon-Evolution-v1.html` | 127 | `const siteId = employee.site_id \|\| 'vito-sainte-marie';` |
| `NEXUS-Mon-Planning-v1.html` | 137 | idem |
| `NEXUS-Debug-v1.html` | 93, 722 | `let SITE_ACTUEL = 'vito-sainte-marie'` puis `\|\|` |
| `NEXUS-Debug-Createur-v1.html` | 459 | `SITES.find(s => s.site_id === (employee.site_id \|\| 'vito-sainte-marie'))` |

**Criticité : haute sur les deux premiers**, moyenne sur Debug (réservé aux
managers, ligne 718).

**Multi-site :** un employé dont `site_id` serait nul lirait les données d'un
**autre client**. Les RLS devraient l'en empêcher — mais c'est précisément la
définition d'un fail-open : la sécurité ne tient plus que par la couche du
dessous.

**Source correcte :** `employee.site_id`, sans repli. Ces quatre lignes sont
les **survivantes de la dé-Vito-isation du 11/08/2026** — 26 écrans l'ont
appliquée, ces 4 ne l'ont pas eue.

**Risque :** remplacer `|| 'vito-sainte-marie'` par `|| ''` transformerait un
mauvais résultat en requête vide silencieuse. Il faut un arrêt explicite.

## B — valeur métier légitime, mais qui devrait venir de la station active

### B1 · Le nom de station en dur, écrasé **seulement si la lecture réussit**

| Fichier | Ligne | Mécanisme |
|---|---|---|
| `NEXUS-App-v1.html` | 573 + 2756 | `if (error \|\| !site) return;` → le libellé HTML reste |
| `NEXUS-Cockpit-v2.html` | 1451 + 1523 | `if (siteActuel && siteActuel.nom_entreprise)` → idem |

**Criticité : moyenne, mais la conséquence est sérieuse.** Le mécanisme est
présentationnel ; le mode de défaillance ne l'est pas : un client dont la
lecture de `sites` échoue voit **le nom d'un autre client** en en-tête. Ce
n'est pas une faute de logique, c'est une fuite de libellé.

**Source correcte :** `sites.nom_entreprise`. **Risque :** vider le libellé
donnerait un en-tête vide au chargement ; il faut un repli neutre (« NEXUS »),
pas un autre nom de client.

### B2 · Prix d'abonnement d'un client

`NEXUS-Capital-v1.html:231-236` — `COUT_MENSUEL_PRO = 399`,
`DEBUT_ABONNEMENT_PRO = 1er juillet 2026`.

Donnée réelle, assumée et documentée (« Si ce prix venait à changer un jour,
il faudra le mettre à jour ici »). **Multi-site :** tout client verrait le prix
et la date d'abonnement de Vito. **Source correcte :** aucune n'existe —
`sites.forfait` porte le nom du forfait, pas son prix ni sa date de début.
C'est une **colonne manquante**, pas une ligne à corriger.

### B3 · Libellé de bouton

`NEXUS-Parametres-Station-v1.html:380` — « Réinitialiser aux valeurs Vito
Sainte-Marie Usine ». Le bouton dit la vérité sur ce que fait C2. À traiter
**avec** C2, jamais avant : corriger le libellé seul rendrait le défaut
invisible.

## A — pure présentation, remplaçable dynamiquement

- **30 pieds de page** `<footer>… Vito Sainte-Marie Usine</footer>`.
- `NEXUS-Home-Concept-v1.html:216, 406` — maquette de concept.
- `NEXUS-Parametres-Comptes-Clients-v1.html:239, 241` — `placeholder="Ex : …"`,
  qui **doit** rester un exemple.

**Risque :** aucun sur le fond, mais 30 pieds de page réécrits en une passe
mécanique produiraient 30 lectures réseau redondantes de `sites`. À traiter par
un composant unique, pas par substitution.

## D — sans impact production

- **26 commentaires** de dé-Vito-isation dans les écrans : **à conserver**,
  ils documentent une correction et empêchent la régression.
- **12 commentaires** d'observation terrain dans les moteurs carburant,
  écarts, risques (« cas réel vito-sainte-marie, 23-24/08 ») : preuves de
  validation sur données réelles.
- **278 occurrences en migrations** : historique immuable.
- **171 en tests**, **89 en documentation**, **6 en outillage**.
- `NEXUS-API-v1.html:298` — exemple de charge utile dans la page de doc API.
- `NEXUS-Verify-v1.html:1416`, `NEXUS-Produits-v1.html:753`,
  `NEXUS-Carburant-Reception-v1.html:399` — commentaires explicatifs.

## E — ambigu, à arbitrer

### E1 · Codes de site du planning

`nexus-planning-sheets-moteur.js:31` —
`CODES_SITE_DEFAUT = ['T', 'SME', 'SMU', 'TRINITE', 'UNION']`.

Ce sont les codes des **autres** sites du groupe, servant à reconnaître qu'un
salarié a travaillé ailleurs (7 h forfaitaires). Le paramètre `codesSite` du
point d'entrée permet déjà de les surcharger (ligne 91), et le préfixe
d'onglet vient de `station_config.planning_onglet_prefixe` — le module est
**mieux conçu que la moyenne**.

**Mais aucun écran n'appelle encore `analyserFeuillePlanning`** : seuls les
tests le font. Le défaut est **latent**. Chez un autre client, un salarié dont
le prénom figurerait comme « T » ou « UNION » serait compté 7 h ailleurs.

**À arbitrer :** rendre `codesSite` obligatoire dès le premier appel réel, ou
le déclarer en `station_config` à côté du préfixe.

### E2 · Coordonnées géographiques de la station

`nexus-tempo.js:107-112` — latitude 14.7861, longitude −60.9976,
« Sainte-Marie, Martinique », pour l'API météo Open-Meteo.

Une station a **légitimement** des coordonnées. Le défaut n'est pas qu'elles
soient écrites, c'est qu'elles soient écrites **dans un moteur partagé**.

**À arbitrer :** ajouter `sites.latitude` / `sites.longitude`, ou considérer
que Tempo reste mono-site tant qu'il n'y a qu'une station réelle.

---

# Ce que dit cet inventaire

1. **Le nom de station n'est presque jamais le problème.** 30 pieds de page,
   sans conséquence.
2. **Le vrai risque est invisible au balayage du nom** : fuseau, horaires,
   cuves. Aucune de ces occurrences ne contient « Vito ».
3. **Quatre replis d'identifiant ont survécu** à la dé-Vito-isation du
   11/08/2026 sur 30 écrans.
4. **La migration `20260803021549` est le point dur** : logique serveur, tous
   sites, immuable.
5. **B2 et E2 ne sont pas des corrections de code** : il manque des colonnes.

# Ordre de traitement proposé

| Lot | Contenu | Pourquoi d'abord |
|---|---|---|
| A3-1 | C4 — les 4 replis d'identifiant | 4 lignes, fail-open, aucune dépendance |
| A3-2 | C1 côté client — 8 replis de fuseau | même motif, un seul contrat |
| A3-3 | C1 côté serveur — migration nouvelle | irréversible, à isoler |
| A3-4 | C2 + C3 + B3 | même mécanisme, même écran |
| A3-5 | B1 — repli neutre du libellé | dépend d'un composant partagé |
| A3-6 | A — les 30 pieds de page | cosmétique, en dernier |
| — | B2, E1, E2 | colonnes manquantes / arbitrage |

**Aucune correction n'est engagée. `main` et `production` restent à `501c0c7`.**
