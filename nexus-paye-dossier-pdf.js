/* ------------------------------------------------------------
 * NEXUS PAYE — Dossier comptable PDF (03/09/2026).
 *
 * Demande de Frédéric : « la sortie principale du module ne peut pas
 * rester un CSV ». Un CSV est un format d'échange technique ; ce que la
 * comptable attend, c'est un document lisible — une synthèse du mois et
 * une fiche par salarié — qu'elle peut lire, classer et archiver telle
 * quelle. Le CSV reste disponible, mais en second, comme export
 * technique.
 *
 * Ce fichier ne calcule RIEN (Article 11) : il reçoit le dossier déjà
 * agrégé par `NexusPayeMoteur.dossierComptable()` — la même agrégation
 * que celle affichée sur la carte salarié — et se contente de le mettre
 * en page avec les primitives génériques de `nexus-pdf-moteur.js`.
 * Aucune règle de paie ici, aucun seuil, aucune requête : si un chiffre
 * du PDF diffère de l'écran, c'est un bug de mise en page, jamais une
 * divergence de calcul.
 *
 * Refonte du 25/11/2026 (GO gérant, #383) : A4 paysage, trois colonnes, une fiche
 * compacte par salarié, rubriques vides omises. Le dossier provisoire est
 * téléchargeable en brouillon, marqué « Provisoire ».
 *
 * Charger APRÈS pdf-lib, nexus-pdf-moteur.js et nexus-paye-moteur.js.
 * ------------------------------------------------------------ */
