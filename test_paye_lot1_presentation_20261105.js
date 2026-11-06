// NEXUS PAYE — lot 1 « présentation » (05/11/2026).
// Garde-fous du lot : aucune phrase « à source unique », statuts Prêt / À traiter /
// Hors paie, « Valider le salarié » désactivé tant qu'une décision est ouverte,
// aucun onglet mort, et surtout AUCUN écart d'heures ni de montant avant/après
// (la version de `HEAD` du lot est rejouée sur les mêmes données).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

function charger(html) {
  const script = html.match(/<body>[\s\S]*?<script>\n([\s\S]*?)\n<\/script><\/body>/);
  assert.ok(script, 'script inline introuvable');
  const rendu = {};
  function element(id) {
    return {
      id, hidden: true, textContent: '', value: '', checked: false, disabled: false,
      dataset: {}, style: {}, classList: { toggle() {}, add() {}, remove() {} },
      set innerHTML(v) { rendu[id] = v; this._h = v; },
      get innerHTML() { return this._h || ''; },
      querySelector: () => element('sous'), querySelectorAll: () => [],
      appendChild() {}, focus() {}, scrollIntoView() {},
      addEventListener() {}, removeEventListener() {},
    };
  }
  const ctx = {
    console,
    document: {
      getElementById: element, querySelector: () => element('q'), querySelectorAll: () => [],
      createElement: () => element('cree'), body: { appendChild() {} },
      addEventListener() {}, removeEventListener() {},
    },
    navigator: {}, nexusClient: {},
    // `URL` est fourni par le navigateur : sans lui, le garde-fou du lien
    // planning refuserait TOUT lien et le test passerait pour de mauvaises
    // raisons.
    URL,
    nexusRequireAuth: () => ({ then: () => ({ catch: () => {} }) }),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-ecarts-moteur.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-ecarts-donnees.js'), 'utf8'), ctx);
  if (!ctx.URLSearchParams) ctx.URLSearchParams = URLSearchParams;
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-banniere-station.js'), 'utf8'), ctx);
  
  vm.runInContext(script[1], ctx);
  const JOURS_E1 = ['2026-08-03', '2026-08-04', '2026-08-06', '2026-08-07'];
  const JOURS_E5 = ['2026-08-10', '2026-08-11', '2026-08-12'];
  
  ctx.__donnees = {
    periode: '2026-08-01',
    employees: [
      { id: 'e1', nom: 'Camille', role: 'pompiste', actif: true },
      { id: 'e2', nom: 'Vanessa Ribe', role: 'caissier', actif: true },
      { id: 'e3', nom: 'Angélique', role: 'renfort', actif: true },
      { id: 'e4', nom: 'Mathieu', role: 'caissier', actif: true },
      { id: 'e5', nom: 'Sofiane', role: 'pompiste', actif: true },
    ],
    settings: [
      { employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' },
      { employee_id: 'e2', inclus_paye: true, mode_presence: 'automatique' },
      { employee_id: 'e4', inclus_paye: false, mode_presence: 'exclu' },
      { employee_id: 'e5', inclus_paye: true, mode_presence: 'automatique' },
      // e3 (Angélique) : rattachement paie jamais confirmé.
    ],
    planning: [
      ...JOURS_E1.map(date => ({ employee_id: 'e1', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'piste' })),
      ...JOURS_E5.map(date => ({ employee_id: 'e5', date, quart: 'quart1', statut: 'travail_normal', duree_heures: 7, tache: 'boutique' })),
    ],
    pointages: [
      ...JOURS_E1.map(date => ({ employee_id: 'e1', date, type: 'arrivee', retard_min: date === '2026-08-04' ? 12 : 0 })),
      // Camille a aussi travaillé un jour qui n'était pas à son planning.
      { employee_id: 'e1', date: '2026-08-17', type: 'arrivee', retard_min: 0 },
      // Sofiane manque au 12 : une absence non déclarée s'ajoute à son écart.
      { employee_id: 'e5', date: '2026-08-10', type: 'arrivee', retard_min: 0 },
      { employee_id: 'e5', date: '2026-08-11', type: 'arrivee', retard_min: 0 },
    ],
    indisponibilites: [{
      id: 'i1', employee_id: 'e2', date_debut: '2026-07-21', date_fin: '2027-01-03',
      type: 'indisponible', motif: 'conge_maternite', confirme_le: '2026-07-21T09:00:00Z',
    }],
    // Écart constaté −50 €, validé −20 € : les +30 € sont une CORRECTION À LA
    // VALIDATION, pas un versement. Jusqu'au 09/10 l'écran les présentait comme
    // « Régularisations encaissées » alors qu'aucun versement n'existait
    // (0 en Production) : le défaut est corrigé et ce test l'interdit désormais.
    ecarts: [{
      id: 'ec1', employeeId: 'e5', date: '2026-08-11', activite: 'boutique', quart: 'quart1',
      sourceModule: 'verify', montantRetenu: -20, ecartInitial: -50, ecartFinal: -20,
      statut: 'valide', causeCode: 'erreur_rendu', deepLink: 'NEXUS-Verify-v1.html#ec1',
    }],
    audits: [], items: [], config: { jours_feries: ['2026-08-15'] },
  };
  
  
  vm.runInContext(`
    MOIS = '2026-08-01'; SITE = 'vito-sainte-marie';
    EMPLOYEE = { id: 'manager-1', role: 'manager' };
    RAPPORT = NexusPayeMoteur.construireRapport(__donnees);
    RAPPORT.periodeEnregistree = null;
    RAPPORT.planningOfficiel = { source: 'google_sheets', url: 'https://docs.google.com/spreadsheets/d/aout2026/edit' };
    render();
  `, ctx);
  return { ctx, rendu, html };
}

const dir = __dirname;
const apres = charger(fs.readFileSync(path.join(dir, 'NEXUS-Paye-v1.html'), 'utf8'));
let avantSrc = null;
try {
  avantSrc = execFileSync('git', ['show', 'origin/production:NEXUS-Paye-v1.html'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 });
} catch (e) { /* hors dépôt : la comparaison est sautée, dite à l'écran */ }

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}
const ev = (a, code) => vm.runInContext(code, a.ctx);
const ecran = () => apres.rendu.app || '';
const onglets = ['synthese', 'journees', 'evenements', 'variables', 'historique'];

verifier('aucune phrase « à source unique » dans le code ni à l’écran',
  !/à source unique/i.test(apres.html) && !/à source unique/i.test(ecran()));

// Statuts de la liste
ev(apres, "FILTRE='inclus'; render();");
verifier('la liste porte Prêt ou À traiter, jamais l’ancien jargon',
  /class="st (ok|todo)">(Prêt|À traiter)</.test(ecran()) && !/class="pill /.test((ecran().match(/<tr data-employee[\s\S]*?<\/tr>/g) || []).join('')));
ev(apres, "FILTRE='hors_paie'; render();");
verifier('le hors paie est lu dans son onglet, sans statut de paie',
  /Mathieu/.test(ecran()) && !/class="st (ok|todo)"[^>]*>[^<]*<\/span><\/td><\/tr>[\s\S]*Mathieu/.test(ecran()));
ev(apres, "FILTRE='inclus'; render();");

// Valider le salarié : désactivé tant qu'une décision est ouverte
const ids = ev(apres, "RAPPORT.employes.filter(f=>f.reglage.inclus).map(f=>f.employee.id)");
let vuOuvert = false, vuFerme = false;
ids.forEach(id => {
  ev(apres, `SELECTION='${id}'; FICHE_ONGLET='synthese'; render();`);
  const t = ecran() + (apres.rendu.panelInner || '');
  const m = t.match(/<button[^>]*valider-salarie[^>]*>/);
  if (!m) return;
  const aTraiter = ev(apres, `itemsEnAttente(RAPPORT.employes.find(f=>f.employee.id==='${id}')).length + bloqueursConfig('${id}').length`);
  const desactive = /\bdisabled\b/.test(m[0]);
  if (aTraiter > 0) { vuOuvert = true; verifier(`« Valider le salarié » est désactivé pour ${id} (${aTraiter} décision(s) ouverte(s))`, desactive); }
  else { vuFerme = true; verifier(`« Valider le salarié » est actif pour ${id} (aucune décision ouverte)`, !desactive); }
});
verifier('les deux cas (décision ouverte / aucune) ont été exercés', vuOuvert);

// Aucun onglet mort
ev(apres, "SELECTION='e1'; render();");
const tabs = [...new Set((ecran().match(/data-ftab="[a-z]+"/g) || []).map(x => x.slice(11, -1)))];
verifier('la fiche offre ses cinq onglets', onglets.every(o => tabs.includes(o)));
onglets.forEach(o => {
  ev(apres, `FICHE_ONGLET='${o}'; render();`);
  verifier(`l’onglet « ${o} » a un contenu`, ecran().length > 3000 && ev(apres, 'FICHE_ONGLET') === o);
});
ev(apres, "FICHE_ONGLET='synthese'; render();");

// Vocabulaire
const tout = onglets.map(o => { ev(apres, `FICHE_ONGLET='${o}'; render();`); return ecran(); }).join('\n');
verifier('le vocabulaire Constatée / Calculée / Corrigée est employé', /constatée/.test(tout) && /Constatée/.test(apres.html) && /Calculée/.test(apres.html) && /Corrigée/.test(apres.html));

// Avant / après : mêmes heures, mêmes montants
if (avantSrc) {
  const avant = charger(avantSrc);
  const empreinte = a => ev(a, `JSON.stringify(RAPPORT.employes.map(f => ({
    id: f.employee.id, statut: f.statut,
    v: NexusPayeMoteur.variablesComptables(f),
    h: f.reglage.inclus ? libelleHeures(NexusPayeMoteur.variablesComptables(f)) : null,
    attente: itemsEnAttente(f).length
  })).concat([RAPPORT.synthese]))`);
  const a = empreinte(avant), b = empreinte(apres);
  verifier('heures, montants et statuts identiques avant / après sur les données de test', a === b);
  verifier('l’export comptable est identique avant / après',
    ev(avant, 'JSON.stringify(NexusPayeMoteur.lignesExport(RAPPORT))') === ev(apres, 'JSON.stringify(NexusPayeMoteur.lignesExport(RAPPORT))'));
} else {
  console.log('SKIP — comparaison avant / après (git indisponible)');
}

// ── Corrections du Guardian (#160, 6671839139 et 6671871777) ─────────────────
const src = apres.html;
verifier('ancienne barre du haut retirée (appbar)', !/<header class="appbar"/.test(src));
verifier('« 1 réglage à compléter » avec bouton Configurer, plus de « décision à prendre » pour le rattachement',
  /réglage(s)? à compléter : rattachement à la paie/.test(src) && /btn primary configure/.test(src));
verifier('Transmettre à la comptabilité désactivé tant que des salariés sont à traiter, avec la raison',
  /Transmettre[^`]*?\$\{[^}]*à traiter/.test(src) || /à traiter<\/|à traiter\)/.test(src));
verifier('formats d’heures sans « .00 »', ev(apres, "hFr(0)") === '0 h' && ev(apres, "hFr(21)") === '21 h' && ev(apres, "hFr(7.5)") === '7,5 h');
verifier('variables € : message vide dédié', /Aucune variable ce mois/.test(src) && /function tuilesFiche/.test(src));
verifier('icônes SVG (plus d’emoji caisse / pompe / renfort)', !/[🏪⛽🛒🔧💼]/u.test(src));
verifier('la fiche n’a plus qu’une zone de défilement (le tableau)', (src.match(/-webkit-overflow-scrolling:touch/g) || []).length === 1);
// Photo de l'Accueil : module partagé, plus l'ancienne photo de Paye
verifier('la photo suit le module partagé de l’Accueil', /NexusBanniereStation\.html\(/.test(src) && /NexusBanniereStation\.suivreTheme\(/.test(src) && /nexus-banniere-station\.js/.test(src));
verifier('l’ancienne photo de Paye est retirée', !/station-crepuscule/.test(src)
  && !fs.existsSync(path.join(__dirname, 'assets/paye/station-crepuscule.webp')));
verifier('photo de jour et de nuit, mêmes fichiers que l’Accueil', ['', '-nuit'].every(n => [800, 1200, 1600].every(w =>
  fs.existsSync(path.join(__dirname, `assets/accueil/accueil-station-vito${n}-${w}.webp`)))));
const B = require('./nexus-banniere-station.js');
verifier('bannière : Sainte-Marie oui, autre site non, aperçu Test seulement avec le paramètre',
  B.html('vito-sainte-marie', { sizes: '100vw' }).includes('am-banniere') && B.html('autre-site', { sizes: '100vw' }) === ''
  && B.html('nexus-station-test', { sizes: '100vw' }) === '' && B.html('nexus-station-test', { apercu: true, sizes: '100vw' }).includes('am-banniere'));
verifier('le fondu est coupé sous mouvement réduit', /prefers-reduced-motion:reduce\)\{\.hero-haut>\.am-banniere img\.am-fondu\{transition:none/.test(src));
verifier('boutons d\u2019action sous le titre, hors de la photo', /<div class="hero-haut">[\s\S]*?<\/div><\/div><\/div>\s*<div class="topacts">/.test(src) && !/\.hero::after/.test(src));
verifier('photo fondue sur tous les bords (masque horizontal x vertical, sans bordure ni ombre)',
  /\.hero-haut>\.am-banniere\{[^}]*mask-image:linear-gradient\(to right,transparent 0%,#000 45%[^}]*to bottom[^}]*mask-composite:intersect/.test(src)
  && /-webkit-mask-composite:source-in/.test(src) && !/\.am-banniere\{[^}]*(box-shadow|border)/.test(src));
verifier('un seul nombre « à traiter » (salariés inclus - prêts), hors réglages hors-paie', /const dec=Math\.max\(0,s\.salariesInclus-s\.salariesPrets\)/.test(src));
verifier('« 0 h » reste en minuscule dans les indicateurs', /button\.kpi span b,button\.kpi span small\{text-transform:none\}/.test(src));
verifier('un seul bouton Configurer dans la fiche quand la zone de décision le porte', /\$\{reglage\?'':`<button class="btn configure"/.test(src));

console.log(`\n${ok} contrôles passent.`);
