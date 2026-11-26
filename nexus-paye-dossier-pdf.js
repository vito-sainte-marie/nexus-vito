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

  // « -6,53 € » : une seule valeur, pas de détail par origine. Absent ou nul : « — ».
  function ecartsMois(m) {
    if (!m || (!m.totalCentimes && !m.boutiqueCentimes && !m.pisteCentimes && !m.fdjCentimes)) return '—';
    return euros(m.totalCentimes);
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

  // Jour civil (AAAA-MM-JJ) d'un instant, au fuseau du site. Jamais en UTC : à 21 h
  // en Martinique, il est déjà le lendemain en UTC (recette du 25/11, « Généré le 26 »).
  function jourLocal(instantISO, fuseau) {
    const t = new Date(instantISO);
    if (isNaN(t.getTime())) return String(instantISO || '').slice(0, 10);
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau || 'America/Martinique', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    } catch (e) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Martinique', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    }
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

  const FONCTION = { caissier: 'Caisse', caissiere: 'Caisse', pompiste: 'Piste', renfort: 'Renfort', manager: 'Manager', gerant: 'Gérant', 'gérant': 'Gérant' };
  const MARGE = 28;
  const PAD = 10;
  const ECART_FICHES = 12;
  const RAYON = 6;
  const ENTETE_FICHE = 20;
  const GOUTTIERE = 14;
  const TAILLE = 8.5;
  const INTERLIGNE = 10.5;

  function joursCal(n) { return `${Number(n || 0)} j cal.`; }
  function jjmm(iso) { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : String(iso || ''); }
  function plage(debut, fin) { return (!fin || fin === debut) ? jjmm(debut) : `du ${jjmm(debut)} au ${jjmm(fin)}`; }

  // Le dossier d'un mois validé est provisoire tant que sa date de génération (genere_le du
  // snapshot, fuseau du site) précède le dernier jour du mois ; un brouillon l'est toujours.
  // Aucune horloge du jour de génération du PDF.
  function dossierProvisoire(statutPeriode, genereLeISO, periodeISO, fuseau) {
    if (!statutPeriode || statutPeriode === 'brouillon') return true;
    return estProvisoire(genereLeISO, periodeISO, fuseau);
  }

  // Total d'écart du mois : objet {boutique, piste, fdj, total}. Absent ou total nul de valeur
  // (null) = donnée manquante ; 0 = vrai zéro. Jamais recalculé ici.
  function ecartGeneral(v) {
    const e = v.financier && v.financier.ecartsCaisseMois;
    if (!e || typeof e !== 'object' || e.totalCentimes == null || e.sansMontant > 0) return null;
    return Number(e.totalCentimes);
  }

  function envelopper(texte, max) {
    const lignes = [];
    let cur = '';
    String(texte).split(' ').forEach(m => {
      if (cur && (cur + ' ' + m).length > max) { lignes.push(cur); cur = '  ' + m; } else cur = cur ? cur + ' ' + m : m;
    });
    if (cur) lignes.push(cur);
    return lignes;
  }

  // Une fiche = une liste de rangées typées ; seules les rubriques non vides sont présentes.
  function lignesFiche(s) {
    const v = s.variables;
    const L = [];
    const add = (k, o) => L.push(Object.assign({ k }, o));
    if (s.statut === 'donnee_manquante') add('alerte', { t: 'Donnée manquante : fiche incomplète', couleur: 'rouge' });
    else if (s.statut === 'a_verifier') add('alerte', { t: `${v.elementsEnAttente} ${v.elementsEnAttente > 1 ? 'éléments' : 'élément'} à vérifier`, couleur: 'ambre' });
    add('banniere', { label: 'Heures supplémentaires', valeur: heures(v.heuresSupplementaires.heures) });
    const j = Number(v.presence.jours || 0);
    add('gris', { t: `${j} jour${j > 1 ? 's' : ''} travaillé${j > 1 ? 's' : ''} · ${heures(v.presence.heuresNormales)} normales` });
    if (v.heuresSupplementaires.enAttente) add('lv', { label: 'Heures sup. à arbitrer', valeur: String(v.heuresSupplementaires.enAttente), couleur: 'ambre' });

    const tab = [];
    const t3 = (nature, periode, duree, o) => {
      // Un libellé long prend sa propre ligne : la date et la durée suivent dessous.
      if (String(nature).length > 26) { tab.push(Object.assign({ k: 't3', nature, periode: '', duree: '', large: true }, o || {})); nature = ''; }
      tab.push(Object.assign({ k: 't3', nature, periode, duree }, o || {}));
    };
    const sousReel = ev => {
      const deborde = (ev.evenementDebut && ev.evenementDebut < ev.debut) || (ev.evenementFin && ev.evenementFin > ev.fin) || ev.finIndeterminee;
      if (deborde) tab.push({ k: 'sous', t: `période réelle du ${jjmmaaaa(ev.evenementDebut)} au ${ev.finIndeterminee ? 'retour non daté' : jjmmaaaa(ev.evenementFin)}` });
    };
    if (v.absence.jours) t3('Présence à vérifier', '', `${v.absence.jours} j`, { couleur: 'ambre' });
    (v.congesPayes.detail || []).forEach(ev => { t3('Congés payés', plage(ev.debut, ev.fin), joursCal(ev.jours)); sousReel(ev); });
    (v.maladieMaternite.detail || []).forEach(ev => { t3(ev.libelle || 'Maladie / maternité', plage(ev.debut, ev.fin), joursCal(ev.jours)); sousReel(ev); });
    // Une absence entièrement contenue dans une autre ne compte pas deux fois ses jours.
    const toutes = v.autresAbsences.detail || [];
    const autres = toutes.filter((ev, k) => !toutes.some((o, m) => m !== k && o.debut <= ev.debut && o.fin >= ev.fin && (o.debut < ev.debut || o.fin > ev.fin || m < k)));
    if (!autres.length && v.autresAbsences.jours) t3('Autres absences', '', joursCal(v.autresAbsences.jours));
    autres.forEach(ev => {
      let lib = ev.libelle || 'Autre absence';
      const sansReponse = ev.motif === 'autre' && ev.justifiee == null;
      if (ev.motif === 'autre') lib = ev.justifiee === true ? 'Absence justifiée' : (ev.justifiee === false ? 'Absence injustifiée' : 'Absence');
      t3(lib, plage(ev.debut, ev.fin), joursCal(ev.jours), sansReponse ? { couleur: 'ambre' } : {});
      if (sansReponse) tab.push({ k: 'sous', t: 'justification non renseignée' });
      sousReel(ev);
    });
    const ret = v.retards.detail || [];
    if (v.retards.occurrences) {
      ret.forEach(r => t3('Retard', jjmm(r.date), `${r.minutes} min`));
      t3('Total retards', '', `${v.retards.minutes} min`, { gras: true });
    }
    tab.forEach(r => L.push(r));

    if (v.financier.acompteCentimes) add('lv', { label: 'Acompte', valeur: euros(v.financier.acompteCentimes) });
    if (v.financier.detteCentimes) add('lv', { label: 'Avance', valeur: euros(v.financier.detteCentimes) });
    if (v.financier.retenueEcartCentimes) add('lv', { label: 'Retenue décidée', valeur: euros(v.financier.retenueEcartCentimes) });
    const fer = (v.joursFeries.detail || []);
    if (fer.length || v.joursFeries.jours) {
      const parDate = {};
      (v.presence.detailJours || []).forEach(d => { parDate[d.date] = d; });
      add('ferieEntete', {});
      fer.forEach(f => {
        const d = parDate[f.date];
        const n = d ? Number(d.normales || 0) : null;
        const sp = d ? Number(d.supplementaires || 0) + Number(d.autres || 0) : null;
        add('ferie', { date: jjmm(f.date), nom: f.nom || 'Jour férié', n: n == null ? '' : heures(n), sp: sp == null ? '' : heures(sp), tot: d ? heures(n + sp) : '' });
      });
      if (!fer.length) add('lv', { label: 'Jours fériés travaillés', valeur: `${v.joursFeries.jours} j` });
    }
    add('regle', {});
    const g = ecartGeneral(v);
    add('ecart', { valeur: g == null ? 'donnée manquante' : euros(g), couleur: g == null ? 'rouge' : (g < 0 ? 'rouge' : 'texte') });
    return L;
  }

  const HAUT = { alerte: 12, banniere: 22, gris: 13, lv: INTERLIGNE, t3: 10.5, sous: 9, ferieEntete: 17, ferie: 10.5, regle: 7, ecart: 20 };
  const PIED = HAUT.regle + HAUT.ecart;
  const estPied = l => l.k === 'regle' || l.k === 'ecart';
  const hCorps = lignes => lignes.reduce((t, l) => t + (HAUT[l.k] || INTERLIGNE), 0);
  // Hauteur d'un cadre : marges + en-tête + corps + (pied d'écart, seulement sur le dernier morceau).
  function hauteurCadre(corps, avecPied) { return 2 * PAD + ENTETE_FICHE + hCorps(corps) + (avecPied ? PIED : 0); }
  function hauteurFiche(lignes) { return hauteurCadre(lignes.filter(l => !estPied(l)), true); }

  // Présentation seule : initiale majuscule à chaque mot (tiret et apostrophe compris), accents intacts.
  function nomAffiche(nom) {
    const n = String(nom == null ? '' : nom).trim();
    if (!n) return 'Salarié sans nom';
    return n.replace(/(^|[\s\-'’])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());
  }

  /**
   * Découpe une fiche en morceaux qui tiennent chacun dans `cap` pt : coupe entre deux lignes,
   * jamais au milieu d'une ligne ni entre une ligne et sa sous-ligne. Seul le dernier morceau porte le pied.
   */
  function decouperFiche(s, lignes, cap) {
    const corps = lignes.filter(l => !estPied(l));
    const nom = nomAffiche(s.nom);
    if (hauteurCadre(corps, true) <= cap) return [{ s, nomAff: nom, corps, pied: true, h: hauteurCadre(corps, true) }];
    const morceaux = [];
    let reste = corps.slice();
    while (reste.length) {
      if (hauteurCadre(reste, true) <= cap) { morceaux.push({ corps: reste, pied: true }); reste = []; break; }
      let n = 0;
      while (n < reste.length && hauteurCadre(reste.slice(0, n + 1), false) <= cap) n += 1;
      while (n > 1 && reste[n] && reste[n].k === 'sous') n -= 1;
      if (n < 1) n = 1;
      morceaux.push({ corps: reste.slice(0, n), pied: false });
      reste = reste.slice(n);
      if (!reste.length) morceaux.push({ corps: [], pied: true });
    }
    return morceaux.map((m, i) => ({ s, nomAff: i === 0 ? nom : `${nom} (suite)`, corps: m.corps, pied: m.pied, h: hauteurCadre(m.corps, m.pied), morceau: i, morceaux: morceaux.length }));
  }

  /**
   * Construit le dossier comptable PDF (A4 paysage, trois colonnes) et
   * renvoie `{ bytes, nomFichier, titre }`. `dossier` vient de
   * `NexusPayeMoteur.dossierComptable(rapport)`. Aucun calcul ici.
   * `options.genereLe` : date de génération du snapshot validé (sinon celle du dossier).
   */
  async function construireDossierPdf(dossier, options) {
    const opts = options || {};
    const M = global.NexusPdfMoteur;
    const C = M.COULEUR;
    const label = moisLabel(dossier.periode);
    const genereLe = opts.genereLe || dossier.genereLe;
    const provisoire = opts.provisoire != null ? !!opts.provisoire : estProvisoire(genereLe, dossier.periode, opts.fuseau);
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
    const droite = (t, xDroit, y, taille, gras, couleur) => texte(t, xDroit - largeur(t, taille, gras), y, taille, gras, couleur);

    let logo = null;
    if (opts.logoDataUrl) { try { logo = await rapport.doc.embedPng(opts.logoDataUrl); } catch (e) { logo = null; } }
    const logoDims = logo ? logo.scaleToFit(60, 18) : null;
    const decalLogo = logoDims ? logoDims.width + 6 : 0;
    let premiere = true;
    const entete = () => {
      if (logo) rapport.page.drawImage(logo, { x: MARGE, y: H - MARGE - 15, width: logoDims.width, height: logoDims.height });
      texte('NEXUS PAYE', MARGE + decalLogo, H - MARGE - 12, 14, true, 'cyan');
      texte(titre, MARGE + decalLogo + largeur('NEXUS PAYE', 14, true) + 12, H - MARGE - 11, 10, false, 'texte');
      const mode = provisoire ? 'Provisoire' : 'Validé';
      droite(mode, W - MARGE, H - MARGE - 12, 11, true, provisoire ? 'ambre' : 'vert');
      let y = H - MARGE - 26;
      if (premiere) {
        texte(`${entreprise} · ${dossier.synthese.salaries} ${dossier.synthese.salaries > 1 ? 'salariés' : 'salarié'} · Généré le ${jjmmaaaa(jourLocal(genereLe, opts.fuseau))} · NEXUS prépare des variables : aucune retenue automatique, la comptabilité établit le bulletin.`, MARGE, y, 8, false, 'texteDim');
        y -= 10;
      }
      rapport.page.drawLine({ start: { x: MARGE, y: y - 4 }, end: { x: W - MARGE, y: y - 4 }, thickness: 0.6, color: C.ligne });
      premiere = false;
      return y - 12;
    };

    let haut = entete();
    const bas0 = bas;
    const cap = haut - bas0;
    // Morceaux : une fiche qui dépasse la page est coupée ; chaque morceau trop haut est seul sur sa rangée.
    const rangees = [];
    let courante = [];
    const fermer = () => { if (courante.length) { rangees.push({ items: courante, h: Math.max.apply(null, courante.map(i => i.h)) }); courante = []; } };
    dossier.salaries.forEach(sal => {
      const morceaux = decouperFiche(sal, lignesFiche(sal), cap);
      if (morceaux.length > 1) {
        fermer();
        morceaux.forEach((m, i) => {
          if (i < morceaux.length - 1) rangees.push({ items: [m], h: m.h });
          else courante.push(m);
        });
        // Le dernier morceau repart en tête d'une nouvelle page : on l'isole dans sa propre rangée si besoin.
        return;
      }
      courante.push(morceaux[0]);
      if (courante.length === 3) fermer();
    });
    fermer();

    const cadre = (x, yHaut, h) => {
      const w = colL;
      const r = RAYON;
      const d = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
      rapport.page.drawSvgPath(d, { x, y: yHaut, borderColor: C.ligne, borderWidth: 0.8 });
    };

    const dessinerFiche = (f, x0, yHaut, hCadre) => {
      cadre(x0, yHaut, hCadre);
      const x = x0 + PAD;
      const iw = colL - 2 * PAD;
      const y0 = yHaut - PAD;
      texte(f.nomAff, x, y0 - 11, 11.5, true, 'texte');
      const fct = FONCTION[String(f.s.role || '').toLowerCase()] || String(f.s.role || '');
      if (fct) droite(fct, x + iw, y0 - 10, 8, false, 'texteDim');
      rapport.page.drawLine({ start: { x, y: y0 - 15 }, end: { x: x + iw, y: y0 - 15 }, thickness: 0.4, color: C.ligne });
      let y = y0 - ENTETE_FICHE;
      const xP = x + iw * 0.5;
      const xD = x + iw;
      f.corps.forEach(l => {
        const h = HAUT[l.k] || INTERLIGNE;
        const base = y - h + 3;
        if (l.k === 'alerte') texte(l.t, x, base, TAILLE, true, l.couleur);
        else if (l.k === 'banniere') {
          rapport.page.drawRectangle({ x, y: y - h + 2, width: iw, height: h - 3, color: C.fondEntete });
          texte(l.label, x + 4, base + 2, TAILLE, false, 'cyan');
          droite(l.valeur, xD - 4, base + 1, 14, true, 'cyan');
        } else if (l.k === 'gris') texte(l.t, x, base, 8, false, 'texteDim');
        else if (l.k === 'lv') {
          const vW = largeur(l.valeur, TAILLE, false);
          texte(tronquer(l.label, iw - vW - 6, TAILLE, false), x, base, TAILLE, false, l.couleur);
          droite(l.valeur, xD, base, TAILLE, false, l.couleur);
        } else if (l.k === 't3') {
          texte(tronquer(l.nature, l.large ? iw : iw * 0.5 - 6, TAILLE, l.gras), x, base, TAILLE, !!l.gras, l.couleur);
          if (l.periode) texte(tronquer(l.periode, iw * 0.5 - 50, TAILLE, false), xP, base, TAILLE, false, l.couleur);
          droite(l.duree, xD, base, TAILLE, !!l.gras, l.couleur);
        } else if (l.k === 'sous') texte(tronquer(l.t, iw - 10, 7.5, false), x + 6, base, 7.5, false, 'texteDim');
        else if (l.k === 'ferieEntete') {
          texte('Jours fériés', x, base, 7.5, true, 'texteDim');
          droite('Normales', x + iw * 0.62, base, 7.5, false, 'texteDim');
          droite('Sup.', x + iw * 0.8, base, 7.5, false, 'texteDim');
          droite('Total', xD, base, 7.5, false, 'texteDim');
        } else if (l.k === 'ferie') {
          texte(l.date, x, base, TAILLE, false);
          texte(tronquer(l.nom, iw * 0.62 - 44 - largeur(l.n, TAILLE), TAILLE, false), x + 34, base, TAILLE, false);
          if (l.n) droite(l.n, x + iw * 0.62, base, TAILLE, false);
          if (l.sp) droite(l.sp, x + iw * 0.8, base, TAILLE, false);
          if (l.tot) droite(l.tot, xD, base, TAILLE, false);
        }
        y -= h;
      });
      if (f.pied) {
        // L'écart général est ancré au bas du cadre, sous un filet discret.
        const bord = yHaut - hCadre + PAD;
        const e = lignesFiche(f.s).find(l => l.k === 'ecart');
        rapport.page.drawLine({ start: { x, y: bord + HAUT.ecart + 3 }, end: { x: xD, y: bord + HAUT.ecart + 3 }, thickness: 0.5, color: C.ligne });
        texte('Écart général du mois', x, bord + 3, 9, true, 'texte');
        droite(e.valeur, xD, bord + 3, 9, true, e.couleur);
      }
    };

    let y = haut;
    rangees.forEach(r => {
      if (y - r.h < bas0 && y < haut) { rapport._nouvellePage({ sansBandeau: true }); haut = entete(); y = haut; }
      r.items.forEach((it, c) => dessinerFiche(it, MARGE + c * (colL + GOUTTIERE), y, r.h));
      y -= r.h + ECART_FICHES;
    });

    rapport.piedDePageToutesPages('');
    const bytes = await M.finaliser(rapport);
    return {
      bytes,
      nomFichier: `NEXUS_Paye_${opts.site || 'station'}_${String(dossier.periode).slice(0, 7)}${provisoire ? '_PROVISOIRE' : ''}.pdf`,
      titre,
    };
  }

  global.NexusPayeDossierPdf = { construireDossierPdf, estProvisoire, dossierProvisoire, ecartGeneral, lignesFiche, moisLabel, periodeEvenement, lignesVariables, euros, heures, minutes, nombre, jjmmaaaa, jourLocal };
})(typeof window !== 'undefined' ? window : globalThis);
