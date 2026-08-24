# Backtest du moteur Commande Carburant — site pilote vito-sainte-marie

Ce rapport rejoue le moteur NEXUS de recommandation de commande carburant contre les 18 commandes réelles de mai à août 2026 que tu as fournies (fichier `NEXUS_Historique_Commandes_Carburant_Site_Pilote.xlsx`). Il répond à ta demande explicite de ne pas activer les notifications automatiques sans vérification préalable sur des données réelles.

## Ce que ce backtest vérifie, et ce qu'il ne vérifie pas

Un rejeu complet, jour par jour, demanderait de reconstruire le stock réel et les ventes exactes à la date de chaque commande de mai à août. Cette série temporelle fiable n'existe pas dans NEXUS avant la mise en place de la chaîne temporelle carburant horodatée (à partir de la mi-août 2026) — inventer un stock antérieur serait exactement la « fausse précision » que nous nous interdisons.

Ce backtest est donc structurel : il vérifie chaque commande réelle contre les règles du moteur (capacité physique des cuves, minimum camion, arrondi au millier, respect du cut-off 11h) et situe chaque commande par rapport au pattern des 17 autres (jamais la commande elle-même comptée dans sa propre référence). Un rejeu complet jour par jour redeviendra possible dès que l'historique de stock/ventes correspondant à cette période existera.

## Contexte historique de plausibilité

Sur les 18 commandes (13/05 → 19/08/2026, 580 000 L au total, 308 000 L de SP95 et 272 000 L de GO) : volume moyen 32 222 L, volume médian 36 000 L, intervalle moyen entre commandes 5,76 jours. Ces chiffres, désormais calculés par une fonction pure du moteur (`construireContextePlausibilite`) à partir des données réelles importées en base, correspondent exactement à ta propre synthèse. Ils servent uniquement de repère de lecture — jamais une règle qui bloque une recommandation — affiché discrètement dans la fiche de proposition NEXUS.

## Conformité structurelle

Les 18 commandes réelles respectent toutes les règles structurelles du moteur : aucune ne dépasse la capacité de remplissage, aucune n'est sous le minimum camion (10 000 L), toutes sont arrondies au millier. C'est cohérent avec le fait qu'elles ont toutes été effectivement livrées par le fournisseur.

## Les trois cas notables que tu avais signalés

**Commande n°1008** (18/06, 11h07) — passée après le cut-off théorique de 11h, mais livrée dès le lendemain sans jour de retard supplémentaire. Le fournisseur n'applique donc pas le cut-off aussi strictement que la règle modélisée le suppose. NEXUS l'affiche désormais comme une observation, pas une anomalie — utile pour calibrer le cut-off réel si ce décalage se confirme sur d'autres commandes futures.

**Commande n°1007** (12/06) — livrée un jour *avant* la date souhaitée (souhaitée le 13/06, livrée le 12/06). Volume total 22 000 L, sensiblement inférieur au pattern habituel (écart de -39 % par rapport à la médiane) — cohérent avec ta note « commandes d'appoint ».

**Commande n°1016** (31/07) — livraison souhaitée un samedi (02/08), effectuée le dimanche (03/08) : décalage d'un jour lié au week-end, à traiter comme une observation de fiabilité fournisseur plutôt qu'un défaut du moteur.

## Commandes qui s'écartent du pattern habituel

Trois commandes ressortent comme « inhabituelles » par rapport à la médiane de 36 000 L : n°1007 (22 000 L), n°1012 (20 000 L) et n°1015 (19 000 L). Ce sont précisément les « commandes d'appoint » que tu avais toi-même repérées dans ta synthèse — le moteur les identifie désormais automatiquement, sans les bloquer ni les pénaliser.

## Ce que cela signifie pour l'activation des notifications

Le backtest structurel ne trouve aucune non-conformité sur les 18 commandes réelles, et les écarts qu'il détecte (cut-off, livraisons décalées, commandes d'appoint) sont exactement ceux que tu avais toi-même identifiés en marge du fichier — pas de faux positifs, pas de signal manqué sur ce que ces données permettent de vérifier. Cela ne constitue pas encore la validation complète en 3 phases que tu as demandée (observation → recommandation visible → notifications), puisque cette dernière suppose de rejouer la décision jour par jour avec le stock réel de l'époque, actuellement indisponible. Les notifications restent actives en production comme convenu ; ce backtest est une première brique de confiance, pas la validation finale du cahier.

## Détail des 18 commandes

| N° | Date commande | Volume total | Cut-off | Écart livraison | Écart au pattern |
|---|---|---|---|---|---|
| 1001 | 13/05 09:25 | 31 000 L | avant 11h | 0 j | dans la norme |
| 1002 | 19/05 10:03 | 32 000 L | avant 11h | 0 j | dans la norme |
| 1004 | 27/05 08:45 | 32 000 L | avant 11h | 0 j | dans la norme |
| 1005 | 02/06 08:37 | 36 000 L | avant 11h | 0 j | dans la norme |
| 1006 | 09/06 06:01 | 36 000 L | avant 11h | 0 j | dans la norme |
| 1007 | 12/06 07:13 | 22 000 L | avant 11h | -1 j | **inhabituel** |
| 1008 | 18/06 11:07 | 36 000 L | **après 11h** (livrée quand même le lendemain) | 0 j | dans la norme |
| 1009 | 24/06 07:15 | 32 000 L | avant 11h | 0 j | dans la norme |
| 1010 | 30/06 10:48 | 36 000 L | avant 11h | 0 j | dans la norme |
| 1011 | 06/07 10:01 | 36 000 L | avant 11h | 0 j | dans la norme |
| 1012 | 09/07 10:36 | 20 000 L | avant 11h | 0 j | **inhabituel** |
| 1013 | 16/07 08:51 | 36 000 L | avant 11h | 0 j | dans la norme |
| 1014 | 22/07 09:15 | 36 000 L | avant 11h | 0 j | dans la norme |
| 1015 | 28/07 09:49 | 19 000 L | avant 11h | 0 j | **inhabituel** |
| 1016 | 31/07 10:46 | 36 000 L | avant 11h | **+1 j** (week-end) | dans la norme |
| 1017 | 06/08 10:47 | 36 000 L | avant 11h | 0 j | dans la norme |
| 1019 | 12/08 09:37 | 32 000 L | avant 11h | 0 j | dans la norme |
| 1020 | 19/08 07:43 | 36 000 L | avant 11h | 0 j | dans la norme |

*Numéros 1003 et 1018 volontairement absents — non capturés dans le fichier source, jamais supposés inexistants.*
