# Cartographie de l'existant — préalable au moteur de qualification du risque

11/08/2026 — Document préparatoire, avant toute ligne de code de `nexus-risques-moteur.js`.

## Objectif

Frédéric a proposé une vision précise pour une future brique NEXUS : un moteur de qualification du risque à 4 niveaux (Anomalie à expliquer / Signal faible / Exposition / Risque avéré), comparant chaque signal à sa propre référence pertinente plutôt qu'à une moyenne générale, avec une matrice de matérialité explicite et une mémoire du risque dans le temps.

Avant d'écrire ce moteur, ce document répond à une question simple : **qu'est-ce que NEXUS détecte déjà aujourd'hui, où, avec quels seuils, et est-ce que ça correspond déjà à l'un des 4 niveaux visés ?** L'idée est de construire sur ce qui existe et fonctionne plutôt que de repartir de zéro, et de savoir précisément ce qui manque avant de s'engager sur la conception.

Rien n'a été modifié dans le code pour produire ce document — c'est une lecture, pas un chantier commencé.

---

## Rappel des 4 niveaux (tels que définis par Frédéric)

1. **Anomalie à expliquer** — fait inhabituel observé, mais NEXUS ne sait pas encore s'il représente un risque.
2. **Signal faible** — plusieurs éléments vont dans le même sens, sans preuve suffisante d'un risque avéré.
3. **Exposition** — une situation connue peut produire une perte si elle perdure, même si l'impact n'est pas encore constaté.
4. **Risque avéré** — l'impact existe déjà ou la situation est suffisamment démontrée.

Principe central : comparer chaque élément à sa propre référence pertinente (pas une moyenne générale) — une catégorie tabac/carburant/recharge/produit d'appel n'a pas vocation à avoir la même marge qu'un snacking.

---

## 1. Marge / Scanner

**`NexusMarge.detecterEcartsMarge()`** (`nexus-marge.js`) compare chaque article à la **médiane de sa propre famille économique** (`familleMarge()`), pas à une moyenne générale — exclusions explicites de tabac, gaz, presse/téléphonie/cartes prépayées, exactement les familles citées dans la demande. Seuil : écart ≥ 10 points de marge, groupe comparable ≥ 4 articles. Vocabulaire actuel : "écart", "gainPotentiel" — jamais "risque".

**Classement dans les 4 niveaux :** c'est aujourd'hui un instantané sur une seule période, sans mémoire d'une détection à l'autre → correspond au niveau 1 (**Anomalie à expliquer**) tel quel. Pour monter à Signal faible ou Exposition, il manque uniquement le suivi de la même anomalie sur plusieurs périodes — la logique de comparaison "à sa propre référence" existe déjà et est directement réutilisable.

**Point de vigilance trouvé, à trancher avant de généraliser cette logique :** `nexus-rayon-moteur.js` (`classerRayons()`, consommé par le chapitre Risques du Rapport de Direction) compare au contraire chaque rayon à la **moyenne pondérée de tout le magasin**, avec un seuil différent (5 points) et un périmètre d'exclusion différent (n'exclut ni tabac ni gaz). Deux méthodes concurrentes pour la même question, dans deux fichiers différents — exactement le type de double vérité que l'Article 11 de NEXUS interdit. Ce point devra être tranché (laquelle fait foi, ou fusion des deux) avant ou pendant la construction du moteur de risque marge.

---

## 2. Carburants

**`statutCarburant()`** (`nexus-carburant-moteur.js`) compare le stock théorique (dernier relevé physique + mouvements − ventes) au stock réel. Seuils fixes : 1 % → "à surveiller", 3 % → "à corriger" — identiques pour GO/SP95/GNR, identiques pour tous les sites, documentés comme "provisoires, non recalibrés".

**Classement dans les 4 niveaux :** un écart ponctuel = niveau 1 (**Anomalie**), exactement l'exemple donné par Frédéric. Mais **aucune récurrence n'est trackée** : rien ne compte "3 relevés de suite en dérive" ni ne cumule les litres perdus dans le temps — le moteur actuel ne peut pas, seul, produire un Signal faible ni un Risque avéré carburant. L'autonomie de stock et les livraisons (Phase 2/3 du chantier Carburants) ne sont pas construites — ce sont pourtant les exemples d'Exposition donnés par Frédéric ("autonomie carburant faible").

---

