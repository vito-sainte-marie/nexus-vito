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
  function analyserFeuillePlanning(csv, { periode, employesNexus, alias } = {}) {
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
        } else {
          // Ni un nombre ni rien : un code de site ou un prénom écrit à la
          // main. On ne l'interprète pas — on le remonte pour que le manager
          // tranche, plutôt que d'inventer des heures (Article 5).
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

  global.NexusPlanningSheets = { analyserFeuillePlanning, rapprocherAvecVerify, lignesCSV, dateISO, normaliser };
})(typeof window !== 'undefined' ? window : globalThis);
