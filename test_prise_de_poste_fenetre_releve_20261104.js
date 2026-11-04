// Fenêtre de relève de la prise de poste (Guardian #160, choix 2 de Frédéric, 04/11/2026).
// Cas Kecy/Terry : arrivée à 12 h 29 pour le quart 2, rangée au quart 1 par l'horloge.
// Contrat gardé ici, sans réseau (NexusStation réel, seul le réseau est simulé) :
//  - de 30 min avant le quart 2 à 30 min après la fin du quart 1 : DEUX cartes, rien d'autre ;
//  - hors fenêtre, ou avec un quart planifié : comportement inchangé ;
//  - « Je finis le quart 1 » avec un service du quart 1 en cours : AUCUNE écriture, retour accueil ;
//  - bornes lues dans station_config.horaires (jours étendus compris), aucune heure en dur.
// Chaque garde est suivie d'une mutation qui doit la faire rougir.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const MOD = lire('nexus-prise-de-poste.js');
const STATION = lire('nexus-station.js');

const HORAIRES = { quart1: { normal: '05:30', etendu: '05:30', fin_normal: '12:45', fin_etendu: '13:45' },
                   quart2: { normal: '12:40', etendu: '13:40', fin_normal: '21:00', fin_etendu: '22:00' } };
const TZ = 'America/Martinique'; // UTC-4, sans changement d'heure