## 3. Caisse / Verify — la découverte la plus importante de cette cartographie

Il existe une **couche de détection côté base de données** (vues et fonctions PL/pgSQL dans `nexus_schema_dump.sql`, consommée par le Centre d'Intelligence NEXUS via `advisor_messages`), largement plus proche du moteur à 4 niveaux que tout ce qui est visible côté JS :

- **`v_caisse_ecart_recurrent`** : fenêtre glissante de 14 jours, se déclenche à ≥2 anomalies, escalade en priorité "haute" à ≥3 occurrences ou une seule critique, avec un **niveau de confiance calculé selon la taille d'échantillon** ('A' si ≥6 audits, 'B' si ≥3, 'C' sinon).
- Les fonctions génératrices gèrent une **déduplication** (fingerprint) et un **cooldown** (72h par défaut, configurable par règle) — un signal déjà émis n'est pas réémis avant expiration, sauf si le nombre de preuves augmente entre-temps.
- **`caisse_sante_historique`** cumule mensuellement `ecart_net_cumule`/`ecart_absolu_cumule`/`nb_anomalies` en base — un vrai historique €, comparé mois vs mois-1.
- Le Conseiller Verify (dans `NEXUS-Verify-v1.html`) compare déjà l'écart du jour à la **moyenne des 30 derniers audits du même numéro de quart** (jamais quart 1 vs quart 2) — un 2e exemple concret de comparaison "à sa propre référence", après celui de la marge.

**Classement dans les 4 niveaux :** un écart isolé = niveau 1. `v_caisse_ecart_recurrent` avec 2 occurrences = niveau 2 (**Signal faible**). Avec ≥3 occurrences ou montant cumulé significatif = ce que Frédéric appelle Risque avéré côté caisse dans son exemple ("6 écarts sur 18 quarts, cumul 84,30 €") — le mécanisme existe déjà, seul le nommage explicite des 4 niveaux et l'exposition du cumul € au niveau du signal manquent.

Séparément, la même couche SQL détecte aussi la qualité de tenue (`v_qualite_tenue_recurrente`, `v_qualite_controle_absent`, `v_qualite_mission_sans_preuve`, `v_qualite_degradation_activite`) avec la même logique de confiance par échantillon — un futur "risque équipe/conformité" pourrait s'appuyer directement dessus.

---

## 4. Stock

**`calculerAnalyseStock()`** (`nexus-stock.js`) compare le stock théorique (relevés + ventes connues) au dernier contrôle physique. États : stable / surveiller / verifier / impossible / inconnu, seuils identiques pour tous les articles (10 %, 25 %). Un `risqueEur` est calculé, mais **seulement si l'état est "verifier" ET l'écart négatif** — sinon 0, donc binaire dans son déclenchement plutôt que gradué.

Un score de **confiance** par article (5-99) existe déjà, pondéré par la présence de ventes, l'ampleur de l'écart et l'ancienneté du contrôle — c'est une notion de fiabilité du signal, à ne pas confondre avec une notion de récurrence.

**Classement dans les 4 niveaux :** un article "à vérifier" isolé = niveau 1. `stock_sante_historique` enregistre bien un instantané en base à chaque calcul (ce qui permettrait de suivre une dégradation dans le temps), mais son alimentation est **irrégulière** (pas de cron quotidien confirmé) — l'historique existe donc mais n'est pas fiable comme série continue pour construire un Signal faible ou une Exposition stock sans y retravailler.

---

## 5. FDJ

**`calculerCandidatsFdj()`** détecte rupture de stock et écarts de caisse en instantané, sans aucun chiffrage € (`impactEur` toujours à 0) — uniquement des constats qualitatifs (critique/attention/positif).

**`nexus-coach-fdj-moteur.js`** est en revanche le moteur le plus avancé de tout NEXUS sur la logique de récurrence : chaque détecteur a un `minimum_sample` avant de se déclencher, et **`calculerCandidatsCoachEquipe()`** escalade explicitement de "signal isolé" à "carte rouge" à partir de `SEUIL_RISQUE_RECURRENT = 3` occurrences — avec le libellé littéral **"Risque de contrôle récurrent"**, seul endroit du code JS où le mot "risque" qualifie déjà un comportement répété dans le temps. Ces seuils sont configurables par site depuis le 10/08/2026, contrairement à la quasi-totalité des autres seuils NEXUS.

**Classement dans les 4 niveaux :** une rupture ou un écart isolé = niveau 1 ou 2 selon la confiance affichée ("Moyenne" pour une évolution sur une seule période, documentée explicitement comme non confirmée). Le mécanisme d'escalade par occurrence de Coach FDJ = patron direct pour Signal faible → Risque avéré. Ce qui manque : le chiffrage € (Exposition/Risque avéré carburant-style), inexistant côté FDJ.

---

## 6. Commercial (Conseiller) et Tempo

Les règles R2/R3/R4 du Conseiller (`nexus-conseiller.js`) comparent l'évolution ou la contribution d'un produit à des seuils fixes (±15 %, +20 %, -30 %), identiques pour toutes les catégories, sur une seule paire de périodes — chaque règle documente elle-même sa limite ("pas encore une tendance confirmée sur plusieurs périodes"). Niveau 1 par construction.

**`nexus-tempo.js`** contient en revanche une vraie logique de récurrence calendaire déjà écrite : `detecterProgressionConsecutive()` exige 4 occurrences consécutives avant de publier une tendance, `detecterJourExtremeStable()` combine volume ET régularité (coefficient de variation) pour distinguer un vrai motif d'un simple bruit. C'est un patron directement transposable à d'autres domaines (marge, caisse, carburant) pour construire le passage Anomalie → Signal faible.

---

## 7. Boussole et Secteurs — où "risque" est déjà un concept d'affichage

L'axe "Risques" de la Boussole NEXUS (`nexus-boussole-moteur.js`) calcule un score 0-100 par pénalités cumulées : jusqu'à 40 points pour les écarts de caisse critiques, 20 pour les alertes inventaire ouvertes, **20 points fixes** (binaire, peu importe le montant) si `risqueStockTotal > 0`, **20 points fixes** si des pertes R2 existent. Documenté "provisoire, non recalibré". `nexus-secteurs-moteur.js` reprend les mêmes 3 signaux dans un champ `risques[]` du secteur Opérations — c'est un agrégat d'affichage, pas une nouvelle détection.

**Ce que ça implique pour le moteur de risque :** la Boussole et les Secteurs sont aujourd'hui les points de sortie naturels pour un score consolidé — mais leur binarité actuelle (0 ou 20 points, jamais proportionnel à l'ampleur) devra être remplacée une fois le moteur de risque en place, sinon un risque de 50 € et un risque de 5 000 € pèsent pareil dans le score global.

