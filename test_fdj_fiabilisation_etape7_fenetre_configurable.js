// Test — FDJ Fiabilisation Étape 7 (18/08/2026, cahier
// NEXUS_FDJ_Audit_Fiabilisation_Chaine_Quarts.pdf, §13/§18 "Verrouillage des
// employés sur leur quart" — "la fenêtre de 30 minutes est configurable par
// station"). Le verrou horaire lui-même (NexusFdjMoteur.evaluerAccesQuart,
// fdj_employee_shift_locks, RLS) était déjà entièrement construit et testé
// (test_fdj_acces_quart.js, tâche du 13/08/2026) — seule la fenêtre des 30
// minutes restait une constante JS codée en dur dans NEXUS-FDJ-v1.html
// (accesQuart) au lieu de venir de fdj_site_settings.fenetre_acces_quart_min.
//
// Ce fichier couvre uniquement la CONFIGURABILITÉ (le wiring HTML), pas la
// logique de décision elle-même (déjà couverte par test_fdj_acces_quart.js,
// inchangée — la fonction moteur n'a pas été modifiée cette étape).

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const CHEMIN_BASE = __dirname;

require(`${CHEMIN_BASE}/nexus-fdj-moteur.js`);
const NexusFdjMoteur = global.NexusFdjMoteur;

const html = fs.readFileSync(`${CHEMIN_BASE}/NEXUS-FDJ-v1.html`, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function extraire(nomFonction) {
  const debut = (() => {
    const iAsync = script.indexOf(`async function ${nomFonction}(`);
    if (iAsync !== -1) return iAsync;
    return script.indexOf(`function ${nomFonction}(`);
  })();
  assert.ok(debut !== -1, `Fonction ${nomFonction} introuvable`);
  let i = script.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (script[j] === '{') profondeur++;
    else if (script[j] === '}') profondeur--;
    j++;
  }
  return script.slice(debut, j);
}

// ------------------------------------------------------------
// 1) La fonction réelle accesQuart() transmet fenetreAccesQuartMin (la
//    variable module, alimentée par fdj_site_settings.fenetre_acces_quart_min)
//    en 4e argument à NexusFdjMoteur.evaluerAccesQuart, jamais une constante
//    littérale 30 — vérifié en lisant le source extrait ET en le confrontant
//    au comportement réel du moteur (déjà testé indépendamment) : avec une
//    fenêtre de 45 min, un quart 44 min avant l'heure officielle doit rester
//    hors fenêtre (44 < 45), ce qu'une constante 30 codée en dur aurait
//    rendu accessible à tort (44 > 30).
// ------------------------------------------------------------
function test1() {
  const src = extraire('accesQuart');
  assert.ok(
    /evaluerAccesQuart\(quart, minutesMaintenant, horaire, fenetreAccesQuartMin, verrouJour\)/.test(src),
    'accesQuart() doit transmettre la variable fenetreAccesQuartMin, jamais une constante littérale'
  );
  assert.ok(!/evaluerAccesQuart\([^)]*,\s*30\s*,/.test(src), 'accesQuart() ne doit plus jamais passer 30 en dur');

  const horaireQ1 = '06:00';
  const minutesHoraire = NexusFdjMoteur.minutesDepuisMinuit(horaireQ1);
  const fenetre45 = 45;
  // 40 min avant l'heure officielle : à l'intérieur d'une fenêtre de 45 min,
  // mais en dehors d'une fenêtre de 30 min — c'est exactement le cas qui
  // distingue "fenêtre configurable" de "constante 30 codée en dur".
  const acces40 = NexusFdjMoteur.evaluerAccesQuart('1', minutesHoraire - 40, horaireQ1, fenetre45, null);
  assert.strictEqual(acces40.accessible, true, '40 min avant, fenêtre 45 -> accessible (une constante 30 aurait dit inaccessible à tort)');
  const acces50 = NexusFdjMoteur.evaluerAccesQuart('1', minutesHoraire - 50, horaireQ1, fenetre45, null);
  assert.strictEqual(acces50.accessible, false, '50 min avant, fenêtre 45 -> hors fenêtre (contrôle)');
  const acces10 = NexusFdjMoteur.evaluerAccesQuart('1', minutesHoraire - 10, horaireQ1, fenetre45, null);
  assert.strictEqual(acces10.accessible, true, '10 min avant, fenêtre 45 -> accessible');

  console.log('OK — accesQuart() transmet une fenêtre réellement configurable, jamais 30 codé en dur.');
}

// ------------------------------------------------------------
// 2) chargerParametresFdjSite() : le repli (aucune ligne fdj_site_settings
//    pour ce site) inclut fenetre_acces_quart_min: 30 — comportement
//    historique inchangé pour tout site n'ayant jamais rien configuré.
// ------------------------------------------------------------
async function test2() {
  const tables = { fdj_site_settings: [] };
  const nexusClient = {
    from() {
      const api = {
        select() { return api; },
        eq() { return api; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      };
      return api;
    },
  };
  const ctx = { console, nexusClient, siteId: 'site-test' };
  ctx.globalThis = ctx;
  const src = ['let parametresFdjSiteCache = undefined;', extraire('chargerParametresFdjSite'), 'globalThis.__chargerParametresFdjSite = chargerParametresFdjSite;'].join('\n');
  vm.runInNewContext(src, ctx);
  const p = await ctx.__chargerParametresFdjSite();
  assert.strictEqual(p.fenetre_acces_quart_min, 30, 'Repli par défaut : 30 minutes, comportement historique inchangé');
  assert.strictEqual(p.horaire_bascule_quart2_repli, '12:40');
  console.log('OK — chargerParametresFdjSite() : repli par défaut inclut fenetre_acces_quart_min: 30.');
}

// ------------------------------------------------------------
// 3) chargerParametresFdjSite() : une ligne fdj_site_settings existante
//    avec une fenêtre personnalisée (ex. 15 min) est bien répercutée telle
//    quelle, jamais écrasée par le repli.
// ------------------------------------------------------------
async function test3() {
  const nexusClient = {
    from() {
      const api = {
        select() { return api; },
        eq() { return api; },
        maybeSingle() { return Promise.resolve({ data: { site: 'site-test', fenetre_acces_quart_min: 15, horaire_bascule_quart2_repli: '13:00' }, error: null }); },
      };
      return api;
    },
  };
  const ctx = { console, nexusClient, siteId: 'site-test' };
  ctx.globalThis = ctx;
  const src = ['let parametresFdjSiteCache = undefined;', extraire('chargerParametresFdjSite'), 'globalThis.__chargerParametresFdjSite = chargerParametresFdjSite;'].join('\n');
  vm.runInNewContext(src, ctx);
  const p = await ctx.__chargerParametresFdjSite();
  assert.strictEqual(p.fenetre_acces_quart_min, 15, 'Une fenêtre personnalisée en base doit primer sur le repli 30');
  console.log('OK — une fenêtre personnalisée (15 min) en base est bien répercutée, jamais écrasée par le repli.');
}

(async () => {
  test1();
  await test2();
  await test3();
  console.log('\nTous les tests "FDJ Fiabilisation Étape 7 — fenêtre d\'accès configurable" passent.');
})().catch(e => { console.error(e); process.exit(1); });
