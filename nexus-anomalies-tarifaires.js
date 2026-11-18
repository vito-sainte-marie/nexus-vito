// Anomalies tarifaires S1–S7 (lot C, #331). Fonctions pures : aucune lecture de base, aucune horloge.
// Le moteur détecte les causes ; ce module les dédoublonne, les empreinte et calcule leur cycle de vie.
// Aucun mot « certifié » : une anomalie est « démontrée » ou « à vérifier », jamais prouvée par une vérification humaine.
(function (global) {
  'use strict';
  const TOL_COLIS = 0.03;
  // Seuils : source unique = réglages du moteur (variationNotable, variationSuspecte, ecartStockInsuffisant). Valeurs par défaut identiques à celles du moteur.
  const REGLAGES_DEFAUT = { variationNotable: 0.10, variationSuspecte: 0.50, ecartStockInsuffisant: 0.10 };
  const AGGRAVATION_POINTS = 5, AGGRAVATION_RELATIF = 0.20;
  const PRIORITE = ['S5', 'S4', 'S2', 'S3']; // la cause amont masque l'aval
  const NIVEAU = { S1: 'demontree', S2: 'a_verifier', S3: 'a_verifier', S4: 'a_verifier', S5: 'a_verifier', S6: 'a_verifier', S7: 'a_verifier' };
  const IDENTITE_RELEVE = { S2: true, S4: true, S5: true };

  let cache = null;
  function vocab() {
    try {
      const w = global.NexusVocabTarif || (typeof window !== 'undefined' && window.NexusVocabTarif);
      if (w && w.anomaliesTarifaires) return w.anomaliesTarifaires;
    } catch (e) { /* repli ci-dessous */ }
    if (cache) return cache;
    if (typeof require === 'function') {
      const vm = require('vm'), fs = require('fs'), path = require('path'), w = {};
      vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'nexus-vocabulaire-tarif.js'), 'utf8'), { window: w });
      cache = w.NexusVocabTarif && w.NexusVocabTarif.anomaliesTarifaires || null;
    }
    return cache;
  }
  function textes(code) { const v = vocab(); return v && v.codes[code] ? v.codes[code] : { titre: code, controle: '' }; }
  const num = x => (x === null || x === undefined || x === '' || isNaN(Number(x)) ? null : Number(x));
  const r4 = x => Math.round(x * 1e4) / 1e4;
  const pts = x => Math.round(x * 1000) / 10; // points de pourcentage, une décimale
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  // Port exact de tarif_cle_reference (SQL) : btrim = espaces seuls, \s = [ \t\n\r\f\v], accents conservés, null si vide.
  const btrim = x => String(x === null || x === undefined ? '' : x).replace(/^ +| +$/g, '');
  const cle = l => {
    const cb = btrim(l.code_barres), ar = btrim(l.article);
    if (cb !== '') return 'cb:' + cb;
    if (ar !== '') return 'lib:' + ar.replace(/[ \t\n\r\f\v]+/g, ' ').toLowerCase();
    return null;
  };

  // SHA-256 synchrone autonome : même empreinte en Node et dans le navigateur.
  function sha256(msg) {
    const K = [], H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let p = 0;
    for (let c = 2; p < 64; c++) { let ok = true; for (let i = 2; i * i <= c; i++) if (c % i === 0) { ok = false; break; } if (ok) { K[p++] = (Math.pow(c, 1 / 3) % 1) * 4294967296 | 0; } }
    const b = []; const s = unescape(encodeURIComponent(msg));
    for (let i = 0; i < s.length; i++) b.push(s.charCodeAt(i));
    const bits = b.length * 8; b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    const hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
    [hi, lo].forEach(v => { b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); });
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < b.length; o += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      [a, bb, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map(v => ('00000000' + (v >>> 0).toString(16)).slice(-8)).join('');
  }

  // Nombre d'unités annoncé par le libellé : « 40P », « x6 », « 6 pcs », « lot de 12 ».
  function unitesLibelle(libelle) {
    const t = String(libelle || '').toLowerCase();
    const m = t.match(/(?:^|[^\d.,])x\s?(\d{1,3})(?!\d)/) || t.match(/(\d{1,3})\s?(?:p|pcs?|pieces?|unites?|u)(?![a-z])/) || t.match(/lot de (\d{1,3})/);
    const n = m ? Number(m[1]) : null;
    return n && n >= 2 && n <= 500 ? n : null;
  }
  const proche = (rapport, n) => rapport > 0 && (Math.abs(rapport - n) / n <= TOL_COLIS || Math.abs(1 / rapport - n) / n <= TOL_COLIS);

  function causes(l, R) {
    R = { ...REGLAGES_DEFAUT, ...(R || {}) };
    const out = [], reg = l.regime, admin = reg === 'reglemente';
    const al = c => (l.alertes || []).filter(a => a.code === c)[0] || null;
    const cout = l.margeEstimee && l.margeEstimee.cout ? num(l.margeEstimee.cout.valeur) : null;
    const ctl = l.margeEstimee && l.margeEstimee.controle ? l.margeEstimee.controle : null;
    const taux = num(l.taux);
    if (al('A3')) out.push({ code: 'S1', gravite: taux === null ? 0 : pts(-taux), valeurs: { taux: taux === null ? null : r4(taux) } });
    // S5 : identité ou correspondance, hors constats déjà portés par S7 (TVA) ou le régime déclaré.
    const a5 = al('A5'), c5 = a5 && a5.donnees && a5.donnees.constats ? a5.donnees.constats.filter(c => /identit|motif déclaré|absente du relevé|préfixé d'une date/.test(c)) : [];
    const ambigu = (l.fiabilite && l.fiabilite.raisons || []).some(r => /ambig|plusieurs/i.test(r));
    if (c5.length || ambigu) out.push({ code: 'S5', gravite: 0, valeurs: { constats: c5.length + (ambigu ? 1 : 0) } });
    // S4 : coût / relevé ou coût / PV au voisinage du nombre d'unités du libellé.
    const n = unitesLibelle(l.article), pa = cout, pv = num(l.pv_ht), paRel = ctl ? num(ctl.paNetHtReleve) : null;
    if (n && pa > 0) {
      const r1 = paRel > 0 ? pa / paRel : null, r2 = pv > 0 ? pa / pv : null;
      if ((r1 !== null && proche(r1, n)) || (r2 !== null && proche(r2, n))) out.push({ code: 'S4', gravite: 0, valeurs: { unites: n, rapportReleve: r1 === null ? null : r4(r1), rapportPv: r2 === null ? null : r4(r2) } });
    }
    const ec = ctl ? num(ctl.ecart) : null;
    if (ec !== null && Math.abs(ec) > R.ecartStockInsuffisant) out.push({ code: 'S2', gravite: pts(Math.abs(ec)), valeurs: { ecart: r4(ec), paNetHtReleve: paRel } });
    const vc = num(l.variationCout);
    if (!admin && vc !== null && Math.abs(vc) >= R.variationNotable) out.push({ code: 'S3', gravite: pts(Math.abs(vc)), valeurs: { variationCout: r4(vc) } });
    const vp = num(l.variationPv);
    if (!admin && vp !== null && Math.abs(vp) >= R.variationSuspecte && !l.prixDecide) out.push({ code: 'S6', gravite: pts(Math.abs(vp)), valeurs: { variationPv: r4(vp) } });
    const te = l.tva && l.tva.etat;
    if (te === 'a_verifier') out.push({ code: 'S7', gravite: 0, valeurs: { tva: l.tva.taux === undefined ? null : l.tva.taux, etat: te }, ...(l.tva.contreConfirmation ? { niveau: 'demontree', valeurs: { tva: l.tva.taux === undefined ? null : l.tva.taux, etat: te, tauxConfirme: l.tva.tauxConfirme } } : {}) });
    return out;
  }

  function empreinte(code, l, valeurs, periode) {
    const p = periode ? (periode.debut || '') + '/' + (periode.fin || '') : '';
    const v = Object.keys(valeurs).sort().map(k => k + '=' + (valeurs[k] === null || valeurs[k] === undefined ? '' : valeurs[k])).join(',');
    return sha256([code, cle(l), v, p].join('|'));
  }

  // Détection par ligne, dédoublonnée : la cause amont masque l'aval (S5 > S4 > S2 > S3) ; S1, S6, S7 indépendantes.
  function anomaliesLigne(l, ctx) {
    ctx = ctx || {};
    const brutes = causes(l, ctx.reglages), masquantes = brutes.filter(c => PRIORITE.includes(c.code)).sort((a, b) => PRIORITE.indexOf(a.code) - PRIORITE.indexOf(b.code));
    const gardee = masquantes[0] ? masquantes[0].code : null;
    const aussi = masquantes.slice(1).map(c => c.code);
    return brutes.filter(c => !PRIORITE.includes(c.code) || c.code === gardee).map(c => {
      const t = textes(c.code);
      return {
        code: c.code, niveau: c.niveau || NIVEAU[c.code], titre: t.titre, controleConseille: t.controle, gravite: c.gravite, valeurs: c.valeurs,
        peutExpliquerAussi: c.code === gardee ? aussi : [],
        empreinte: empreinte(c.code, l, c.valeurs, ctx.periode),
        cle: cle(l),
        identiteDonnees: { fichierHash: ctx.fichierHash || null, dateReleve: IDENTITE_RELEVE[c.code] ? (ctx.dateReleve || ctx.stockDate || null) : null },
      };
    });
  }

  // Cycle de vie. verifications : [{ code, cle, empreinte, gravite, identiteDonnees, verifie_le }] — la plus récente par (code, cle) fait foi.
  // identiteCourante : { fichierHash, dateReleve } de l'import en cours. Sans nouvel import, rien ne change : l'anomalie reste « vérifiée », rien n'est écrit.
  // Nouvel import = fichierHash courant renseigné et différent de celui de la vérification ; pour S2, S4, S5, la dateReleve courante doit aussi différer.
  // Retourne { anomalies: [... + cycle], resolues: [...] }.
  function cycleDeVie(anomalies, verifications, identiteCourante) {
    const cur = identiteCourante || {};
    const dernier = new Map();
    (verifications || []).forEach(v => { const k = v.code + '|' + v.cle; const o = dernier.get(k); if (!o || String(v.verifie_le || '') >= String(o.verifie_le || '')) dernier.set(k, v); });
    const nouvelImport = v => {
      const id = v.identiteDonnees || {};
      if (!cur.fichierHash || cur.fichierHash === (id.fichierHash || null)) return false;
      if (IDENTITE_RELEVE[v.code] && (!cur.dateReleve || cur.dateReleve === (id.dateReleve || null))) return false;
      return true;
    };
    const vus = new Set();
    const res = (anomalies || []).map(a => {
      const k = a.code + '|' + a.cle, v = dernier.get(k); vus.add(k);
      if (!v) return { ...a, cycle: 'nouvelle', nouveauControle: true };
      if (v.empreinte === a.empreinte || !nouvelImport(v)) return { ...a, cycle: 'verifiee', nouveauControle: false };
      const g0 = num(v.gravite) || 0, g1 = num(a.gravite) || 0;
      const aggrave = g1 - g0 >= AGGRAVATION_POINTS || (g0 > 0 && (g1 - g0) / g0 >= AGGRAVATION_RELATIF);
      return { ...a, cycle: aggrave ? 'aggravee' : 'persistante', nouveauControle: true };
    });
    const resolues = [];
    dernier.forEach((v, k) => { if (!vus.has(k) && nouvelImport(v)) resolues.push({ code: v.code, cle: v.cle, empreinte: v.empreinte, cycle: 'resolue', nouveauControle: false }); });
    return { anomalies: res, resolues };
  }

  // Lignes à écrire par tarif_enregistrer_reevaluations : une ligne par changement de cycle, jamais par anomalie inchangée.
  function reevaluations(resultat) {
    return resultat.anomalies.filter(a => a.cycle === 'persistante' || a.cycle === 'aggravee').map(a => ({ code: a.code, cle: a.cle, empreinte: a.empreinte, cycle: a.cycle, gravite: a.gravite }))
      .concat(resultat.resolues.map(r => ({ code: r.code, cle: r.cle, empreinte: r.empreinte, cycle: 'resolue', gravite: null })));
  }

  const API = { cle, anomaliesLigne, cycleDeVie, reevaluations, empreinte, sha256, unitesLibelle, CODES: Object.keys(NIVEAU), PRIORITE };
  global.NexusAnomaliesTarifaires = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