// `hhmm` : heure locale de la station. 2026-11-04 = mercredi (normal), 2026-11-05 = jeudi (étendu).
function instant(jour, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return Date.parse(`${jour}T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
}

async function ouvrir({ mod = MOD, station = STATION, jour = '2026-11-04', hhmm, planifie = null, serviceEnCours = false, horaires = HORAIRES, bascule = null }) {
  const ecritures = [];
  const aller = [];
  const fixe = instant(jour, hhmm);
  class DateFixe extends Date { constructor(...a) { if (a.length) super(...a); else super(fixe); } static now() { return fixe; } }
  const noeuds = {};
  const win = {};
  const ctx = {
    window: win, Date: DateFixe,
    nexusServiceCourant: async () => (serviceEnCours ? { service: { id: 'sh-1', quart: 'matin' } } : { service: null }), Intl, console: { warn() {}, error() {}, log() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} } },
    nexusClient: {
      rpc: async (nom, args) => { if (nom !== 'poste_le_plus_frequent') ecritures.push({ nom, args }); return { data: { ok: true }, error: null }; },
      from: table => {
        const b = { select: () => b, eq: () => b, limit: () => b, order: () => b,
          maybeSingle: async () => ({ data: table === 'station_config' ? { horaires } : null, error: null }),
          then: res => res({ data: table === 'shifts' && serviceEnCours ? [{ id: 'sh-1' }] : [], error: null }) };
        return b;
      },
    },
  };
  ctx.window.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(station, ctx);
  const reel = win.NexusStation || ctx.NexusStation;
  ctx.NexusStation = Object.assign({}, reel, {
    fuseauDeLaStation: async () => ({ timezone: TZ }),
    seuilDeBascule: async () => ({ indetermine: false, minutes: bascule === null ? (jour === '2026-11-05' ? 13 * 60 + 40 : 12 * 60 + 40) : bascule }),
    quartPlanifie: async () => planifie,
  });
  vm.runInContext(mod, ctx);
  const hote = { innerHTML: '', querySelectorAll: sel => {
    const re = /data-choix="(matin|soir)"/g; const l = []; let r;
    if (sel === '.pdp-releve') while ((r = re.exec(hote.innerHTML))) { const n = { dataset: { choix: r[1] }, addEventListener: (_, f) => { n.clic = f; }, style: {} }; l.push(n); noeuds[r[1]] = n; }
    else return [{ style: {}, dataset: {}, addEventListener() {} }];
    return l; } };
  const employee = { id: 'emp-1', nom: 'Kecy', site_id: 's', role: 'pompiste' };
  await win.NexusPriseDePoste.monter(hote, employee, { aller: d => aller.push(d) });
  return { get html() { return hote.innerHTML; }, ecritures, aller, noeuds, win };
}
const deuxCartes = h => /id="pdpReleve"/.test(h) && /Je finis le quart 1/.test(h) && /Je commence le quart 2/.test(h);

(async () => {
  let ok = 0;
  const verifier = (c, msg) => { assert.ok(c, msg); console.log('OK  —', msg); ok++; };

  async function epreuves(mod, station) {
    const R = {};
    R.avant = await ouvrir({ mod, station, hhmm: '12:09' });
    R.debut = await ouvrir({ mod, station, hhmm: '12:10' });
    R.kecy = await ouvrir({ mod, station, hhmm: '12:29' });
    R.fin = await ouvrir({ mod, station, hhmm: '13:14' });
    R.apres = await ouvrir({ mod, station, hhmm: '13:15' });
    R.planifie = await ouvrir({ mod, station, hhmm: '12:29', planifie: 'quart2' });
    R.etenduDedans = await ouvrir({ mod, station, jour: '2026-11-05', hhmm: '14:14' });
    R.etenduAvant = await ouvrir({ mod, station, jour: '2026-11-05', hhmm: '13:09' });
    R.etenduApres = await ouvrir({ mod, station, jour: '2026-11-05', hhmm: '14:15' });
    return R;
  }
  const lecture = R => ({
    avant: !deuxCartes(R.avant.html), debut: deuxCartes(R.debut.html), kecy: deuxCartes(R.kecy.html),
    fin: deuxCartes(R.fin.html), apres: !deuxCartes(R.apres.html), planifie: !deuxCartes(R.planifie.html),
    etendu: deuxCartes(R.etenduDedans.html) && !deuxCartes(R.etenduAvant.html) && !deuxCartes(R.etenduApres.html),
  });

  const R = await epreuves(MOD, STATION);
  const L = lecture(R);
  verifier(L.avant, '12:09 : pas de choix, quart 1 automatique (écran des postes)');
  verifier(L.debut, '12:10 : début de fenêtre, deux cartes');
  verifier(L.kecy, '12:29 (cas Kecy) : deux cartes');
  verifier(L.fin, '13:14 : encore dans la fenêtre');
  verifier(L.apres, '13:15 : fin de fenêtre, quart 2 automatique');
  verifier(L.planifie, 'quart planifié : priorité au planning, pas de choix');
  verifier(L.etendu, 'jeudi à horaires étendus : fenêtre 13:10–14:15 calculée depuis les réglages');
  verifier(/jusqu'à 12 h 45/.test(R.kecy.html) && /à partir de 12 h 40/.test(R.kecy.html), 'sous-titres : « jusqu\'à 12 h 45 » / « à partir de 12 h 40 »');
  verifier(/jusqu'à 13 h 45/.test(R.etenduDedans.html) && /à partir de 13 h 40/.test(R.etenduDedans.html), 'sous-titres suivent les horaires étendus');
  verifier(!/<p/.test(R.kecy.html) && !/pdp-securite|rappelSecurite/.test(R.kecy.html), 'aucun paragraphe, deux cartes et rien d\'autre');
  verifier(R.kecy.ecritures.length === 0, 'le montage de l\'écran n\'écrit rien');

  // Le choix part dans shifts.quart via l'unique RPC.
  { const r = await ouvrir({ hhmm: '12:29' });
    await r.noeuds.soir.clic();
    verifier(!deuxCartes(r.html) && r.ecritures.length === 0, '« Je commence le quart 2 » ouvre le choix du poste, toujours sans écriture');
  }

  // « Je finis » avec service en cours : aucune écriture, accueil.
  { const r = await ouvrir({ hhmm: '12:39', serviceEnCours: true });
    await r.noeuds.matin.clic();
    verifier(r.ecritures.length === 0, '« Je finis » + service du quart 1 en cours : aucune écriture (ni clôture ni ouverture)');
    verifier(r.aller.length === 1 && r.aller[0] === 'NEXUS-App-v1.html', '… et retour à l\'accueil'); }
  // « Je finis » sans service en cours : on poursuit vers le choix du poste.
  { const r = await ouvrir({ hhmm: '12:39', serviceEnCours: false });
    await r.noeuds.matin.clic();
    verifier(r.aller.length === 0 && !deuxCartes(r.html), '« Je finis » sans service en cours : choix du poste, pas de renvoi'); }

  // Mutations.
  const muts = [
    ['fenêtre sans marge avant', MOD, STATION.replace('const debut = minutesBascule - marge;', 'const debut = minutesBascule;'), 'kecy'],
    ['fin de fenêtre sans marge', MOD, STATION.replace('const fin = finQuart1Minutes + marge;', 'const fin = finQuart1Minutes;'), 'fin'],
    ['fenêtre en dur (12:10–13:15)', MOD, STATION.replace('const debut = minutesBascule - marge;', 'const debut = 730;').replace('const fin = finQuart1Minutes + marge;', 'const fin = 795;'), 'etendu'],
    ['planning ignoré', MOD.replace('if (!FENETRE_RELEVE_PDP || QUART_PLANIFIE_PDP || !FUSEAU_STATION_PDP) return false;', 'if (!FENETRE_RELEVE_PDP || !FUSEAU_STATION_PDP) return false;'), STATION, 'planifie'],
    ['bornes mal comparées (fin incluse)', MOD, STATION.replace('minutes >= fenetre.debut && minutes < fenetre.fin', 'minutes >= fenetre.debut && minutes <= fenetre.fin'), 'apres'],
  ];
  for (const [nom, mod, station, cle] of muts) {
    assert.notStrictEqual(mod + station, MOD + STATION, 'mutation sans effet : ' + nom);
    const m = lecture(await epreuves(mod, station));
    assert.ok(!m[cle], `mutation non détectée : ${nom}`);
    console.log('OK  — mutation détectée :', nom); ok++;
  }
  { const mod = MOD.replace("if (CHOIX_RELEVE_PDP === 'matin' && await serviceQuart1EnCours()) {", "if (false) {");
    assert.notStrictEqual(mod, MOD);
    const r = await ouvrir({ mod, hhmm: '12:39', serviceEnCours: true });
    await r.noeuds.matin.clic();
    assert.ok(r.aller.length === 0, 'mutation « finis » non détectée');
    console.log('OK  — mutation détectée : « Je finis » ne renvoie plus à l\'accueil'); ok++; }
  { const mod = MOD.replace("if (CHOIX_RELEVE_PDP && !QUART_PLANIFIE_PDP) return CHOIX_RELEVE_PDP;", '');
    assert.notStrictEqual(mod, MOD);
    assert.ok(!/CHOIX_RELEVE_PDP && !QUART_PLANIFIE_PDP\) return/.test(mod));
    console.log('OK  — mutation détectée : le choix n\'est plus honoré par quartDuMoment'); ok++; }
  verifier(/if \(CHOIX_RELEVE_PDP && !QUART_PLANIFIE_PDP\) return CHOIX_RELEVE_PDP;/.test(MOD), 'quartDuMoment honore le choix (hors planning)');

  console.log(`\n${ok} vérifications`);
})().catch(e => { console.error(e); process.exit(1); });
