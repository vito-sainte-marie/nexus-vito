# Suivi — ce que le lot « source unique de planning » laisse derrière lui

*Ouvert le 19/09/2026. **Dossier de constat : aucun code, aucune migration, aucune
écriture Production.** Il nomme des défauts que le lot a vus et n'a pas corrigés,
sur instruction explicite de Frédéric.*

> « Pour les horodatages navigateur similaires découverts hors périmètre,
> documente-les comme dette ; ne transforme pas ce lot en correction globale. »
>
> « La classe morte `.nexus-nom-commerce` peut être documentée si sa correction
> exige de sortir du périmètre ; ne lance pas un refactoring transversal
> uniquement pour elle. »

Chaque entrée porte son ancre exacte. Une dette sans ligne de code est une
intention, pas une dette.

---

## 1. L'horodatage revendiqué par le navigateur

Le lot a donné à la base l'autorité sur `planning_shifts.modifie_le`
(migration `20260919240000`, trigger `trg_planning_shifts_horodatage_serveur`).
Le même défaut subsiste ailleurs : **l'heure écrite est celle de l'appareil du
manager**, pas celle du serveur. Une tablette mal réglée date une modification
d'hier ou de demain, et rien ne le signale.

`modifie_par` n'est pas concerné : c'est une identité, pas une horloge.

| Écriture | Table | Colonne |
|---|---|---|
| `NEXUS-Planning-v1.html:458` | `employee_contraintes` | `updated_at` |
| `NEXUS-Planning-v1.html:549` | `planning_regles_effectif` | `updated_at` |
| `NEXUS-Planning-v1.html:550` | `planning_regles_effectif` | `updated_at` |
| `NEXUS-Planning-v1.html:553` | `planning_regles_effectif` | `updated_at` |
| `NEXUS-Parametres-Station-v1.html:1215` (`enregistrerCorrespondances`) | `station_config` | `updated_at` |
| `nexus-paye-donnees.js:60` | `nexus_paye_items` | `modifie_le` |
| `nexus-paye-donnees.js:122` | `nexus_paye_items` | `modifie_le` |

**Correction visée** : le même geste que `20260919240000` — un trigger
`before insert or update` qui écrase la colonne avec `now()`, et le retrait de
la colonne du `payload` côté navigateur. Quatre tables, donc autant de migrations ;
`nexus_paye_items` relève de Paye, dont Frédéric a demandé qu'on n'y touche pas
maintenant.

**Pourquoi hors lot** : corriger `nexus_paye_items` ferait entrer Paye dans un
lot Planning, et corriger `planning_regles_effectif` sans le reste donnerait
l'illusion que la question est réglée.

---

## 2. `.nexus-nom-commerce` — une classe qui ne nomme plus rien

```
NEXUS-Pointage-v1.html:174       <span class="nexus-nom-commerce">Ma station</span>
NEXUS-Prise-De-Poste-v1.html:162 <span class="nexus-nom-commerce">Ma station</span>
```

Aucune feuille de style ne définit cette classe et aucun script ne la
sélectionne. Le texte affiché est donc littéralement **« Ma station »** dans les
pieds de page de Pointage et de Prise de poste, sur tous les sites.

Le lot Planning a corrigé le nom codé en dur **de son propre périmètre**
(`footerStation`, rempli depuis `sites.nom_entreprise`). Étendre la correction
à Pointage et Prise de poste demande de porter le même mécanisme dans deux
écrans qui n'ont rien à voir avec le chantier.

**Correction visée** : remplacer la classe morte par un `id` rempli au
chargement, comme `footerStation` dans `NEXUS-Planning-v1.html:235`.

---

## 3. `badge-premium` — le nom de classe survit au libellé

Le vocabulaire commercial réel est `essential` / `professional`. « Premium »
n'existe plus. Les **libellés** ont été corrigés dans le périmètre du lot :

