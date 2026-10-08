// Épreuve — 08/10/2026, mandat consolidé §5 (audit e60d1d82, 07/10 Q2) :
// la piste, ramenée de −5,00 € à 0,00 €, n'était pas validable.
//   1. Un clic dans le détail déplié (menu « Pourquoi cet écart ? »,
//      champ, bouton) remontait au gestionnaire de la carte et la repliait.
//   2. Un écart ramené à 0,00 € exigeait un motif, et l'alerte native
//      bloquait la validation.
// Exigences : piste et boutique se valident indépendamment, dans les deux
// ordres, sans réinitialisation croisée ; aucune cause inventée à 0,00 €.
//
// Le code est extrait du vrai NEXUS-Verify-v1.html et exécuté contre une
// ligne en mémoire : la preuve porte sur ce que l'écran écrit réellement.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'NEXUS-Verify-v1.html'), 'utf8');
const ecartsMoteurSrc = fs.readFileSync(path.join(DIR, 'nexus-ecarts-moteur.js'), 'utf8');
const verifyMoteurSrc = fs.readFileSync(path.join(DIR, 'nexus-verify-moteur.js'), 'utf8');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

function extraireBloc(source, debutMotif) {
  const debut = source.indexOf(debutMotif);
  assert.ok(debut !== -1, `Introuvable : ${debutMotif}`);
  assert.strictEqual(source.indexOf(debutMotif, debut + 1), -1, `Ancre non unique : ${debutMotif}`);
  let i = source.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (source[j] === '{') profondeur++;
    else if (source[j] === '}') profondeur--;
    j++;
  }
  return source.slice(debut, j);
}

// Le gestionnaire de la carte : `el.querySelectorAll('.histo-item').forEach(item => { ... });`
function extraireListenerCarte() {
  const ancre = "el.querySelectorAll('.histo-item').forEach(item => {";
  const bloc = extraireBloc(html, ancre);
  return bloc + ');';
}

// --- Faux DOM minimal -------------------------------------------------
function fabriquerDom() {
  const parId = new Map();
  const tous = [];
  function element({ id = null, classes = [], parent = null, dataset = {}, value = '' } = {}) {
    const ecouteurs = {};
    const classSet = new Set(classes);
    const el = {
      id, parent, dataset, value, disabled: false, textContent: '', innerHTML: '',
      classList: {
        toggle(c) { classSet.has(c) ? classSet.delete(c) : classSet.add(c); },
        contains(c) { return classSet.has(c); },
        add(c) { classSet.add(c); },
      },
      addEventListener(type, fn) { (ecouteurs[type] = ecouteurs[type] || []).push(fn); },
      async declencher(type, cible) {
        // Propagation montante, comme le navigateur.
        let courant = el;
        const evt = { target: cible || el, stopped: false, stopPropagation() { this.stopped = true; } };
        while (courant && !evt.stopped) {
          for (const fn of (courant._ecouteurs()[type] || [])) await fn(evt);
          courant = courant.parent;
        }
      },
      _ecouteurs() { return ecouteurs; },
      _classes: classSet,
      closest(selecteur) {
        const c = selecteur.replace(/^\./, '');
        let courant = el;
        while (courant) { if (courant._classes.has(c)) return courant; courant = courant.parent; }
        return null;
      },
    };
    if (id) parId.set(id, el);
    tous.push(el);
    return el;
  }
  const document = {
    getElementById: (id) => parId.get(id) || null,
    querySelectorAll(sel) {
      if (sel === '.histo-item') return tous.filter(e => e._classes.has('histo-item'));
      if (sel === '.btn-valider-audit') return tous.filter(e => e._classes.has('btn-valider-audit'));
      const m = sel.match(/^\[id\^="([^"]+)"\]$/);
      if (m) return tous.filter(e => e.id && e.id.startsWith(m[1]));
      throw new Error('Sélecteur non simulé : ' + sel);
    },
  };
  return { element, document };
}

