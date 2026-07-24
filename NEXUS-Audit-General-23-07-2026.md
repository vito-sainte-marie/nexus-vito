# Audit général NEXUS — 23/07/2026

## Périmètre réellement vérifié

Cet audit porte sur les 14 pages HTML, le lexique `nexus-vocabulaire.js` et les 37 migrations SQL présents dans mon espace de travail — l'intégralité du code produit avec moi jusqu'ici. Je n'ai pas accès à ton dépôt GitHub réel : trois éléments référencés partout ne sont pas dans mon espace et n'ont donc pas pu être vérifiés ligne à ligne — `nexus-auth.js`, `NEXUS-Login-v1.html`, et une dizaine d'écrans liés dans le menu (Radar Manager, Scanner, Scanner Stock, Capital, Prise de poste, Pointage, Rappels, Assignations, Résultats Équipe, Évaluation Employé). Je le dis clairement plutôt que de laisser croire à un audit à 100 % — c'est la même règle que NEXUS applique à ses propres utilisateurs : ne jamais affirmer plus que ce qu'on a vérifié.

Méthode : lecture complète des fichiers, recherche systématique de motifs à risque (dates mal interprétées, sites codés en dur, pagination manquante, données inventées, incohérences de vocabulaire), puis vérification manuelle de chaque signal avant de le retenir comme anomalie réelle.

---

## 1. Anomalies trouvées et corrigées aujourd'hui

**Site codé en dur dans la fiche produit.** `NEXUS-Produits-v1.html`, fonction `chargerStockGap()`, interrogeait `stock_releves` avec `.eq('site', 'vito-sainte-marie')` écrit en dur, au lieu de `SITE_ACTUEL` comme partout ailleurs dans le même fichier. Sans conséquence tant qu'un seul site existe, mais dès qu'un deuxième site sera ajouté (l'administration multi-site créateur existe déjà), les fiches produit de ce site auraient silencieusement affiché le stock de Vito Sainte-Marie, ou rien du tout. Corrigé.

**Historique des audits de caisse non paginé.** `NEXUS-Verify-v1.html` chargeait tout l'historique `audits_caisse` en une seule requête, sans le helper `fetchAllRows` déjà utilisé partout ailleurs (Cockpit, Centre d'Intelligence, Produits, Rayon, Missions, Debug). Supabase plafonne toute requête à 1000 lignes sans erreur visible. À 2 audits par jour, ce plafond est atteint en un peu plus d'un an — les audits les plus anciens auraient fini par disparaître de l'historique sans le moindre message d'erreur. Corrigé en ajoutant le même helper que partout ailleurs.

Les deux corrections sont dans les fichiers livrés avec ce message.

---

## 2. Anomalie trouvée, non corrigée — ta décision nécessaire

**Le Cockpit compare encore les deux dernières périodes sans vérifier qu'elles se comparent équitablement.** C'est exactement le bug corrigé cette semaine dans `NEXUS-Rayon-v1.html` (périodes qui se chevauchent, ou de durées très différentes — un trimestre complet contre un mois entamé) : mêmes symptômes, même cause, mais le correctif n'a été appliqué qu'à Rayon. Le Cockpit calcule encore ses "tendances produit" (`PRODUITS_EN_BAISSE`, `MEILLEUR_SUCCES`, les alertes de progression/chute) à partir d'une simple comparaison des deux périodes les plus récentes, quelles que soient leurs durées ou un éventuel chevauchement.

