# Re-mesure finale avant gate — exécutée

**10/09/2026, 14 h 02 – 14 h 05 UTC** (10 h 02 – 10 h 05 à la station).
Production `uzhjpqpctpvxytxpxoqz`, **lecture seule**. Six mesures, prescrites
par `re-mesure-finale-gate-1.md`, exécutées dans l'ordre.

> **Validité : 24 heures.** Ces chiffres expirent le **11/09/2026 à 14 h 02
> UTC** (10 h 02 à la station). Passé ce délai, le critère
> `impacts_production_mesures_horodates` repasse `BLOQUE`, et la re-mesure est
> à refaire. Ce n'est pas une formalité : deux des six chiffres ont bougé en
> deux jours.

**Aucune écriture.** Les six requêtes sont des `select`. Aucune n'a été
exécutée en dehors du connecteur en lecture, aucun secret n'a transité, et
`outils/correction-horaires-production-a-executer-par-frederic.sql` reste
**non appliqué** — c'est un geste de Frédéric, pas de ce document.

---

## Le tableau

| # | Mesure | 08/09 | **10/09** | Lecture |
|---|---|---|---|---|
| 1 | Référentiel Advisor — lignes dont une valeur changerait | 0 | **0** | rien à examiner |
| 2 | `shifts` dont `site_id` diverge de `site` | 17 | **17** | stable |
| 2 | `mission_catalog` dont `site` diverge de `site_id` | 89 | **89** | stable |
| 3 | Sites sans fuseau résolvable | 0 | **0** | aucun site nouveau |
| 4 | Services `en_cours` au total | 16 | **21** | +5 |
| 4 | Services qui seraient clos `clos_sans_pointage` | 13 | **20** | +7 |
| 5 | Écritures en vol sur `shifts` / `mission_catalog` | — | **0** | fenêtre propre |
| 6 | `nexus_live_events` déjà présente en Production | non | **non** | pas d'arrêt |

---

## 1 · Référentiel Advisor — 0 changée, 37 identiques

`0 créée · 0 changée · 37 identique` (6 modèles de langage, 31 règles).
**La migration ne changerait aucune valeur.** Elle réécrirait les 37 lignes à
l'identique, `updated_at` compris, parce qu'un `on conflict do update`
s'exécute même quand rien ne diverge — « réécrite » n'est pas « modifiée ».

**Cette mesure est désormais rejouable, et elle ne l'était pas.** Celle du
09/09 avait été faite avec un analyseur jeté après usage : le chiffre était
juste, mais personne — moi compris — ne pouvait le refaire. Un critère de gate
qu'on ne peut pas rejouer n'est pas un critère, c'est un souvenir. Deux
fichiers le rendent reproductible :

- `outils/empreintes-referentiel-advisor-production.sql` — SELECT-only, rend
  une empreinte `md5` courte par `code`. Trente-sept empreintes de douze
  caractères transitent, au lieu de quinze mille caractères de texte métier
  dont une seule faute de transcription fabriquerait un faux écrasement.
- `outils/comparer-referentiel-advisor.js` — lit le fichier de migration, en
  calcule les mêmes empreintes, compare. Ne se connecte à rien.

**Les deux côtés ont été prouvés avant d'être crus.** L'analyseur lit
exactement `6 lignes × 11 colonnes` et `31 lignes × 15 colonnes` — les listes
que l'`INSERT` déclare. Le témoin qui compte est la mutation : **un seul accent
retiré à une valeur (« à justifier » → « a justifier ») ressort en `CHANGEE`,
et une seule.** Sans ce témoin, un comparateur qui rendrait toujours
`IDENTIQUE` aurait passé tous les autres contrôles.

`test_comparateur_referentiel_advisor_20260910.js` : **12/12**. Il vérifie
aussi la couture la plus fragile de ce dispositif — que le SQL et le
JavaScript normalisent **les mêmes colonnes dans le même ordre**, et que cette
liste est bien celle de la migration. Deux listes qui divergent d'une colonne
feraient diverger les trente-sept empreintes d'un coup, et le comparateur
annoncerait trente-sept écrasements qui n'existent pas.

## 2 · Cohérence `site` / `site_id` — inchangée

17 et 89, exactement comme le 08/09. Ces lignes sont réparées **par** la
migration #3 elle-même, qui répare avant de contraindre : le chiffre documente
l'ampleur, il ne décide pas d'appliquer ou non.

## 3 · Résolution du fuseau — deux sites, tous deux couverts

| site | `station_config.fuseau_horaire` | repris automatiquement | employés | services `en_cours` |
|---|---|---|---|---|
| `site-fantome-test` | `America/Martinique` | oui | 5 | 0 |
| `vito-sainte-marie` | `America/Martinique` | oui | 15 | 21 |

**Aucun site nouveau depuis la dernière mesure**, et aucun ne tombera dans la
décision explicite de l'étape 4 de la migration #4 : les deux sont repris par
`station_config`. `sites.timezone` est **absente** de Production, ce qui
confirme que la migration #4 n'a pas été appliquée et que ce document mesure
bien l'avant.