// Une carte d'historique dépliée avec ses deux formulaires de validation.
function construireCarte(dom, idx, audit) {
  const item = dom.element({ classes: ['histo-item'], dataset: { idx: String(idx) } });
  const entete = dom.element({ classes: ['histo-entete'], parent: item });
  const detail = dom.element({ id: `detail-${idx}`, classes: ['histo-detail', 'open'], parent: item });
  const controles = {};
  for (const type of ['piste', 'boutique']) {
    const form = dom.element({ id: `validationForm-${idx}-${type}`, classes: ['open'], parent: detail });
    const brut = audit[`ecart_${type}`];
    const origine = audit[`ecart_${type}_origine`];
    const input = dom.element({ id: `val-${type}-${idx}`, parent: form, value: String(brut).replace('.', ','),
      dataset: { origine: origine == null ? '' : String(origine) } });
    const select = dom.element({ id: `causeCode-${type}-${idx}`, parent: form, value: '' });
    const commentaire = dom.element({ id: `valCommentaire-${type}-${idx}`, parent: form, value: '' });
    const btn = dom.element({ id: `btnConfirmerValidation-${type}-${idx}`, parent: form, dataset: { idx: String(idx), type } });
    controles[type] = { form, input, select, commentaire, btn };
  }
  return { item, entete, detail, controles };
}

