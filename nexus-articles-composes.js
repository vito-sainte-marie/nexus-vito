// NEXUS - Articles composés : normalisation partagée et règle de classement à l'import des ventes.
// La normalisation est IDENTIQUE à articles_composes_normaliser(text) de la migration 20261118140000 :
// minuscules, accents retirés par table explicite (pas de NFD), espaces multiples réduits, trim, rien d'autre.
// Un test compare ces constantes au littéral SQL.
(function (global) {
  'use strict';

  const ACCENTS_DE = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
  const ACCENTS_VERS = 'aaaaaaceeeeiiiinooooouuuuyy';

  function normaliser(nom) {
    if (nom === null || nom === undefined) return '';
    let s = String(nom).toLowerCase();
    let out = '';
    for (const c of s) { const i = ACCENTS_DE.indexOf(c); out += i >= 0 ? ACCENTS_VERS[i] : c; }
    return out.replace(/\s+/g, ' ').trim();
  }

  // Ensemble des noms normalisés d'une liste d'articles composés déclarés ([{nom, date_releve?, saisi_le?}] ou [string]).
  function ensemble(liste) {
    const m = new Map();
    for (const e of (liste || [])) {
      const nom = typeof e === 'string' ? e : (e && e.nom);
      const k = normaliser(nom);
      if (k && !m.has(k)) m.set(k, typeof e === 'string' ? {} : { date_releve: e.date_releve || null, saisi_le: e.saisi_le || null });
    }
    return m;
  }

  // Classe une référence vendue. Entrées : nom, ligne de relevé (ou undefined si absente),
  // relevé fourni (bool), ensemble des composés déclarés.
  // Retour : null (rien à signaler) ou { etat, ... } avec etat dans
  //   'confirme' (déclaré, absent du relevé ou quantité 0), 'confirme_quantite_inconnue' (déclaré, quantité null),
  //   'a_verifier' (déclaré avec quantité > 0), 'candidat' (absent du relevé, non déclaré).
  // Stock à 0 seul ne donne jamais de candidat. Sans relevé : aucune classification. Quantité négative : aucune règle ici.
  function classer(nom, ligneReleve, releveFourni, composes) {
    if (releveFourni === false) return null;
    const k = normaliser(nom);
    const decl = composes && composes.get ? composes.get(k) : undefined;
    const absent = !ligneReleve;
    const q = absent ? undefined : ligneReleve.quantite;
    if (decl) {
      const meta = { declaration: decl.saisi_le || null, date_releve: decl.date_releve || null };
      if (absent) return Object.assign({ etat: 'confirme', absent: true }, meta);
      if (q === null || q === undefined) return Object.assign({ etat: 'confirme_quantite_inconnue' }, meta);
      if (q > 0) return Object.assign({ etat: 'a_verifier', quantite: q }, meta);
      if (q === 0) return Object.assign({ etat: 'confirme', absent: false }, meta);
      return null; // quantité négative : pas de règle dans ce lot
    }
    return absent ? { etat: 'candidat' } : null;
  }

  global.NexusArticlesComposes = { ACCENTS_DE, ACCENTS_VERS, normaliser, ensemble, classer };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.NexusArticlesComposes;
})(typeof window !== 'undefined' ? window : globalThis);
