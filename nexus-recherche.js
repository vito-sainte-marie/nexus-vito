// Recherche NEXUS « Que cherchez-vous à faire ? » (25/10/2026, décision de
// Frédéric) : l'index et la logique, extraits de NEXUS-App-v1.html pour que
// l'Accueil et Ma Progression utilisent la MÊME source (aucune copie).
// Le HTML du champ reste dans chaque page ; ce module ne fait que le câbler.
(function (root) {
  const PAGES_INDEX = [
    // Brief NEXUS (02/08/2026, demande de Frédéric) : synthèse à
    // l'attention du dirigeant, agrège les moteurs NEXUS réellement actifs
    // et contributeurs pour ce site (registre central, voir
    // nexus-moteurs-registre.js, 13/08/2026 — plus de liste ni de compte
    // fixe codés en dur ici) en une Boussole NEXUS à 6 secteurs + 3
    // décisions priorisées — en tête de liste, avant le Cockpit (brief
    // opérationnel du manager).
    { label: 'Brief NEXUS', desc: 'La synthèse du dirigeant : 5 axes, 3 décisions, un chiffre', href: 'NEXUS-Brief-v1.html', role: 'manager' },
    { label: 'Rapport NEXUS', desc: 'CA, marge et décisions sur une période choisie, comparés à une référence', href: 'NEXUS-Rapport-v1.html', role: 'manager' },
    { label: 'Cockpit', desc: 'Le brief du matin, en un coup d\'œil', href: 'NEXUS-Cockpit-v2.html', role: 'manager' },
    { label: 'Centre d\'Intelligence', desc: 'Que détecte NEXUS dans mon commerce ?', href: 'NEXUS-Centre-Intelligence-v1.html', role: 'manager' },
    { label: 'Journal', desc: 'Qu\'est-ce qui a été fait aujourd\'hui ?', href: 'NEXUS-Journal-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Capital NEXUS', desc: 'La valeur créée par vos décisions', href: 'NEXUS-Capital-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Scanner NEXUS', desc: 'CA, marge et répartition ABC du magasin', href: 'NEXUS-Scanner-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Radar du Manager', desc: '8 domaines de responsabilité', href: 'NEXUS-Radar-Manager-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Contrôle inventaire', desc: 'Écarts, comptages manquants et décisions du jour', href: 'NEXUS-Inventaire-Manager-v1.html', role: 'manager', forfait: 'professional' },
    // NEXUS FDJ (09/08/2026, demande de Frédéric) : role 'all' — même
    // convention que Inventaire (l'écran de comptage employé doit rester
    // trouvable par recherche pour l'employé qui compte lui-même son quart
    // FDJ, pas seulement pour le manager qui le consulte).
    { label: 'FDJ', desc: 'Grattage, tirages et caisse FDJ — écart toujours calculé', href: 'NEXUS-FDJ-v1.html', role: 'all', forfait: 'professional' },
    { label: 'FDJ Opérations', desc: "Historique, écarts et correction de n'importe quel quart", href: 'NEXUS-FDJ-Manager-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'FDJ Performance', desc: "Tendances, jeux, équipe, stock et écarts — ce qui mérite l'attention", href: 'NEXUS-FDJ-Analyse-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Coach FDJ', desc: 'Votre conseil du jour, en une phrase', href: 'NEXUS-Coach-FDJ-v1.html', role: 'all', forfait: 'professional' },
    // Traçabilité (04/08/2026, demande de Frédéric) : volontairement absente
    // du tiroir de menu principal — page consultée seulement pour les
    // produits suivis par lot (SDD, presse), signalée via le Conseiller
    // NEXUS et un lien direct depuis Paramètres → Inventaire → Gestion des
    // profils. Présente ici uniquement pour rester trouvable par recherche.
    { label: 'Traçabilité', desc: 'Lots, retours fournisseurs et échéances (SDD, presse)', href: 'NEXUS-Tracabilite-v1.html', role: 'manager', forfait: 'professional' },
    // Paramètres Inventaire (05/08/2026, rejoint le tiroir "Explorer NEXUS"
    // — groupe Administrer — le 07/08/2026) : reste aussi ici pour rester
    // trouvable par recherche.
    { label: 'Paramètres Inventaire', desc: 'Produits comptés, parcours, règles, alertes et traçabilité', href: 'NEXUS-Parametres-Inventaire-v1.html', role: 'manager', forfait: 'professional' },
    // Paramètres FDJ (10/08/2026, audit "Paramétrage autonome & multi-site",
    // étape 3) : rejoint aussi le tiroir "Explorer NEXUS" — groupe
    // Administrer — le même jour.
    { label: 'Paramètres FDJ', desc: 'Organisation, catalogue des jeux et emplacements', href: 'NEXUS-FDJ-Parametres-v1.html', role: 'manager', forfait: 'professional' },
    // Comptes Clients (07/08/2026, cahier des charges de Frédéric) : centre
    // de pilotage des clients en compte — facturation, justificatifs et
    // relation client. Paramètres Comptes Clients reste joignable par
    // recherche (accès direct aussi depuis l'onglet Comptes Clients).
    { label: 'Comptes Clients', desc: 'Facturation, justificatifs et relation clients sous contrôle', href: 'NEXUS-Comptes-Clients-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Paramètres Comptes Clients', desc: "Identité, signature, modèle d'e-mail, tolérances de rapprochement", href: 'NEXUS-Parametres-Comptes-Clients-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Rayon', desc: 'CA, marge, top ventes par catégorie', href: 'NEXUS-Rayon-v1.html', role: 'manager' },
    { label: 'Produits', desc: 'Fiche complète par référence', href: 'NEXUS-Produits-v1.html', role: 'manager' },
    { label: 'Tempo', desc: 'Les jours qui portent votre station, ceux qui la ralentissent', href: 'NEXUS-Tempo-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Campagnes', desc: 'Déclarer une promotion, mesurer son impact', href: 'NEXUS-Campagne-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Scanner Stock', desc: 'Où vous perdez de l\'argent, quoi recompter', href: 'NEXUS-Scanner-Stock-v1.html', role: 'manager' },
    { label: 'Verify', desc: 'Contrôle caisse et écarts', href: 'NEXUS-Verify-v1.html', role: 'manager' },
    { label: 'Carburants', desc: 'Jaugeage à l\'ouverture, théorique et écart calculés', href: 'NEXUS-Carburants-v1.html', role: 'manager' },
    { label: 'Carburants Performance', desc: 'Volumes, mix et moteurs de performance sur une période choisie', href: 'NEXUS-Carburants-Pilotage-v1.html', role: 'manager' },
    // Réception carburant (14/08/2026, audit "Réceptions, deltas et effet
    // économique du stock", P1) : role 'all' — comme Inventaire, c'est un
    // outil du quotidien pour l'employé qui réceptionne une livraison, pas
    // seulement pour le manager.
    { label: 'Réception carburant', desc: 'Livraison, jaugeage avant/après et calcul NEXUS', href: 'NEXUS-Carburant-Reception-v1.html', role: 'all' },
    { label: 'Missions', desc: '55 procédures · checklist interactive', href: 'NEXUS-Missions-v1.html', role: 'all' },
    // Inventaire (02/08/2026, demande de Frédéric) : role 'all' — visible
    // par recherche pour l'employé, en plus de la mini carte accueil.
    { label: 'Inventaire', desc: "Comptages d'ouverture et de clôture de quart", href: 'NEXUS-Inventaire-v1.html', role: 'all' },
    { label: 'Assignations', desc: 'Assigner, suivre, valider une mission', href: 'NEXUS-Assignations-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Planning', desc: 'Le bon collaborateur, au bon endroit, au bon moment', href: 'NEXUS-Planning-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Paye', desc: 'Variables mensuelles fiabilisées pour la comptabilité', href: 'NEXUS-Paye-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Évaluations', desc: 'Contrôle tenue + grille de prime', href: 'NEXUS-Evaluation-Employe-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Résultats', desc: 'Progression réelle par employé', href: 'NEXUS-Resultats-Equipe-v1.html', role: 'manager', forfait: 'professional' },
    { label: 'Imports', desc: 'Ventes, catalogue ou stock instantané', href: 'NEXUS-Import-v1.html', role: 'manager' },
    { label: 'Paramètres', desc: 'Horaires de service, prix carburants', href: 'NEXUS-Parametres-Station-v1.html', role: 'manager' },
    { label: 'Rappels', desc: 'Commandes fournisseurs, carburant', href: 'NEXUS-Parametres-Rappels-v1.html', role: 'manager' },
    { label: 'Administration multi-site', desc: 'Nom, logo et création de nouveaux sites', href: 'NEXUS-Admin-Sites-v1.html', role: 'createur' },
    { label: 'Debug créateur', desc: 'Outils techniques multi-site — agit directement sur Supabase', href: 'NEXUS-Debug-Createur-v1.html', role: 'createur', danger: true },
    { label: 'Pointage', desc: 'Arrivée, pause, départ', href: 'NEXUS-Pointage-v1.html', role: 'all' },
    { label: 'Mon Planning', desc: 'Vos jours de travail, votre rôle, vos repos', href: 'NEXUS-Mon-Planning-v1.html', role: 'all' },
    // Ma Progression (27/07/2026, demande de Frédéric) : role 'all' — sans
    // ?employe dans l'URL, la page affiche toujours les données de la
    // personne connectée (employé comme manager), jamais celles d'un tiers.
    { label: 'Ma Progression', desc: 'Votre coach personnel NEXUS', href: 'NEXUS-Progression-v1.html', role: 'all' },
    { label: 'Ce que NEXUS a appris sur moi', desc: 'Qualités, habitudes et progrès observés par le Coach', href: 'NEXUS-Apprentissage-v1.html', role: 'all' },
    // Comprendre NEXUS (07/08/2026, demande de Frédéric — renommé le même
    // jour) : point d'entrée par intention ("Que voulez-vous faire ?"),
    // avec sa propre recherche par mots-clés. role 'all' car une partie
    // du contenu (Pointage, Missions, Mon Planning, Ma Progression)
    // concerne directement les employés, pas seulement les managers —
    // contrairement au reste du tiroir Explorer NEXUS.
    { label: 'Comprendre NEXUS', desc: 'Quel moteur utiliser selon ce que vous voulez faire', href: 'NEXUS-Documentation-v1.html', role: 'all' },
  ];

  function normaliserRecherche(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function initRechercheNexus(employee, estNiveauManager, forfaitProfessional, briefNexusInclus, pointageRequisManager, roleDuJour, pointageActif, afficherToastForfait) {
    const input = document.getElementById('rechercheNexusInput');
    const resultats = document.getElementById('rechercheNexusResultats');
    if (!input || !resultats) return;

    // Exemples adaptés au discours de la personne (27/07/2026, demande de
    // Frédéric) : "marge" et "planning" (génération d'équipe) ne
    // signifient rien pour un employé — il cherche plutôt son pointage,
    // ses missions ou sa progression.
    // Reformulation en intention (10/08/2026, refonte "Porte NEXUS") :
    // remplace "Rechercher une page NEXUS (...)" par des exemples de ce
    // que l'utilisateur veut FAIRE, pas des noms de pages — cohérent avec
    // le nouveau label "Que cherchez-vous à faire ?" au-dessus du champ.
    input.placeholder = estNiveauManager
      ? 'contrôler une caisse, comprendre ma marge, voir mes stocks…'
      : 'pointer mon arrivée, voir mes missions, ma progression…';

    const visibles = PAGES_INDEX.filter(p => {
      // Pointage désactivé pour tout le site (16/08/2026, demande de
      // Frédéric) : disparaît entièrement de la recherche, pour tous les
      // rôles — contrairement au cas "non requis pour le manager" plus bas
      // (pointageDesactive), qui laisse l'entrée visible mais grisée.
      if (p.href === 'NEXUS-Pointage-v1.html' && !pointageActif) return false;
      // Inventaire masqué pour un renfort (03/08/2026, demande de Frédéric) :
      // même logique que la mini-carte d'accueil — un renfort n'a pas de
      // comptage d'ouverture/clôture à faire, il ne doit donc pas non plus
      // le retrouver via la recherche.
      if (p.href === 'NEXUS-Inventaire-v1.html' && roleDuJour === 'renfort') return false;
      if (p.role === 'all') return true;
      if (p.role === 'manager') return estNiveauManager;
      if (p.role === 'createur') return !!employee.est_createur;
      return false;
    });

    function rendre(requete) {
      const q = normaliserRecherche(requete);
      if (!q) { resultats.innerHTML = ''; resultats.classList.remove('open'); return; }
      const matches = visibles.filter(p => normaliserRecherche(`${p.label} ${p.desc}`).includes(q)).slice(0, 8);
      if (!matches.length) {
        resultats.innerHTML = `<div class="recherche-vide">Aucune page ne correspond à « ${requete} ».</div>`;
        resultats.classList.add('open');
        return;
      }
      resultats.innerHTML = matches.map(p => {
        // Pointage garde son cas particulier même trouvé par la
        // recherche : non requis pour le poste manager par défaut.
        const pointageDesactive = p.href === 'NEXUS-Pointage-v1.html' && estNiveauManager && !pointageRequisManager;
        const forfaitVerrouille = p.forfait === 'professional' && !forfaitProfessional;
        const briefVerrouille = (p.href === 'NEXUS-Brief-v1.html' && briefNexusInclus === false);
        const desc = pointageDesactive ? 'Non requis pour votre poste — activable dans Paramètres Station' : p.desc;
        const badges = `${forfaitVerrouille ? ' <span class="nav-badge badge-premium">Professional</span>' : ''}${briefVerrouille ? ' <span class="nav-badge badge-soon">Non inclus</span>' : ''}${p.danger ? ' <span class="nav-badge badge-danger">⚠ Irréversible</span>' : ''}`;
        if (pointageDesactive) {
          return `<div class="recherche-item disabled"><div class="recherche-item-body"><div class="recherche-item-titre">${p.label}</div><div class="recherche-item-desc">${desc}</div></div></div>`;
        }
        return `<a class="recherche-item" href="${p.href}" data-forfait-verrouille="${forfaitVerrouille}" data-brief-verrouille="${briefVerrouille}" data-forfait-page="${p.href}">
          <div class="recherche-item-body">
            <div class="recherche-item-titre">${p.label}${badges}</div>
            <div class="recherche-item-desc">${desc}</div>
          </div>
          <div class="recherche-item-arrow">›</div>
        </a>`;
      }).join('');
      resultats.classList.add('open');

      resultats.querySelectorAll('a.recherche-item[data-forfait-verrouille="true"]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          afficherToastForfait(el.getAttribute('data-forfait-page'));
        });
      });
      resultats.querySelectorAll('a.recherche-item[data-brief-verrouille="true"]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          let toast = document.getElementById('forfaitToast');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'forfaitToast';
            toast.className = 'forfait-toast';
            document.body.appendChild(toast);
          }
          toast.textContent = "💎 Brief NEXUS n'est pas inclus pour votre site — contactez votre créateur NEXUS pour l'activer.";
          toast.classList.add('visible');
          clearTimeout(toast._timeout);
          toast._timeout = setTimeout(() => toast.classList.remove('visible'), 4000);
        });
      });
    }

    input.addEventListener('input', () => rendre(input.value));
  }

  root.NexusRecherche = { PAGES_INDEX, normaliserRecherche, initRechercheNexus };
})(typeof window !== 'undefined' ? window : globalThis);
