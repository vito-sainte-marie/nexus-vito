// Rappel sécurité de la prise de poste : une fois par jour et par employé
// (décision de Frédéric, 25/10/2026). Mémoire sur l'appareil (localStorage),
// jamais en base ; stockage absent => on affiche. Texte inchangé.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, 'nexus-prise-de-poste.js'), 'utf8');

async function ouvrir({ source = SRC, stockage, jour, employe = 'emp-1', fenetre = null }) {
  const ecritures = [];
  const win = fenetre || {};
  win.localStorage = stockage;
  const noeud = { style: {}, addEventListener() {}, dataset: {} };
  const ctx = {
    window: win, console: { warn() {}, error() {}, log() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} } },
    NexusStation: {
      fuseauDeLaStation: async () => ({ timezone: 'America/Martinique' }),
      seuilDeBascule: async () => ({ indetermine: false, minutes: 780 }),
      quartPlanifie: async () => null,
      dateLocaleStation: () => jour.valeur,
      minutesLocalesStation: () => 600,
      quartDuJour: () => ({ quart: 'quart1' }),
    },
    nexusClient: {
      rpc: async () => ({ data: [], error: null }),
      from: () => { ecritures.push('from'); throw new Error('aucune écriture en base attendue'); },
    },
  };
  ctx.window.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const hote = { innerHTML: '', querySelectorAll: () => [noeud, noeud, noeud] };
  await win.NexusPriseDePoste.monter(hote, { id: employe, nom: 'Test', site_id: 's', role: 'pompiste' });
  return { html: hote.innerHTML, ecritures };
}

function faireStockage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
const aRappel = h => /id="rappelSecurite"/.test(h) && /Strictement interdit sur la piste/.test(h);

(async () => {
  let ok = 0;
  const verifier = (c, msg) => { assert.ok(c, msg); console.log('OK  —', msg); ok++; };

  async function epreuves(source, etiquette) {
    const st = faireStockage(); const jour = { valeur: '2026-10-25' };
    const r1 = await ouvrir({ source, stockage: st, jour });
    const r2 = await ouvrir({ source, stockage: st, jour });
    jour.valeur = '2026-10-26';
    const r3 = await ouvrir({ source, stockage: st, jour });
    return { r1: aRappel(r1.html), r2: aRappel(r2.html), r3: aRappel(r3.html), st, ecritures: r1.ecritures.concat(r2.ecritures, r3.ecritures) };
  }

  const R = await epreuves(SRC);
  verifier(R.r1, 'première ouverture du jour : rappel affiché');
  verifier(!R.r2, 'deuxième ouverture le même jour : rappel absent');
  verifier(R.r3, 'lendemain : rappel de nouveau affiché');
  verifier(R.ecritures.length === 0, 'aucune écriture en base');
  verifier([...R.st.m.keys()].every(k => /^nexus_rappel_securite_emp-1_2026-10-2[56]$/.test(k)) && R.st.m.size === 2, 'clé = employé + jour de la station');

  // Un autre employé, même appareil, même jour : son propre rappel.
  { const st = faireStockage(); const jour = { valeur: '2026-10-25' };
    await ouvrir({ stockage: st, jour, employe: 'emp-1' });
    const autre = await ouvrir({ stockage: st, jour, employe: 'emp-2' });
    verifier(aRappel(autre.html), 'un autre employé voit son propre rappel'); }

  // Stockage indisponible : on affiche.
  { const jour = { valeur: '2026-10-25' };
    const casse = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); } };
    verifier(aRappel((await ouvrir({ stockage: casse, jour })).html), 'stockage qui lève : rappel affiché');
    verifier(aRappel((await ouvrir({ stockage: undefined, jour })).html), 'stockage absent : rappel affiché'); }

  // Mutations : chaque comportement est tenu par une ligne précise.
  const muts = {
    'mémoire ignorée (toujours affiché)': SRC.replace("if (global.localStorage.getItem(cle)) return false;", ''),
    'jamais ré-affiché le lendemain (clé sans jour)': SRC.replace("'_' + NexusStation.dateLocaleStation(FUSEAU_STATION_PDP)", "'_jour'"),
    'doute => masqué': SRC.replace("} catch (e) { return true; }\n    try { global.localStorage.setItem", "} catch (e) { return false; }\n    try { global.localStorage.setItem"),
    'rien mémorisé': SRC.replace("global.localStorage.setItem(cle, '1');", ''),
  };
  for (const [nom, src] of Object.entries(muts)) {
    assert.notStrictEqual(src, SRC, 'mutation sans effet : ' + nom);
    let rouge = false;
    try {
      const m = await epreuves(src);
      rouge = !(m.r1 && !m.r2 && m.r3);
      if (nom === 'doute => masqué') {
        const jour = { valeur: '2026-10-25' };
        const casse = { getItem() { throw new Error('x'); }, setItem() {} };
        rouge = !aRappel((await ouvrir({ source: src, stockage: casse, jour })).html);
      }
    } catch (e) { rouge = true; }
    verifier(rouge, 'mutation rougit : ' + nom);
  }
  console.log(`\n${ok} vérifications passées.`);
})().catch(e => { console.error(e); process.exit(1); });
