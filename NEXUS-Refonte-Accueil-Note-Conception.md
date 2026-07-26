# NEXUS — Refonte de la page d'accueil
### Note de conception — 24/07/2026

Maquette associée : `NEXUS-Home-Concept-v1.html` (à ouvrir dans un navigateur — données d'exemple, non branchée à Supabase, ne remplace pas `NEXUS-App-v1.html`).

---

## 1. Critique de la page actuelle

`NEXUS-App-v1.html` est un menu, pas un centre de décision — exactement ce que la Constitution NEXUS interdit à l'accueil.

Ce que voit un Directeur à 6h15 aujourd'hui : un logo, un slogan générique, une carte "Cockpit" avec deux compteurs statiques (références, missions — sans verdict), puis six groupes accordéon (Journée, Analyse, Équipe, Gérer, Découvrir, Intelligence) qu'il faut ouvrir un par un pour trouver quoi que ce soit d'actionnable. Aucun chiffre d'état, aucune priorité, aucune alerte n'est visible avant d'avoir cliqué au moins une fois. La seule "intelligence" présente sur cette page est le rappel des prix carburants — une notification technique, pas une décision.

Le défaut structurel : la page répond à "où sont mes écrans ?" alors qu'elle devrait répondre à "que dois-je faire ?". C'est un catalogue de fonctionnalités, donc un réflexe d'ERP — la page traite NEXUS comme une collection d'outils à ranger, pas comme un directeur d'exploitation qui parle.

## 2. Nouvelle architecture (4 niveaux)

| Niveau | Contenu | Charge cognitive |
|---|---|---|
| 1 — Immédiat | Indice NEXUS, Capital NEXUS, alerte critique (si active), Conseiller NEXUS (3 décisions max) | 2 KPI d'état + 3 décisions |
| 2 — Aujourd'hui | Missions, Rappels, Décisions validées, Progression équipe | 4 KPI, jamais plus |
| 3 — Outils principaux | Cockpit, Verify, Radar, Produits | 4 accès rapides, jamais plus |
| 4 — Tout le reste | 15 écrans restants, groupés par univers, repliés par défaut | 0 par défaut — 1 tap pour tout voir |

Aucun écran existant n'est supprimé. Le Niveau 4 contient l'intégralité de ce qui a disparu de la vue immédiate : Prise de poste, Pointage, Mon Planning, Nexus Planner, Assignations, Résultats Équipe, Évaluation, Mon Évolution, Import, Scanner Stock, Scanner NEXUS, Rayon, Centre d'Intelligence, Journal, Capital NEXUS (vue détaillée), Paramètres Station, Administration multi-site, Debug créateur.

## 3. Ordre exact des blocs

1. Bandeau station + horodatage ("Bonjour Fred · vendredi 24 juillet · 06:15")
2. Carte "État du commerce" — Indice NEXUS + Capital NEXUS, une seule bannière
3. Alerte critique (uniquement si une alerte est active — invisible sinon)
4. Conseiller NEXUS — 3 décisions, temps estimé, gain potentiel, un seul bouton d'action
5. Grille "Aujourd'hui" — 4 KPI
6. Grille "Outils principaux" — 4 cartes
7. "Tous les outils" — replié, groupé par univers

## 4. Raisons cognitives de chaque choix

**Indice + Capital dans une seule bannière** : ce sont les deux seuls chiffres qui répondent à "comment va mon commerce dans l'absolu ?", avant toute question de "quoi faire". Les séparer les noierait parmi les KPI d'action du Niveau 2.

**Alerte critique conditionnelle** : une alerte qui apparaît toujours (même vide) devient du bruit qu'on ignore au bout de trois jours. Elle ne doit exister à l'écran que si elle est vraie.

**Conseiller limité à 3 décisions** : au-delà de trois éléments, un cerveau humain cesse de prioriser et commence à trier — l'inverse de l'objectif. Trois est le maximum qu'on retient sans effort et qu'on peut exécuter dans la même matinée.

**Temps estimé + gain potentiel en clôture** : ce sont les deux variables qui déclenchent réellement l'action ("est-ce que ça vaut le coup, maintenant ?") — les mettre à la fin du message du Conseiller, jamais avant l'explication, respecte l'ordre naturel Constat → Explication → Décision déjà utilisé ailleurs dans NEXUS (Rayon, Produits).

**4 KPI et 4 accès rapides, jamais plus** : c'est la limite numérique donnée par le brief, et elle correspond à la capacité de la mémoire de travail à traiter une grille sans scanner colonne par colonne — au-delà de 4, l'œil doit chercher plutôt que percevoir d'un coup.

**Niveau 4 replié, groupé par univers plutôt qu'en liste plate** : un directeur qui a besoin de "Paramètres Station" une fois par mois ne doit jamais payer son coût visuel les 29 autres jours — mais il doit le retrouver en moins de 3 secondes le jour où il le cherche, d'où le regroupement par intention (Ma journée / Équipe / Données / Intelligence / Administration) plutôt qu'un ordre alphabétique ou chronologique.

## 5. Éléments supprimés de la vue immédiate

- L'accordéon de 6 groupes toujours visibles (Journée, Analyse, Équipe, Gérer, Découvrir, Intelligence)
- Les compteurs statiques "Références" / "Missions" sous la carte Cockpit, qui n'exprimaient aucun jugement
- Le sous-titre générique ("Chaque décision compte...")
- La hero card "Nexus Verify" et "Nexus Planner" comme entrées de navigation autonomes — absorbées respectivement dans les 4 outils principaux et le Niveau 4

Rien n'est supprimé du produit — seulement de ce qui s'affiche avant tout clic.

## 6. Éléments mis en avant

Indice NEXUS, Capital NEXUS, alerte critique, Conseiller NEXUS (3 décisions + temps + gain) — dans cet ordre, avant toute navigation.

## 7. Modules regroupés (univers du Niveau 4)

- **Ma journée** : Prise de poste, Pointage, Mon Planning, Nexus Planner
- **Équipe** : Assignations, Résultats Équipe, Évaluation, Mon Évolution
- **Données** : Import, Scanner Stock, Scanner NEXUS, Rayon
- **Intelligence** : Centre d'Intelligence, Journal NEXUS, Capital NEXUS (vue détaillée)
- **Administration** : Paramètres Station, Administration multi-site, Debug créateur

## 8. Modules masqués par défaut

Tous les univers ci-dessus — 15 écrans au total, 0 visibles tant que "Tous les outils" n'est pas ouvert.

## 9. Maquette textuelle (wireframe)

```
┌─────────────────────────────────┐
│ NEXUS · Vito Sainte-Marie Usine  │
│ Bonjour Fred · ven. 24/07 · 6h15 │
├─────────────────────────────────┤
│  INDICE NEXUS   │  CAPITAL NEXUS │
│      62         │   4 280 €      │
│  Situation sous contrôle...      │
├─────────────────────────────────┤
│ ⚠ Prix carburants non renseignés │
├─────────────────────────────────┤
│ 🧭 CONSEILLER NEXUS               │
│ 1. Contrôler écarts caisse       │
│ 2. Commander SP95                │
│ 3. Corriger 2 marges tabac       │
│ 18 min · 420 €    [Commencer →]  │
├─────────────────────────────────┤
│ Missions │ Rappels │ Décisions │ Équipe │  (2x2)
├─────────────────────────────────┤
│ Cockpit │ Verify │ Radar │ Produits │  (2x2)
├─────────────────────────────────┤
│      + Tous les outils (15)      │
└─────────────────────────────────┘
```

## 10. Parcours utilisateur — 30 premières secondes

- **0–3s** : le Directeur voit son Indice (62, ambre) et son Capital (4 280 €) sans avoir rien cliqué — il sait déjà si sa journée part bien ou mal.
- **3–8s** : il lit l'alerte carburant si elle existe, sinon son regard descend directement au Conseiller.
- **8–15s** : il lit les 3 décisions, le temps (18 min) et le gain (420 €) — il décide mentalement s'il les traite maintenant ou plus tard.
- **15–20s** : il touche "Commencer par la priorité 1" et atterrit directement dans Verify, sans passer par un menu.
- **20–30s** : s'il n'a pas besoin d'agir immédiatement, son regard balaie les 4 KPI du jour puis les 4 outils principaux — jamais le reste, sauf besoin explicite.

## 11. Justification selon la philosophie NEXUS

| ERP | NEXUS (nouvelle page) |
|---|---|
| Enregistre | Le Conseiller explique *pourquoi* contrôler les écarts, pas juste qu'il y en a |
| Montre | L'Indice et le Capital *interprètent* les chiffres, ils ne les listent pas |
| Calcule | Les 3 décisions sont *hiérarchisées*, pas une liste plate triée par date |
| Exécute | Le bouton "Commencer" *orchestre* le parcours vers l'outil pertinent |
| Stocke des données | Le Capital NEXUS affiche la *valeur créée*, pas un solde comptable |

## 12. Comparaison avant / après

| | Avant (`NEXUS-App-v1.html`) | Après (concept) |
|---|---|---|
| Premier contenu visible | Logo + carte Cockpit + 2 compteurs neutres | Indice + Capital + verdict en une phrase |
| Décision proposée avant clic | Aucune | 3, hiérarchisées, chiffrées |
| Écrans visibles sans interaction | ~9 (accordéons ouverts par défaut sur leur 1er item) | 8 (2 état + 4 KPI + 4 outils = en réalité 4+4, l'état n'est pas un "écran") |
| Écrans nécessitant un clic supplémentaire | ~10 | 15, groupés en 5 univers derrière un seul toggle |
| Temps pour identifier la priorité du jour | Nécessite d'ouvrir Cockpit puis lire le Brief | 0 — visible dès l'ouverture |
| Sensation | Menu d'application | Poste de pilotage |

---

**Prochaine étape suggérée** : si cette hiérarchie convient, l'intégration réelle consistera à brancher l'Indice NEXUS (`nexus-indice.js`), le Capital NEXUS et les 3 priorités du Conseiller sur les mêmes données que `NEXUS-Cockpit-v2.html` (elles existent déjà côté moteur), puis conserver `NEXUS-App-v1.html` tel quel en accès "Ancien menu" le temps de la transition, ou le retirer une fois validé.
