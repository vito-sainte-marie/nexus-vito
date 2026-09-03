# NEXUS Paye — Spécification de cadrage v1

**Statut au 02/09/2026 : socle v1 construit.** L'écran `NEXUS-Paye-v1.html`, son moteur pur, son chargeur de données et son schéma Supabase réalisent désormais la préparation mensuelle. PAYE reste volontairement un préparateur de variables pour la comptable : il ne fabrique aucun bulletin et n'applique aucune retenue automatiquement.

Origine : demande de Frédéric le 29/08/2026, après la correction du P0 v2.285 (attribution des écarts Verify), posant la question « les employés voient-ils exactement les mêmes écarts que le manager ? » et proposant, si ce n'est pas le cas, une architecture "une seule vérité, plusieurs vues" avec `discrepancy_id`, statut `CONTESTÉ`, verrou PAYE et contrôle de cohérence automatique.

---

## 1. Constat vérifié (audit code du 29/08/2026)

Avant d'écrire une seule ligne de cadrage, vérification demandée par l'Article 5 : **non, à ce jour, Progression employé et Analyse des écarts manager ne consultent PAS le même calcul.** Ce n'est pas une hypothèse, c'est un fait de code :

- **Analyse des écarts** (`NEXUS-Analyse-Ecarts-v1.html`) est alimentée par `nexus-ecarts-donnees.js`, qui délègue toute la logique métier à `nexus-ecarts-moteur.js` : `deriverStatutEcart` (machine à 4 états — À vérifier / Régularisé / Clôturé expliqué / Clôturé non expliqué, basée sur la clôture ET la cause connue), `calculerMontantRetenuLigne` (distingue l'écart constaté du montant réellement retenu), `resoudreEmployeCaisseVerify` (attribution par caisse réelle, corrigée en v2.285).
- **Progression** (`nexus-progression.js`, écran employé) a sa **propre logique indépendante**, jamais reliée à `nexus-ecarts-moteur.js` (vérifié : aucune référence à `NexusEcartsMoteur`, `deriverStatutEcart`, `cause_code`, ni `calculerMontantRetenuLigne` dans ce fichier). Elle applique :
  - un seuil de conformité fixe, `SEUIL_ECART_CONFORME = 2 €`, sur la valeur brute `ecart_piste`/`ecart_boutique` — sans jamais regarder si un manager a expliqué la cause (`cause_code_piste`/`cause_code_boutique`) ou régularisé le montant ;
  - donc aucune notion de "Régularisé" / "Clôturé expliqué" au sens d'Analyse des écarts — juste "conforme" ou "non conforme" ;
  - aucun calcul de `montantRetenu` — Progression ne sait pas dire "l'écart initial était de -36,65 €, mais le montant réellement retenu est 0 €".

**Point rassurant, vérifié aussi** : sur l'attribution en elle-même, Progression ne reproduisait PAS le bug P0 — elle a toujours lu `employes_piste`/`employes_boutique` (jamais `employee_id`) pour décider si un écart est "attribuable" à l'employé (et seulement s'il était seul sur le poste — `soloPiste`/`soloBoutique`, une règle plus prudente qu'Analyse des écarts sur le cas 2+ employés). Le cas concret de Ruddy (17/08 Q2 Piste) était donc déjà correctement rattaché à lui dans sa propre Progression avant même le correctif v2.285 — le bug ne touchait que la vue manager.

**Ce qui reste réellement en risque** : le STATUT et le MONTANT peuvent diverger. Exemple concret avec les vraies règles actuelles : si un manager régularise l'écart de Ruddy après enquête (cause trouvée, correction à 0 €, `montantRetenu = 0`), Analyse des écarts affichera "Régularisé, 0 € retenu" — mais Progression, qui ne lit jamais `cause_code_piste` ni ne recalcule `montantRetenu`, continuera de comparer la valeur brute au seuil de 2 € et pourra continuer d'afficher l'écart comme "non conforme" dans la liste `ecartsAttribuables`, selon que la colonne `ecart_piste` elle-même a ou non été mise à jour lors de la régularisation. Ce mécanisme n'a pas été audité colonne par colonne dans ce passage (hors scope de cette vérification) — mais le principe est confirmé : ce sont deux moteurs de calcul séparés, donc rien ne garantit qu'ils convergent dans tous les cas, aujourd'hui ni demain à mesure que l'un des deux évolue sans l'autre.

**Conclusion** : la proposition de Frédéric est fondée sur un vrai risque architectural vérifié, pas une crainte théorique. La suite de ce document cadre la cible pour l'éliminer.

---

## 2. Principe directeur : une seule vérité, plusieurs vues

Aucun écran ne doit recalculer indépendamment "y a-t-il un écart, de quel statut, quel montant". Un seul endroit calcule, tous les écrans lisent le même résultat.

Bonne nouvelle architecturale : NEXUS a déjà pris à moitié cette décision. Depuis le v2.268-A3 (Article 11, "une seule vérité"), `nexus-ecarts-moteur.js` existe précisément pour être ce moteur central, partagé par construction — `nexus-fdj-moteur.js` lui délègue déjà sa propre logique d'écarts caisse FDJ. Il ne manque qu'un seul consommateur à brancher dessus : **Progression**. Ce n'est pas une nouvelle mécanique à inventer, c'est étendre l'usage de celle qui existe déjà à l'écran qui y échappe encore.

Cela confirme aussi que la recommandation d'origine de Frédéric ("Verify/FDJ créent l'événement → registre central → alimente Progression / Analyse des écarts / PAYE") est déjà réalisée aux 2/3 : Verify/FDJ sont la source, `nexus-ecarts-moteur.js` + `nexus-ecarts-donnees.js` sont le registre de calcul central (calculé à la volée, jamais dupliqué en base — décision Article 11 déjà actée et qui reste valable ici, voir §3). Il manque le branchement de Progression et, pour PAYE, un consommateur qui n'existe pas encore.

---

## 3. Le "registre central" n'a pas besoin d'être une nouvelle table

Point de vigilance Article 11 avant de se lancer : la proposition de Frédéric parle d'un `discrepancy_id` unique par écart, ce qui évoque une table dédiée. Ce n'est probablement pas nécessaire pour l'identité de l'écart lui-même :

- Un écart est déjà identifiable de façon stable et unique aujourd'hui : `id` retourné par `nexus-ecarts-donnees.js` est construit comme `verify-{audit.id}-{piste|boutique}` ou `fdj-{control.id}` — c'est déjà, de fait, un `discrepancy_id` stable. Il suffit de le formaliser comme tel dans le cadrage plutôt que d'en fabriquer un nouveau.
- Dupliquer l'écart lui-même dans une nouvelle table reproduirait exactement l'erreur que le v2.268-A3 avait délibérément évitée (cadrage §13 du PDF d'audit proposait une table à double écriture — refusée à l'époque au nom de l'Article 11, décision documentée dans l'en-tête de `nexus-ecarts-donnees.js`). Le calcul EN DIRECT reste la bonne approche : corriger la source (Verify/FDJ) continue de corriger instantanément toutes les vues, sans script de rattrapage — c'est exactement ce qui a permis au correctif v2.285 de s'appliquer à tout l'historique sans migration.

Ce qui, en revanche, NÉCESSITE bien un état persistant nouveau — parce que ce n'est pas dérivable des tables source — c'est la **contestation** (§5) : une action de l'employé, avec un contenu (motif), un instant, un traitement manager. Pour cela, pas besoin non plus de table dédiée : `nexus_ecarts_qualifications` est déjà, par construction, une table générique clé sur `(source_module, source_control_id, activite, type_qualification)`, utilisée aujourd'hui pour un seul type (`activite_inhabituelle`, v2.269). Elle est faite pour accueillir un second type, `contestation`, sans rien dupliquer (Article 11).

---

## 4. Cible : consommateurs du moteur unique

```
Verify (audits_caisse) ──┐
                          ├──> nexus-ecarts-moteur.js + nexus-ecarts-donnees.js
FDJ (fdj_shifts+controls)┘         (calcul EN DIRECT, single source, existant)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
          Analyse des écarts        Progression            NEXUS Paye
          (vue manager,             (vue employé,          (futur — ne
           déjà branchée,            filtrée sur            consomme QUE
           v2.268-C1)                 son employeeId,        montantRetenu +
                                       PAS ENCORE              statut final,
                                       branchée — refonte      jamais un
                                       nécessaire)             écart CONTESTÉ)
```

### 4.1 Analyse des écarts (déjà conforme)
Aucun changement requis par cette spécification — c'est déjà le modèle cible.

### 4.2 Progression (refonte nécessaire, hors scope de ce document)
`nexus-progression.js` devrait, pour chaque service caisse d'un employé, résoudre l'écart via le MÊME résultat que `nexus-ecarts-donnees.js` (même `id`, même `statut`, même `ecartFinal`/`montantRetenu`) plutôt que recalculer `estConforme(ecart_piste brut)`. Concrètement, à termes : Progression appellerait `chargerEcartsConsolides` (ou une variante filtrée côté employé) et ferait son filtrage/mise en forme narrative (coaching, tendances, séries) SUR le résultat déjà qualifié par le moteur, au lieu de relire `audits_caisse` en direct avec ses propres règles. Le vocabulaire "Écarts de caisse constatés" plutôt que "faute"/"pénalité" (déjà dans l'esprit du fichier — voir son en-tête, "jamais une accusation") est cohérent avec la proposition de Frédéric et n'implique aucun changement de philosophie, seulement de plomberie.

Ce point n'est PAS traité dans ce document au-delà du cadrage : c'est un chantier de refonte à part entière (au minimum : ré-écrire `construireServicesCaisse`/`ecartsAttribuables`/`serviceEstPropre` pour consommer le moteur central, vérifier l'impact sur toutes les métriques qui en dérivent — séries, tendances, axes de progression — et rejouer les tests existants de Progression qui encodent aujourd'hui l'ancien comportement).

### 4.3 NEXUS Paye (socle v1 construit)
Le module ne recalcule jamais un écart : il consomme `montantRetenu` et le `statut` final produits par le moteur central. Ce montant reste une référence affichée ; le manager doit saisir explicitement le montant à transmettre avant que `impact_paye` ne puisse devenir vrai dans l'arbitrage PAYE.

---

## 5. Extension du cycle de statut : CONTESTÉ

Statuts actuels (`nexus-ecarts-moteur.js`, `STATUTS_ECART`) : `a_verifier` → `regularise` | `cloture_non_explique` | `cloture_explique`.

Extension proposée (à construire, pas construite) :

```
a_verifier → regularise
           → cloture_explique
           → cloture_non_explique → contesté → en_reexamen → regularise (si erreur confirmée)
                                                             → confirme  (si écart maintenu)
```

`contesté` et `en_reexamen` ne remplacent jamais `cloture_non_explique` : ils s'ajoutent par-dessus une ligne déjà close, comme une qualification (même mécanisme que `activite_inhabituelle`, table `nexus_ecarts_qualifications`, nouveau `type_qualification = 'contestation'`). L'écart initial n'est jamais modifié ni supprimé — seule une qualification vient s'y superposer, exactement comme le fait déjà `qualification` sur les lignes retournées par `chargerEcartsConsolides` aujourd'hui pour `activite_inhabituelle`.

Champs à prévoir pour une contestation (réutilisation de la table générique existante, colonnes déjà présentes ou à ajouter en additif — jamais en remplacement) :
- `motif` (texte libre de l'employé — colonne déjà existante sur `nexus_ecarts_qualifications`) ;
- `qualifie_par` (l'employé qui conteste — déjà existant) / `qualifie_le` (déjà existant) ;
- des colonnes additives à envisager le moment venu : un statut de traitement de la contestation elle-même (ouverte / résolue) et la décision du manager (motif de résolution, lien vers la ligne éventuellement corrigée) — non actées ici, à cadrer précisément lors de l'implémentation réelle plutôt que deviné par avance.

---

## 6. Verrou PAYE (construit en v1)

Un écart dont la qualification `contestation` est ouverte ou en réexamen ne peut jamais être transmis à PAYE. L'écran affiche cet état explicitement et conserve ce verrou même si un ancien arbitrage PAYE existe.

## 7. Contrôle de cohérence automatique

Proposition retenue comme test de non-régression à écrire dès que Progression sera branchée sur le moteur central (§4.2) : pour un employé et une période donnés, la somme des `montantRetenu` que Progression affiche doit être strictement égale à la somme des `montantRetenu` filtrés sur le même `employeeId`/période dans `appliquerFiltresEcarts` (déjà existant côté Analyse des écarts). Une divergence ne devrait plus jamais être possible une fois les deux écrans branchés sur le même moteur — ce test sert de garde-fou contre une régression future (ex. si Progression réintroduit un jour un calcul local par erreur).

## 8. Ce qui ne doit jamais arriver

- Supprimer ou réécrire un `ecartInitial`/`ecart_*_origine` déjà capturé (règle déjà en vigueur depuis le v2.268-B1, réaffirmée ici pour la contestation : contester ou régulariser ajoute une qualification/une correction, ne réécrit jamais l'historique).
- Un deuxième moteur de statut/montant, où qu'il soit (Progression aujourd'hui, tout futur écran demain) — Article 11.
- Une transmission PAYE sur un écart encore contesté.
- Une attribution single "au pif" quand 2+ employés partagent une caisse — règle déjà actée (v2.285 pour Analyse des écarts, et de longue date pour Progression via `soloPiste`/`soloBoutique`) et à conserver telle quelle dans toute extension future.

---

## 9. Suites restant à engager

1. Refondre `nexus-progression.js` pour consommer `nexus-ecarts-moteur.js`/`nexus-ecarts-donnees.js` au lieu de recalculer indépendamment (§4.2) — le seul chantier qui corrige réellement le risque de divergence aujourd'hui, indépendamment de tout le reste.
2. Étendre `nexus_ecarts_qualifications` avec `type_qualification = 'contestation'` + écran employé "Signaler un écart" dans Progression, et son pendant manager dans Analyse des écarts (§5).
3. Écrire le contrôle de cohérence automatique (§7) comme test de non-régression, une fois (1) fait.
4. Faire valider le premier dossier mensuel réel dans l'écran PAYE, puis compléter le calendrier des jours fériés du site avant toute clôture comptable.

Chacun de ces points est un lot à part entière, à traiter et tester séparément (même discipline que tous les correctifs précédents de cet historique) — pas un chantier unique.

---

## 10. Interface guidée de préparation mensuelle (02/09/2026)

L'écran PAYE est organisé comme un parcours de contrôle destiné à un manager non spécialiste de la paie :

1. **À vérifier** rassemble les seules décisions encore nécessaires.
2. **Salariés** présente une synthèse nominative puis le détail repliable.
3. **Dossier comptable** guide les étapes `Marquer prêt` → `Exporter` → `Marquer transmis`.

Les écarts Verify et FDJ sont tous conservés dans la lecture PAYE :

- un écart positif reste visible comme information sans impact paie ;
- un écart négatif est proposé à arbitrage, sans jamais devenir automatiquement une retenue ;
- un écart associé à plusieurs employés reste visible sous « Employé à identifier » et renvoie vers le contrôle source ;
- l'écart initial, l'écart final validé, le motif, le statut et le lien source restent lisibles ;
- une contestation ouverte conserve son verrou de transmission.

Les boutons `(i)` expliquent les notions sensibles : rôle du planning, preuves de présence, arbitrage, écart de caisse, impact paie, saisie sur une période et contenu de l'export comptable.

La saisie manuelle accepte une période inclusive `Du / Au`. NEXUS crée une ligne datée par journée en une seule écriture groupée. Tout montant en euros reste limité à une journée afin d'empêcher une duplication accidentelle.

> **Révisé le 03/09/2026 (voir §11).** Deux points de cette section ne valent plus : les libellés du parcours comptable sont désormais `Valider le mois` → `Générer le dossier comptable` → `Marquer transmis`, et la saisie journée par journée est **refusée** pour les congés, absences longues, maladie, maternité, paternité et formation — ce sont des événements RH, portés par une période unique.

---

## 11. Dernier kilomètre : d'un moteur de contrôle à un produit comptable (03/09/2026)

Retour de Frédéric après recette : le moteur métier est jugé proche de la validation, la gestion des absences longues va dans la bonne direction, mais l'interface reste à simplifier et **la sortie destinée à la comptable n'est pas validée, parce que le résultat principal du module est encore un CSV**. Le moteur existant est conservé — aucune reprise à zéro.

### 11.1 Un événement RH est une période, jamais une collection de journées (P0)

Absence longue, congé, congé maternité, congé paternité, formation et arrêt maladie sont portés par `employee_indisponibilites` : `date_debut`, `date_fin`, éventuellement `fin_indeterminee` et `date_reprise`. Le moteur produisait déjà un item unique par événement depuis le 03/09/2026 ; ce qui manquait, c'était le **raccordement de l'interface manuelle au bon modèle de données** : l'écran proposait encore « congé payé » et « arrêt maladie » comme des variables saisissables jour par jour, ce qui recréait à la main le dépliage que le moteur venait d'abolir.

Désormais :

- l'écran expose **« Déclarer un événement RH »** — salarié, motif, période, retour éventuellement non daté — qui écrit une ligne dans `employee_indisponibilites`, et une période qui déborde du mois affiché est le cas normal, pas une erreur ;
- `nexus-paye-donnees.js` **refuse** tout `nexus_paye_item` portant un type d'événement RH (`refuserEvenementRHParJournee`, liste dans `NexusPayeMoteur.TYPES_ITEM_EVENEMENT_RH`). Le garde-fou est dans la couche de données, pas seulement dans la discipline de l'écran : aucun chemin de code ne peut plus produire une ligne par journée ;
- l'affichage se lit en trois lignes — nom, motif, période couverte, jours couverts :

```
Vanessa Ribe
Congé maternité
01/08/2026 → 31/08/2026
31 jours couverts
```

### 11.2 Le dossier comptable devient la sortie principale (P0)

Le CSV reste disponible, explicitement présenté comme **export technique** destiné à un import logiciel. La sortie principale est **« Générer le dossier comptable »**, un PDF composé de :

- une **synthèse mensuelle** : état du dossier (prêts / à vérifier / donnée manquante), totaux du mois, récapitulatif par salarié ;
- une **fiche par salarié** : variables du mois, événements RH couvrant le mois avec leur période réelle, éléments financiers datés, et les réserves éventuelles.

Répartition des responsabilités, conforme à l'Article 11 : `NexusPayeMoteur.dossierComptable()` agrège (calcul), `nexus-paye-dossier-pdf.js` met en page (aucune règle métier), `nexus-pdf-moteur.js` fournit les primitives génériques déjà partagées par les autres modules. Le PDF est régénéré depuis l'**instantané figé** à la validation du mois quand il existe : deux générations successives donnent le même document.

### 11.3 Carte salarié : les variables d'abord, les sources ensuite (P1)

La carte affiche directement les variables comptables agrégées — présence, absence, congés payés, maladie/maternité, retards, heures supplémentaires, jours fériés, éléments financiers. Les événements journaliers et leurs sources passent derrière **« Voir le détail »**. L'écran et le PDF consomment la même fonction `variablesComptables()` : ils ne peuvent pas diverger.

Un élément encore `a_verifier` n'est **jamais** fondu dans un total : il est compté à part et signalé, à l'écran comme dans le PDF.

### 11.4 Statut par salarié, statut du mois (P1)

Trois statuts, et trois seulement :

| Statut | Signification |
| --- | --- |
| **Prêt** | Plus rien à décider ; le salarié peut partir en paie. |
| **À vérifier** | Les données sont là, un arbitrage reste à rendre. |
| **Donnée manquante** | Il manque un paramétrage (rattachement non confirmé, heures manuelles absentes) ou toute donnée du mois. |

Le statut du mois est celui du salarié **le plus en retard**, jamais une moyenne. Un salarié proposé d'office par son rôle mais dont le rattachement n'a jamais été confirmé figure au dossier en « donnée manquante » : la comptable doit le voir, pas le découvrir absent.

### 11.5 Modales NEXUS à la place des boîtes du navigateur (P1)

`prompt()`, `alert()` et `confirm()` ont disparu de l'écran PAYE (13 appels supprimés, aucun restant). Toutes les saisies — date de reprise, montant transmis à la comptable, rattachement d'un salarié, réouverture du dossier, messages d'erreur — passent par une modale graphique à champs typés, avec validation avant fermeture. Motif : ces boîtes ne portent ni le vocabulaire ni les garde-fous de NEXUS, et sur iOS en PWA elles sont parfois purement ignorées — un manager pouvait croire avoir répondu à une question qui ne lui avait jamais été posée.

### 11.6 Vocabulaire (P2)

| Avant | Après |
| --- | --- |
| `Marquer prêt` | `Valider le mois` |
| `Exporter le dossier` | `Générer le dossier comptable` |
| statut `vérifié` | `prêt pour comptabilité` |

### 11.7 Recette : août 2026

Le mois de référence est encodé dans deux tests rejouables :

- `test_nexus_paye_dossier_comptable.js` — 35 vérifications : l'événement RH reste unique et borné au mois, chaque salarié retrouve les variables réellement communiquées à la comptable, les statuts se déduisent correctement et la synthèse est la somme exacte des fiches ;
- `test_nexus_paye_ecran_rendu.js` — 27 vérifications : l'écran est **réellement exécuté** sur un DOM minimal, ce qu'aucun test ne faisait jusqu'ici. Un gabarit peut contenir tous les bons mots et lever une exception à l'exécution ; le manager voit alors un écran vide, sans le moindre message.

Ces deux tests s'ajoutent à `test_nexus_paye_evenement_rh.js` (44 vérifications, dont le refus du dépliage par journée) et à `test_nexus_paye_periode_manuelle.js`, dont le scénario encodait l'ancien comportement — un congé saisi jour par jour — et encode désormais son refus.
