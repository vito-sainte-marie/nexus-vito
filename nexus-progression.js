// ============================================================
// NEXUS Progression — le Conseiller devient un coach personnel.
//
// Demande de Frédéric le 27/07/2026 : transformer "Mon Évolution" (jamais
// livré, resté à l'état de prototype dans NEXUS-Home-Concept-v1.html) en
// "Ma Progression". Trois questions guident tout ce moteur, jamais un
// chiffre nu :
//   1. Pourquoi cet écart est-il probablement arrivé ?
//   2. Comment l'éviter demain ?
//   3. Quels progrès ont été réalisés ?
//
// Philosophie non négociable (Article 5 + langage NEXUS déjà en vigueur
// dans nexus-verify/nexus-marge/nexus-tempo) :
//   - jamais un chiffre inventé — "Données insuffisantes" plutôt qu'un
//     score optimiste par défaut ;
//   - jamais une accusation — "les données indiquent" plutôt que "vous
//     avez fait" ;
//   - jamais une comparaison entre collègues — uniquement la personne
//     comparée à elle-même dans le temps.
//
// Attribution des écarts de caisse (décision de Frédéric, 27/07/2026) :
// audits_caisse.employes_piste/employes_boutique sont des LISTES —
// plusieurs personnes peuvent partager le même poste au même quart. Un
// écart n'est donc compté dans les statistiques personnelles d'un employé
// QUE s'il/elle était seul(e) sur ce poste ce quart-là (liste à 1 élément)
// : aucune ambiguïté, jamais de fausse accusation sur un poste partagé.
// Un quart partagé compte quand même comme "service travaillé" (utile aux
// points forts positifs, ex. "14 services sans écart" — un écart conforme
// ne fait de tort à personne, l'attribution n'a pas besoin d'être certaine
// pour créditer un bon résultat), mais jamais comme preuve d'un écart
// individuel.
//
// Inclure dans une page : <script src="nexus-progression.js?v=20260903-1221"></script>
// (même mécanisme que nexus-auth.js, nexus-marge.js, nexus-tempo.js)
//
// v2.286 (29/08/2026, demande de Frédéric) : la classification "conforme /
// écart" d'un contrôle VALIDÉ (statutCaisseJour, statutActivite — sections
// 10-11) délègue désormais à nexus-ecarts-moteur.js (deriverStatutEcart),
// la même mécanique déjà utilisée par "Analyse des écarts" manager
// (nexus-ecarts-donnees.js), au lieu d'un second calcul local par seuil.
// Voir le commentaire détaillé au-dessus de statutEcartActiviteVerify.
// DOIT donc être chargé dans cet ordre :
//   <script src="nexus-ecarts-moteur.js?v=20260903-1221"></script>
//   <script src="nexus-progression.js?v=20260903-1221"></script>
// ============================================================

