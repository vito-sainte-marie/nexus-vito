# Protocole de diagnostic — tout arrêt du lot Production Readiness

**Posé par Frédéric Bragance le 09/09/2026**, après trois mauvaises
attributions successives dans la même soirée :

1. une extension de la recette navigateur a emporté tout le scénario employé,
   et j'ai d'abord cru à un défaut du scénario ;
2. le message d'échec a désigné la carte d'invitation comme absente, alors
   qu'elle était bien servie — vérifié par requête directe ;
3. l'étiquetage a lu « App-v1 » dans le paramètre `retour=NEXUS-App-v1` d'une
   redirection vers le pointage, et a conclu que l'accueil était affiché.

Trois fois, une corrélation de journal a été transformée en conclusion. Ce
n'est pas de la malchance, c'est un défaut de méthode.

**Ce protocole ne crée aucune architecture et ne déplace aucune priorité.** Il
s'applique tel quel, immédiatement, à la répétition réelle existante.

---

## Les huit règles

**1 · Préserver avant de relancer.** La première sortie brute, le code retour,
l'étape exacte et l'état utile des données sont conservés. **Ne pas relancer
immédiatement le scénario complet** : une relance efface la seule observation
qu'on avait.

**2 · Séparer trois choses qui se confondent vite.** Le fait observé. La cause
suspectée. La cause démontrée. Elles ne s'écrivent pas dans la même phrase.

**3 · Descendre à la première commande réellement en échec**, puis la
reproduire isolément avec le plus petit jeu de données possible.

**4 · Double contrôle avant toute désignation.** Aucun script, migration ou
donnée n'est déclaré coupable sans :
- **témoin négatif** — l'élément suspect retiré, l'échec doit DISPARAÎTRE ;
- **témoin positif** — cet élément seul réintroduit, l'échec doit REVENIR.

**5 · Deux reproductions consécutives identiques** avant toute conclusion
causale.

**6 · Une variable à la fois.** Si plusieurs changements sont nécessaires pour
instrumenter le diagnostic, ils sont distingués de la correction.

**7 · Quatre preuves séparées après correction :**
- le cas qui échouait réussit ;
- une mutation reproduisant l'ancien défaut échoue bien ;
- le scénario complet réussit jusqu'au point attendu ;
- aucune nouvelle régression ni finding Guardian.

**8 · Rubriques obligatoires du rapport**, dans cet ordre :

> Observation brute · Reproduction minimale · Hypothèses examinées · Témoins
> exécutés · Cause démontrée · Correction minimale · Preuves après correction ·
> Limites restantes

---

## La formule qui n'a pas de synonyme

Si la causalité n'est pas démontrée, on écrit **exactement** :

> cause non isolée

et l'on poursuit le diagnostic. Aucune paraphrase, aucun « probablement »,
aucun « tout indique que ». Une formule reconnaissable se cherche et se compte ;
une tournure prudente se lit comme une conclusion molle et finit par en tenir
lieu.

---

## Ce que ce protocole interdit en pratique

**Conclure depuis un journal.** Un message d'erreur dit ce qui a été observé au
moment où il a été écrit, pas ce qui l'a causé. Les trois erreurs du 09/09 sont
toutes des lectures de journal promues en diagnostic.

**Corriger et relancer pour voir.** Sans témoin négatif ET positif, une
correction qui « marche » ne prouve pas qu'elle a traité la cause : elle peut
avoir déplacé le symptôme.

**Nommer un coupable pour clore.** Un rapport qui désigne à tort envoie la
session suivante chercher au mauvais endroit, et coûte plus cher que l'absence
de rapport.

---

## Portée

Lot `NEXUS-PRODUCTION-READINESS-1-20260908`, tout arrêt. **Aucun accès ni
changement Production n'est autorisé par ce protocole** : il encadre le
diagnostic, il n'ouvre aucune porte.