(function (global) {
  'use strict';

  const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function moisLabel(periodeISO) {
    const p = String(periodeISO || '').slice(0, 10).split('-');
    if (p.length !== 3) return String(periodeISO || '');
    return `${MOIS_FR[Number(p[1]) - 1] || p[1]} ${p[0]}`;
  }

  function jjmmaaaa(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso || '');
  }

  function euros(centimes) {
    if (centimes == null) return 'donnée manquante';
    return `${(Number(centimes) / 100).toFixed(2).replace('.', ',')} €`;
  }

  function heures(valeur) {
    const v = Number(valeur || 0);
    return `${(Math.round(v * 100) / 100).toString().replace('.', ',')} h`;
  }

  function minutes(valeur) {
    const v = Number(valeur || 0);
    return v ? `${v} min` : '—';
  }

  function nombre(valeur, unite) {
    const v = Number(valeur || 0);
    return v ? `${v} ${unite}${v > 1 && unite !== 'h' ? 's' : ''}` : '—';
  }

  // Période couverte par un événement RH, exprimée telle que la comptabilité
  // en a besoin : ce qui tombe DANS le mois, plus le rappel de la période
  // réelle quand l'événement déborde (une maternité de juillet à janvier
  // ne doit pas ressembler à une absence d'un mois).
  function periodeEvenement(ev) {
    const dansLeMois = `du ${jjmmaaaa(ev.debut)} au ${jjmmaaaa(ev.fin)}`;
    const deborde = (ev.evenementDebut && ev.evenementDebut < ev.debut)
      || (ev.evenementFin && ev.evenementFin > ev.fin) || ev.finIndeterminee;
    if (!deborde) return dansLeMois;
    const fin = ev.dateReprise ? `reprise le ${jjmmaaaa(ev.dateReprise)}`
      : (ev.finIndeterminee ? 'retour non daté' : jjmmaaaa(ev.evenementFin));
    return `${dansLeMois} (événement : du ${jjmmaaaa(ev.evenementDebut)} au ${fin})`;
  }

  // Les variables d'un salarié, sous la forme d'un tableau clé/valeur —
  // exactement l'ordre de lecture demandé : présence, absence, CP,
  // maladie/maternité, retards, heures supplémentaires, jours fériés,
  // éléments financiers.
  function lignesVariables(v) {
    const lignes = [
      { variable: 'Présence confirmée', valeur: v.presence.jours ? `${nombre(v.presence.jours, 'jour')} · ${heures(v.presence.heures)}` : '0' },
      { variable: 'Heures normales retenues', valeur: heures(v.presence.heuresNormales) },
      { variable: 'Présence à vérifier', valeur: nombre(v.absence.jours, 'jour') },
      { variable: 'Congés payés', valeur: nombre(v.congesPayes.jours, 'jour') },
      { variable: 'Maladie / maternité / paternité', valeur: nombre(v.maladieMaternite.jours, 'jour') },
      { variable: 'Autres absences qualifiées', valeur: nombre(v.autresAbsences.jours, 'jour') },
      { variable: 'Retards', valeur: v.retards.occurrences ? `${minutes(v.retards.minutes)} sur ${nombre(v.retards.occurrences, 'jour')}${(v.retards.detail || []).length ? ` (${v.retards.detail.map(r => `${String(r.date).slice(8, 10)}/${String(r.date).slice(5, 7)} : ${minutes(r.minutes)}`).join(' ; ')})` : ''}` : '—' },
      { variable: 'Heures supplémentaires', valeur: v.heuresSupplementaires.heures ? `${heures(v.heuresSupplementaires.heures)} (comprises dans la présence)` : 'aucune' },
      { variable: 'Heures supplémentaires en attente d’arbitrage', valeur: v.heuresSupplementaires.enAttente ? nombre(v.heuresSupplementaires.enAttente, 'élément') : 'aucune' },
      { variable: 'Jours fériés travaillés', valeur: nombre(v.joursFeries.jours, 'jour') + ((v.joursFeries.dates || []).length ? ` (${v.joursFeries.dates.join(', ')})` : '') },
      { variable: 'Acomptes', valeur: v.financier.acompteCentimes ? euros(v.financier.acompteCentimes) : '—' },
      { variable: 'Dettes / avances', valeur: v.financier.detteCentimes ? euros(v.financier.detteCentimes) : '—' },
      // Le cumul du mois est automatique : une retenue n'apparaît que si elle vient d'une décision antérieure (lecture seule).
      ...(v.financier.retenueEcartCentimes ? [{ variable: 'Retenue sur écart de caisse (décision antérieure)', valeur: euros(v.financier.retenueEcartCentimes) }] : []),
      { variable: 'Écarts de caisse du mois', valeur: ecartsMois(v.financier.ecartsCaisseMois) },
    ];
    return lignes;
  }

  // Provisoire = généré avant le dernier jour du mois, au fuseau du site.
  function estProvisoire(genereLeISO, periodeISO, fuseau) {
    const t = new Date(genereLeISO);
    const p = String(periodeISO || '').slice(0, 10).split('-').map(Number);
    if (isNaN(t.getTime()) || p.length !== 3 || !p[0]) return true;
    let local;
    try {
      local = new Intl.DateTimeFormat('en-CA', { timeZone: fuseau || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    } catch (e) {
      local = t.toISOString().slice(0, 10);
    }
    const dernier = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
    const finDeMois = `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(dernier).padStart(2, '0')}`;
    return local < finDeMois;
  }

  const FONCTION = { caissier: 'Caisse', caissiere: 'Caisse', pompiste: 'Piste', renfort: 'Renfort' };
  const MARGE = 28;
  const GOUTTIERE = 14;
  const TAILLE = 8.5;
  const INTERLIGNE = 10.5;

  function joursCal(n) { return `${Number(n || 0)} j cal.`; }

  // Une fiche = une liste de lignes ; seules les rubriques non vides sont présentes.
  function lignesFiche(s) {
    const v = s.variables;
    const L = [];
    const ligne = (label, valeur, o) => L.push(Object.assign({ label, valeur }, o || {}));
    if (s.statut === 'donnee_manquante') ligne('Donnée manquante : fiche incomplète', '', { couleur: 'rouge', gras: true });
    else if (s.statut === 'a_verifier') ligne(`${v.elementsEnAttente} élément(s) à vérifier`, '', { couleur: 'ambre', gras: true });
    ligne('Jours travaillés', `${v.presence.jours} j`);
    ligne('Heures', heures(v.presence.heures));
    if (v.absence.jours) ligne('Présence à vérifier', `${v.absence.jours} j`, { couleur: 'ambre' });
    const evenements = (typeLabel, bloc) => {
      if (!bloc.jours && !(bloc.detail || []).length) return;
      ligne(typeLabel, joursCal(bloc.jours));
      (bloc.detail || []).forEach(ev => {
        const deborde = (ev.evenementDebut && ev.evenementDebut < ev.debut) || (ev.evenementFin && ev.evenementFin > ev.fin) || ev.finIndeterminee;
        if (deborde) ligne(`période réelle du ${jjmmaaaa(ev.evenementDebut)} au ${ev.finIndeterminee ? 'retour non daté' : jjmmaaaa(ev.evenementFin)}`, '', { couleur: 'texteDim', petit: true });
      });
    };
    evenements('Congés payés', v.congesPayes);
    evenements('Maladie / maternité', v.maladieMaternite);
    if (v.autresAbsences.jours || (v.autresAbsences.detail || []).length) {
      const detail = v.autresAbsences.detail || [];
      if (!detail.length) ligne('Autres absences', joursCal(v.autresAbsences.jours));
      detail.forEach(ev => {
        let lib = ev.libelle || 'Autre absence';
        if (ev.motif === 'autre') lib = ev.justifiee === true ? 'Absence justifiée' : (ev.justifiee === false ? 'Absence injustifiée' : 'Absence (justification non renseignée)');
        ligne(lib, joursCal(ev.jours), ev.motif === 'autre' && ev.justifiee !== true ? { couleur: 'ambre' } : {});
      });
    }
    if (v.retards.occurrences) ligne('Retards', `${v.retards.minutes} min`);
    ligne('Heures supplémentaires', heures(v.heuresSupplementaires.heures));
    if (v.heuresSupplementaires.enAttente) ligne('Heures sup. à arbitrer', String(v.heuresSupplementaires.enAttente), { couleur: 'ambre' });
    if (v.joursFeries.jours) ligne('Jours fériés travaillés', `${v.joursFeries.jours} j`);
    if (v.financier.acompteCentimes) ligne('Acompte', euros(v.financier.acompteCentimes));
    if (v.financier.detteCentimes) ligne('Avance', euros(v.financier.detteCentimes));
    if (v.financier.retenueEcartCentimes) ligne('Retenue décidée', euros(v.financier.retenueEcartCentimes));
    const g = v.financier.ecartGeneralCentimes;
    ligne('Écart général du mois', g == null ? 'donnée manquante' : euros(g), g == null ? { couleur: 'rouge' } : {});
    return L;
  }

  function hauteurFiche(lignes) { return 16 + lignes.length * INTERLIGNE + 8; }

  /**
   * Construit le dossier comptable PDF (A4 paysage, trois colonnes) et
   * renvoie `{ bytes, nomFichier, titre }`. `dossier` vient de
   * `NexusPayeMoteur.dossierComptable(rapport)`. Aucun calcul ici.
   */
  async function construireDossierPdf(dossier, options) {
    const opts = options || {};
    const M = global.NexusPdfMoteur;
    const C = M.COULEUR;
    const label = moisLabel(dossier.periode);
    const provisoire = opts.provisoire != null ? !!opts.provisoire : estProvisoire(dossier.genereLe, dossier.periode, opts.fuseau);
    const titre = `Dossier comptable ${label}`;
    const rapport = await M.creerRapport({
      titre: `NEXUS PAYE : ${titre}`,
      sujet: 'Variables de paie préparées par NEXUS, la comptabilité établit le bulletin.',
      orientation: 'paysage',
      marge: MARGE,
    });
    const entreprise = opts.nomEntreprise || opts.site || 'Commerce non identifié';
    const W = rapport.pageLargeur;
    const H = rapport.pageHauteur;
    const colL = (W - 2 * MARGE - 2 * GOUTTIERE) / 3;
    const bas = MARGE + 6;

    const texte = (t, x, y, taille, gras, couleur) => {
      rapport.page.drawText(rapport._assainir(String(t), gras), { x, y, size: taille, font: gras ? rapport.policeGrasse : rapport.police, color: C[couleur || 'texte'] });
    };
    const largeur = (t, taille, gras) => (gras ? rapport.policeGrasse : rapport.police).widthOfTextAtSize(rapport._assainir(String(t), gras), taille);
    const tronquer = (t, max, taille, gras) => {
      let s = String(t);
      if (largeur(s, taille, gras) <= max) return s;
      while (s.length > 1 && largeur(`${s}...`, taille, gras) > max) s = s.slice(0, -1);
      return `${s}...`;
    };

    let premiere = true;
    const entete = () => {
      texte('NEXUS PAYE', MARGE, H - MARGE - 12, 14, true, 'cyan');
      texte(titre, MARGE + 92, H - MARGE - 11, 10, false, 'texte');
      const mode = provisoire ? 'Provisoire' : 'Validé';
      texte(mode, W - MARGE - largeur(mode, 11, true), H - MARGE - 12, 11, true, provisoire ? 'ambre' : 'vert');
      let y = H - MARGE - 26;
      if (premiere) {
        texte(`${entreprise} · ${dossier.synthese.salaries} salarié(s)`, MARGE, y, 8.5, false, 'texteDim');
        texte('NEXUS prépare des variables : aucune retenue automatique, la comptabilité établit le bulletin.', MARGE, y - 10, 8.5, false, 'texteDim');
        y -= 20;
      }
      rapport.page.drawLine({ start: { x: MARGE, y: y - 4 }, end: { x: W - MARGE, y: y - 4 }, thickness: 0.6, color: C.ligne });
      premiere = false;
      return y - 12;
    };

    let haut = entete();
    const fiches = dossier.salaries.map(s => { const lignes = lignesFiche(s); return { s, lignes, h: hauteurFiche(lignes) }; });
    const capacite = haut - bas;
    // Pages : remplissage glouton sur trois colonnes, puis colonnes équilibrées par page.
    const pages = [];
    let cour = null;
    fiches.forEach(f => {
      if (!cour || cour.col > 2) { cour = { liste: [], col: 0, acc: 0 }; pages.push(cour); }
      if (cour.acc + f.h > capacite && cour.acc > 0) {
        cour.col += 1; cour.acc = 0;
        if (cour.col > 2) { cour = { liste: [], col: 0, acc: 0 }; pages.push(cour); }
      }
      cour.liste.push(f); cour.acc += f.h;
    });
    pages.forEach((pg, ip) => {
      if (ip > 0) { rapport._nouvellePage({ sansBandeau: true }); haut = entete(); }
      const cible = pg.liste.reduce((t, f) => t + f.h, 0) / 3;
      let col = 0;
      let y = haut;
      let acc = 0;
      pg.liste.forEach(f => {
        if (col < 2 && acc > 0 && (acc + f.h / 2 > cible || y - f.h < bas)) { col += 1; y = haut; acc = 0; }
        const x = MARGE + col * (colL + GOUTTIERE);
        texte(f.s.nom || 'Salarié sans nom', x, y - 11, 11.5, true, 'texte');
        const fct = FONCTION[String(f.s.role || '').toLowerCase()] || String(f.s.role || '');
        if (fct) texte(fct, x + colL - largeur(fct, 8, false), y - 10, 8, false, 'texteDim');
        rapport.page.drawLine({ start: { x, y: y - 15 }, end: { x: x + colL, y: y - 15 }, thickness: 0.4, color: C.ligne });
        let ly = y - 16 - INTERLIGNE + 2;
        f.lignes.forEach(l => {
          const taille = l.petit ? 7.5 : TAILLE;
          const vW = l.valeur ? largeur(l.valeur, taille, false) : 0;
          texte(tronquer(l.label, colL - vW - 6, taille, l.gras), x, ly, taille, l.gras, l.couleur);
          if (l.valeur) texte(l.valeur, x + colL - vW, ly, taille, false, l.couleur);
          ly -= INTERLIGNE;
        });
        y -= f.h; acc += f.h;
      });
    });

    rapport.piedDePageToutesPages(`NEXUS PAYE · ${titre} · Généré le ${jjmmaaaa(String(dossier.genereLe).slice(0, 10))}`);
    const bytes = await M.finaliser(rapport);
    return {
      bytes,
      nomFichier: `NEXUS_Paye_${opts.site || 'station'}_${String(dossier.periode).slice(0, 7)}${provisoire ? '_PROVISOIRE' : ''}.pdf`,
      titre,
    };
  }

  global.NexusPayeDossierPdf = { construireDossierPdf, estProvisoire, moisLabel, periodeEvenement, lignesVariables, euros, heures, minutes, nombre, jjmmaaaa };
})(typeof window !== 'undefined' ? window : globalThis);
