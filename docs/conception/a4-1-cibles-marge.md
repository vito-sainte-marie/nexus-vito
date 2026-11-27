# A4-1 — Référence de marge : fiche de conception (aucun code)

Référentiel de conception v1.0. Décision du gérant (Guardian, 7219563170) : aucune cible de marge écrite en dur. La référence vient des seuils de la politique tarifaire (`tarif_seuils`, vue `v_tarif_seuils_actifs`, écran Produits). Cette fiche précède tout code.

Faits lus dans le dépôt (lecture seule) :
- `v_tarif_seuils_actifs` = lignes non annulées (`annule_le is null`) et non remplacées. `security_invoker = true`.
- Niveaux `famille`, `rayon`, `defaut` ; `minimum` et `cible` dans [0,1) ; statuts `valide`, `indicatif`, `a_l_etude`, `hypothese`. « Seul le statut valide est décisionnel » (commentaire de la table).
- RLS en lecture : manager et gérant du même site, plus le créateur si `sites.acces_createur_autorise`. Employés et anon ne lisent rien.
- Un résolveur existe déjà : `seuilDe` (nexus-politique-tarifaire.js) fait famille, puis rayon, puis défaut, et distingue valide et indicatif.

## 1. Résolution de la cible
Ordre : famille, puis rayon, puis `defaut`. Le premier niveau qui porte une `cible` gagne. On réutilise `seuilDe`, pas un second résolveur.
Statuts : seule une cible `valide` fait foi pour une note ou un score. Une cible `indicatif` s'affiche, étiquetée « indicative », et ne note pas (score neutre). `a_l_etude` et `hypothese` ne s'affichent pas dans le Brief.
Affichage : « Objectif 28 % (valide, rayon Confiserie) » ; « Objectif 28 % (indicatif, non décisionnel) ». Le niveau de résolution est toujours nommé, pour qu'un seul chiffre soit lisible (article 11).

## 2. Lecteurs à rebrancher
| Lecteur | Valeur fixe aujourd'hui | Remplacée par |
|---|---|---|
| Boussole `scoreDepuisMarge` | 0,25 | cible résolue du rayon ou du site ; score neutre si absente ou non valide |
| Indice `calculerIndiceNexus` | 0,25 dans `50 + (m − 0,25)·100 + évol·50` | la même cible, passée en paramètre ; `null` si absente (comme `margeReelle` null) |
| Secteurs `construireSecteurMarge` | 0,25 et texte « référence de 25 % » | cible passée en entrée ; le texte cite la cible lue (« objectif 28 % ») ou « objectif non défini » |
| Conseiller `SEUILS_RENTABILITE` (0,40 / 0,25 / 0,10) | paliers de lecture | voir ci-dessous |
| Page Rayon | 0,25 en cinq endroits et une copie locale des paliers | même cible et même fonction que les autres |

Paliers du Conseiller : ce sont des paliers d'affichage (bonne, correcte, faible), pas une cible. Proposition : `cible` devient le palier « correct » et `minimum` le palier « faible », quand ils existent. Quand ils manquent, le Conseiller garde un affichage sans palier, sans jugement. Les 0,40 et 0,10 ne sont pas déduits d'un seuil : ils disparaissent du code, et l'on ne juge plus au-delà de `cible`. À arbitrer : si le gérant veut conserver un palier « très bonne », il doit le saisir comme seuil, pas le laisser dans le code.
Restent distincts et inchangés : le Scanner tarifaire (`SEUILS_SCANNER_TARIFAIRE`, détection de prix) et l'écart aux pairs (`SEUIL_ECART_POINTS`, comparaison). Ils sont nommés à part.

## 3. Cible absente
`tarif_seuils` est vide en Production aujourd'hui. Article 5 : rien d'inventé.
- Carte Marge : le taux réel reste affiché ; la ligne de référence devient « objectif non défini » + lien « Le saisir dans Produits ».
- Boussole : axe Marge sans score (« non évalué »), exclu de la moyenne et non compté comme zéro.
- Indice : pas de valeur (`null`), mention « objectif de marge non défini », pas de note de repli.
- Secteurs : la contribution Marge est neutre, le détail dit « objectif non défini ». Aucune note n'est écrite à partir d'une valeur supposée.
Distinction obligatoire, à cause de la RLS : un employé ne lit pas `tarif_seuils`. Son résultat vide ne veut pas dire « aucune cible ». Pour les rôles sans droit de lecture, l'écran n'affiche rien sur l'objectif (ni « non défini », ni note) ; le message « objectif non défini » est réservé à manager et gérant, qui peuvent lire et saisir.

## 4. Valeurs affichées qui changent (exemple fictif)
Rayon fictif, marge réelle 22 %.
- Aujourd'hui : référence 25 %, écart −3 pts, Boussole et Indice notés.
- Sans cible saisie : marge 22 % affichée, « objectif non défini », Boussole « non évalué », Indice absent. C'est la rupture la plus visible, assumée : on ne note plus sur un chiffre inventé.
- Avec cible par défaut 28 % valide : référence 28 %, écart −6 pts, notes recalculées à 28 %.
- Avec cible 28 % indicative : 28 % affiché « indicatif », pas de note.
Écran par écran, rien d'autre ne change (libellés, couleurs, ordre).

## 5. Sécurité
Lecture de `v_tarif_seuils_actifs` filtrée par `site` (`.eq('site', …)`) ; la RLS (`lecture_meme_site`) double ce filtre. Une seule lecture par chargement d'écran, résultat partagé entre lecteurs. Aucune migration, aucune écriture, aucun accès anon. Réponse vide ou refusée : état « non lisible », jamais « non défini » (point 3).

## 6. Lien avec le référentiel d'objectifs (#394)
Le référentiel dit que MAR-TAUX cible vit dans `tarif_seuils` (`cible_externe`), lu par le moteur R3. Pour éviter deux lectures : un seul module `nexus-cible-marge.js` lit `tarif_seuils` et rend `{cible, minimum, statut, niveau}` par périmètre. Aujourd'hui le Brief l'appelle ; quand R3 existe, ce module devient son adaptateur MAR-TAUX et les lecteurs n'ont rien à changer. Le Brief ne lit jamais la table directement ailleurs.

## À arbitrer par Guardian
1. Un palier « très bonne » du Conseiller doit-il devenir un seuil saisi, ou disparaître ?
2. Un indicatif doit-il noter ou seulement s'afficher (proposé : seulement s'afficher) ?
3. Boussole : axe « non évalué » exclu de la moyenne, ou score global marqué incomplet ?
