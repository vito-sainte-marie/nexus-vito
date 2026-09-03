// Lecture d'un onglet de planning Google Sheets (03/09/2026).
//
// Le classeur « Planning Energy 2026 » contient un onglet par site et par
// mois — SMU09 pour Sainte-Marie Usine en septembre, SMU10 en octobre. C'est
// le NOM de l'onglet qui désigne le site : le classeur mélange plusieurs
// sites, et lire le fichier « en bloc » revient à confondre des équipes
// différentes. Le nom d'onglet est donc une donnée obligatoire, jamais devinée.
//
// Structure réelle observée :
//   ligne 1  : "", "", "", puis un prénom par colonne
//   ligne 2+ : [jour, date j/m/aaaa, "QUART A"|"QUART B", valeurs…]
//              la date n'est portée que par la ligne QUART A du jour.
//   valeur   : un nombre d'heures (7, 8) OU un code (SMU, SME, T…) qui
//              signale un travail sur un AUTRE site, OU un prénom écrit à la
//              main (remplaçant).
//
// L'onglet déborde volontairement sur le mois précédent et suivant : le
// filtrage se fait sur la date réelle, jamais sur le nom de l'onglet.
(function (global) {
  'use strict';

  const QUART = { 'QUART A': '1', 'QUART B': '2' };

  // Codes de site (03/09/2026, règle de Frédéric : « Dylan est rattaché à
  // Vito Sainte-Marie même s'il est sur un autre site — si tu vois T ou SME
  // c'est 7 heures peu importe le jour »).
  //
  // Un code n'exclut donc PAS la personne de la paie du site : elle a
  // travaillé, 7 h, ailleurs. C'est une information de lieu, pas une absence.
  // Le barème 7/8 selon le jour ne s'applique qu'au travail sur place.
  const CODES_SITE_DEFAUT = ['T', 'SME', 'SMU', 'TRINITE', 'UNION'];
  const HEURES_AUTRE_SITE = 7;

  // ------------------------------------------------------------
  // Nom de l'onglet du mois — règle unique (article 11)
  // Un onglet par site et par mois : <préfixe><mois sur 2 chiffres>.
  // Le préfixe (SMU pour Sainte-Marie Usine) est DÉCLARÉ dans
  // station_config.planning_onglet_prefixe, jamais déduit du nom du site :
  // c'est une convention de classeur, pas une donnée NEXUS (article 5).
  // L'écran de paramétrage et le futur lecteur de planning appellent tous
  // deux cette fonction, pour ne jamais diverger d'un caractère.
  // ------------------------------------------------------------
  function normaliserPrefixeOnglet(valeur) {
    return String(valeur == null ? '' : valeur).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
  }

  function ongletDuMois(prefixe, date) {
    const p = normaliserPrefixeOnglet(prefixe);
    if (!p) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return p + String(d.getMonth() + 1).padStart(2, '0');
  }

  function normaliser(nom) {
    return String(nom || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Découpage CSV tolérant aux guillemets et aux virgules internes.
  function lignesCSV(texte) {
    const lignes = [];
    let champ = '', ligne = [], dansGuillemets = false;
    const src = String(texte || '').replace(/\r\n?/g, '\n');
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (dansGuillemets) {
        if (c === '"') { if (src[i + 1] === '"') { champ += '"'; i++; } else dansGuillemets = false; }
        else champ += c;
      } else if (c === '"') dansGuillemets = true;
      else if (c === ',') { ligne.push(champ); champ = ''; }
      else if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
      else champ += c;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes;
  }

  function dateISO(valeur) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(valeur || '').trim());
    if (!m) return null;
    const [, j, mo, a] = m;
    return `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  }

  // `alias` : { "loanne": "loane" } — correspondance explicite quand
  // l'orthographe de la feuille diffère de celle de NEXUS. Jamais de
  // rapprochement approximatif : deux prénoms proches peuvent être deux
  // personnes (même doctrine que import_product_aliases).
  function analyserFeuillePlanning(csv, { periode, employesNexus, alias, codesSite } = {}) {
    const CODES = new Set((codesSite || CODES_SITE_DEFAUT).map(c => normaliser(c)));
    const lignes = lignesCSV(csv).filter(l => l.some(c => String(c).trim() !== ''));
    if (!lignes.length) return { shifts: [], colonnes: [], inconnus: [], codes: [], anomalies: ['feuille vide'] };

    const entete = lignes[0];
    const colonnes = [];
    for (let i = 3; i < entete.length; i++) {
      const nom = String(entete[i] || '').trim();
      if (nom) colonnes.push({ index: i, nom });
    }

    const index = new Map();
    (employesNexus || []).forEach(e => index.set(normaliser(e.nom), e));
    Object.entries(alias || {}).forEach(([feuille, nexus]) => {
      const cible = index.get(normaliser(nexus));
      if (cible) index.set(normaliser(feuille), cible);
    });

    const shifts = [], codes = [], anomalies = [];
    // Les colonnes sans correspondance sont signalées dès l'en-tête, même
    // vides : un écran de paramétrage doit dire ce qui ne se rapprochera pas
    // AVANT que le mois se remplisse, pas après coup.
    const inconnus = new Set(colonnes.filter(c => !index.has(normaliser(c.nom))).map(c => c.nom));
    let jour = null;

    for (let r = 1; r < lignes.length; r++) {
      const l = lignes[r];
      const iso = dateISO(l[1]);
      if (iso) jour = iso;
      const quart = QUART[String(l[2] || '').trim().toUpperCase()];
      if (!jour || !quart) continue;
      if (periode && jour.slice(0, 7) !== String(periode).slice(0, 7)) continue;

      colonnes.forEach(({ index: i, nom }) => {
        const brut = String(l[i] || '').trim();
        if (!brut) return;
        const employe = index.get(normaliser(nom));
        if (!employe) return; // déjà signalé dans `inconnus`
        const heures = Number(brut.replace(',', '.'));
        if (Number.isFinite(heures) && heures > 0 && heures <= 24) {
          shifts.push({ employeeId: employe.id, nomFeuille: nom, date: jour, quart, heures, statut: 'travail_normal' });
        } else if (CODES.has(normaliser(brut))) {
          // Code de site : la personne a travaillé 7 h, ailleurs. Elle reste
          // rattachée à ce site pour la paie, donc ces heures comptent.
          shifts.push({
            employeeId: employe.id, nomFeuille: nom, date: jour, quart,
            heures: HEURES_AUTRE_SITE, statut: 'travail_normal',
            siteTravail: brut.toUpperCase(), horsSite: true,
          });
        } else {
          // Ni un nombre, ni un code connu : le plus souvent un prénom écrit
          // à la main. On ne l'interprète pas — on le remonte pour que le
          // manager tranche, plutôt que d'inventer des heures (Article 5).
          codes.push({ employeeId: employe.id, nomFeuille: nom, date: jour, quart, valeur: brut });
        }
      });
    }

    if (!shifts.length && !codes.length) anomalies.push('aucune affectation lue sur la période');
    return { shifts, colonnes: colonnes.map(c => c.nom), inconnus: [...inconnus], codes, anomalies };
  }

  // Rapprochement planning ↔ Verify : qui était prévu, qui était là.
  function rapprocherAvecVerify(shifts, audits, employesNexus) {
    const nom = new Map((employesNexus || []).map(e => [e.id, e.nom]));
    const prevus = new Map();
    shifts.forEach(s => {
      const cle = `${s.date}|${s.quart}`;
      if (!prevus.has(cle)) prevus.set(cle, new Set());
      prevus.get(cle).add(s.employeeId);
    });
    const resultat = [];
    (audits || []).forEach(a => {
      const cle = `${a.date}|${String(a.quart)}`;
      const attendus = prevus.get(cle) || new Set();
      const presents = new Set([...(a.employes_piste || []), ...(a.employes_boutique || [])].map(String));
      const converge = [...presents].filter(id => attendus.has(id));
      resultat.push({
        date: a.date, quart: String(a.quart),
        converge: converge.map(id => nom.get(id) || id),
        prevusAbsents: [...attendus].filter(id => !presents.has(id)).map(id => nom.get(id) || id),
        presentsNonPrevus: [...presents].filter(id => !attendus.has(id)).map(id => nom.get(id) || id),
        planningConnu: attendus.size > 0,
      });
    });
    return resultat;
  }

  // Vue par employé (03/09/2026, demande de Frédéric : « je ne veux pas que
  // NEXUS affiche le fichier, trop de cases à lire sur un portable — fais-le
  // par employé avec ses jours travaillés, ses jours de repos, qui est en
  // renfort, son binôme, et s'il est quart 1 ou quart 2 »).
  //
  // Règle décisive posée le même jour : UNE CASE VIDE VEUT DIRE « PAS ENCORE
  // PLANIFIÉ », pas « repos ». On ne peut donc conclure au repos que sur une
  // journée où l'équipe A ÉTÉ planifiée — c'est-à-dire où au moins une
  // affectation existe. Sur une journée entièrement vide, NEXUS se tait
  // (Article 5) : dire « repos » à quelqu'un qui n'a simplement pas encore
  // été planifié serait une information fausse, et il organiserait sa vie
  // dessus.
  function resumerParEmploye(analyse, { employesNexus, periode } = {}) {
    const shifts = (analyse && analyse.shifts) || [];
    const codes = (analyse && analyse.codes) || [];
    const noms = new Map((employesNexus || []).map(e => [e.id, e]));

    // Journées réellement planifiées : au moins une affectation, quelle
    // qu'elle soit (heures OU code de site).
    const joursPlanifies = new Set([...shifts, ...codes].map(x => x.date));

    // Qui est sur quel créneau, pour retrouver les binômes.
    const parCreneau = new Map();
    shifts.forEach(s => {
      const cle = `${s.date}|${s.quart}`;
      if (!parCreneau.has(cle)) parCreneau.set(cle, []);
      parCreneau.get(cle).push(s);
    });

    const resultat = [];
    noms.forEach(employe => {
      const siens = shifts.filter(s => s.employeeId === employe.id)
        .sort((a, b) => (a.date === b.date ? a.quart.localeCompare(b.quart) : a.date.localeCompare(b.date)));
      const ailleurs = codes.filter(c => c.employeeId === employe.id);
      const horsSite = siens.filter(s => s.horsSite);
      const datesTravail = new Set(siens.map(s => s.date));
      const datesAilleurs = new Set(ailleurs.map(c => c.date));

      const journees = siens.map(s => {
        const binome = (parCreneau.get(`${s.date}|${s.quart}`) || [])
          .filter(x => x.employeeId !== employe.id)
          .map(x => (noms.get(x.employeeId) || {}).nom || x.nomFeuille);
        // 7 h un jeudi, vendredi ou samedi, alors que le créneau tourne à
        // 8 h : la personne n'est pas sur le barème piste/boutique du jour.
        // Renfort ou autre site — le fichier ne le dit pas en clair, donc
        // NEXUS le signale sans trancher.
        const jour = new Date(`${s.date}T12:00:00`).getDay();
        const creneauHuit = (parCreneau.get(`${s.date}|${s.quart}`) || []).some(x => x.heures === 8);
        const horsBareme = !s.horsSite && [4, 5, 6].includes(jour) && s.heures === 7 && creneauHuit;
        return {
          date: s.date, quart: s.quart, heures: s.heures, binome,
          renfortProbable: horsBareme,
          note: horsBareme ? '7 h un jour à 8 h — renfort ou autre site, à confirmer' : null,
        };
      });

      // Repos : uniquement sur une journée planifiée pour l'équipe.
      const repos = [...joursPlanifies].sort()
        .filter(d => !datesTravail.has(d) && !datesAilleurs.has(d));

      resultat.push({
        employeeId: employe.id, nom: employe.nom, role: employe.role || null,
        periode: periode || null,
        journees,
        joursTravailles: datesTravail.size,
        heuresPrevues: siens.reduce((t, s) => t + s.heures, 0),
        quartsDominants: siens.length
          ? [...new Set(siens.map(s => s.quart))].sort().map(q => `Quart ${q}`)
          : [],
        repos,
        // Travail sur un autre site : les heures comptent quand même, la
        // personne restant rattachée à ce site pour la paie.
        surAutreSite: horsSite.map(s => ({ date: s.date, quart: s.quart, code: s.siteTravail, heures: s.heures })),
        heuresAutreSite: horsSite.reduce((t, s) => t + s.heures, 0),
        // Valeurs non interprétables (un prénom écrit à la main, par exemple).
        aArbitrer: ailleurs.map(c => ({ date: c.date, quart: c.quart, valeur: c.valeur })),
        // Ce que NEXUS ne sait PAS, dit explicitement plutôt que tu.
        joursNonPlanifies: null,
      });
    });

    return {
      periode: periode || null,
      joursPlanifies: [...joursPlanifies].sort(),
      employes: resultat.sort((a, b) => String(a.nom).localeCompare(String(b.nom))),
    };
  }

  global.NexusPlanningSheets = { resumerParEmploye, analyserFeuillePlanning, rapprocherAvecVerify, lignesCSV, dateISO, normaliser, ongletDuMois, normaliserPrefixeOnglet };
})(typeof window !== 'undefined' ? window : globalThis);
