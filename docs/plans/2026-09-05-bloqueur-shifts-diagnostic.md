# Bloqueur 1 — cycle de vie et traçabilité des services

**05/09/2026 · diagnostic · aucune correction**

## Le fait central

```
insert dans shifts  : 1   (NEXUS-Prise-De-Poste-v1.html:326)
update dans shifts  : 0
delete dans shifts  : 0
```

**Aucun code de NEXUS ne ferme jamais un service.** Ce n'est pas le pointage
de départ qui oublie de clôturer : c'est qu'il n'existe aucun écrivain pour
`heure_fin`, `statut = 'termine'`, `cloture_source` ni `cloture_le`.

Ces colonnes existent pourtant, et deux contraintes veillent sur leur
cohérence :

```sql
shifts_heure_fin_coherente  -- 'termine' exige heure_fin, 'en_cours' l'interdit
shifts_journal_cloture      -- toute clôture exige cloture_source ET cloture_le
shifts_cloture_source_check -- 'employe' | 'pointage_depart' | 'manager'
                            -- | 'prise_de_poste_suivante' | 'systeme_legacy' | 'test'
```

Le contrat de clôture a été **modélisé en entier, puis jamais implémenté**.
Les valeurs `pointage_depart` et `prise_de_poste_suivante` nomment exactement
les deux événements qui auraient dû fermer un service.

## Le vrai problème est en amont : « le service courant » n'a pas de définition

Six lecteurs, **quatre définitions différentes** :

| Lecteur | Définition du service courant |
|---|---|
| `NEXUS-Pointage-v1.html:563` | `statut = 'en_cours'`, le plus récent |
| `NEXUS-Missions-v1.html:371` | `heure_debut >= maintenant - 24 h`, le plus récent — **`statut` ignoré** |
| `nexus-auth.js:181` | un service existe aujourd'hui (jour calendaire) |
| `NEXUS-App-v1.html:2659` | un service entre `T00:00:00` et `T23:59:59` — **bornes UTC**, pas heure station |
| Cockpit, Brief, Inventaire, Pointage:982 | le `role` du plus récent, sans borne |

**C'est ce qui rend une correction partielle dangereuse.** Écrire `heure_fin`
au départ ne changerait rien pour Missions, qui ne regarde pas `statut` — un
employé parti verrait ses coches rester actives 24 h. Et cela changerait tout
pour Pointage, qui filtre sur `en_cours`. Deux écrans, deux comportements
opposés, à partir de la même donnée corrigée.

## Contrat cible

**Un service est ouvert par un seul événement.** La confirmation de prise de
poste. C'est déjà le cas, rien à changer.

**Un service est fermé par deux événements, et deux seulement :**

| Événement | `cloture_source` | `heure_fin` |
|---|---|---|
| Pointage de départ | `pointage_depart` | l'heure du pointage |
| Prise de poste suivante du même employé | `prise_de_poste_suivante` | l'heure de la nouvelle prise |

Les deux valeurs existent déjà dans la contrainte. La clôture par `manager`
reste possible mais hors de ce lot : aucun écran ne la propose aujourd'hui.

**Le service courant a UNE définition** : `statut = 'en_cours'`, le plus
récent, pour l'employé. Les six lecteurs s'y alignent. La fenêtre de 24 h de
Missions et les bornes UTC de l'Accueil disparaissent — elles étaient des
approximations pour compenser l'absence de clôture. Une fois les services
fermés, la question « lequel est actif ? » n'a plus qu'une réponse.

**Le doublon devient impossible.** Deux protections, à deux niveaux :

- en base, un index unique partiel : au plus **un** service `en_cours` par
  employé. C'est la seule barrière qui tienne face à un double clic, une
  double soumission ou deux onglets ;
- à l'écran, le bouton déjà désactivé pendant l'appel — utile pour le confort,
  insuffisant seul, comme le prouvent les deux services créés à 7 secondes
  d'intervalle.

**Le rattachement.** `inventaire_quart_employes` porte une clé étrangère vers
`shifts` et ne la renseigne jamais. Une fois « le service courant » défini
sans ambiguïté, il n'y a plus de raison de ne pas l'écrire. `mission_progress`
et `role_changes` la renseignent déjà.

Les 13 colonnes `shift_id` des tables FDJ **ne sont pas concernées** : aucune
clé étrangère vers `shifts`, elles désignent `fdj_shifts`. À consigner comme
homonymie, pas à traiter ici.

## Ce que la correction ne doit pas faire

- **Ne pas fermer rétroactivement les 6 services ouverts** sans arbitrage :
  ce sont des données de recette réelles, et une clôture inventée serait une
  heure de fin fausse. Une migration de reprise doit les marquer
  `clos_sans_pointage` — le statut existe déjà — et non `termine`.
- **Ne pas se contenter d'écrire `heure_fin`** : sans l'alignement des
  lecteurs, la correction produit deux comportements contradictoires.
- **Ne pas ouvrir le sujet du fuseau des bornes journalières** de l'Accueil
  au-delà du strict nécessaire : c'est la famille A17, déjà consignée.

## Découpage proposé

| Lot | Contenu |
|---|---|
| **S-1** | Migration : index unique partiel `en_cours` par employé, et reprise des 6 services ouverts en `clos_sans_pointage` |
| **S-2** | Clôture au pointage de départ |
| **S-3** | Clôture à la prise de poste suivante |
| **S-4** | Alignement des lecteurs sur la définition unique |
| **S-5** | `shift_id` renseigné dans `inventaire_quart_employes` |

S-1 d'abord : sans l'index, S-3 peut créer une course entre la clôture de
l'ancien service et l'insertion du nouveau.

**Aucune correction engagée. `main` et `production` restent à `501c0c7`.**