---

## 8. Rapport de Direction — chapitre 12 "Risques et contrôle interne"

C'est la seule section de NEXUS qui construit déjà une liste nommée "Risques", avec 3 champs (`categorie`, `impact`, `urgence`) et 7 règles concrètes (écarts caisse cumulés, démarque potentielle, catégories sous la moyenne de marge — hérite du biais du point 1 —, écarts inventaire ouverts, comptages manquants, catégories en recul de CA, carburant en recul).

**Classement dans les 4 niveaux :** c'est un instantané pur à chaque génération de rapport — rien n'est comparé à l'édition précédente, aucune mémoire d'un risque déjà signalé le mois dernier. Impact et urgence sont des étiquettes à 3 niveaux, souvent une seule valeur possible par règle ("moyen (fixe)") — pas les 4 niveaux visés, et pas de cumul € consolidé au niveau de la liste entière. **C'est le chapitre à refondre en priorité une fois le moteur de risque prêt** — c'est exactement l'endroit où la nouvelle section "Risques & vigilance" décrite par Frédéric prendrait place.

---

## 9. Le mot "risque" aujourd'hui dans le code — usage rhétorique, pas une classification

Vérifié par recherche exhaustive : "risque" apparaît comme nom de variable interne (`risqueEur` dans Stock, jamais affiché sans la réserve "pas une démarque confirmée"), comme axe déjà nommé (Boussole, Secteurs, Rapport de Direction), comme phrase générée ("représente un risque estimé à X €" dans le Conseiller — usage rhétorique d'un impact € potentiel), et une seule fois pour qualifier une récurrence comportementale ("Risque de contrôle récurrent", Coach FDJ). **Nulle part il ne désigne aujourd'hui une classification formelle à plusieurs niveaux.** Le futur moteur introduit donc un vocabulaire réellement nouveau, pas un renommage de l'existant.

---

## 10. Synthèse — ce qui peut nourrir le moteur tout de suite vs ce qui manque

### Peut être branché quasi tel quel (niveaux 3-4 : Exposition / Risque avéré)

- `v_caisse_ecart_recurrent` (SQL) — récurrence, confiance par échantillon, cooldown anti-bruit déjà en place. C'est un prototype fonctionnel de l'escalade Signal faible → Risque avéré.
- `caisse_sante_historique` et `stock_sante_historique` — cumuls € déjà stockés en base (le 2e avec une alimentation à fiabiliser).
- `NexusMarge.detecterEcartsMarge` — la seule comparaison "à sa propre référence" généralisée de tout NEXUS ; le principe central demandé par Frédéric existe déjà et fonctionne en production.
- `detecterProgressionConsecutive` / `detecterJourExtremeStable` (Tempo) — logique de streak/régularité transposable à d'autres domaines.
- `calculerCandidatsCoachEquipe` — seuils configurables par site, escalade par occurrence, vocabulaire "Risque" déjà écrit et validé à l'usage.

### Ce qui manque structurellement avant de construire les 4 niveaux proprement

1. **Pas de mémoire d'occurrence systématique.** Sauf caisse (mensuel) et stock (irrégulier), tout est recalculé à chaque affichage sans historique — impossible aujourd'hui de savoir qu'"un écart de marge existe depuis 3 périodes" sans reconstruire l'historique à la main.
2. **Seuils presque tous codés en dur, identiques pour tout le monde** — non différenciés par catégorie/secteur (exception : la marge, seul exemple de segmentation par famille économique) et non configurables par site (exception : Coach FDJ).
3. **Cumul € rarement consolidé au niveau du signal lui-même** — les montants existent ligne par ligne mais ne sont jamais additionnés dans le temps pour un même signal récurrent.
4. **Binarité fréquente là où une gradation serait nécessaire** — le score Boussole traite un risque stock de 50 € et de 5 000 € pareil ; FDJ ne chiffre jamais d'impact €.
5. **Incohérence de référence sur la marge** (point 1) — deux méthodes concurrentes (médiane de famille vs moyenne pondérée du magasin) à trancher avant de généraliser.
6. **Aucune distinction formelle entre les 4 niveaux visés.** L'existant produit 2 à 4 statuts qualitatifs qui se recoupent partiellement (conforme/surveiller/anomalie/critique, sous contrôle/à surveiller/à corriger, critique/attention/positif) mais aucun moteur ne distingue explicitement "je constate un fait inhabituel" de "l'impact est déjà mesuré" — c'est un axe conceptuel entièrement nouveau à construire.
7. **La "référence propre" n'est généralisée qu'à la marge.** Verify le fait par numéro de quart (2e exemple), mais rien d'équivalent n'existe pour carburant (mêmes seuils GO/SP95/GNR) ni pour la plupart des autres domaines.

---

## Recommandation pour la suite

Avant d'écrire `nexus-risques-moteur.js`, trois décisions restent à prendre avec toi :

1. **Trancher la contradiction marge vs rayon** (point 1) — sinon le moteur de risque hériterait de deux vérités différentes sur le même sujet dès le premier domaine traité.
2. **Décider si le moteur consomme la couche SQL existante (`advisor_rules`/`v_caisse_ecart_recurrent`...) ou la réécrit en JS** — la couche SQL a déjà la logique de confiance/cooldown la plus aboutie, mais elle ne couvre que Caisse et Qualité, pas Marge/Stock/Carburant/FDJ. Un choix cohérent (tout en SQL, ou moteur JS qui lit ces vues comme une source parmi d'autres) évitera de dupliquer la logique de cooldown/confiance une 2e fois.
3. **Prioriser un domaine pilote** pour la 1ère version du moteur — Marge et Caisse sont les deux domaines où l'essentiel (référence propre, récurrence, cumul €) existe déjà à 80 %, donc les moins coûteux à qualifier proprement en premier ; Carburant et FDJ demandent de construire le chiffrage € et/ou l'historique avant de pouvoir produire un Risque avéré.

Une fois ces 3 points tranchés, la conception du schéma de qualification (`type_signal`, `niveau_confiance`, `preuve`, `impact_mesure`, `impact_potentiel`, `recurrence`, `anciennete`, `secteur`, `action_recommandee`) et la matrice de matérialité peuvent être posées sur papier, domaine pilote par domaine pilote, avant tout code.
