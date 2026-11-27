# Lot A4 — doublons de calcul : état réel sur `production` (étape 1, document seul)

Base : `origin/production` (fd0ac0dc). Point de départ : `docs/conception/objectifs-a0-conformite.md` (PR #394).
Aucune migration, aucune lecture Production, aucun libellé ni écran touché. Les numéros de ligne ci-dessous
sont ceux de `production` aujourd'hui ; ceux de A0 sont périmés (A1, A2, A2b, A3 ont déplacé le code).

## Verdict d'ensemble

| # | Doublon | État | Sous-lot |
|---|---|---|---|
| 1 | Marge : deux notions + cible 25 % en plusieurs endroits | **Ouvert** (cible dupliquée) ; notion « écart aux pairs » déjà unifiée | A4-1 |
| 2 | Niveau et urgence (« risque avéré ») | **Réglé pour l'essentiel** (deux dimensions séparées) ; un point de vérification | A4-2 (contrôle seul) |
| 3 | Priorité : trois ordres dans le Conseiller | **Ouvert** | A4-3 |
| 4 | Ponctualité : plusieurs versions | **Partiellement réglé** (filtres station posés) ; le ratio reste calculé à plusieurs endroits | A4-4 |
| 5 | `fdj_stock_reference_lignes` sans `site` | **Réglé** (la table porte `site`) ; deux lecteurs HTML sans filtre direct | aucun (note) |

Ordre recommandé : A4-2 (contrôle, sans effet), A4-5 absent, A4-1 (constante, sans effet affiché si valeurs égales),
A4-4 (module unique du ratio, effet possible), A4-3 en dernier (touche l'ordre affiché).

## 1. Marge

**Deux notions.**
- Écart aux pairs : `nexus-marge.js` — `SEUIL_ECART_POINTS = 10`, `TAILLE_MIN_GROUPE = 4`, `detecterEcartsMarge` (l.156),
  `ecartsMargeDeLaPeriode` (l.200), exporté sur `NexusMarge` (l.218). Déjà source unique : lue via `ecartsMargeDeLaPeriode`
  par `NEXUS-Capital-v1.html:372`, `NEXUS-Produits-v1.html:1624`, `NEXUS-Scanner-v1.html:324`, `nexus-app-donnees.js:192`,
  `nexus-brief-donnees.js:77`. `nexus-risques-moteur.js:321` documente la complémentarité. **Réglé.**
- Seuil absolu du Scanner tarifaire : `nexus-politique-tarifaire.js`, `-registres.js`, `-ecran.js` (seuils actifs en base,
  `v_tarif_seuils_actifs`). C'est une politique de prix paramétrable, pas la même question que « marge anormale par rapport
  aux pairs ». **À confirmer avec Guardian** : si le gérant les tient pour deux notions distinctes, on garde les deux, nommées
  différemment ; sinon arbitrage gérant.

**Cible 25 % dupliquée** (valeurs écrites en dur, paliers 0,40 / 0,25 / 0,10) :
`NEXUS-Rayon-v1.html:290, 321, 328, 333, 382, 389, 396` ; `nexus-boussole-moteur.js:73` ; `nexus-indice.js:22, 31` ;
`nexus-secteurs-moteur.js:351, 370, 371` ; `nexus-conseiller.js:212` (`SEUILS_RENTABILITE`, `niveauRentabilite` l.239).
Hors sujet (autre notion, à ne pas fusionner) : `nexus-carburant-commande-moteur.js:539`, `nexus-tempo.js:2269–2270`.

**A4-1 — autorité retenue** : `nexus-marge.js` expose `CIBLES_MARGE = { tresRentable: 0.40, correcte: 0.25, faible: 0.10 }`
et `niveauRentabilite(taux)`. Lecteurs à recâbler : les 5 modules et la page Rayon ci-dessus.
**Valeurs affichées modifiées** : aucune si toutes les occurrences valent bien 0,25 / 0,40 / 0,10 (relevé fait : oui sur
les lignes citées ; à re-prouver par test). Exemple fictif : article à 24 % de marge → « sous la cible » avant et après,
dans Rayon, Boussole, Indice, Secteurs et Conseiller. Si un lecteur diverge, il sort du lot et attend l'arbitrage.
**Épreuves** : (a) test de parité — pour une grille fictive de taux (0,09 ; 0,10 ; 0,249 ; 0,25 ; 0,40), chaque module
rend le même palier qu'avant ; (b) garde statique : aucun littéral `0.25` de cible hors `nexus-marge.js`.
**Taille** : moyenne (7 fichiers, une constante, une fonction), sans migration.

## 2. Niveau et urgence

`nexus-risques-moteur.js` : `NIVEAUX` / `RANG_NIVEAU` (l.65–66), `SEUIL_RECURRENCE_RISQUE_AVERE = 5` (l.134), et une
dimension séparée `URGENCES` / `RANG_URGENCE` / `classifierUrgence({niveau, ancienneteJours})` (l.436–) avec
`SEUIL_ANCIENNETE_INSTALLEE_JOURS = 14` : exposition → immédiate ; risque avéré → moyenne si installé depuis ≥ 14 jours,
sinon immédiate ; signal faible → moyenne ; anomalie → faible. Le « risque avéré » ne masque donc plus l'urgence.

Lecteurs : `nexus-risques-donnees.js:72` (pose `urgence`), `NEXUS-Brief-v1.html:735–746` (tri urgence puis niveau),
`nexus-rapport-direction-moteur.js:490–505` (même source `RANG_URGENCE`), `NEXUS-Rapport-v1.html:441` (commentaire).
**Verdict : réglé.** **A4-2** se réduit à une épreuve : aucun lecteur ne trie par `niveau` seul (garde statique sur
`RANG_NIVEAU` hors des trois fichiers ci-dessus). À vérifier avant de conclure : les écrans qui consomment
`nexus-risques-donnees.js` autrement que le Brief (Cockpit) — non relus ici. **Valeur affichée modifiée : aucune.**
**Taille** : petite (un test).

### A4-2 : constats à l'écriture (27/11)
1. **`nexus-risques-donnees.js` (corrigé).** Il portait sa propre table `{risque_avere:3, exposition:2, signal_faible:1,
   anomalie:0}`, identique terme à terme à `RANG_NIVEAU`. Il lit maintenant `NexusRisques.RANG_NIVEAU`. L'ordre affiché ne
   change pas : épreuve de parité sur les quatre niveaux, ex aequo compris (jeu fictif de 8 lignes).
2. **`nexus-rapport-direction-moteur.js:564` (laissé hors du lot, signalé).** `RANG_NIVEAU_LOCAL = {risque_avere:2,
   exposition:1, signal_faible:0}` : `anomalie` y vaut 0, comme `signal_faible` (égalité). Avec `RANG_NIVEAU` elles
   seraient séparées (0 contre 1). Les signaux de marge peuvent être `anomalie` (`qualifierMargeCategorie` sans
   historique, l.348) : remplacer la table changerait l'ordre de lignes du rapport. Exemple fictif : deux lignes de marge,
   « Boissons » `signal_faible` et « Confiserie » `anomalie` ; aujourd'hui elles sortent dans l'ordre d'arrivée, après le
   remplacement « Boissons » passerait toujours devant. Décision du gérant, pas de A4. La garde garde ce fichier en
   exception nommée.
3. **Tri par urgence d'abord : hors lot** (décision du gérant, il change l'ordre affiché).
4. Garde : `RANG_NIVEAU` n'est lu que par le moteur, le Brief, le rapport direction et `nexus-risques-donnees.js` ;
   `nexus-secteurs-moteur.js` reste une exception nommée (choix de catégories, pas un ordre d'urgence). La garde échoue
   si une exception disparaît ou si une nouvelle table locale apparaît.

## 3. Priorité : trois ordres dans le Conseiller

Dans `nexus-conseiller.js` :
1. Candidats produit : tri par `impact_eur` décroissant (l.432).
2. Signaux Advisor : `rang` dérivé de `RANG_ADVISOR[message.priority]`, 3 par défaut, `impact_eur: 0` (l.878) — comparés aux
   candidats produit sur le rang, jamais sur les euros.
3. Mélange final : file par moteur, rang puis rotation à graine du jour à rang égal (l.1125–1136), puis tour de rôle entre
   moteurs avec tri des files par rang de tête (l.1191–1201). Texte d'urgence (« Maintenant / Aujourd'hui / Cette semaine »)
   séparé, l.720–757.

Les trois coexistent : un impact de 500 € (ordre 1) et un signal Advisor sans euro (ordre 2) ne se comparent que par le rang.
**Ouvert.** Graine désormais stable par jour de station (l.1125–1130), donc le grief UTC de A0 §6.2–6.3 est réglé.

**A4-3 — autorité retenue** : une fonction `ordonnerPriorites(candidats)` dans `nexus-conseiller.js`, clé unique
(rang, puis impact, puis rotation graine). **Valeurs affichées modifiées** : l'ordre des cartes du Conseiller (Cockpit,
Brief, App selon les lecteurs). Exemple fictif : A (rang 2, 300 €), B (rang 2, 0 € Advisor), C (rang 1, 40 €) → aujourd'hui
C, puis A/B selon la rotation ; avec la clé unique C, A, B (l'impact départage avant la rotation). **Attend l'arbitrage du
gérant.** **Épreuves** : parité sur jeu fictif (ordre inchangé quand tous les rangs sont distincts) ; cas d'égalité documenté.
**Taille** : moyenne à grande, risque d'effet visible ; en dernier.

## 4. Ponctualité

Lecteurs de `retard_min` sur `production` :
- `nexus-app-donnees.js:68–78` (`.eq('site', siteId)`, dénominateur `not retard_min is null`, **sans fenêtre de dates**) ;
- `nexus-brief-donnees.js:748–761` (site filtré, fenêtres actuelle/précédente ; l.761 sans fenêtre, comptage employés) ;
- `nexus-risques-donnees.js:717, 723` (site, `gte('date', depuis)`) ;
- `nexus-rapport-direction-donnees.js:117–137` (`Number.isFinite(p.retard_min)`) ;
- `nexus-progression.js:410–648` (pointage mesuré = `retard_min` fini) ;
- HTML : `NEXUS-Centre-Intelligence-v1.html:385` (site, sans fenêtre), `NEXUS-Radar-Manager-v1.html:178–223`,
  `NEXUS-Resultats-Equipe-v1.html:267` (site via `employee.site_id`), `NEXUS-Journal-v1.html:168`,
  `NEXUS-Apprentissage-v1.html:176` et `NEXUS-Progression-v1.html:446` (par employé, sans filtre site),
  `nexus-paye-donnees.js:19`.

**Filtres station** : posés sur les lecteurs agrégés (App, Brief, Risques, Centre, Résultats). Les lectures « par employé »
ne filtrent pas le site mais bornent déjà par l'identité de l'employé. **Reste ouvert** : le ratio lui-même (fenêtre,
dénominateur) est recalculé à plusieurs endroits, avec des fenêtres différentes (App et Centre sans fenêtre, Brief et
Risques fenêtrés) : un même quart peut donner deux taux selon l'écran.

**A4-4 — autorité retenue** : un module `nexus-ponctualite.js` (fonction pure `tauxPonctualite(pointages, {debut, fin})`,
dénominateur : pointages avec `retard_min` non nul). **Lecteurs à recâbler** : App, Brief, Risques, Rapport direction,
Centre, Radar Manager. **Valeurs modifiées** : App et Centre, qui lisent aujourd'hui sans fenêtre, passeraient à la
fenêtre commune (à fixer par le gérant, p. ex. 30 jours). Exemple fictif : 20 pointages dont 5 en retard dans les 30
derniers jours, 40 sur l'année dont 20 en retard → App affiche 50 % aujourd'hui, 25 % après. **Attend l'arbitrage.**
**Épreuves** : parité de chaque lecteur contre le module sur jeu fictif ; garde statique sur `retard_min` hors module.
**Taille** : moyenne. Je n'ai pas encore dénombré avec certitude si Radar Manager et Rapport direction divergent du
dénominateur : à mesurer en début de A4-4.

## 5. `fdj_stock_reference_lignes`

La table **porte** `site text not null default 'vito-sainte-marie'`
(`supabase/migrations/20260810011853_fdj_stock_references_inventaire_zero.sql`, définition de la table, colonne `site`) :
elle est **par station**, pas commune. Lecteurs avec `.eq('site', …)` : `nexus-brief-donnees.js:131`,
`nexus-coach-fdj-donnees.js:84`, `nexus-fdj-analyse-donnees.js:100` (gardés par
`test_isolation_station_lecteurs_20261127.js:88`). `NEXUS-FDJ-v1.html:675` et `NEXUS-FDJ-Manager-v1.html:827, 861` lisent
par `.in('reference_id', ids)` où `ids` vient d'un parent déjà filtré par site : risque faible, mais pas de ceinture.
**Verdict : réglé.** Proposition facultative (hors A4, sans effet affiché) : ajouter `.eq('site', …)` dans ces deux pages.
**Politique RLS de lecture (migrations du dépôt)** : `select_fdj_stock_reference_lignes ... for select using (site = (select current_employee_site_id()))`, posée avec `enable row level security` dans `20260810011853_fdj_stock_references_inventaire_zero.sql` (l.43, 50-51) ; l'insertion est filtrée de même. Aucune migration postérieure ne la modifie (seule `20261005090000` lit la table). **Oui, la lecture est filtrée sur `site` côté base** : le `.eq('site', …)` manquant dans les deux pages FDJ n'ouvre donc pas de lecture croisée, c'est une ceinture. Ce que dit le dépôt, pas l'état de Production (non mesuré).

## Hors A4
Score global et produits d'appel (lots B), potentiel compté deux fois (lot C1). Aucun libellé ni écran touché ici.

## Sous-lots proposés, dans l'ordre
A4-2 (contrôle, aucun effet) → A4-1 (constante de marge, aucun effet si égalité confirmée) → A4-4 (ponctualité, arbitrage
gérant sur la fenêtre) → A4-3 (ordre des priorités, arbitrage gérant). Les deux premiers peuvent passer en code sur Test
après revue ; les deux autres attendent l'arbitrage.
