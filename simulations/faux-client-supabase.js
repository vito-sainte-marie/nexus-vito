// Faux client Supabase pour le banc d'essai NEXUS.
//
// Pourquoi : les moteurs NEXUS sont testables unitairement (fonctions pures),
// mais les bugs qui coûtent cher naissent dans la COMPOSITION — l'ordre des
// ancres, la fenêtre de ventes retenue, la garde qui court-circuite une
// correction. Ces chemins-là ne se voient qu'en rejouant une vraie chaîne de
// chargement, donc avec un client.
//
// Ce faux client sert des tableaux d'objets en mémoire et implémente le
// sous-ensemble de PostgREST réellement utilisé par les chargeurs NEXUS. Il
// est volontairement strict : un opérateur non implémenté lève plutôt que de
// renvoyer un résultat faux, parce qu'un banc d'essai qui ment est pire que
// pas de banc d'essai.

'use strict';

function comparer(valeur, cible) {
  if (valeur instanceof Date) valeur = valeur.toISOString();
  if (cible instanceof Date) cible = cible.toISOString();
  return { valeur, cible };
}

function creerFauxClient(tables) {
  const donnees = {};
  Object.entries(tables || {}).forEach(([nom, lignes]) => {
    donnees[nom] = (lignes || []).map(l => ({ ...l }));
  });

  return {
    _tables: donnees,
    from(nom) {
      if (!Object.prototype.hasOwnProperty.call(donnees, nom)) {
        // Table non fournie par le scénario : ensemble vide, jamais une erreur
        // silencieuse — le scénario reste lisible sans déclarer chaque table.
        donnees[nom] = [];
      }
      let lignes = donnees[nom].map(l => ({ ...l }));
      let colonnes = null;

      const chaine = {
        select(cols) {
          if (typeof cols === 'string' && cols !== '*' && !cols.includes('(')) {
            colonnes = cols.split(',').map(c => c.trim()).filter(Boolean);
          }
          return chaine;
        },
        insert(payload) {
          const rangees = Array.isArray(payload) ? payload : [payload];
          rangees.forEach(r => donnees[nom].push({ ...r }));
          const inserees = rangees.map(r => ({ ...r }));
          // PostgREST rend l'insert "thenable" et chaînable avec select() /
          // maybeSingle() : on reproduit les deux formes réellement utilisées.
          const apres = {
            select() { return apres; },
            maybeSingle() { return Promise.resolve({ data: inserees[0] || null, error: null }); },
            single() { return Promise.resolve({ data: inserees[0] || null, error: null }); },
            then(res, rej) { return Promise.resolve({ data: inserees, error: null }).then(res, rej); },
          };
          return apres;
        },
        eq(col, v) { const f = lignes.filter(l => { const c = comparer(l[col], v); return String(c.valeur) === String(c.cible); }); lignes = f; return chaine; },
        neq(col, v) { lignes = lignes.filter(l => String(l[col]) !== String(v)); return chaine; },
        lt(col, v) { lignes = lignes.filter(l => { const c = comparer(l[col], v); return l[col] != null && c.valeur < c.cible; }); return chaine; },
        lte(col, v) { lignes = lignes.filter(l => { const c = comparer(l[col], v); return l[col] != null && c.valeur <= c.cible; }); return chaine; },
        gt(col, v) { lignes = lignes.filter(l => { const c = comparer(l[col], v); return l[col] != null && c.valeur > c.cible; }); return chaine; },
        gte(col, v) { lignes = lignes.filter(l => { const c = comparer(l[col], v); return l[col] != null && c.valeur >= c.cible; }); return chaine; },
        in(col, vs) { const s = new Set((vs || []).map(String)); lignes = lignes.filter(l => s.has(String(l[col]))); return chaine; },
        not(col, op, v) {
          if (op !== 'is' || v !== null) throw new Error(`faux-client: not(${op}) non implémenté`);
          lignes = lignes.filter(l => l[col] != null);
          return chaine;
        },
        is(col, v) {
          if (v !== null) throw new Error('faux-client: is(non-null) non implémenté');
          lignes = lignes.filter(l => l[col] == null);
          return chaine;
        },
        order(col, opts) {
          const asc = !opts || opts.ascending !== false;
          lignes = lignes.slice().sort((a, b) => {
            const x = a[col], y = b[col];
            if (x == null && y == null) return 0;
            if (x == null) return 1;
            if (y == null) return -1;
            if (x < y) return asc ? -1 : 1;
            if (x > y) return asc ? 1 : -1;
            return 0;
          });
          return chaine;
        },
        limit(n) { lignes = lignes.slice(0, n); return chaine; },
        projeter(l) {
          if (!colonnes) return l;
          const o = {};
          colonnes.forEach(c => { o[c] = l[c]; });
          return o;
        },
        maybeSingle() {
          if (lignes.length > 1) return Promise.resolve({ data: null, error: { message: 'plus d\'une ligne' } });
          return Promise.resolve({ data: lignes.length ? chaine.projeter(lignes[0]) : null, error: null });
        },
        single() {
          if (lignes.length !== 1) return Promise.resolve({ data: null, error: { message: 'attendu exactement 1 ligne' } });
          return Promise.resolve({ data: chaine.projeter(lignes[0]), error: null });
        },
        then(resoudre, rejeter) {
          return Promise.resolve({ data: lignes.map(chaine.projeter), error: null }).then(resoudre, rejeter);
        },
      };
      return chaine;
    },
  };
}

module.exports = { creerFauxClient };