```
NEXUS-Planning-v1.html:128   <span class="badge-premium">Professional</span>
NEXUS-Planning-v1.html:235   footer … · Professional
```

Restent :

* le **nom de classe** `.badge-premium` (`NEXUS-Planning-v1.html:43`,
  `NEXUS-App-v1.html:176`, `NEXUS-Home-Concept-v1.html:203`) — purement
  cosmétique, mais il fait croire à un troisième forfait quand on lit le code ;
* deux **libellés encore faux** dans une maquette :
  `NEXUS-Home-Concept-v1.html:362` et `:380` affichent `Premium`.
  Ce fichier est un concept, il n'est pas servi aux stations.

**Correction visée** : renommer la classe en `.badge-forfait` d'un seul geste,
au moment où un autre lot touchera déjà ces trois fichiers.

---

## 4. `remplirFormulaire` lit `config.renfort` sans garde

```
NEXUS-Parametres-Station-v1.html:1875   document.getElementById('r_debut').value = config.renfort.debut;
NEXUS-Parametres-Station-v1.html:1876-1878   idem pause_debut, pause_fin, fin
```

Si `station_config.horaires` ne porte pas de clé `renfort`, la ligne 1875 lève
`TypeError` et **l'écran Paramètres Station cesse de se remplir**, en silence
pour l'utilisateur. C'est ce qui s'est produit en recette le 19/09 sur
`nexus-station-test` ; la clé a été rajoutée dans la donnée de Test, ce qui
corrige le symptôme et pas la cause.

**Correction visée** : la même défense que les autres blocs de cet écran —
`(config.renfort || {})` et une valeur vide plutôt qu'un plantage. Hors lot
parce qu'elle touche le chargement général des horaires, pas la source Planning.

---

## 5. La donnée de Test de `nexus-station-test` est incomplète

`station_config.horaires` de `nexus-station-test` ne porte pas
`quart1.etendu`, `quart1.fin_etendu`, `quart2.etendu`, `quart2.fin_etendu`,
ni `temps_habillage_min`. La clé `renfort` y a été ajoutée le 19/09 pour
débloquer la recette (cf. §4).

Ce n'est pas un défaut de code : c'est une donnée de recette partielle, qui
rend une future recette d'horaires étendus impossible sans la compléter.

---

## 6. Ce que la recette du 19/09 laisse dans la base Test

Sur `nexus-station-test`, base **Test** (`udljdqxerrbbbajxubfn`) uniquement :

* `station_config.planning_google_sheet_id` =
  `1NEXUSRECETTETESTFICTIF0000000000000000000`, préfixe d'onglet `SMU`.
  **Conservé volontairement** : l'identifiant s'annonce comme fictif, la source
  du site est revenue à `nexus` donc il n'est plus lu, et le retirer
  interdirait de rejouer la recette d'import.
* quatre lignes dans `planning_source_periodes` (10/09, 11/09, 12/09, 19/09),
  qui sont l'historique réel des gestes de recette et n'ont pas à être effacées :
  c'est précisément la traçabilité que le lot apporte.
* les affectations importées non publiées du classeur fictif.

`sites.forfait` de `nexus-station-test`, monté à `professional` pour la recette
de l'écran Planning, a été **remis à `essential`** le 19/09.

---

## 7. Dettes déjà ouvertes que ce lot n'a pas refermées

Rappelées ici pour mémoire, elles ont leur propre trace :

* `TRUNCATE` accordé à `anon` et `authenticated` sur 144 des 161 tables de
  Production — `TRUNCATE` ignore la RLS ;
* le rôle du jour n'est filtré que par l'écran : un appel direct à la base
  accepte n'importe quel rôle ;
* `planning_shifts` n'a pas de contrainte composite site/employé ;
* quatre lecteurs Carburants distincts, et `NEXUS-Parametres-Station-v1.html`
  écrit `station_config.fuseau_horaire` sans passer par le moteur unique.