function construireContexte(audit) {
  const dom = fabriquerDom();
  const ligne = JSON.parse(JSON.stringify(audit));
  const ecritures = [];
  const instantanes = [];
  const alertes = [];
  const ctx = {
    console, Number, String, JSON, Date, Promise, Map, Set,
    document: dom.document,
    alert: (m) => { alertes.push(m); },
    EMPLOYEE_ID: 'manager-test',
    nexusClient: {
      from(table) {
        assert.strictEqual(table, 'audits_caisse');
        return { update(patch) { return { eq(col, val) {
          assert.strictEqual(col, 'id'); assert.strictEqual(val, ligne.id);
          ecritures.push(patch); Object.assign(ligne, patch);
          return Promise.resolve({ error: null });
        } }; } };
      },
    },
    snapshotAuditAvantEcriture: async (row, action) => { instantanes.push({ action, valeurs: JSON.parse(JSON.stringify(row)) }); },
    afficherHistorique: async () => {},
    majBlocMotifValidation: () => {},
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(ecartsMoteurSrc, ctx);
  vm.runInContext(verifyMoteurSrc, ctx);
  vm.runInContext(extraireBloc(html, 'function numFR('), ctx);
  vm.runInContext(extraireBloc(html, 'function brancherValidationAudits('), ctx);
  const carte = construireCarte(dom, 0, ligne);
  // La liste `data` porte la même référence que la ligne : afficherHistorique
  // la rechargerait depuis la base, dont la ligne en mémoire tient lieu.
  ctx.__data = [ligne];
  vm.runInContext(`(function(el, data){ ${extraireListenerCarte()} })({ querySelectorAll: (s) => document.querySelectorAll(s) }, __data);`, ctx);
  vm.runInContext('brancherValidationAudits(__data);', ctx);
  ctx.chargerEtRenderVersions = () => {};
  return { ctx, ligne, carte, ecritures, instantanes, alertes };
}

// Reproduction de e60d1d82 (07/10 Q2), valeurs Production lues le 08/10.
const AUDIT_E60 = {
  id: 'e60d1d82-test', date: '2026-10-07', quart: 'Q2',
  ecart_piste: 0, ecart_piste_origine: -5, ecart_boutique: 9.34, ecart_boutique_origine: 9.34,
  valide_le_piste: null, valide_le_boutique: null, valide_le: null,
  ecart_piste_valide: null, ecart_boutique_valide: null,
};

async function principal() {
  // 1) Un clic dans le détail ne replie pas la carte ; l'en-tête, si.
  {
    const { ctx, carte } = construireContexte(AUDIT_E60);
    ctx.chargerEtRenderVersions = () => {};
    await carte.controles.piste.select.declencher('click');
    assert.ok(carte.detail.classList.contains('open'), 'un clic sur le menu « Pourquoi cet écart ? » ne doit pas replier la carte');
    await carte.controles.piste.input.declencher('click');
    assert.ok(carte.detail.classList.contains('open'), 'un clic dans le champ écart ne doit pas replier la carte');
    await carte.entete.declencher('click');
    assert.ok(!carte.detail.classList.contains('open'), "un clic sur l'en-tête replie toujours la carte");
    ok('clic dans le détail : la carte reste dépliée ; l\'en-tête plie toujours');
  }

  // 2) Ordre piste puis boutique, piste à 0,00 € sans motif.
  for (const ordre of [['piste', 'boutique'], ['boutique', 'piste']]) {
    const { ligne, carte, ecritures, alertes, instantanes } = construireContexte(AUDIT_E60);
    const [premier, second] = ordre;
    await carte.controles[premier].btn.declencher('click');
    assert.deepStrictEqual(alertes, [], `aucune alerte bloquante (${ordre.join(' puis ')}) : ` + alertes.join(' | '));
    assert.ok(ligne[`valide_le_${premier}`], `${premier} validée en premier`);
    assert.strictEqual(ligne[`valide_le_${second}`], null, `${second} pas encore validée`);
    const valideLePremier = ligne[`valide_le_${premier}`];
    await new Promise(r => setTimeout(r, 5));
    await carte.controles[second].btn.declencher('click');
    assert.deepStrictEqual(alertes, [], 'aucune alerte au second clic : ' + alertes.join(' | '));
    assert.ok(ligne[`valide_le_${second}`], `${second} validée en second`);
    assert.strictEqual(ligne[`valide_le_${premier}`], valideLePremier, `la validation ${premier} n'est pas réécrite par celle de ${second}`);
    assert.ok(!(`valide_le_${premier}` in ecritures[1]), `l'écriture ${second} ne touche pas valide_le_${premier}`);
    assert.strictEqual(ligne.ecart_piste_valide, 0, 'piste validée à 0,00 €');
    assert.strictEqual(ligne.ecart_boutique_valide, 9.34, 'boutique validée à 9,34 € (inchangée)');
    assert.strictEqual(ligne.cause_code_piste, null, 'aucune cause inventée pour la piste ramenée à 0,00 €');
    assert.strictEqual(ligne.cause_code_boutique, 'non_explique', 'écart restant boutique : « origine non identifiée », comme avant');
    assert.ok(ligne.valide_le, 'la colonne atomique est posée quand les deux caisses sont validées');
    assert.strictEqual(ecritures.length, 2, 'deux écritures, une par caisse');
    assert.deepStrictEqual(instantanes.map(i => i.action), [`validation_${premier}`, `validation_${second}`], 'un instantané historisé avant chaque validation');
    ok(`validation ${premier} puis ${second} : indépendantes, sans réinitialisation croisée, sans motif artificiel`);
  }

  // 3) La cause reste enregistrée quand le manager la choisit.
  {
    const { ligne, carte } = construireContexte(AUDIT_E60);
    carte.controles.piste.select.value = 'erreur_saisie';
    await carte.controles.piste.btn.declencher('click');
    assert.strictEqual(ligne.cause_code_piste, 'erreur_saisie', 'cause choisie conservée');
    ok('cause choisie : enregistrée telle quelle');
  }

  // 4) Le statut dérivé d'une piste ramenée à 0 sans cause est « Régularisé ».
  {
    const { ctx } = construireContexte(AUDIT_E60);
    const statut = ctx.NexusEcartsMoteur.deriverStatutEcart({ ecartInitial: -5, ecartFinal: 0, cloture: true, causeConnue: false });
    assert.strictEqual(statut, 'regularise');
    ok('sans cause, une piste ramenée à 0,00 € reste « Régularisé » dans l\'analyse des écarts');
  }

  // 5) Libellé : « remboursement » désigne le client, jamais le versement d'un employé.
  {
    const { ctx } = construireContexte(AUDIT_E60);
    const opts = ctx.NexusVerifyMoteur.motifsEcartCorrigeDisponiblesVerify(-5);
    const r = opts.find(o => o.value === 'remboursement');
    assert.ok(r && r.label === 'Remboursement client non saisi', 'libellé explicite : ' + JSON.stringify(r));
    assert.strictEqual(ctx.NexusVerifyMoteur.labelMotifEcartVerify('remboursement'), 'Remboursement client non saisi');
    ok('motif « Remboursement client non saisi », valeur stockée inchangée');
  }

  console.log(`\n${n} tests passés.`);
}

principal().catch(e => { console.error(e); process.exit(1); });