> **Un défaut du document de prescription, trouvé en l'exécutant.** Les
> requêtes #3 et #4 telles qu'écrites **ne pouvaient pas s'exécuter** :
> elles lisaient `s.timezone`, la colonne que la migration *ajoute*
> (`ERROR: 42703: column s.timezone does not exist`). Une pré-mesure qui
> interroge l'état d'après ne mesure rien. Les deux requêtes demandent
> maintenant ce que la migration *résoudra*, à partir de ce qui existe déjà —
> `re-mesure-finale-gate-1.md` est corrigé et porte l'explication.

`site-fantome-test` existe toujours en Production avec 5 employés. C'est le
site de test créé par Frédéric, désormais remplacé par nexus-test. Il ne gêne
aucune migration ; son retrait est une décision séparée, pas un blocage.

## 4 · Services ouverts — le seul chiffre qui a bougé

**21 services `en_cours`, dont 20 seraient clos `clos_sans_pointage`.**
Six employés, du **04/09 au 09/09**, tous des jours antérieurs — zéro doublon
ouvert le jour même. Zéro service sans employé joignable, zéro sans fuseau
résolvable : la migration n'en laisserait aucun de côté.

**Le critère de fenêtre est satisfait, et il fallait le vérifier.**
`plan-reparation-rollback-1.md` interdit d'exécuter #6 sans expliquer tout
écart de plus d'un facteur 2 avec la référence du 08/09 (16).

> 21 / 16 = **1,3** — et sur les services réellement repris, 20 / 13 = **1,5**.
> Sous le facteur 2 dans les deux cas.

**L'écart est expliqué, pas seulement toléré.** Cinq services ouverts de plus
en deux jours, pour environ trois prises de poste par jour : les quarts ne se
ferment pas. C'est le motif d'adoption déjà constaté — NEXUS est utilisé au
compte-gouttes, et personne ne clôture. **Cette release est précisément ce qui
vient traiter ce motif**, et le chiffre continuera de monter tant qu'elle n'est
pas passée.

## 5 · Aucune écriture en vol

Zéro requête active en écriture sur `shifts` ou `mission_catalog` à l'instant
de la mesure. Une seule requête active en tout — la mienne.

**Ce contrôle est une heuristique, pas une garantie**, et le document de
prescription le dit déjà : il photographie un instant. Les deux tâches
planifiées écrivent toutes les quinze minutes ; il reste à démarrer juste après
un top de quart d'heure, comme `mesure-fenetre-deploiement-1.md` le recommande.

## 6 · `nexus_live_events` — absente, comme attendu

`false`. Aucune écriture hors migration n'a créé la table en Production. La
condition d'arrêt de la migration 21 n'est pas déclenchée.

---

## Ce que cette re-mesure ne fait pas

- **Elle n'autorise rien.** Elle rend un critère mesurable ; la gate reste
  celle de Frédéric, et l'autorisation Production en est distincte par
  construction.
- **Elle ne mesure pas la durée de la promotion.** Le journal de la répétition
  n'horodate pas ses étapes — limite déjà portée par
  `mesure-fenetre-deploiement-1.md`, non levée ici.
- **Elle ne juge pas l'activité métier réelle.** Zéro requête en vol à 10 h du
  matin ne dit rien de la fenêtre recommandée, qui est le soir.
- **Elle expire.** Le 11/09/2026 à 14 h 02 UTC. Si la gate est posée après,
  rejouer les six mesures — `outils/empreintes-referentiel-advisor-production.sql`
  puis `node outils/comparer-referentiel-advisor.js <fichier.json>` pour la
  première, `re-mesure-finale-gate-1.md` pour les cinq autres.

Empreintes brutes conservées : `empreintes-production-advisor-20260910.json`.

---

## Le verdict est désormais calculé, et il n'est pas celui qu'on attendait

`impacts_production_mesures_horodates` passe **OK** — c'était l'objet de cette
re-mesure, et c'est fait. Mais poser les dix critères dans un fichier de faits
et les faire évaluer par du code, au lieu de les raconter, a fait tomber un
critère qui semblait acquis.

    node outils/evaluer-pret-pour-production.js

    candidat : ea561f6
    CI       : pull_request:success · push:failure

    ✗ BLOQUE   ci_et_guardians_conformes
    ✓ OK       impacts_production_mesures_horodates
    ? INCONNU  aucun_blocage_non_resolu
    …
    VERDICT               : NON_PRET
    gate humaine Frédéric : INCONNU
    autorisation          : NON_AUTORISEE

**Le SHA candidat porte un run vert ET un run rouge.** Une lecture qui s'arrête
au premier run trouvé aurait déclaré la CI verte. Un seul échec sur le SHA
suffit à retirer le vert — c'est le sens du mot, et
`test_evaluation_pret_production_20260910.js` le tient par un témoin bâti sur
ce cas réel.

Le défaut est décrit sous `blocages-ouverts-1.md` §7, avec la mention qui
convient : **cause non isolée**. Une occurrence, pas reproduite, instrumentée
pour la prochaine.

`faits-pret-pour-production.json` porte chaque fait avec sa preuve. Deux faits
n'y figurent pas et sont mesurés à l'exécution — le SHA et l'état de la CI —
parce qu'ils changent à chaque commit et qu'un fichier ne peut pas les suivre
honnêtement. La gate humaine n'y est jamais déclarée : une épreuve l'interdit,
sans quoi l'autorisation Production deviendrait atteignable par un commit.
