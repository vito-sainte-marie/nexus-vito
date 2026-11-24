'use strict';
// Lot 3 mobile (24/11) : Accueil employé. Chaque garde est suivie d'une mutation qui doit la faire rougir.
const fs = require('fs');
const assert = require('assert');
const P = require('./nexus-accueil-piste.js');
const M = require('./nexus-menu-accueil.js');
const lire = (f) => fs.readFileSync(f, 'utf8');
const base = { enService: true, prenom: 'Test', quart: 'matin', heureDebut: '2026-11-24T13:05:00Z', fuseau: 'America/Martinique', missions: { total: 2, faites: 1 }, points: 3 };


// Charge les trois scripts comme un navigateur (self = fenêtre), pour que le registre d'icônes serve vraiment.
function navigateur() {
  const vm = require('vm'); const w = {}; w.self = w; w.window = w;
  vm.createContext(w);
  ['nexus-icones.js', 'nexus-accueil-piste.js', 'nexus-menu-accueil.js'].forEach((f) => vm.runInContext(lire(f), w, { filename: f }));
  return { P: w.NexusAccueilPiste, M: w.NexusMenuAccueil };
}

const garde = {
  'police : aucune Inter sur l\'Accueil employé (Plex Sans, Plex Mono pour les chiffres)': (app) => {
    assert(/#accueilPisteHote, #accueilPisteHote \*\{font-family:var\(--sans\)/.test(app));
    assert(/#accueilPisteHote \.ap-chiffre, #accueilPisteHote \.ap-fil-compte\{font-family:var\(--mono\)/.test(app));
    const bloc = app.split('\n').filter((l) => /#accueilPisteHote|\.ap-/.test(l) && !/am-marqueur/.test(l)).join('\n');
    assert(!/Inter/.test(bloc), 'Inter dans le CSS employé');
  },
  'rayon des cartes : 12 px, plus de 16 px': (app) => {
    ['ap-poste', 'ap-fil, .ap-missions', 'ap-reception'].forEach((c) => {
      const l = app.split('\n').find((x) => x.trim().indexOf('.' + c + '{') === 0);
      assert(l && /border-radius:12px/.test(l) && !/border-radius:16px/.test(l), c);
    });
  },
  'lien « Voir » : variable existante, aucune couleur en dur': (app) => {
    const l = app.split('\n').find((x) => x.indexOf('#accueilPisteHote a#apVoirMissions') > -1);
    assert(l && /color:var\(--cyan\)/.test(l) && !/color:\s*(#[0-9a-fA-F]{3,8}|rgb)/.test(l));
  },
  'nom du site : une ligne, ellipse, nom complet en title': (app) => {
    assert(/\.header-sitename\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/.test(app));
    assert(/titre\.title = site\.nom_entreprise/.test(app));
  },
  'menu ☰ : Échap ferme et rend le focus au bouton': (app) => {
    assert(/e\.key === 'Escape'[^\n]*basculer\(false\); bouton\.focus\(\)/.test(app));
    assert(/aria-expanded/.test(app));
  },
  'en-tête : aucune ligne vide de l’en-tête ne prend de place': (app) => {
    assert(/#sessionInfo:empty, #headerLive:empty\{display:none;\}/.test(app));
  },
  'accueil employé : en-tête sans hauteur minimale': (app) => {
    assert(/body\.accueil-piste \.header\{min-height:0 !important;\}/.test(app));
  },
  'renfort : « fin à » calculé aux horaires de la station, quart connu seulement': (app) => {
    assert(/roleDuJour === NexusFilCaisse\.ROLE \|\| roleDuJour === 'renfort'\) && fuseauStation && \(quartDuJour === 'matin' \|\| quartDuJour === 'soir'\)/.test(app));
  },
  'carte renfort : « fin à » présent avec l\'heure, absent sans': () => {
    const V = navigateur();
    const f = Object.assign({}, base, { roleDuJour: 'renfort', enService: true, quart: 'matin', finMinutes: 795 });
    assert(/fin à/.test(V.P.html(V.P.modele(f))), 'fin à absent');
    assert(!/fin à/.test(V.P.html(V.P.modele(Object.assign({}, f, { finMinutes: null })))), 'fin à inventé');
  },
  '« fin à » absent sans heure de fin dans les données': () => {
    const h = P.html(P.modele(Object.assign({}, base, { roleDuJour: 'pompiste' })));
    assert(!/fin à/.test(h));
  },
  'pompiste : lien « Mes missions » toujours visible, aucun bloc missions': () => {
    const h = P.html(P.modele(Object.assign({}, base, { roleDuJour: 'pompiste' })));
    assert(/id="apMesMissions"/.test(h) && !/id="apMissions"/.test(h) && !/Commencer les missions/.test(h));
  },
  'renfort : aucune entrée Inventaire, grisée ou non': () => {
    const gs = M.groupes({ enService: true, roleDuJour: 'renfort' });
    assert(!gs.some((g) => g.code === 'inventaire'));
    assert(!/mm-desactive/.test(M.html(gs)));
  },
  'carte Réception : icône de bibliothèque 24 px décorative, pas d\'emoji': () => {
    const V = navigateur();
    const h = V.P.html(V.P.modele(Object.assign({}, base, { roleDuJour: 'pompiste', receptionApplicable: true })));
    const r = (h.match(/id="apReception"[\s\S]*?<\/a>/) || [''])[0];
    assert(r, 'carte Réception absente');
    assert(/<img[^>]*alt=""[^>]*>/.test(r) && /(width|height)[=:]"?24/.test(r), 'icône 24 px décorative absente');
    assert(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(r), 'emoji');
  },
  'menu : icône 24 px alt vide devant les entrées qui en ont une, texte seul sinon': () => {
    const V = navigateur();
    const h = V.M.html(V.M.groupes({ enService: true, roleDuJour: 'pompiste', receptionApplicable: true, fermetureLien: 'x.html' }));
    assert(/data-entree="reception"[^>]*><img[^>]*alt=""/.test(h), 'icône Réception');
    assert(/data-entree="fermeture"[^>]*><span class="mm-texte"/.test(h), 'Fermeture reste en texte seul');
  },
  'manager et gérant : menu inchangé (Inventaire, Jaugeage, Index présents)': () => {
    ['manager', 'gerant'].forEach((r) => {
      const codes = [].concat(...M.groupes({ estNiveauManager: true, roleDuJour: r }).map((g) => g.entrees.map((e) => e.code)));
      ['inventaire', 'jaugeage', 'index', 'reception'].forEach((c) => assert(codes.includes(c), r + ' ' + c));
    });
  },
};

const MUT_APP = [
  ['hauteur minimale héritée', 'accueil employé : en-tête sans hauteur minimale', (s) => s.replace('body.accueil-piste .header{min-height:0 !important;}', 'body.accueil-piste .header{min-height:0;}')],
  ['lignes vides réservées', 'en-tête : aucune ligne vide de l’en-tête ne prend de place', (s) => s.replace('#sessionInfo:empty, #headerLive:empty{display:none;}', '#sessionInfo:empty, #headerLive:empty{display:block;}')],
  ['renfort sans fin', 'renfort : « fin à » calculé aux horaires de la station, quart connu seulement', (s) => s.replace("roleDuJour === NexusFilCaisse.ROLE || roleDuJour === 'renfort') && fuseauStation", "roleDuJour === NexusFilCaisse.ROLE) && fuseauStation")],
  ['Inter revenue', 'police : aucune Inter sur l\'Accueil employé (Plex Sans, Plex Mono pour les chiffres)', (s) => s.replace('#accueilPisteHote, #accueilPisteHote *{font-family:var(--sans),', "#accueilPisteHote, #accueilPisteHote *{font-family:'Inter',")],
  ['rayon 16', 'rayon des cartes : 12 px, plus de 16 px', (s) => s.replace('.ap-reception{display:flex;align-items:center;gap:12px;min-height:64px;box-sizing:border-box;padding:0 16px;border:1px solid var(--rec-bord);background:var(--rec-fond);border-radius:12px', '.ap-reception{display:flex;align-items:center;gap:12px;min-height:64px;box-sizing:border-box;padding:0 16px;border:1px solid var(--rec-bord);background:var(--rec-fond);border-radius:16px')],
  ['Voir en dur', 'lien « Voir » : variable existante, aucune couleur en dur', (s) => s.replace('.ap-voir{color:var(--cyan)', '.ap-voir{color:#4FC3D9')],
  ['title retiré', 'nom du site : une ligne, ellipse, nom complet en title', (s) => s.replace('titre.title = site.nom_entreprise', 'void 0')],
  ['Échap sans focus', 'menu ☰ : Échap ferme et rend le focus au bouton', (s) => s.replace('basculer(false); bouton.focus(); } });', 'basculer(false); } });')],
];
const MUT_JS = [
  ['lien Mes missions retiré', 'pompiste : lien « Mes missions » toujours visible, aucun bloc missions', 'nexus-accueil-piste.js', (s) => s.replace('id="apMesMissions"', 'id="apAutre"')],
  ['Inventaire renfort revenu', 'renfort : aucune entrée Inventaire, grisée ou non', 'nexus-menu-accueil.js', (s) => s.replace("role !== 'renfort'", 'true')],
  ['emoji Réception', 'carte Réception : icône de bibliothèque 24 px décorative, pas d\'emoji', 'nexus-accueil-piste.js', (s) => s.replace('iconeReception()', "'⛽'")],
  ['manager sans Index', 'manager et gérant : menu inchangé (Inventaire, Jaugeage, Index présents)', 'nexus-menu-accueil.js', (s) => s.replace("if (manager || (f.enService && !f.fermetureLien && role === 'pompiste')) carburant.push", "if (false) carburant.push")],
];

const app = lire('NEXUS-App-v1.html');
Object.keys(garde).forEach((n) => { garde[n](app); console.log('ok', n); });

// Mutations sur l'App (texte) : la garde nommée doit rougir.
MUT_APP.forEach(([nom, g, f]) => {
  const m = f(app); assert.notStrictEqual(m, app, 'mutation sans effet : ' + nom);
  let rouge = false; try { garde[g](m); } catch (e) { rouge = true; }
  assert(rouge, 'mutation survivante : ' + nom);
});
// Mutations sur les modules : on les recharge depuis une copie modifiée.
const os = require('os'), path = require('path');
MUT_JS.forEach(([nom, g, fichier, f]) => {
  const src = lire(fichier); const m = f(src); assert.notStrictEqual(m, src, 'mutation sans effet : ' + nom);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lot3-'));
  ['nexus-accueil-piste.js', 'nexus-menu-accueil.js', 'nexus-icones.js'].forEach((x) => fs.copyFileSync(x, path.join(dir, x)));
  fs.writeFileSync(path.join(dir, fichier), m);
  const code = `const assert=require('assert');const fs=require('fs');const lire=(f)=>fs.readFileSync(f,'utf8');const P=require('./nexus-accueil-piste.js');const M=require('./nexus-menu-accueil.js');\n${navigateur.toString()}\nconst base=${JSON.stringify(base)};const garde={'x':${garde[g].toString()}};garde.x();`;
  fs.writeFileSync(path.join(dir, 'run.js'), code);
  let rouge = false;
  try { require('child_process').execFileSync(process.execPath, ['run.js'], { cwd: dir, stdio: 'pipe' }); } catch (e) { rouge = true; }
  fs.rmSync(dir, { recursive: true, force: true });
  assert(rouge, 'mutation survivante : ' + nom);
});
console.log('Lot 3 mobile : gardes et mutations OK');