Concrètement : si le Cockpit affiche aujourd'hui "tel produit chute de 40 %", ce chiffre peut être faux pour la même raison que "Cartes prépayées" affichait -70 % à tort avant la correction de Rayon. Je n'ai pas touché au Cockpit pour l'instant — c'est un fichier plus gros et plus central (page d'accueil manager), et tu m'as dit de commencer par Produits aujourd'hui. Mais c'est la découverte la plus importante de cet audit : **je recommande de porter le même correctif (paire de périodes comparables, `raison_indisponible` honnête) au Cockpit en priorité**, avant tout autre chantier — c'est un bug de fiabilité, pas une amélioration.

---

## 3. Philosophie NEXUS — vérifiée, globalement respectée

J'ai cherché spécifiquement : nombres générés aléatoirement (`Math.random`), valeurs inventées pour combler une case vide, dates mal interprétées à cause du fuseau horaire, échappements Unicode cassés (bug récurrent trouvé plusieurs fois cette semaine).

Aucune donnée inventée trouvée, nulle part. Aucun `Math.random`. Le bug d'échappement Unicode (accents mal gérés) ne réapparaît dans aucun fichier. Les dates affichées avec fuseau horaire correct partout où c'est pertinent — j'ai vérifié en particulier `releve_le` (relevés de stock) et les dates de période produit : ce sont soit de vrais horodatages avec fuseau, soit des calculs de durée où le fuseau s'annule ; pas de bug caché là où je m'attendais à devoir en trouver un. La discipline "dire qu'on ne sait pas plutôt qu'inventer" est appliquée de façon cohérente : rotation/stock en estimation assumée, emplacements suggérés jamais confondus avec des emplacements confirmés, photos jamais associées sans validation humaine.

Point d'attention plutôt que d'anomalie : cette rigueur (comparaison de périodes fiable, `raison_indisponible`, fiabilité affichée) est nette dans Rayon, plus ancienne et moins stricte dans Cockpit — cf. point 2 ci-dessus. C'est un effet naturel de la façon dont NEXUS s'est construit par couches successives, pas un manque de discipline.

---

## 4. Cohérence inter-fichiers

Le vocabulaire NEXUS n'existe pour l'instant que dans Rayon et Produits (choix assumé, "on commence par Produits aujourd'hui") — pas une incohérence, un chantier en cours. `fetchAllRows` est maintenant présent partout où une table peut dépasser 1000 lignes. Plus aucun site codé en dur. Les migrations SQL n'ont révélé aucune incohérence de nommage de colonnes par rapport à ce que le code HTML interroge.

---

## 5. Sublimer NEXUS — vers l'addiction saine à l'usage

Tu veux que les utilisateurs reviennent parce que NEXUS leur rend service, pas parce qu'on les piège. La bonne dépendance, c'est celle qu'on a envers un compte en banque ou une balance : on la consulte sans qu'on nous le demande, parce qu'elle nous dit quelque chose qui compte pour nous, tout de suite. Voici les leviers que je vois, classés par effort.

**Rapides à poser, fort impact :**

Un "brief du matin" — un seul écran qui résume en 15 secondes ce qui a changé depuis hier : écart de caisse de la veille, comparaison au même jour la semaine dernière plutôt qu'à une période lointaine, ruptures de stock détectées, mission du jour. Aujourd'hui, obtenir cette vue demande d'ouvrir plusieurs écrans — le condenser en un seul geste quotidien est ce qui transforme un outil de gestion en réflexe.

Boucler les décisions. NEXUS recommande déjà des actions (renforcer un facing, surveiller un rayon) mais ne revient jamais dire ce que ça a donné. Le jour où le Conseiller dit "il y a 30 jours vous avez renforcé le facing de X, son CA a progressé de 18 % depuis" — le manager sait que NEXUS se souvient de lui et vérifie ses propres conseils. C'est le mécanisme qui fait qu'on ouvre une appli de sport : voir l'effet de ce qu'on a fait.

Comparer au même jour de la semaine plutôt qu'à la période précédente pour les indicateurs du quotidien (caisse, ventes du jour) — "mardi vs mardi dernier" est plus actionnable pour un gérant que "ce mois vs le mois dernier", et plus fiable (pas de bug de durée mismatch possible).

**Effort moyen :**

Un indice de santé NEXUS unique, en page d'accueil, agrégeant caisse + stock + rayons + missions en un seul chiffre avec sa courbe des 30 derniers jours — l'équivalent d'un crédit score. Un seul nombre qu'on a envie de voir monter donne une raison de revenir même sans problème à régler.

Des alertes qui viennent chercher l'utilisateur plutôt que l'inverse — rupture de stock imminente détectée, écart de caisse au-dessus du seuil, rayon qui décroche : NEXUS a déjà toutes ces données, il manque le mécanisme qui pousse l'info au lieu d'attendre une visite. C'est probablement le levier le plus puissant de tous : la vraie addiction vient du produit qui te contacte, pas de celui que tu dois penser à ouvrir.

Étendre le vocabulaire NEXUS et le cycle Constat → Explication → Décision au Cockpit (une fois le bug du point 2 corrigé) puis à toutes les pages restantes — c'est ce qui construit une vraie identité reconnaissable, condition pour que les utilisateurs "parlent NEXUS" entre eux.

**Plus structurant :**

Un digest hebdomadaire (page "Cette semaine chez vous" ou notification programmée le lundi) qui retire la charge de devoir se souvenir d'aller consulter — je peux mettre ça en place directement comme tâche planifiée si tu veux.

Célébrer les réussites, pas seulement signaler les problèmes. Un Conseiller qui n'est qu'un système d'alerte fatigue à la longue ; un Conseiller qui dit aussi explicitement "ce que vous avez fait a marché" donne envie de revenir voir la suite.

---

Je n'ai touché à rien d'autre que les deux corrections du point 1 — le reste (Cockpit, addiction saine) attend ta décision sur les priorités. Par quoi veux-tu qu'on commence ?