(function (global) {
  // Même seuil que NEXUS Verify (classifierEcart) — ne jamais faire
  // coexister deux définitions différentes de "écart conforme" dans NEXUS.
  const SEUIL_ECART_CONFORME = 2; // €

  // Seuils provisoires (27/07/2026) — premier jet documenté plutôt
  // qu'enfoui, à recalibrer une fois plusieurs mois d'historique réel
  // disponibles (même esprit que SEUIL_ECART_OPERATIONS_EUR dans App-v1).
  const SEUIL_MIN_PONTAGES = 5;
  const SEUIL_MIN_CONTROLES_TENUE = 3;
  const SEUIL_MIN_EVALUATIONS = 1;
  const SEUIL_MIN_ASSIGNATIONS = 3;
  const SEUIL_MIN_ECARTS_TENDANCE = 2; // par fenêtre, pour comparer deux périodes

  // v2.286 (29/08/2026) — même arrondi centimes que nexus-ecarts-moteur.js
  // (arrondiCentimes), réutilisé plutôt que dupliqué (Article 11). Sans ce
  // passage, un montant lu brut depuis Supabase (ex. -36.649999999999636,
  // dérive flottante) resterait différent au bit près du montant affiché
  // côté manager (qui, lui, applique arrondiCentimes dans
  // nexus-ecarts-donnees.js) — les deux valeurs s'affichent identiquement
  // une fois formatées en euros (toFixed(2)), mais Frédéric a explicitement
  // demandé une égalité stricte entre les deux vues, pas seulement une
  // égalité visuelle. Repli défensif si le moteur n'est pas chargé (même
  // logique que statutEcartActiviteVerify plus bas) : arrondi local
  // identique, jamais une exception.
  function arrondi(v) {
    if (v === null || v === undefined || Number.isNaN(v)) return v;
    const M = global.NexusEcartsMoteur;
    return M ? M.arrondiCentimes(v) : Math.round(Number(v) * 100) / 100;
  }

  // ------------------------------------------------------------
  // 1) Services caisse — reconstruction par employé
  // ------------------------------------------------------------

  // rowsAudits : lignes audits_caisse déjà filtrées par site (date, quart,
  // ecart_piste, ecart_boutique, employes_piste, employes_boutique, et
  // depuis "Mes Caisses" le 03/08/2026 : id, valide_le, ecart_piste_valide,
  // ecart_boutique_valide, commentaire_validation — champs additifs, ne
  // changent rien au comportement pour les appelants qui ne les lisent pas).
  // v2.286 (29/08/2026) : ecart_piste_origine/ecart_boutique_origine (capture
  // immuable du tout premier constat, v2.268-B1) et cause_code_piste/
  // cause_code_boutique (motif structuré, v2.267) ajoutés — additifs eux
  // aussi, nécessaires à statutEcartActiviteVerify pour déléguer au moteur
  // central au lieu de recalculer un seuil local (voir plus bas).
  function construireServicesCaisse(rowsAudits, employeeId) {
    const services = [];
    (rowsAudits || []).forEach(a => {
      const listePiste = a.employes_piste || [];
      const listeBoutique = a.employes_boutique || [];
      const surPiste = listePiste.includes(employeeId);
      const surBoutique = listeBoutique.includes(employeeId);
      if (!surPiste && !surBoutique) return;
      services.push({
        id: a.id != null ? a.id : null,
        date: a.date,
        quart: a.quart,
        surPiste, surBoutique,
        soloPiste: surPiste && listePiste.length === 1,
        soloBoutique: surBoutique && listeBoutique.length === 1,
        ecartPiste: surPiste ? arrondi(Number(a.ecart_piste)) : null,
        ecartBoutique: surBoutique ? arrondi(Number(a.ecart_boutique)) : null,
        // Mes Caisses (03/08/2026) : valideLe null => contrôle provisoire.
        // Les montants *_valide ne sont significatifs qu'une fois validés —
        // jamais lus tant que valideLe est null (voir statutCaisseJour).
        valideLe: a.valide_le || null,
        ecartPisteValide: (surPiste && a.ecart_piste_valide != null) ? arrondi(Number(a.ecart_piste_valide)) : null,
        ecartBoutiqueValide: (surBoutique && a.ecart_boutique_valide != null) ? arrondi(Number(a.ecart_boutique_valide)) : null,
        commentaireValidation: a.commentaire_validation || null,
        // v2.286 — nécessaires à deriverStatutEcart (nexus-ecarts-moteur.js).
        ecartPisteOrigine: (surPiste && a.ecart_piste_origine != null) ? arrondi(Number(a.ecart_piste_origine)) : null,
        ecartBoutiqueOrigine: (surBoutique && a.ecart_boutique_origine != null) ? arrondi(Number(a.ecart_boutique_origine)) : null,
        causeCodePiste: surPiste ? (a.cause_code_piste || null) : null,
        causeCodeBoutique: surBoutique ? (a.cause_code_boutique || null) : null,
      });
    });
    // Plus récent d'abord — plus pratique pour les séries et le compteur
    // "N derniers services" du message d'accueil.
    services.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
    return services;
  }

  function estConforme(montant) {
    return montant == null || Math.abs(montant) <= SEUIL_ECART_CONFORME;
  }

  // Un service est "propre" si tous les postes occupés par l'employé ce
  // jour-là sont conformes — peu importe qu'il ait été seul ou non : un
  // écart conforme ne fait de tort à personne, l'attribution n'a pas
  // besoin d'être certaine pour créditer un bon résultat.
  function serviceEstPropre(s) {
    const okPiste = !s.surPiste || estConforme(s.ecartPiste);
    const okBoutique = !s.surBoutique || estConforme(s.ecartBoutique);
    return okPiste && okBoutique;
  }

  function nbServicesConformes(services) {
    return (services || []).filter(serviceEstPropre).length;
  }

  // Écarts réellement attribuables à CET employé : uniquement les postes
  // occupés en solo et hors seuil de conformité. C'est la SEULE liste
  // utilisable pour parler de "vos écarts" — tout le reste resterait une
  // supposition sur un poste partagé.
  function ecartsAttribuables(services) {
    const ecarts = [];
    (services || []).forEach(s => {
      if (s.soloPiste && !estConforme(s.ecartPiste)) {
        ecarts.push({ date: s.date, quart: s.quart, poste: 'piste', montant: s.ecartPiste });
      }
      if (s.soloBoutique && !estConforme(s.ecartBoutique)) {
        ecarts.push({ date: s.date, quart: s.quart, poste: 'boutique', montant: s.ecartBoutique });
      }
    });
    ecarts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return ecarts;
  }

  // Série de services propres — la plus récente (en cours) et la
  // meilleure jamais observée. Sert à "vous êtes à N services sans écart"
  // et "vous égalez/battez votre record".
  function meilleureSerieConforme(services) {
    // services est trié du plus récent au plus ancien : on le retrie du
    // plus ancien au plus récent pour parcourir l'historique dans l'ordre
    // chronologique, plus simple pour détecter des séries.
    const chrono = [...(services || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let record = 0, courante = 0, enCours = 0;
    chrono.forEach(s => {
      if (serviceEstPropre(s)) {
        courante += 1;
        if (courante > record) record = courante;
      } else {
        courante = 0;
      }
    });
    // La série "en cours" est la série propre qui se termine au tout
    // dernier service connu (si le dernier service n'est pas propre, la
    // série en cours est 0).
    for (let i = chrono.length - 1; i >= 0; i--) {
      if (serviceEstPropre(chrono[i])) enCours += 1; else break;
    }
    return { enCours, record, total: chrono.length };
  }

  // Tendance de l'écart moyen (uniquement sur les écarts attribuables) :
  // compare les nbJours derniers jours à la fenêtre équivalente juste
  // avant. Retourne null si l'une des deux fenêtres n'a pas assez
  // d'écarts pour être honnête (SEUIL_MIN_ECARTS_TENDANCE) — jamais de
  // "-40 %" calculé sur un ou deux points isolés.
  function tendanceEcartMoyen(ecarts, nbJours) {
    if (!ecarts || !ecarts.length) return null;
    const jours = nbJours || 21;
    const auj = new Date();
    const seuil1 = new Date(auj.getTime() - jours * 86400000).toISOString().slice(0, 10);
    const seuil2 = new Date(auj.getTime() - 2 * jours * 86400000).toISOString().slice(0, 10);
    const recents = ecarts.filter(e => e.date >= seuil1);
    const precedents = ecarts.filter(e => e.date >= seuil2 && e.date < seuil1);
    if (recents.length < SEUIL_MIN_ECARTS_TENDANCE || precedents.length < SEUIL_MIN_ECARTS_TENDANCE) return null;
    const moyenne = liste => liste.reduce((s, e) => s + Math.abs(e.montant), 0) / liste.length;
    const moyRecente = moyenne(recents);
    const moyPrecedente = moyenne(precedents);
    return { moyRecente, moyPrecedente, ameliore: moyRecente < moyPrecedente, nbJours: jours };
  }

  // Répartition par quart des écarts attribuables — purement descriptive,
  // jamais présentée comme une cause psychologique inventée ("l'attention
  // baisse en fin de service" n'est pas une donnée, c'est une hypothèse).
  // On se limite à ce que les données montrent réellement : la proportion
  // du quart dominant.
  function quartDominant(ecarts) {
    if (!ecarts || ecarts.length < SEUIL_MIN_ECARTS_TENDANCE) return null;
    const parQuart = {};
    ecarts.forEach(e => { parQuart[e.quart] = (parQuart[e.quart] || 0) + 1; });
    const quarts = Object.keys(parQuart);
    if (quarts.length < 2) return { quart: quarts[0], part: 1, n: ecarts.length };
    quarts.sort((a, b) => parQuart[b] - parQuart[a]);
    const quart = quarts[0];
    const part = parQuart[quart] / ecarts.length;
    return part >= 0.7 ? { quart, part, n: ecarts.length } : null;
  }

  // ------------------------------------------------------------
  // 2) Les 5 compétences (Caisse / Ponctualité / Missions / Tenue /
  //    Relation client) — même palette de statuts que l'État global de
  //    App-v1 (COULEUR_STATUT_DOMAINE), pour rester cohérent visuellement.
  // ------------------------------------------------------------

  function statutCaisse(services) {
    const attribuables = services.filter(s => s.soloPiste || s.soloBoutique);
    if (attribuables.length < SEUIL_MIN_ASSIGNATIONS) return { statut: 'Données insuffisantes', detail: null };
    const nbEcarts = ecartsAttribuables(services).length;
    const taux = 1 - nbEcarts / attribuables.length;
    if (taux >= 0.9) return { statut: 'Sous contrôle', detail: `${nbEcarts} écart(s) sur ${attribuables.length} service(s) en solo` };
    if (taux >= 0.7) return { statut: 'À surveiller', detail: `${nbEcarts} écart(s) sur ${attribuables.length} service(s) en solo` };
    return { statut: 'À corriger', detail: `${nbEcarts} écart(s) sur ${attribuables.length} service(s) en solo` };
  }

  // Même formule que statutEquipe (App-v1) et chargerDomainesRadarHome —
  // jamais une deuxième définition du score de ponctualité qui donnerait
  // un chiffre différent de ce que voit déjà le manager.
  function statutPonctualite(pointagesArriveeEmploye) {
    const total = (pointagesArriveeEmploye || []).length;
    if (total < SEUIL_MIN_PONTAGES) return { statut: 'Données insuffisantes', detail: null };
    const retards = pointagesArriveeEmploye.filter(p => (p.retard_min || 0) > 0);
    const totalRetard = retards.reduce((s, p) => s + (p.retard_min || 0), 0);
    const score = Math.round(Math.max(0, 100 - totalRetard));
    const statut = score >= 90 ? 'Sous contrôle' : score >= 70 ? 'À surveiller' : 'À corriger';
    return { statut, detail: `${retards.length} retard(s) sur ${total} pointage(s)`, score, nbRetards: retards.length, total };
  }

  // mission_assignments : uniquement les missions ponctuelles assignées
  // avec échéance (assigned_to_employee_id, due_at, status, updated_at) —
  // les missions récurrentes du catalogue n'ont pas de notion
  // d'assignation individuelle, elles ne peuvent donc pas entrer dans ce
  // calcul sans inventer un total qui n'existe pas.
  function statutMissions(assignationsEmploye) {
    const total = (assignationsEmploye || []).length;
    if (total < SEUIL_MIN_ASSIGNATIONS) return { statut: 'Données insuffisantes', detail: null };
    const terminees = assignationsEmploye.filter(a => a.status === 'terminee');
    const taux = terminees.length / total;
    const enRetard = terminees.filter(a => a.due_at && a.updated_at && a.updated_at.slice(0, 10) > a.due_at.slice(0, 10)).length;
    const statut = (taux >= 0.9 && enRetard === 0) ? 'Sous contrôle' : (taux >= 0.6 ? 'À surveiller' : 'À corriger');
    return { statut, detail: `${terminees.length}/${total} mission(s) assignée(s) terminée(s)`, taux, enRetard };
  }

  function statutTenue(controlesEmploye) {
    const total = (controlesEmploye || []).length;
    if (total < SEUIL_MIN_CONTROLES_TENUE) return { statut: 'Données insuffisantes', detail: null };
    const conformes = controlesEmploye.filter(c => c.conforme).length;
    const taux = conformes / total * 100;
    const statut = taux >= 90 ? 'Sous contrôle' : taux >= 70 ? 'À surveiller' : 'À corriger';
    return { statut, detail: `${conformes}/${total} contrôle(s) conforme(s)`, taux };
  }

  // evaluations_employes : critère "accueil" (type standard, /2) et
  // "service" (type renfort, /5) — les deux seuls critères qui parlent
  // explicitement de relation client dans la grille réelle
  // (NEXUS-Evaluation-Employe-v1.html). Normalisés sur 100 puis moyennés.
  function statutRelationClient(evaluationsEmploye) {
    const notes = [];
    (evaluationsEmploye || []).forEach(e => {
      if (!e.criteres) return;
      if (e.type === 'standard' && e.criteres.accueil != null) notes.push(e.criteres.accueil / 2 * 100);
      if (e.type === 'renfort' && e.criteres.service != null) notes.push(e.criteres.service / 5 * 100);
    });
    if (notes.length < SEUIL_MIN_EVALUATIONS) return { statut: 'Données insuffisantes', detail: null };
    const moyenne = notes.reduce((s, n) => s + n, 0) / notes.length;
    const statut = moyenne >= 85 ? 'Sous contrôle' : moyenne >= 60 ? 'À surveiller' : 'À corriger';
    return { statut, detail: `${notes.length} évaluation(s) prise(s) en compte`, moyenne };
  }

  // ------------------------------------------------------------
  // 3) Niveau NEXUS — synthèse des 5 compétences en étoiles.
  //    V1 provisoire (27/07/2026) : compte, parmi les compétences ayant
  //    assez de données, la proportion "Sous contrôle" — les compétences
  //    à "Données insuffisantes" sont exclues du calcul (jamais pénalisées
  //    pour un manque de données, Article 5), pas remplacées par une
  //    valeur par défaut optimiste ni pessimiste.
  // ------------------------------------------------------------
  function niveauNexus(competences) {
    const exploitables = Object.values(competences).filter(c => c.statut !== 'Données insuffisantes');
    if (!exploitables.length) return { etoiles: null, detail: 'Historique encore insuffisant pour établir un niveau NEXUS.' };
    const poids = { 'Sous contrôle': 1, 'À surveiller': 0.5, 'À corriger': 0 };
    const score = exploitables.reduce((s, c) => s + (poids[c.statut] != null ? poids[c.statut] : 0), 0) / exploitables.length;
    const etoiles = Math.max(1, Math.round(score * 5));
    return { etoiles, detail: `${exploitables.length}/${Object.keys(competences).length} compétence(s) avec assez de données` };
  }

  // ------------------------------------------------------------
  // 4) Points forts — jamais fabriqués : chaque bullet doit être appuyé
  //    par un vrai seuil franchi. Retourne au plus 3 lignes, les plus
  //    parlantes en premier.
  // ------------------------------------------------------------
  function pointsForts({ services, statutPonctualiteVal, statutTenueVal, statutRelationClientVal }) {
    const forts = [];
    const serie = meilleureSerieConforme(services);
    if (serie.enCours >= 3) {
      forts.push({ texte: `${serie.enCours} service${serie.enCours > 1 ? 's' : ''} sans écart de caisse d'affilée.`, poids: serie.enCours });
    } else if (nbServicesConformes(services) >= 5 && services.length >= 5) {
      const pct = Math.round(nbServicesConformes(services) / services.length * 100);
      if (pct >= 80) forts.push({ texte: `${pct} % de vos services sans écart de caisse.`, poids: pct / 20 });
    }
    if (statutPonctualiteVal.statut === 'Sous contrôle' && statutPonctualiteVal.nbRetards === 0) {
      forts.push({ texte: `Ponctualité parfaite sur vos ${statutPonctualiteVal.total} derniers pointages.`, poids: statutPonctualiteVal.total / 5 });
    }
    if (statutTenueVal.statut === 'Sous contrôle') {
      forts.push({ texte: 'Tenue conforme lors de vos derniers contrôles.', poids: 3 });
    }
    if (statutRelationClientVal.statut === 'Sous contrôle') {
      forts.push({ texte: 'Excellent accueil client observé.', poids: 3 });
    }
    forts.sort((a, b) => b.poids - a.poids);
    return forts.slice(0, 3).map(f => f.texte);
  }

  // ------------------------------------------------------------
  // 5) Axe de progression principal — un seul, le plus significatif
  //    parmi les compétences ayant assez de données. Priorité : "À
  //    corriger" avant "À surveiller" ; à égalité, le plus de preuves
  //    disponibles gagne (plus fiable à expliquer).
  // ------------------------------------------------------------
  const ORDRE_GRAVITE = { 'À corriger': 2, 'À surveiller': 1, 'Sous contrôle': 0 };

  function identifierAxeProgression({ services, statutCaisseVal, statutPonctualiteVal, statutMissionsVal, statutTenueVal, ecartsAttribuablesVal }) {
    const candidats = [
      { domaine: 'Caisse', val: statutCaisseVal, preuves: ecartsAttribuablesVal.length },
      { domaine: 'Ponctualité', val: statutPonctualiteVal, preuves: statutPonctualiteVal.nbRetards || 0 },
      { domaine: 'Missions', val: statutMissionsVal, preuves: statutMissionsVal.enRetard || 0 },
      { domaine: 'Tenue', val: statutTenueVal, preuves: 1 },
    ].filter(c => c.val.statut !== 'Données insuffisantes' && ORDRE_GRAVITE[c.val.statut] > 0);

    if (!candidats.length) return null;
    candidats.sort((a, b) => (ORDRE_GRAVITE[b.val.statut] - ORDRE_GRAVITE[a.val.statut]) || (b.preuves - a.preuves));
    const choisi = candidats[0];

    if (choisi.domaine === 'Caisse') {
      // Vocabulaire coach (27/07/2026, demande de Frédéric — "le Coach ne
      // parle jamais de problèmes, il parle de progression") : "point
      // d'attention" plutôt que "écart", uniquement sur ce texte destiné
      // au coach personnel (identifierAxeProgression n'est consommé que
      // par Ma Progression, jamais par une vue manager).
      const dominant = quartDominant(ecartsAttribuablesVal);
      const constat = ecartsAttribuablesVal.length === 1
        ? `Un point d'attention a été identifié sur votre dernier service en solo (${Math.abs(ecartsAttribuablesVal[0].montant).toFixed(2)} €).`
        : `${ecartsAttribuablesVal.length} points d'attention ont été identifiés sur vos services en solo.`;
      const causeProbable = dominant
        ? `Les données indiquent qu'ils surviennent surtout lors du quart ${dominant.quart === 'quart2' ? 'du soir' : 'du matin'} (${dominant.n} sur ${ecartsAttribuablesVal.length}).`
        : null;
      return {
        domaine: 'Caisse', constat, causeProbable,
        recommandation: 'Prenez deux secondes supplémentaires pour vérifier chaque rendu de monnaie, en particulier pendant les périodes chargées.',
      };
    }
    if (choisi.domaine === 'Ponctualité') {
      return {
        domaine: 'Ponctualité',
        constat: `Les données indiquent ${statutPonctualiteVal.nbRetards} retard(s) sur vos ${statutPonctualiteVal.total} derniers pointages.`,
        causeProbable: null,
        recommandation: 'Prévoyez quelques minutes de marge avant le début de votre service pour sécuriser votre pointage.',
      };
    }
    if (choisi.domaine === 'Missions') {
      return {
        domaine: 'Missions',
        constat: `Les données indiquent ${statutMissionsVal.detail}.`,
        causeProbable: null,
        recommandation: 'Traitez vos missions assignées dès leur réception plutôt qu\'en fin d\'échéance, pour ne jamais dépendre du dernier moment.',
      };
    }
    // Tenue
    return {
      domaine: 'Tenue',
      constat: `Les données indiquent ${statutTenueVal.detail}.`,
      causeProbable: null,
      recommandation: 'Vérifiez votre tenue avant chaque prise de poste, à l\'aide de la liste utilisée lors des contrôles.',
    };
  }

  // ------------------------------------------------------------
  // 6) Encouragement — toujours quelque chose de réel à dire, jamais un
  //    chiffre gonflé. Priorité : record en cours > tendance en
  //    amélioration > proximité d'un record > message neutre.
  // ------------------------------------------------------------
  function genererEncouragement({ services, ecartsAttribuablesVal }) {
    const serie = meilleureSerieConforme(services);
    if (serie.enCours > 0 && serie.enCours >= serie.record && serie.total >= 5) {
      return `Vous réalisez actuellement votre meilleure série de services sans écart depuis le début de vos données NEXUS (${serie.enCours}).`;
    }
    const tendance = tendanceEcartMoyen(ecartsAttribuablesVal);
    if (tendance && tendance.ameliore) {
      return `Bonne nouvelle : votre écart moyen est passé de ${tendance.moyPrecedente.toFixed(2)} € à ${tendance.moyRecente.toFixed(2)} € sur les ${tendance.nbJours} derniers jours. Continuez ainsi.`;
    }
    if (serie.record > 0 && serie.enCours > 0 && serie.enCours < serie.record) {
      const reste = serie.record - serie.enCours;
      return `Vous êtes à ${reste} service${reste > 1 ? 's' : ''} sans écart de votre record personnel (${serie.record}).`;
    }
    return 'NEXUS affinera ses observations au fil de vos prochains services — continuez à enregistrer votre activité.';
  }

  // ------------------------------------------------------------
  // 7) Système de reconnaissance (27/07/2026, demande de Frédéric —
  //    "inciter les employés à utiliser NEXUS au maximum", voir
  //    Proposition_evolution_NEXUS_Employe.pdf) : niveaux nommés +
  //    badges de réussite. Même exigence que le reste du moteur — chaque
  //    seuil franchi doit être un vrai fait, jamais une estimation.
  // ------------------------------------------------------------

  // Série de ponctualité (même construction que meilleureSerieConforme,
  // appliquée aux pointages plutôt qu'aux services caisse) — nécessite
  // `date` sur chaque pointage pour être ordonnée chronologiquement.
  function calculerSeriePonctualite(pointagesArriveeEmploye) {
    const chrono = [...(pointagesArriveeEmploye || [])]
      .filter(p => p.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let record = 0, courante = 0, enCours = 0;
    chrono.forEach(p => {
      if ((p.retard_min || 0) === 0) {
        courante += 1;
        if (courante > record) record = courante;
      } else {
        courante = 0;
      }
    });
    for (let i = chrono.length - 1; i >= 0; i--) {
      if ((chrono[i].retard_min || 0) === 0) enCours += 1; else break;
    }
    return { enCours, record, total: chrono.length };
  }

  // "Expérience" NEXUS — un proxy honnête de l'usage réel de l'app :
  // chaque composante ne peut exister que si l'employé est passé par
  // NEXUS (audit caisse renseigné par un manager sur un service travaillé,
  // mission cochée dans l'app, pointage effectué dans l'app). Encourager
  // l'expérience revient donc mécaniquement à encourager l'usage de NEXUS.
  function calculerExperience({ nbServices, nbMissionsCompletees, nbPointages }) {
    return (nbServices || 0) + (nbMissionsCompletees || 0) + (nbPointages || 0);
  }

  // Niveaux nommés (seuils provisoires, 27/07/2026 — à recalibrer avec
  // plusieurs mois de recul, même esprit que les autres seuils de ce
  // fichier). Un niveau élevé n'est jamais atteint si une compétence
  // reste "À corriger" — l'expérience ne remplace jamais la fiabilité,
  // elle s'y ajoute : plafond appliqué dans calculerNiveauNomme.
  const NIVEAUX_NEXUS = [
    { id: 'decouverte', nom: 'Découverte', seuil: 0 },
    { id: 'fiable', nom: 'Employé fiable', seuil: 15 },
    { id: 'confirme', nom: 'Confirmé', seuil: 40 },
    { id: 'reference', nom: 'Référence', seuil: 80 },
    { id: 'expert', nom: 'Expert', seuil: 150 },
    { id: 'ambassadeur', nom: 'Ambassadeur', seuil: 250 },
  ];

  function calculerNiveauNomme(experience, competences) {
    let index = 0;
    for (let i = 0; i < NIVEAUX_NEXUS.length; i++) {
      if (experience >= NIVEAUX_NEXUS[i].seuil) index = i; else break;
    }
    const nbACorriger = Object.values(competences || {}).filter(c => c.statut === 'À corriger').length;
    if (nbACorriger >= 2) index = Math.min(index, 1); // jamais au-delà de "Employé fiable"
    else if (nbACorriger === 1) index = Math.min(index, 3); // jamais au-delà de "Référence"

    const niveau = NIVEAUX_NEXUS[index];
    const suivant = NIVEAUX_NEXUS[index + 1] || null;
    return {
      id: niveau.id, nom: niveau.nom, experience,
      progression: suivant ? { manque: suivant.seuil - experience, seuilSuivant: suivant.seuil, nomSuivant: suivant.nom } : null,
    };
  }

  // Badges de réussite — "obtenu" dès que le record correspondant a été
  // atteint au moins une fois dans l'historique (pas besoin d'être dans
  // la série en ce moment, un badge gagné reste gagné). Paliers
  // progressifs choisis pour donner une première réussite tôt, comme
  // demandé par Frédéric ("inciter à utiliser NEXUS au maximum").
  function calculerBadges({ seriesCaisse, seriePonctualite, nbMissionsCompletees }) {
    const badges = [];
    const ajouter = (id, label, valeurActuelle, seuil) => {
      badges.push({ id, label, obtenu: valeurActuelle >= seuil, valeurActuelle, seuil });
    };
    ajouter('caisse-7', 'Une semaine sans écart de caisse (7 services)', seriesCaisse.record, 7);
    ajouter('caisse-30', 'Un mois sans écart de caisse (30 services)', seriesCaisse.record, 30);
    ajouter('ponctualite-7', '7 jours sans retard', seriePonctualite.record, 7);
    ajouter('ponctualite-30', '30 jours sans retard', seriePonctualite.record, 30);
    ajouter('missions-25', '25 missions réalisées', nbMissionsCompletees || 0, 25);
    ajouter('missions-100', '100 missions réalisées', nbMissionsCompletees || 0, 100);
    return badges;
  }

  // ------------------------------------------------------------
  // 8) "Ce que NEXUS a appris sur moi" (27/07/2026, demande de Frédéric) —
  //    l'écran le plus personnel de l'application. Quatre familles
  //    d'observations, chacune bâtie sur un signal réel et traçable :
  //      - Qualités : compétences déjà "Sous contrôle" (aucune nouveauté
  //        de calcul, juste une reformulation qualitative des 5 statuts).
  //      - Habitudes : régularités factuelles (quart où le service est le
  //        plus propre, moment de la journée où les missions sont
  //        réalisées, oubli récurrent de la photo finale).
  //      - Progrès : évolution réelle dans le temps (écart moyen, niveau
  //        NEXUS nommé il y a SEUIL_JOURS_NIVEAU_PASSE jours vs aujourd'hui).
  //      - Prochain objectif : projection assumée comme une estimation
  //        ("si vous conservez ce rythme"), jamais présentée comme une
  //        certitude, et jamais affichée sans un minimum de recul.
  //    Toute observation sans signal suffisant est omise plutôt
  //    qu'approximée — Article 5.
  // ------------------------------------------------------------

  const SEUIL_MIN_SERVICES_PAR_QUART = 3;
  const SEUIL_DIFF_TAUX_QUART = 0.15; // 15 points de pourcentage
  const SEUIL_MIN_MISSIONS_MOMENT = 5;
  const SEUIL_PART_MOMENT_DOMINANT = 0.7;
  const SEUIL_MIN_MISSIONS_PHOTO = 3;
  const SEUIL_TAUX_OUBLI_PHOTO = 0.2;
  const SEUIL_JOURS_NIVEAU_PASSE = 90;
  const SEUIL_MIN_SERVICES_OBJECTIF = 5;

  function analyserQualites({ statutCaisseVal, statutPonctualiteVal, statutMissionsVal, statutTenueVal, statutRelationClientVal }) {
    const qualites = [];
    if (statutPonctualiteVal.statut === 'Sous contrôle') qualites.push('Toujours ponctuel.');
    if (statutCaisseVal.statut === 'Sous contrôle') qualites.push('Très peu d\'écarts de caisse.');
    if (statutRelationClientVal.statut === 'Sous contrôle') qualites.push('Excellent relationnel client.');
    if (statutTenueVal.statut === 'Sous contrôle') qualites.push('Tenue et procédures toujours conformes.');
    if (statutMissionsVal.statut === 'Sous contrôle') qualites.push('Missions réalisées avec rigueur.');
    return qualites;
  }

  // Quart (piste/boutique) où les services sont le plus souvent propres —
  // purement descriptif, jamais une supposition sur "pourquoi" (Article 5).
  function habitudeMeilleurQuart(services) {
    const parQuart = {};
    (services || []).forEach(s => {
      if (!s.quart) return;
      if (!parQuart[s.quart]) parQuart[s.quart] = { total: 0, propres: 0 };
      parQuart[s.quart].total += 1;
      if (serviceEstPropre(s)) parQuart[s.quart].propres += 1;
    });
    const quarts = Object.keys(parQuart).filter(q => parQuart[q].total >= SEUIL_MIN_SERVICES_PAR_QUART);
    if (quarts.length < 2) return null;
    quarts.forEach(q => { parQuart[q].taux = parQuart[q].propres / parQuart[q].total; });
    quarts.sort((a, b) => parQuart[b].taux - parQuart[a].taux);
    const diff = parQuart[quarts[0]].taux - parQuart[quarts[1]].taux;
    if (diff < SEUIL_DIFF_TAUX_QUART) return null;
    return { quart: quarts[0], tauxMeilleur: parQuart[quarts[0]].taux, tauxAutre: parQuart[quarts[1]].taux };
  }

  // Moment de la journée où les missions sont le plus souvent réalisées —
  // basé sur mission_completions.heure (heure réelle d'enregistrement).
  function habitudeMomentMissions(completionsEmploye) {
    const buckets = { matin: 0, 'après-midi': 0, soir: 0 };
    let total = 0;
    (completionsEmploye || []).forEach(c => {
      if (!c.heure) return;
      const h = parseInt(String(c.heure).slice(0, 2), 10);
      if (Number.isNaN(h)) return;
      total += 1;
      if (h < 12) buckets.matin += 1;
      else if (h < 18) buckets['après-midi'] += 1;
      else buckets.soir += 1;
    });
    if (total < SEUIL_MIN_MISSIONS_MOMENT) return null;
    const moments = Object.keys(buckets).sort((a, b) => buckets[b] - buckets[a]);
    const dominant = moments[0];
    const part = buckets[dominant] / total;
    return part >= SEUIL_PART_MOMENT_DOMINANT ? { moment: dominant, part, total } : null;
  }

  // Oubli de la photo finale — uniquement parmi les missions dont le
  // catalogue exige réellement une preuve photo (proof_required), pour ne
  // jamais reprocher une photo qui n'était pas demandée.
  function habitudePhotoOubliee(completionsEmploye, catalogueParId) {
    const concernees = (completionsEmploye || []).filter(c => catalogueParId && catalogueParId[c.mission_id] && catalogueParId[c.mission_id].proof_required);
    if (concernees.length < SEUIL_MIN_MISSIONS_PHOTO) return null;
    const oublis = concernees.filter(c => !c.photo_fournie).length;
    const taux = oublis / concernees.length;
    return taux >= SEUIL_TAUX_OUBLI_PHOTO ? { taux, total: concernees.length, oublis } : null;
  }

  // Combine les trois signaux d'habitude ci-dessus en phrases prêtes à
  // afficher — jamais plus de 3, jamais une habitude sans signal réel.
  function analyserHabitudes({ services, completionsEmploye, catalogueParId }) {
    const habitudes = [];
    const quart = habitudeMeilleurQuart(services);
    if (quart) {
      habitudes.push(`Vous êtes plus performant en caisse ${quart.quart === 'quart1' ? 'le matin' : "l'après-midi"}.`);
    }
    const moment = habitudeMomentMissions(completionsEmploye);
    if (moment) {
      const libelle = moment.moment === 'matin' ? 'le matin' : moment.moment === 'soir' ? 'le soir' : "l'après-midi";
      habitudes.push(`Vous réalisez la plupart de vos missions ${libelle}.`);
    }
    const photo = habitudePhotoOubliee(completionsEmploye, catalogueParId);
    if (photo) {
      habitudes.push('Vous oubliez parfois la photo finale de vos missions — pensez à la joindre avant de valider.');
    }
    return habitudes.slice(0, 3);
  }

  // Progrès réels dans le temps : écart moyen (fenêtre glissante déjà
  // fiabilisée par tendanceEcartMoyen) et changement de niveau nommé entre
  // aujourd'hui et il y a SEUIL_JOURS_NIVEAU_PASSE jours.
  function analyserProgres({ ecartsAttribuablesVal, niveauActuel, niveauPasse }) {
    const progres = [];
    const tendance = tendanceEcartMoyen(ecartsAttribuablesVal, 30);
    if (tendance && tendance.ameliore && tendance.moyPrecedente > 0) {
      const pct = Math.round((1 - tendance.moyRecente / tendance.moyPrecedente) * 100);
      if (pct > 0) progres.push(`Les écarts de caisse ont diminué de ${pct} % sur les 30 derniers jours.`);
    }
    if (niveauPasse && niveauActuel && niveauPasse.id !== niveauActuel.id) {
      progres.push(`Votre niveau est passé de « ${niveauPasse.nom} » à « ${niveauActuel.nom} ».`);
    }
    return progres;
  }

  // Recalcule le niveau NEXUS "nommé" tel qu'il aurait été il y a
  // `joursAvant` jours, en ne gardant que les lignes antérieures à cette
  // date — permet de dire honnêtement "vous étiez à tel niveau" sans avoir
  // besoin d'un historique stocké séparément.
  function calculerNiveauADate({ auditsRows, pointagesRows, assignationsRows, controlesRows, evaluationsRows, completionsRows, employeeId, joursAvant }) {
    const jours = joursAvant || SEUIL_JOURS_NIVEAU_PASSE;
    const dateLimite = new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);
    const auditsF = (auditsRows || []).filter(a => a.date <= dateLimite);
    const pointagesF = (pointagesRows || []).filter(p => p.date <= dateLimite);
    const controlesF = (controlesRows || []).filter(c => c.date <= dateLimite);
    const evaluationsF = (evaluationsRows || []).filter(e => e.date <= dateLimite);
    const completionsF = (completionsRows || []).filter(m => m.date <= dateLimite);
    const assignationsF = (assignationsRows || []).filter(a => ((a.updated_at || a.due_at || '').slice(0, 10)) <= dateLimite);

    const services = construireServicesCaisse(auditsF, employeeId);
    const statutCaisseVal = statutCaisse(services);
    const statutPonctualiteVal = statutPonctualite(pointagesF);
    const statutMissionsVal = statutMissions(assignationsF);
    const statutTenueVal = statutTenue(controlesF);
    const statutRelationClientVal = statutRelationClient(evaluationsF);
    const experience = calculerExperience({ nbServices: services.length, nbMissionsCompletees: completionsF.length, nbPointages: pointagesF.length });
    return calculerNiveauNomme(experience, {
      caisse: statutCaisseVal, ponctualite: statutPonctualiteVal,
      missions: statutMissionsVal, tenue: statutTenueVal, relation: statutRelationClientVal,
    });
  }

  // Prochain objectif — projection assumée, jamais une promesse. Le rythme
  // est estimé sur l'ensemble de l'historique connu (expérience / nombre
  // de services), jamais affiché sans au moins SEUIL_MIN_SERVICES_OBJECTIF
  // services pour rester honnête sur la fiabilité de l'estimation.
  function projeterProchainObjectif(niveau, nbServices) {
    if (!niveau.progression) {
      return { texte: 'Niveau maximum atteint — vous incarnez la référence NEXUS.', atteint: true };
    }
    if (!nbServices || nbServices < SEUIL_MIN_SERVICES_OBJECTIF) {
      return { texte: 'Continuez à utiliser NEXUS pour que je puisse identifier votre rythme de progression.', atteint: false };
    }
    const expParService = niveau.experience / nbServices;
    if (expParService <= 0) {
      return { texte: `Encore ${niveau.progression.manque} point(s) d'expérience avant « ${niveau.progression.nomSuivant} ».`, atteint: false };
    }
    const servicesRestants = Math.max(1, Math.ceil(niveau.progression.manque / expParService));
    return {
      texte: `Si vous conservez ce rythme, encore environ ${servicesRestants} service${servicesRestants > 1 ? 's' : ''} avant de devenir « ${niveau.progression.nomSuivant} ».`,
      atteint: false,
    };
  }

  // ------------------------------------------------------------
  // 9) "Nouveau constat" (27/07/2026, demande de Frédéric) — une petite
  //    notification qui apparaît quand le Coach a réellement appris
  //    quelque chose de neuf depuis la dernière fois : nouvelle qualité,
  //    nouvelle habitude, niveau franchi, badge obtenu. Toujours la
  //    personne comparée à elle-même dans le temps — jamais un
  //    classement ni un pourcentile entre collègues (décision explicite
  //    de Frédéric, 27/07/2026, non négociable).
  //    `snapshot` : dernière ligne connue de apprentissage_snapshots
  //    (ou null si l'employé n'a encore jamais été analysé — dans ce cas,
  //    on enregistre juste une base de référence, sans notifier : il n'y
  //    a rien à comparer).
  // ------------------------------------------------------------
  function detecterNouveaute({ qualitesActuelles, habitudesActuelles, niveauActuel, badgesActuels, snapshot }) {
    const premierPassage = !snapshot;
    const qualitesVues = (snapshot && snapshot.qualites) || [];
    const habitudesVues = (snapshot && snapshot.habitudes) || [];
    const niveauVu = (snapshot && snapshot.niveau_id) || null;
    const badgesVus = (snapshot && snapshot.badges_obtenus) || [];
    const badgesObtenusIds = (badgesActuels || []).filter(b => b.obtenu).map(b => b.id);

    const nouveauNiveau = !premierPassage && niveauVu && niveauActuel.id !== niveauVu;
    const nouveauBadgeId = !premierPassage ? badgesObtenusIds.find(id => !badgesVus.includes(id)) : null;
    const nouvelleQualite = !premierPassage ? (qualitesActuelles || []).find(q => !qualitesVues.includes(q)) : null;
    const nouvelleHabitude = !premierPassage ? (habitudesActuelles || []).find(h => !habitudesVues.includes(h)) : null;

    let detail = null;
    if (nouveauNiveau) {
      detail = `Votre niveau vient de passer à « ${niveauActuel.nom} ».`;
    } else if (nouveauBadgeId) {
      const badge = (badgesActuels || []).find(b => b.id === nouveauBadgeId);
      detail = `Vous venez d'obtenir un nouveau badge : ${badge ? badge.label : nouveauBadgeId}.`;
    } else if (nouvelleQualite) {
      detail = "J'ai identifié une nouvelle qualité chez vous.";
    } else if (nouvelleHabitude) {
      detail = "J'ai détecté une nouvelle habitude chez vous.";
    }

    return {
      nouveau: !premierPassage && !!detail,
      detail,
      // Instantané à enregistrer dans apprentissage_snapshots, que la
      // détection ait trouvé une nouveauté ou non — sert de référence pour
      // la prochaine comparaison.
      instantane: {
        qualites: qualitesActuelles || [],
        habitudes: habitudesActuelles || [],
        niveau_id: niveauActuel.id,
        badges_obtenus: badgesObtenusIds,
      },
    };
  }

  // ------------------------------------------------------------
  // 10) "Mes Caisses" (03/08/2026, demande de Frédéric) — donner à chaque
  //    employé la visibilité sur ses écarts de caisse jour par jour ET
  //    cumulés au mois, en distinguant strictement trois statuts :
  //      - 'provisoire'       : contrôle enregistré par un manager dans
  //        Verify mais pas encore validé (audits_caisse.valide_le est null).
  //      - 'validee_conforme' : validé, écart(s) attribuable(s) dans le
  //        seuil de conformité.
  //      - 'validee_ecart'    : validé, au moins un écart attribuable hors
  //        seuil.
  //    Règle non négociable (rappelée par Frédéric) : un écart provisoire
  //    et un écart validé ne doivent JAMAIS être additionnés dans le même
  //    total. Toutes les fonctions ci-dessous respectent cette séparation
  //    en gardant deux cumuls distincts (ecartProvisoireCumule /
  //    ecartValideCumule) plutôt qu'un seul total mélangé.
  //
  //    Même règle d'attribution que la section 1 : un écart (provisoire ou
  //    validé) n'est imputé à l'employé que s'il était seul sur le poste ce
  //    quart-là. Un poste partagé, même validé, ne peut jamais devenir
  //    "validée avec écart" pour un individu précis.
  // ------------------------------------------------------------

  // Statut d'un service caisse (objet retourné par construireServicesCaisse)
  // pour la vue employé "Mes Caisses". Distinct de statutCaisse() (section 2)
  // qui reste la synthèse "compétence" utilisée par Niveau NEXUS — jamais
  // fusionnées, ce sont deux questions différentes ("suis-je fiable en
  // général ?" vs "où en est CE contrôle précis ?").
  // v2.286 — délègue à statutActivite (définie section 11, hissée
  // conceptuellement ici : les déclarations de fonction sont hissées en JS,
  // aucun souci d'ordre d'exécution) poste par poste, plutôt que de relire
  // ecartPisteValide/ecartBoutiqueValide contre un seuil local — Article 11,
  // une seule mécanique de classification pour tout le fichier.
  function statutCaisseJour(service) {
    if (!service) return null;
    if (!service.valideLe) return 'provisoire';
    const statutPiste = service.soloPiste ? statutActivite(service, 'piste') : null;
    const statutBoutique = service.soloBoutique ? statutActivite(service, 'boutique') : null;
    const enEcart = statutPiste === 'validee_ecart' || statutBoutique === 'validee_ecart';
    return enEcart ? 'validee_ecart' : 'validee_conforme';
  }

  const LIBELLE_STATUT_CAISSE_JOUR = {
    provisoire: 'En cours de contrôle',
    validee_conforme: 'Validée conforme',
    validee_ecart: 'Validée avec écart',
  };

  // Mention de protection — à afficher sous le total mensuel, dans une
  // infobulle près du statut, et avant l'ouverture du détail des écarts
  // (demande explicite de Frédéric, 03/08/2026).
  const MENTION_PROTECTION_LONGUE = 'Les montants affichés avant validation sont provisoires : ils correspondent au contrôle enregistré au moment de la clôture de caisse, avant toute vérification manager. Seuls les écarts validés par un manager sont définitifs et peuvent entrer dans vos statistiques. Un écart provisoire peut être corrigé, expliqué ou annulé lors de la validation — il ne doit jamais être interprété comme une faute avant cette étape.';
  const MENTION_PROTECTION_COURTE = 'Résultats provisoires jusqu\'à validation complète de la caisse. Seuls les écarts validés sont définitifs.';

  // Agrège les services d'un employé sur un mois donné (moisRef au format
  // 'YYYY-MM'). Les deux cumuls (provisoire / validé) restent toujours
  // séparés — voir note de section ci-dessus.
  //
  // Correction du 03/08/2026 (signalée par Frédéric — "pourquoi Angélique
  // ne voit pas son écart réel, elle voit 0 alors que son écart d'hier est
  // de -0,20 €") : les cumuls ne sommaient QUE les écarts dépassant le
  // seuil de conformité (2 €, SEUIL_ECART_CONFORME), donc un petit écart
  // réel (-0,20 €, -0,02 €...) disparaissait purement et simplement du
  // total au lieu d'y apparaître — NEXUS affichait alors "+0,00 €" alors
  // qu'un montant réel, non nul, existait. Le seuil de conformité sert à
  // qualifier un service ("conforme" vs "écart", pour les compteurs
  // caissesConformes/caissesEcartValide et le badge affiché), jamais à
  // effacer un montant réel d'un total — les deux questions sont
  // distinctes ("ce service mérite-t-il attention ?" vs "combien d'argent
  // exactement ?"). Les cumuls somment donc désormais TOUS les montants
  // attribuables (postes solo), petits ou grands, conformes ou non.
  function agregerMoisCaisse(services, moisRef) {
    const duMois = (services || []).filter(s => s.date && s.date.slice(0, 7) === moisRef);
    let caissesConformes = 0, caissesEnCours = 0, caissesEcartValide = 0;
    let ecartProvisoireCumule = 0, ecartValideCumule = 0;
    duMois.forEach(s => {
      const statut = statutCaisseJour(s);
      if (statut === 'provisoire') {
        caissesEnCours += 1;
        // Cumul provisoire : tous les montants attribuables (poste solo),
        // calculés sur les colonnes brutes — jamais les colonnes _valide,
        // qui n'existent pas encore tant que non validé.
        if (s.soloPiste) ecartProvisoireCumule += s.ecartPiste;
        if (s.soloBoutique) ecartProvisoireCumule += s.ecartBoutique;
      } else if (statut === 'validee_conforme') {
        caissesConformes += 1;
        if (s.soloPiste && s.ecartPisteValide != null) ecartValideCumule += s.ecartPisteValide;
        if (s.soloBoutique && s.ecartBoutiqueValide != null) ecartValideCumule += s.ecartBoutiqueValide;
      } else if (statut === 'validee_ecart') {
        caissesEcartValide += 1;
        if (s.soloPiste && s.ecartPisteValide != null) ecartValideCumule += s.ecartPisteValide;
        if (s.soloBoutique && s.ecartBoutiqueValide != null) ecartValideCumule += s.ecartBoutiqueValide;
      }
    });
    return {
      moisRef,
      caissesControlees: duMois.length,
      caissesConformes, caissesEnCours, caissesEcartValide,
      ecartProvisoireCumule, ecartValideCumule,
    };
  }

  function moisPrecedent(moisRef) {
    const [an, mois] = moisRef.split('-').map(Number);
    const d = new Date(an, mois - 2, 1); // mois-2 (index 0) = mois précédent
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // Tendance vs mois précédent — comparée uniquement sur les écarts
  // VALIDÉS (les seuls définitifs). Retourne null si le mois précédent n'a
  // aucune caisse contrôlée : jamais de "amélioration" calculée contre zéro.
  function tendanceMoisCaisse(agregatActuel, agregatPrecedent) {
    if (!agregatPrecedent || agregatPrecedent.caissesControlees === 0) return null;
    const actuel = Math.abs(agregatActuel.ecartValideCumule);
    const precedent = Math.abs(agregatPrecedent.ecartValideCumule);
    if (precedent === 0 && actuel === 0) return { evolution: 'stable', actuel, precedent };
    if (precedent === 0) return { evolution: 'degrade', actuel, precedent };
    const variation = (actuel - precedent) / precedent;
    const evolution = variation < -0.01 ? 'ameliore' : (variation > 0.01 ? 'degrade' : 'stable');
    return { evolution, variation, actuel, precedent };
  }

  // Jours consécutifs (calendaires, parmi les jours où l'employé a un
  // contrôle enregistré) sans écart VALIDÉ — un jour "provisoire" ou
  // "validé conforme" compte comme "sans écart validé" ; un jour avec au
  // moins un contrôle "validée avec écart" interrompt la série. Limite
  // assumée : ne compte que les jours où NEXUS a un contrôle enregistré,
  // jamais les jours non travaillés (aucune donnée à ce sujet).
  function joursConsecutifsSansEcartValide(services) {
    const parJour = {};
    (services || []).forEach(s => {
      if (!s.date) return;
      if (!(s.date in parJour)) parJour[s.date] = false;
      if (statutCaisseJour(s) === 'validee_ecart') parJour[s.date] = true;
    });
    const jours = Object.keys(parJour).sort();
    let enCours = 0;
    for (let i = jours.length - 1; i >= 0; i--) {
      if (parJour[jours[i]]) break;
      enCours += 1;
    }
    return enCours;
  }

  // Série de contrôles VALIDÉS CONFORMES consécutifs — ignore les contrôles
  // encore provisoires (ni comptés, ni interrupteurs de série : on ne sait
  // pas encore ce qu'ils deviendront), s'appuie uniquement sur les
  // contrôles déjà tranchés par un manager, dans l'ordre chronologique.
  function serieValideeConforme(services) {
    const resolus = (services || [])
      .filter(s => statutCaisseJour(s) !== 'provisoire')
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let record = 0, courante = 0, enCours = 0;
    resolus.forEach(s => {
      if (statutCaisseJour(s) === 'validee_conforme') { courante += 1; if (courante > record) record = courante; }
      else { courante = 0; }
    });
    for (let i = resolus.length - 1; i >= 0; i--) {
      if (statutCaisseJour(resolus[i]) === 'validee_conforme') enCours += 1; else break;
    }
    return { enCours, record, total: resolus.length };
  }

  // Système de "point de fiabilité" (03/08/2026, demande explicite de
  // Frédéric — VOLONTAIREMENT pas automatique dès qu'une caisse est
  // conforme, pour ne jamais récompenser la simple déclaration plutôt que
  // la sincérité). Un point n'est accordé que si :
  //   1. la caisse est définitivement validée conforme (jamais provisoire) ;
  //   2. l'inventaire obligatoire du même site/date/quart est bien clôturé
  //      (vérifiable via inventaire_quarts.statut === 'cloture').
  // Limite assumée et documentée plutôt que cachée : le modèle de données
  // actuel ne permet pas de vérifier "aucune correction tardive nécessaire"
  // (audits_caisse n'a pas de colonne updated_at distincte de created_at,
  // ni de liste explicite de justificatifs fournis). Cette condition n'est
  // donc PAS appliquée ici — on ne fabrique jamais une vérification qu'on ne
  // fait pas réellement (Article 5). À ajouter dès que ces données existent.
  function pointFiabiliteEligible(service, inventaireCloture) {
    if (statutCaisseJour(service) !== 'validee_conforme') {
      return { eligible: false, raison: 'Caisse non validée conforme.' };
    }
    if (inventaireCloture !== true) {
      return { eligible: false, raison: 'Inventaire du quart non confirmé clôturé.' };
    }
    return { eligible: true, raison: null };
  }

  // Bonus "+3 points de régularité" pour 5 contrôles validés conformes
  // consécutifs — s'appuie sur serieValideeConforme, jamais un second calcul
  // de série divergent.
  function bonusRegulariteCaisse(serieValideeConformeVal) {
    const paliers = Math.floor((serieValideeConformeVal ? serieValideeConformeVal.enCours : 0) / 5);
    return { paliersAtteints: paliers, points: paliers * 3 };
  }

  // Ce qui peut expliquer un écart (03/08/2026) — toujours présentées comme
  // des hypothèses à vérifier, jamais des constats ni des accusations. Le
  // Coach ne choisit jamais UNE cause : il propose la liste, à l'employé et
  // au manager de recouper avec le contexte réel du quart.
  const CAUSES_POSSIBLES_CAISSE = [
    'Rendu de monnaie imprécis lors d\'un pic d\'affluence.',
    'Un règlement en espèces oublié au moment de l\'enregistrer.',
    'Une erreur de saisie du montant à la caisse.',
    'Une vente non scannée ou non enregistrée.',
    'Une erreur de comptage lors du dépôt (billets ou pièces).',
    'Un chèque ou une carte carburant non comptabilisé.',
    'Une dépense ponctuelle non déclarée au moment du contrôle.',
    'Un litrage carburant renseigné de façon approximative.',
    'Une remise cuve non reportée correctement.',
    'Un poste partagé entre plusieurs personnes, rendant l\'origine incertaine.',
    'Un incident technique (terminal de paiement, pompe, logiciel de caisse).',
  ];

  // Messages Coach pour "Mes Caisses" — cinq scénarios distincts, toujours
  // dans le langage NEXUS établi (jamais accusatoire, distingue fait /
  // hypothèse / recommandation, jamais de comparaison entre collègues).
  // contexte : { statut, montantEcart, serieValideeConformeVal, ameliorationDetectee }
  function messageCoachCaisseJour({ statut, montantEcart, serieValideeConformeVal, ameliorationDetectee }) {
    const enCours = serieValideeConformeVal ? serieValideeConformeVal.enCours : 0;
    if (statut === 'provisoire') {
      if (montantEcart != null && !estConforme(montantEcart)) {
        return `Un petit écart de ${Math.abs(montantEcart).toFixed(2)} € a été relevé sur ce contrôle. Il reste provisoire tant qu'un manager ne l'a pas validé — rien à faire de votre côté pour l'instant.`;
      }
      return 'Ce contrôle de caisse est en cours de validation par un manager. Il apparaîtra dans votre historique définitif une fois validé.';
    }
    if (statut === 'validee_conforme') {
      if (enCours >= 5) {
        return `Caisse validée conforme — cela fait ${enCours} contrôles validés conformes d'affilée. Belle régularité.`;
      }
      if (enCours >= 2) {
        return `Plusieurs caisses validées conformes de suite (${enCours}). Continuez ainsi.`;
      }
      return 'Caisse validée conforme par votre manager.';
    }
    // validee_ecart
    const base = montantEcart != null
      ? `Un écart de ${Math.abs(montantEcart).toFixed(2)} € a été validé par votre manager sur ce contrôle.`
      : 'Un écart a été validé par votre manager sur ce contrôle.';
    if (ameliorationDetectee) {
      return `${base} Les données indiquent aussi une amélioration par rapport à vos précédents écarts — continuez sur cette voie.`;
    }
    return `${base} Les données n'indiquent pas encore la cause précise — les causes possibles ci-dessous restent des hypothèses à vérifier, jamais des certitudes.`;
  }

  // ------------------------------------------------------------
  // 11) "Ma Progression" multi-activité (16/08/2026, demande de Frédéric —
  //    voir sa spécification complète : intégrer Boutique / Piste / FDJ
  //    dans une seule page, lisible "en 2 secondes", sans jamais mélanger
  //    deux activités dans une même ligne ni dans un même statut).
  //
  //    Construit une lecture PAR ACTIVITÉ à partir des mêmes données
  //    brutes que la section 10 — jamais un second calcul divergent des
  //    montants ou seuils déjà définis plus haut (SEUIL_ECART_CONFORME,
  //    estConforme). Ne modifie ni ne remplace statutCaisseJour /
  //    agregerMoisCaisse (section 10) : ces fonctions restent la référence
  //    de tout autre écran qui les consomme déjà (aucune régression).
  // ------------------------------------------------------------

  // Statut d'UNE activité (piste OU boutique) d'un service Verify —
  // distinct de statutCaisseJour (section 10) qui combine les deux postes
  // en un seul statut. Ici, chaque activité a son propre statut,
  // indépendant de l'autre poste éventuellement tenu le même quart : un
  // écart sur la piste ne doit jamais colorer la ligne "boutique" du même
  // quart, et inversement (nécessaire pour la demande explicite de
  // Frédéric : "une ligne d'historique = une activité = un statut = un
  // montant").
  // ------------------------------------------------------------
  // PONT VERS LE MOTEUR CENTRAL DES ÉCARTS — v2.286 (29/08/2026, demande de
  // Frédéric après le P0 v2.285 : "les employés et le manager doivent voir
  // le même événement, pas deux calculs indépendants"). Vérifié avant ce lot
  // (Article 5) : statutActivite comparait le montant validé à un seuil FIXE
  // de 2€ (SEUIL_ECART_CONFORME) pour décider "conforme"/"écart", sans
  // jamais regarder si un manager avait réellement corrigé l'écart à zéro ou
  // seulement expliqué sa cause — une divergence réelle avec
  // nexus-ecarts-moteur.js (deriverStatutEcart, déjà utilisé par "Analyse
  // des écarts" manager via nexus-ecarts-donnees.js), qui ne régularise
  // JAMAIS un écart par simple tolérance en euros : seul un montant corrigé
  // à zéro pile compte comme réglé. C'est aussi la règle déjà en vigueur
  // côté Verify depuis le v2.267 (motifEcartObligatoire : un motif est exigé
  // dès qu'un écart non nul existe, quel que soit son montant) — l'ancien
  // seuil de 2€ ici était simplement resté figé à l'état d'avant cette
  // règle. Résultat concret avant correction : un écart de -1,50 € clôturé
  // par le manager (donc bien réel et éventuellement retenu contre le solde
  // opérationnel) pouvait s'afficher "Validée conforme" côté employé — exact
  // scénario que Frédéric voulait éliminer.
  //
  // SEUIL_ECART_CONFORME reste utilisé AILLEURS dans ce fichier (sections
  // 1-9 : compétence "Caisse" du Niveau NEXUS, coaching, points forts,
  // tendances) — un périmètre de coaching motivationnel volontairement
  // distinct de la question posée ici ("que retient officiellement le
  // manager sur CE contrôle validé ?"). Les deux questions restent
  // séparées, comme le rappelait déjà le commentaire historique de
  // statutCaisseJour ("suis-je fiable en général ?" vs "où en est CE
  // contrôle précis ?") — ce lot ne change QUE la seconde.
  //
  // Repli défensif si nexus-ecarts-moteur.js n'est pas chargé (ne devrait
  // jamais arriver en production — voir l'en-tête du fichier — mais jamais
  // un écran cassé pour un oubli d'ordre de <script>, Article 5) : on
  // retombe sur l'ancien comportement par seuil, identique à avant v2.286.
  function statutEcartActiviteVerify(ecartInitial, ecartFinal, causeCode) {
    const M = global.NexusEcartsMoteur;
    if (!M) return (ecartFinal == null || estConforme(ecartFinal)) ? 'validee_conforme' : 'validee_ecart';
    const causeConnue = !!causeCode && causeCode !== 'non_explique';
    const statutMoteur = M.deriverStatutEcart({ ecartInitial, ecartFinal, cloture: true, causeConnue });
    if (statutMoteur === null || statutMoteur === M.STATUTS_ECART.REGULARISE) return 'validee_conforme';
    return 'validee_ecart'; // cloture_explique OU cloture_non_explique : un écart retenu, expliqué ou non.
  }

  function statutActivite(service, activite) {
    if (!service) return null;
    if (!service.valideLe) return 'provisoire';
    const solo = activite === 'piste' ? service.soloPiste : service.soloBoutique;
    if (!solo) return 'validee_conforme';
    const ecartInitial = activite === 'piste' ? service.ecartPisteOrigine : service.ecartBoutiqueOrigine;
    const ecartFinal = activite === 'piste' ? service.ecartPisteValide : service.ecartBoutiqueValide;
    const causeCode = activite === 'piste' ? service.causeCodePiste : service.causeCodeBoutique;
    return statutEcartActiviteVerify(ecartInitial, ecartFinal, causeCode);
  }

  // Une ligne d'historique pour UNE activité tenue (piste et/ou boutique) —
  // null si l'employé n'a pas tenu ce poste ce quart-là. Un même service
  // Verify où l'employé a tenu piste ET boutique produit donc deux lignes
  // indépendantes. Le montant n'est affiché que pour un poste tenu SEUL
  // (règle d'attribution, section 1) ; un poste partagé reste visible
  // (transparence : "j'ai bien tenu ce poste ce jour-là") mais sans chiffre
  // individuel imputable.
  function ligneActiviteCaisse(service, activite) {
    const sur = activite === 'piste' ? service.surPiste : service.surBoutique;
    if (!sur) return null;
    const solo = activite === 'piste' ? service.soloPiste : service.soloBoutique;
    const statut = statutActivite(service, activite);
    let montant = null;
    if (solo) {
      montant = statut === 'provisoire'
        ? (activite === 'piste' ? service.ecartPiste : service.ecartBoutique)
        : (activite === 'piste' ? service.ecartPisteValide : service.ecartBoutiqueValide);
    }
    return { activite, date: service.date, quart: service.quart, statut, montant, attribuable: solo, source: service };
  }

  // FDJ — reconstruction des services caisse par employé. rowsShiftsFdj :
  // lignes fdj_shifts déjà filtrées site + employé, chargées avec
  // select('*, fdj_cash_controls(*)') — même forme que
  // NEXUS-FDJ-Manager-v1.html::chargerShiftsAvecCaisse (PostgREST renvoie
  // l'objet imbriqué comme OBJET, pas tableau, tant que la contrainte
  // unique shift_id existe — voir le commentaire historique de cette
  // fonction — mais on gère les deux formes par robustesse). Un quart sans
  // caisse enregistrée n'a rien à montrer ici : rien n'a encore été
  // transmis. Aucune règle d'attribution "solo" nécessaire côté FDJ :
  // chaque ligne fdj_cash_controls est déjà rattachée à un employee_id
  // unique (fdj_shifts.employee_id) — pas de poste partagé possible,
  // contrairement à Verify (section 1).
  function construireServicesCaisseFdj(rowsShiftsFdj) {
    const services = [];
    (rowsShiftsFdj || []).forEach(s => {
      const c = Array.isArray(s.fdj_cash_controls) ? (s.fdj_cash_controls[0] || null) : (s.fdj_cash_controls || null);
      // 20/08/2026, cahier "FDJ - Audit de consolidation", FDJ-26 : "Coach
      // et Ma progression n'utilisent jamais un brouillon ou un écart
      // provisoire." Avant ce jour, un quart encore 'brouillon' n'avait
      // jamais de ligne fdj_cash_controls (elle n'était écrite qu'à la
      // validation finale) — `if (!c) return` suffisait donc à exclure les
      // brouillons, par construction. Depuis que "Laisser en brouillon"
      // (NEXUS-FDJ-v1.html) peut enregistrer un vrai rapprochement de
      // caisse sans transmettre le quart, ce filtre ne suffit plus : un
      // brouillon peut désormais avoir `c` non nul, avec le même statut
      // 'provisoire' qu'une caisse réellement transmise et en attente de
      // contrôle manager. Seul `s.statut === 'valide'` distingue encore les
      // deux cas (déjà chargé, déjà utilisé plus bas pour `quartValide` —
      // Article 11, on ne duplique pas un second signal).
      if (!c || s.statut !== 'valide') return;
      services.push({
        id: s.id, date: s.date, quart: s.quart,
        quartValide: s.statut === 'valide',
        statutCash: c.statut || null,
        caisseAttendue: c.caisse_attendue != null ? Number(c.caisse_attendue) : null,
        caisseReelle: c.caisse_reelle != null ? Number(c.caisse_reelle) : null,
        caisseReelleOrigine: c.caisse_reelle_origine != null ? Number(c.caisse_reelle_origine) : null,
        ecart: c.ecart != null ? Number(c.ecart) : null,
        ecartOrigine: c.ecart_origine != null ? Number(c.ecart_origine) : null,
        motifEcart: c.motif_ecart || null,
        valideLe: c.valide_le || null,
      });
    });
    services.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
    return services;
  }

  // Statut FDJ ramené au même vocabulaire à 3 niveaux que Verify
  // (provisoire / validee_conforme / validee_ecart) — FDJ n'a pas de seuil
  // numérique automatique comme Verify (SEUIL_ECART_CONFORME) : c'est le
  // manager qui choisit un statut qualitatif parmi 7 valeurs (STATUTS_CAISSE
  // de NEXUS-FDJ-Manager-v1.html). On les range ici dans le même
  // vocabulaire à 3 niveaux pour qu'une seule grammaire de statuts soit
  // lisible dans toute la page "Ma Progression", quelle que soit
  // l'activité : 'provisoire'/absent -> provisoire ; 'conforme' ->
  // validee_conforme ; tout autre statut posé par le manager (à
  // contrôler / en attente / expliquée / régularisé / validé avec écart)
  // -> validee_ecart.
  function statutCaisseJourFdj(service) {
    if (!service) return null;
    const s = service.statutCash;
    if (!s || s === 'provisoire') return 'provisoire';
    if (s === 'conforme') return 'validee_conforme';
    return 'validee_ecart';
  }

  function ligneActiviteFdj(service) {
    const statut = statutCaisseJourFdj(service);
    const montant = statut === 'provisoire' ? service.ecartOrigine : service.ecart;
    return { activite: 'fdj', date: service.date, quart: service.quart, statut, montant, attribuable: true, source: service };
  }

  // Historique unifié — une ligne par activité réellement tenue, jamais
  // deux activités mélangées dans une même ligne. Trié du plus récent au
  // plus ancien.
  function construireHistoriqueUnifie(servicesCaisse, servicesFdj) {
    const lignes = [];
    (servicesCaisse || []).forEach(s => {
      const lp = ligneActiviteCaisse(s, 'piste'); if (lp) lignes.push(lp);
      const lb = ligneActiviteCaisse(s, 'boutique'); if (lb) lignes.push(lb);
    });
    (servicesFdj || []).forEach(s => lignes.push(ligneActiviteFdj(s)));
    lignes.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const qa = String(a.quart), qb = String(b.quart);
      return qa < qb ? 1 : (qa > qb ? -1 : 0);
    });
    return lignes;
  }

  // Synthèse d'une activité pour un mois donné — alimente les mini-cartes
  // Boutique / Piste / FDJ du Niveau 1. Même règle non négociable que
  // partout ailleurs dans NEXUS : seuls les montants NON provisoires
  // entrent dans le cumul affiché.
  function syntheseActivite(lignesActivite, moisRef) {
    const duMois = (lignesActivite || []).filter(l => l.date && l.date.slice(0, 7) === moisRef);
    let conformes = 0, aRegulariser = 0, cumulValide = 0;
    duMois.forEach(l => {
      if (l.statut === 'validee_conforme') conformes += 1;
      else if (l.statut === 'validee_ecart') aRegulariser += 1;
      if (l.statut !== 'provisoire' && l.attribuable && l.montant != null) cumulValide += l.montant;
    });
    return { nbControles: duMois.length, conformes, aRegulariser, cumulValide };
  }

  // Synthèse combinée toutes activités confondues, sur le mois — forme de
  // sortie volontairement identique à agregerMoisCaisse (mêmes noms de
  // champs) pour pouvoir réutiliser tendanceMoisCaisse/moisPrecedent tels
  // quels (Article 11 — jamais un second calcul de tendance divergent).
  function syntheseCombinee(lignesUnifiees, moisRef) {
    const duMois = (lignesUnifiees || []).filter(l => l.date && l.date.slice(0, 7) === moisRef);
    let caissesConformes = 0, caissesEcartValide = 0, ecartValideCumule = 0;
    duMois.forEach(l => {
      if (l.statut === 'validee_conforme') caissesConformes += 1;
      else if (l.statut === 'validee_ecart') caissesEcartValide += 1;
      if (l.statut !== 'provisoire' && l.attribuable && l.montant != null) ecartValideCumule += l.montant;
    });
    return { moisRef, caissesControlees: duMois.length, caissesConformes, caissesEcartValide, ecartValideCumule };
  }

  // Validations conformes consécutives, toutes activités confondues
  // (Niveau 2 — remplace "jours sans écart validé" par une lecture plus
  // fine : compte des CONTRÔLES résolus, pas des jours calendaires, cohérent
  // avec le fait qu'un même jour peut porter plusieurs contrôles sur des
  // activités différentes). Ignore les lignes encore provisoires (statut
  // pas encore tranché par un manager — ni comptées, ni interruptrices),
  // s'appuie uniquement sur les lignes déjà résolues, en ordre chronologique.
  function serieValideeConformeUnifiee(lignesUnifiees) {
    const resolues = (lignesUnifiees || [])
      .filter(l => l.statut !== 'provisoire')
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (String(a.quart) < String(b.quart) ? -1 : 1)));
    let record = 0, courante = 0, enCours = 0;
    resolues.forEach(l => {
      if (l.statut === 'validee_conforme') { courante += 1; if (courante > record) record = courante; }
      else { courante = 0; }
    });
    for (let i = resolues.length - 1; i >= 0; i--) {
      if (resolues[i].statut === 'validee_conforme') enCours += 1; else break;
    }
    return { enCours, record, total: resolues.length };
  }

  // ------------------------------------------------------------
  // 12) "Mes séries" — badges Série Caisse + points (19/08/2026, cadrage
  //    NEXUS_Ma_Progression_Series_Recompenses_Cadrage_Developpeur.pdf).
  //
  //    Décision (verdict du 19/08/2026, discuté avec Frédéric avant de
  //    coder) : PAS de nouvelle table d'événements/streaks — la série et le
  //    record Caisse existent déjà en direct via serieValideeConformeUnifiee
  //    (section 11, toutes activités Boutique/Piste/FDJ, uniquement les
  //    contrôles définitivement validés — un écart provisoire ne casse ni
  //    ne fait progresser rien). Les deux seules choses qui manquaient
  //    réellement à NEXUS sont un badge acquis UNE SEULE FOIS (idempotence)
  //    et un ledger de points auditable — persistés dans
  //    progression_badge_awards / progression_points_ledger (colle Supabase
  //    côté écran, jamais ici : ce fichier reste 100% pur, comme le reste
  //    de nexus-progression.js).
  //
  //    Le badge se fonde sur le RECORD (meilleure série jamais atteinte),
  //    jamais sur la série en cours : cadrage §5 exemple — "le badge reste
  //    acquis" même si une série redémarre à 0 ensuite (jamais de retrait
  //    silencieux, cadrage §12).
  // ------------------------------------------------------------

  const PALIERS_SERIE_CAISSE = [
    { code: 'caisse_x5', seuil: 5, label: 'Caisse Maîtrisée — Série 5', points: 25 },
    { code: 'caisse_x10', seuil: 10, label: 'Caisse Fiable — Série 10', points: 50 },
    { code: 'caisse_x20', seuil: 20, label: 'Caisse Référence — Série 20', points: 100 },
  ];

  // Paliers génériques (20/08/2026, extraits pour réutilisation par la
  // Série Inventaire — comportement IDENTIQUE à la version Caisse d'origine,
  // vérifié par régression sur test_progression_series_caisse_badges.js
  // avant/après cette extraction) : dont le record vient de franchir le
  // seuil et qui ne sont pas encore enregistrés dans progression_badge_awards
  // (codesDejaAcquis) — peut renvoyer plusieurs paliers d'un coup (ex. un
  // rattrapage d'historique fait bondir le record de 3 à 12 : x5 ET x10 sont
  // franchis en même temps). Idempotent par construction : un palier déjà
  // dans codesDejaAcquis n'est jamais redonné, quel que soit le nombre
  // d'appels (recalcul, refresh...).
  function paliersFranchis(catalogue, record, codesDejaAcquis) {
    const acquis = codesDejaAcquis || [];
    return (catalogue || []).filter(p => (record || 0) >= p.seuil && !acquis.includes(p.code));
  }

  // Prochain palier non encore atteint, pour l'affichage "encore N pour
  // débloquer X" (cadrage §7.1) — se base sur le RECORD comme les badges
  // eux-mêmes (jamais la série en cours, qui peut redescendre à 0 sans que
  // ça change ce qu'il reste à faire pour le prochain vrai palier).
  function prochainPalier(catalogue, record, codesDejaAcquis) {
    const acquis = codesDejaAcquis || [];
    const suivant = (catalogue || []).find(p => (record || 0) < p.seuil || !acquis.includes(p.code));
    if (!suivant) return null;
    return { ...suivant, manque: Math.max(0, suivant.seuil - (record || 0)) };
  }

  // Wrappers Caisse (signature d'origine conservée à l'identique — aucun
  // appelant existant, ni NEXUS-Progression-v1.html ni les tests, n'a besoin
  // de changer).
  function paliersFranchisSerieCaisse(record, codesDejaAcquis) {
    return paliersFranchis(PALIERS_SERIE_CAISSE, record, codesDejaAcquis);
  }
  function prochainPalierSerieCaisse(record, codesDejaAcquis) {
    return prochainPalier(PALIERS_SERIE_CAISSE, record, codesDejaAcquis);
  }

  // ------------------------------------------------------------
  // 13) "Mes séries" — volet Inventaire (20/08/2026, suite du cadrage
  //    Séries & récompenses, discutée avec Frédéric le 19/08/2026).
  //
  //    Différence structurelle avec la Caisse, actée avec Frédéric avant de
  //    coder : Verify a un signal de validation manager EXPLICITE et
  //    définitif (audits_caisse.valide_le). L'Inventaire n'a rien de tel —
  //    un comptage employé est statut='valide' dès la saisie
  //    (inventaire_comptages), et le manager n'intervient que de façon
  //    RÉACTIVE et sans limite de délai via "Correction rétroactive"
  //    (NEXUS-Inventaire-Manager-v1.html::appliquerCorrectionRetroactive,
  //    Sprint 3 — fonctionne explicitement "même après clôture"). Il n'existe
  //    donc aucun instant où NEXUS peut dire avec certitude absolue "plus
  //    aucune correction ne viendra jamais". Décision de Frédéric (19/08) :
  //    délai de grâce fixe de 7 jours après clôture du quart. Un badge déjà
  //    acquis n'est ensuite jamais retiré même si une correction arrive plus
  //    tard (cadrage §12) — seule la série COURANTE (pas l'historique des
  //    badges) peut redescendre à un recalcul si une correction tardive
  //    change la qualification d'un quart déjà compté.
  //
  //    Unité de "session" retenue : une ligne inventaire_quart_employes où
  //    responsable_comptage=true (même principe que l'attribution solo de la
  //    section 1 pour la Caisse — jamais un quart partagé compté comme
  //    preuve individuelle pour quelqu'un qui n'était pas responsable).
  // ------------------------------------------------------------

  const DELAI_GRACE_SERIE_INVENTAIRE_JOURS = 7;

  // Seuls ces deux types de correction manager sont considérés imputables à
  // l'employé responsable du comptage (cadrage §4) : une vraie erreur de
  // comptage, ou un mouvement oublié qui aurait dû être déclaré pendant le
  // quart. 'stock_retenu' (ajustement possiblement légitime, pas
  // nécessairement une faute) et 'corriger_preparation_q1' (Production
  // journalière, hors périmètre comptage) ne cassent JAMAIS la série —
  // cadrage : "Correction technique/parcours/import Decenium -> Ne casse pas
  // la série". Ne jamais élargir cette liste sans une vraie preuve que le
  // nouveau type est bien une faute confirmée de l'employé (Article 5).
  const CORRECTION_TYPES_IMPUTABLES_INVENTAIRE = ['erreur_saisie', 'mouvement_oublie'];

  // Qualifie chaque quart dont l'employé était responsable du comptage en
  // SUCCESS / FAIL_CONFIRMED / PENDING (jamais NOT_COMPARABLE ici : à ce
  // grain — un quart entier, pas un produit — NEXUS n'a pas de vraie
  // troisième catégorie distincte de "pas encore sûr", donc PENDING couvre
  // aussi bien "pas encore clôturé" que "clôturé mais encore dans le délai
  // de grâce" plutôt que d'inventer une distinction sans signal réel).
  //
  // quartEmployeRows : lignes inventaire_quart_employes déjà filtrées site +
  // employé, chargées avec select('*, inventaire_quarts(*)') pour disposer
  // de date/quart/cloture_le/is_simulation sans requête séparée.
  // correctionsRows : lignes inventaire_corrections déjà filtrées site,
  // n'importe quelle période (une correction peut viser un quart ancien).
  function qualifierQuartsInventaireEmploye(quartEmployeRows, correctionsRows, dateReferenceISO, delaiGraceJours) {
    const delai = delaiGraceJours != null ? delaiGraceJours : DELAI_GRACE_SERIE_INVENTAIRE_JOURS;
    const maintenant = dateReferenceISO ? new Date(dateReferenceISO).getTime() : Date.now();

    // Une seule correction imputable sur le quart suffit à le disqualifier,
    // peu importe le produit concerné (cadrage : la série porte sur "un
    // inventaire", pas sur un produit isolé) — regroupées par (date|quart),
    // jamais par produit_id.
    const quartsAvecCorrectionImputable = new Set(
      (correctionsRows || [])
        .filter(c => CORRECTION_TYPES_IMPUTABLES_INVENTAIRE.includes(c.correction_type))
        .map(c => `${c.operational_date}|${c.quart}`)
    );

    return (quartEmployeRows || [])
      .filter(qe => qe.responsable_comptage === true && qe.inventaire_quarts && !qe.inventaire_quarts.is_simulation)
      .map(qe => {
        const q = qe.inventaire_quarts;
        const cle = `${q.date}|${q.quart}`;
        const disqualifie = quartsAvecCorrectionImputable.has(cle);
        let outcome;
        if (disqualifie) {
          // Une correction imputable confirmée casse la série même si elle
          // arrive après le délai de grâce (cadrage §12 : n'affecte que le
          // recalcul de la série courante, jamais un badge déjà historisé).
          outcome = 'FAIL_CONFIRMED';
        } else if (!qe.a_valide_cloture || !q.cloture_le) {
          outcome = 'PENDING'; // session pas encore terminée / preuve manquante
        } else {
          const joursDepuisCloture = (maintenant - new Date(q.cloture_le).getTime()) / 86400000;
          outcome = joursDepuisCloture >= delai ? 'SUCCESS' : 'PENDING';
        }
        return { date: q.date, quart: q.quart, quartId: q.id, outcome };
      });
  }

  // Série générique à partir d'une liste d'événements {date, quart, outcome}
  // — même construction que serieValideeConforme/serieValideeConformeUnifiee
  // (sections 10-11) mais réutilisable par n'importe quel domaine qualifié
  // en SUCCESS/FAIL_CONFIRMED/PENDING/EXCLUDED : PENDING et EXCLUDED sont
  // ignorés (ni comptés, ni interrupteurs), FAIL_CONFIRMED remet à 0, SUCCESS
  // incrémente. Jamais un second algorithme de série divergent (Article 11).
  function calculerSerieDepuisEvenements(evenements) {
    const chrono = (evenements || [])
      .filter(e => e.outcome === 'SUCCESS' || e.outcome === 'FAIL_CONFIRMED')
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (String(a.quart) < String(b.quart) ? -1 : 1)));
    let record = 0, courante = 0, enCours = 0;
    chrono.forEach(e => {
      if (e.outcome === 'SUCCESS') { courante += 1; if (courante > record) record = courante; }
      else { courante = 0; }
    });
    for (let i = chrono.length - 1; i >= 0; i--) {
      if (chrono[i].outcome === 'SUCCESS') enCours += 1; else break;
    }
    return { enCours, record, total: chrono.length };
  }

  const PALIERS_SERIE_INVENTAIRE = [
    { code: 'inventaire_x5', seuil: 5, label: 'Inventaire Maîtrisé — Série 5', points: 25 },
    { code: 'inventaire_x10', seuil: 10, label: 'Inventaire Fiable — Série 10', points: 50 },
    { code: 'inventaire_x20', seuil: 20, label: 'Inventaire Référence — Série 20', points: 100 },
  ];

  // ------------------------------------------------------------
  // 14) "Mes séries" — Paramètres manager (P8 du plan d'implémentation du
  //    cadrage, 20/08/2026). La table Supabase progression_site_settings
  //    (une ligne par site, colle posée dans l'écran, jamais ici) permet à
  //    un manager de personnaliser les paliers/points/délai de grâce sans
  //    développeur. Cette fonction reste pure : elle prend la ligne brute
  //    (ou null/undefined si aucune ligne n'existe encore pour ce site) et
  //    renvoie toujours un objet complet et sûr — jamais une erreur, jamais
  //    un palier à moitié fabriqué (Article 5). Si la ligne est absente ou
  //    qu'un champ est malformé, retombe sur les constantes par défaut
  //    (PALIERS_SERIE_CAISSE / PALIERS_SERIE_INVENTAIRE /
  //    DELAI_GRACE_SERIE_INVENTAIRE_JOURS) pour le champ concerné — jamais
  //    un recalcul partiel silencieux avec des valeurs à moitié valides.
  //
  //    Rappel (voir migration progression_site_settings_series) : la
  //    tolérance caisse n'est PAS reprise ici — elle reste SEUIL_ECART_CONFORME
  //    (source unique déjà utilisée par toute la page Mon évolution, pas
  //    seulement les séries).
  function paliersValides(valeur) {
    if (!Array.isArray(valeur) || valeur.length === 0) return null;
    const ok = valeur.every(p => p && typeof p.code === 'string' && typeof p.seuil === 'number' && p.seuil > 0 && typeof p.points === 'number' && p.points >= 0);
    return ok ? valeur : null;
  }

  function resoudreReglesProgressionSite(ligneSite) {
    const l = ligneSite || {};
    // l.series_inventaire_delai_grace_jours == null couvre absent ET null —
    // Number(null) vaut 0 en JS, ce qui ferait passer "pas de valeur" pour
    // "0 jour de délai" si on ne le testait pas explicitement avant Number().
    const brut = l.series_inventaire_delai_grace_jours;
    const delai = brut == null ? NaN : Number(brut);
    return {
      caisseActif: l.series_caisse_actif !== false,
      caissePaliers: paliersValides(l.series_caisse_paliers) || PALIERS_SERIE_CAISSE,
      inventaireActif: l.series_inventaire_actif !== false,
      inventaireDelaiGraceJours: (Number.isFinite(delai) && delai >= 0) ? delai : DELAI_GRACE_SERIE_INVENTAIRE_JOURS,
      inventairePaliers: paliersValides(l.series_inventaire_paliers) || PALIERS_SERIE_INVENTAIRE,
    };
  }

  global.NexusProgression = {
    SEUIL_ECART_CONFORME,
    construireServicesCaisse, estConforme, serviceEstPropre,
    nbServicesConformes, ecartsAttribuables, meilleureSerieConforme,
    tendanceEcartMoyen, quartDominant,
    statutCaisse, statutPonctualite, statutMissions, statutTenue, statutRelationClient,
    niveauNexus, pointsForts, identifierAxeProgression, genererEncouragement,
    calculerSeriePonctualite, calculerExperience, calculerNiveauNomme, calculerBadges,
    NIVEAUX_NEXUS,
    analyserQualites, analyserHabitudes, analyserProgres,
    calculerNiveauADate, projeterProchainObjectif,
    detecterNouveaute,
    // Mes Caisses (03/08/2026)
    statutCaisseJour, LIBELLE_STATUT_CAISSE_JOUR,
    MENTION_PROTECTION_LONGUE, MENTION_PROTECTION_COURTE,
    agregerMoisCaisse, moisPrecedent, tendanceMoisCaisse,
    joursConsecutifsSansEcartValide, serieValideeConforme,
    pointFiabiliteEligible, bonusRegulariteCaisse,
    CAUSES_POSSIBLES_CAISSE, messageCoachCaisseJour,
    // Ma Progression multi-activité (16/08/2026)
    // v2.286 : statutEcartActiviteVerify exportée pour test direct (pont
    // vers nexus-ecarts-moteur.js) — statutActivite/statutCaisseJour ci-
    // dessus en dépendent désormais.
    statutEcartActiviteVerify, statutActivite, ligneActiviteCaisse,
    construireServicesCaisseFdj, statutCaisseJourFdj, ligneActiviteFdj,
    construireHistoriqueUnifie, syntheseActivite, syntheseCombinee,
    serieValideeConformeUnifiee,
    // Mes séries — badges Série Caisse + points (19/08/2026)
    PALIERS_SERIE_CAISSE, paliersFranchisSerieCaisse, prochainPalierSerieCaisse,
    // Mes séries — génériques + volet Inventaire (20/08/2026)
    paliersFranchis, prochainPalier, calculerSerieDepuisEvenements,
    DELAI_GRACE_SERIE_INVENTAIRE_JOURS, CORRECTION_TYPES_IMPUTABLES_INVENTAIRE,
    qualifierQuartsInventaireEmploye, PALIERS_SERIE_INVENTAIRE,
    // Mes séries — Paramètres manager (20/08/2026)
    resoudreReglesProgressionSite,
  };
})(window);
