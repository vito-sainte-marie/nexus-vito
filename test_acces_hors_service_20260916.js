// ============================================================================
// L'AUTHENTIFICATION N'EST JAMAIS UNE PREUVE DE PRÉSENCE (16/09/2026)
//
// Ce que cette épreuve garde. Jusqu'au 16/09, `nexusRequireAuth()` renvoyait
// vers la prise de poste QUELLE QUE SOIT la page demandée, dès qu'il n'y
// avait pas de service ouvert. Un employé qui voulait relire ses écarts
// validés devait donc d'abord ouvrir un service : la consultation fabriquait
// la présence. La garde n'était pas mal placée — elle est centralisée depuis
// S-4 — elle était trop LARGE.
//
// La correction a deux moitiés, et une seule d'entre elles serait pire que
// rien : la consultation est libérée, l'opérationnel reste gardé. Les deux
// moitiés sont éprouvées ici.
//
// Comment. Le bloc de règle et les deux portes sont EXTRAITS de
// nexus-auth.js et exécutés tels quels dans un contexte vm — jamais réécrits
// à la main. Une épreuve qui rejouerait sa propre copie de la règle serait
// verte pour la mauvaise raison le jour où la règle réelle changerait.
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const RACINE = __dirname;
const AUTH = fs.readFileSync(path.join(RACINE, 'nexus-auth.js'), 'utf8');

function extraire(nom) {
  let debut = AUTH.indexOf(`async function ${nom}(`);
  if (debut === -1) debut = AUTH.indexOf(`function ${nom}(`);
  assert.ok(debut !== -1, `fonction ${nom} introuvable dans nexus-auth.js`);
  let i = AUTH.indexOf('{', debut);
  let profondeur = 1, j = i + 1;
  while (profondeur > 0) {
    if (AUTH[j] === '{') profondeur++;
    else if (AUTH[j] === '}') profondeur--;
    j++;
  }
  return AUTH.slice(debut, j);
}

const D = AUTH.indexOf('/* NEXUS-ACCES-REGLE:DEBUT');
const F = AUTH.indexOf('/* NEXUS-ACCES-REGLE:FIN */');
assert.ok(D !== -1 && F > D, 'le bloc de règle d\'accès a disparu de nexus-auth.js');
const BLOC = AUTH.slice(D, F);

// Le bloc seul, exécuté hors navigateur : il est PUR par construction.
function chargerRegle() {
  const ctx = { console };
  vm.runInNewContext(
    BLOC + '\nthis.nexusCategorieAcces = nexusCategorieAcces;' +
           '\nthis.nexusPageExigeServiceOperationnel = nexusPageExigeServiceOperationnel;' +
           '\nthis.LISTES = { sequence: NEXUS_PAGES_SEQUENCE_OBLIGATOIRE, consultation: NEXUS_PAGES_CONSULTATION,' +
           ' operationnel: NEXUS_PAGES_OPERATIONNELLES, publique: NEXUS_PAGES_PUBLIQUES };',
    ctx);
  // Les tableaux nés dans le contexte vm portent le prototype de CE contexte :
  // deepStrictEqual les refuse face à un tableau de l'hôte, même à contenu
  // identique. On les recopie côté hôte — sans toucher au contenu.
  for (const k of Object.keys(ctx.LISTES)) ctx.LISTES[k] = Array.from(ctx.LISTES[k]);
  return ctx;
}

let passes = 0;
function t(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

// ── 1. La règle est pure, et ne lit rien que l'utilisateur contrôle ────────

t('la règle n\'ouvre aucune porte à une donnée contrôlée par l\'utilisateur', () => {
  const code = BLOC.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const interdit of ['location.search', 'URLSearchParams', 'localStorage',
                          'sessionStorage', 'document.', 'searchParams', 'nexusClient']) {
    assert.ok(!code.includes(interdit),
      `la classification lit « ${interdit} » : une autorisation ne se déduit jamais d'une donnée fournie par l'utilisateur`);
  }
});

t('un écran inconnu est OPÉRATIONNEL — l\'oubli ferme, il n\'ouvre pas', () => {
  const r = chargerRegle();
  assert.strictEqual(r.nexusCategorieAcces('NEXUS-Ecran-Qui-Nexiste-Pas-v9.html'), 'operationnel');
  assert.strictEqual(r.nexusCategorieAcces(''), 'operationnel');
  assert.strictEqual(r.nexusCategorieAcces(undefined), 'operationnel');
});

// ── 2. Le classement couvre TOUT le dépôt, sans recouvrement ───────────────

t('les quatre listes couvrent tous les écrans, chacun une seule fois', () => {
  const r = chargerRegle();
  const ecrans = fs.readdirSync(RACINE).filter(f => /^NEXUS-.*\.html$/.test(f)).sort();
  const toutes = [].concat(r.LISTES.sequence, r.LISTES.consultation,
                           r.LISTES.operationnel, r.LISTES.publique);

  const doublons = toutes.filter((p, i) => toutes.indexOf(p) !== i);
  assert.deepStrictEqual(doublons, [],
    'un écran classé deux fois : la première liste gagne en silence — ' + doublons.join(', '));

  const fantomes = toutes.filter(p => !ecrans.includes(p));
  assert.deepStrictEqual(fantomes, [],
    'écran classé mais absent du dépôt (renommé ? supprimé ?) : ' + fantomes.join(', '));

  const oublies = ecrans.filter(p => !toutes.includes(p));
  assert.deepStrictEqual(oublies, [],
    'écran non classé — il retombe sur OPÉRATIONNEL par défaut, ce qui est sûr mais\n' +
    'jamais délibéré. Classez-le explicitement :\n  ' + oublies.join('\n  '));
});

t('la liste PUBLIQUE est exactement l\'ensemble des écrans sans authentification', () => {
  const r = chargerRegle();
  const ecrans = fs.readdirSync(RACINE).filter(f => /^NEXUS-.*\.html$/.test(f));
  const sansAuth = ecrans.filter(f =>
    !/nexusRequireAuth/.test(fs.readFileSync(path.join(RACINE, f), 'utf8'))).sort();
  assert.deepStrictEqual(r.LISTES.publique.slice().sort(), sansAuth,
    'la liste PUBLIQUE et la réalité du code ont divergé — un écran a gagné ou perdu son authentification');
});

t('les écrans de l\'espace personnel sont bien en consultation', () => {
  const r = chargerRegle();
  for (const p of ['NEXUS-App-v1.html', 'NEXUS-Mon-Evolution-v1.html',
                   'NEXUS-Progression-v1.html', 'NEXUS-Apprentissage-v1.html',
                   'NEXUS-Mon-Planning-v1.html']) {
    assert.strictEqual(r.nexusCategorieAcces(p), 'consultation', p);
    assert.strictEqual(r.nexusPageExigeServiceOperationnel(p), false, p);
  }
});

t('les écrans de terrain restent opérationnels — dissocier n\'est pas désarmer', () => {
  const r = chargerRegle();
  for (const p of ['NEXUS-Missions-v1.html', 'NEXUS-Brief-v1.html',
                   'NEXUS-Inventaire-v1.html', 'NEXUS-FDJ-v1.html',
                   'NEXUS-Carburants-v1.html', 'NEXUS-Scanner-v1.html']) {
    assert.strictEqual(r.nexusCategorieAcces(p), 'operationnel', p);
    assert.strictEqual(r.nexusPageExigeServiceOperationnel(p), true, p);
  }
});

t('les deux écrans de la séquence ne se gardent pas eux-mêmes', () => {
  const r = chargerRegle();
  for (const p of ['NEXUS-Pointage-v1.html', 'NEXUS-Prise-De-Poste-v1.html']) {
    assert.strictEqual(r.nexusCategorieAcces(p), 'sequence', p);
    assert.strictEqual(r.nexusPageExigeServiceOperationnel(p), false, p);
  }
});

// ── 3. Les portes, exécutées pour de vrai ─────────────────────────────────

// La porte de la prise de poste, jouée sur la VRAIE fonction. Les deux
// lectures dont elle dépend sont remplacées par des témoins : on juge la
// décision de la porte, pas la base.
async function porte1(page, employee, { service, departPointe }) {
  const ctx = {
    console,
    window: { location: { pathname: '/' + page } },
    __lectures: [],
  };
  const code = [
    BLOC,
    'async function nexusServiceCourant(e){ __lectures.push("shifts"); return ' + JSON.stringify(service) + '; }',
    'async function nexusDepartPointeAujourdhui(e){ __lectures.push("pointages"); return ' + JSON.stringify(!!departPointe) + '; }',
    // 16/09/2026 — les deux portes appellent desormais `nexusEstManager`
    // au lieu de recopier `role === 'manager' || role === 'gerant'`. Elle
    // est EXTRAITE du fichier reel, jamais reecrite ici : un banc qui
    // porterait sa propre copie resterait vert en mesurant l'ancienne.
    extraire('nexusEstManager'),
    extraire('nexusPriseDePosteManquante'),
    'this.__test = nexusPriseDePosteManquante;',
  ].join('\n\n');
  vm.runInNewContext(code, ctx);
  const bloque = await ctx.__test(employee);
  return { bloque, lectures: ctx.__lectures };
}

// La porte du pointage d'arrivée, idem, avec un faux client Supabase.
async function porte2(page, employee, { config, arrivee }) {
  function chain(table) {
    return {
      select: () => chain(table), eq: () => chain(table),
      maybeSingle: async () => table === 'station_config'
        ? { data: config } : { data: arrivee, error: null },
    };
  }
  const ctx = {
    console,
    window: { location: { pathname: '/' + page } },
    __lectures: [],
    nexusClient: { from: (table) => { ctx.__lectures.push(table); return chain(table); } },
  };
  const code = [BLOC, extraire('nexusEstManager'), extraire('nexusPointageArriveeManquant'),
                'this.__test = nexusPointageArriveeManquant;'].join('\n\n');
  vm.runInNewContext(code, ctx);
  const bloque = await ctx.__test(employee);
  return { bloque, lectures: ctx.__lectures };
}

const EMPLOYE = { id: 'e1', site_id: 's1', role: 'employe', consultation_externe: false };
const MANAGER = { id: 'm1', site_id: 's1', role: 'manager', consultation_externe: false };
const AUCUN_SERVICE = { aucun: true };
const EN_SERVICE = { service: { id: 'sv1', role: 'caissier', quart: 'quart_1' } };

(async () => {

  // ── Cas 1 — employé authentifié SANS service actif : il consulte ────────
  for (const page of ['NEXUS-Mon-Evolution-v1.html', 'NEXUS-Progression-v1.html',
                      'NEXUS-Apprentissage-v1.html', 'NEXUS-Mon-Planning-v1.html',
                      'NEXUS-App-v1.html']) {
    const a = await porte1(page, EMPLOYE, { service: AUCUN_SERVICE, departPointe: false });
    assert.strictEqual(a.bloque, false, `porte prise de poste : ${page} bloqué hors service`);
    const b = await porte2(page, EMPLOYE, { config: { pointage_actif: true }, arrivee: null });
    assert.strictEqual(b.bloque, false, `porte pointage : ${page} bloqué sans arrivée pointée`);
  }
  passes++; console.log('OK — cas 1 : un employé hors service atteint tout son espace personnel');

  // Et il l'atteint SANS QU'ON LISE RIEN : la règle tranche avant la base.
  // C'est ce qui garantit qu'aucune consultation ne peut créer quoi que ce
  // soit — il n'y a pas d'aller-retour où glisser une écriture.
  const sansLecture = await porte1('NEXUS-Mon-Evolution-v1.html', EMPLOYE,
    { service: AUCUN_SERVICE, departPointe: false });
  assert.deepStrictEqual(sansLecture.lectures, [],
    'la consultation interroge encore shifts/pointages : la règle tranche trop tard');
  const sansLecture2 = await porte2('NEXUS-Mon-Evolution-v1.html', EMPLOYE,
    { config: { pointage_actif: true }, arrivee: null });
  assert.deepStrictEqual(sansLecture2.lectures, [],
    'la consultation interroge encore station_config/pointages');
  passes++; console.log('OK — la consultation ne déclenche aucune lecture de service ni de pointage');

  // ── Cas 2 — employé authentifié AVEC service actif : rien ne change ─────
  const avecService = await porte1('NEXUS-Missions-v1.html', EMPLOYE,
    { service: EN_SERVICE, departPointe: false });
  assert.strictEqual(avecService.bloque, false, 'un employé en service est renvoyé à la prise de poste');
  passes++; console.log('OK — cas 2 : un employé en service accède normalement au terrain');

  // ── Cas 3 et 4 — dernier service la veille / aucun service ─────────────
  // nexusServiceCourant ne rend JAMAIS le service de la veille (S-4 + 11/09) :
  // les deux cas arrivent donc ici sous la même forme, { aucun: true }. Sur
  // un écran opérationnel, la porte doit mordre dans les deux.
  const veille = await porte1('NEXUS-Missions-v1.html', EMPLOYE,
    { service: AUCUN_SERVICE, departPointe: false });
  assert.strictEqual(veille.bloque, true,
    'la garde opérationnelle a été désarmée : un employé sans service atteint le terrain');
  passes++; console.log('OK — cas 3 et 4 : sans service du jour, le terrain reste fermé');

  // ── L'autre moitié de l'arbitrage, écran par écran ─────────────────────
  const regle = chargerRegle();
  for (const page of regle.LISTES.operationnel) {
    const r = await porte1(page, EMPLOYE, { service: AUCUN_SERVICE, departPointe: false });
    assert.strictEqual(r.bloque, true, `${page} n'exige plus de service : la garde a fui`);
  }
  passes++; console.log(`OK — les ${regle.LISTES.operationnel.length} écrans opérationnels exigent tous un service ouvert`);

  // ── Le manager : présent seulement s'il l'a décidé ─────────────────────
  // Il était déjà dispensé de la prise de poste ; il ne l'était PAS du
  // pointage d'arrivée quand la station l'exige. Consulter le Cockpit le
  // renvoyait donc pointer — c'est-à-dire produire une preuve de présence
  // pour avoir regardé un écran.
  const cockpit = await porte2('NEXUS-Cockpit-v2.html', MANAGER,
    { config: { pointage_actif: true, manager_pointage_requis: true }, arrivee: null });
  assert.strictEqual(cockpit.bloque, false,
    'le manager est encore renvoyé pointer pour consulter le Cockpit');
  for (const page of ['NEXUS-Verify-v1.html', 'NEXUS-Carburants-Pilotage-v1.html',
                      'NEXUS-Resultats-Equipe-v1.html', 'NEXUS-Evaluation-Employe-v1.html',
                      'NEXUS-Planning-v1.html', 'NEXUS-Parametres-Station-v1.html']) {
    const r = await porte2(page, MANAGER,
      { config: { pointage_actif: true, manager_pointage_requis: true }, arrivee: null });
    assert.strictEqual(r.bloque, false, `le manager est renvoyé pointer pour ouvrir ${page}`);
  }
  passes++; console.log('OK — le manager consulte, contrôle et administre sans preuve de présence');

  // ... mais il reste gardé sur le terrain, si la station l'exige.
  const managerTerrain = await porte2('NEXUS-Inventaire-Manager-v1.html', MANAGER,
    { config: { pointage_actif: true, manager_pointage_requis: true }, arrivee: null });
  assert.strictEqual(managerTerrain.bloque, true,
    'manager_pointage_requis ne mord plus nulle part : l\'interrupteur est devenu décoratif');
  passes++; console.log('OK — manager_pointage_requis mord toujours sur les écrans de terrain');

  // ── Aucune régression sur les dispenses existantes ─────────────────────
  const externe = await porte1('NEXUS-Missions-v1.html',
    Object.assign({}, EMPLOYE, { consultation_externe: true }),
    { service: AUCUN_SERVICE, departPointe: false });
  assert.strictEqual(externe.bloque, false, 'la consultation externe du créateur est retombée sous garde');
  const apresDepart = await porte1('NEXUS-Missions-v1.html', EMPLOYE,
    { service: AUCUN_SERVICE, departPointe: true });
  assert.strictEqual(apresDepart.bloque, false,
    'après un départ pointé, la prise de poste s\'impose à nouveau (arbitrage C.3 du 11/09 perdu)');
  const panne = await porte1('NEXUS-Missions-v1.html', EMPLOYE,
    { service: { erreur: true }, departPointe: false });
  assert.strictEqual(panne.bloque, false,
    'une panne de lecture enferme l\'employé hors de l\'application');
  passes++; console.log('OK — dispenses existantes intactes : consultation externe, après-départ, panne de lecture');

  // ── La troisième porte ne doit pas repousser ──────────────────────────
  const APP = fs.readFileSync(path.join(RACINE, 'NEXUS-App-v1.html'), 'utf8');
  const bloc = APP.match(/if \(!employee\.consultation_externe\) \{\s*const r = await nexusServiceCourant\(employee\);[\s\S]*?\n    \}/);
  assert.ok(bloc, 'le bloc de lecture du service courant de l\'accueil est introuvable');
  const codeSeul = bloc[0].split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/window\.location/.test(codeSeul),
    'l\'accueil redirige à nouveau au chargement : la troisième porte est revenue');
  passes++; console.log('OK — l\'accueil est resté un lecteur du service, pas une porte');

  // ── L'ACL de la migration est écrite, pas héritée ────────────────────
  // 16/09/2026. `create or replace` conserve l'ACL d'une fonction qui existe
  // déjà : une migration muette sur un rôle lui laisse le droit là où la
  // fonction préexistait, et le lui refuse ailleurs. L'ACL dépendait donc de
  // l'histoire de la base. Les quatre lignes doivent être TOUTES présentes,
  // `service_role` compris — c'est la seule façon d'obtenir le même résultat
  // sur Test, en Production et sur une base neuve.
  const MIG = fs.readFileSync(path.join(RACINE, 'supabase/migrations/20260916210000_mes_ecarts_caisse_masque_le_provisoire.sql'), 'utf8');
  const sansCommentaires = MIG.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  const ACL_ATTENDUE = [
    ['revoke', /revoke\s+all\s+on\s+function\s+public\.mes_ecarts_caisse\(\)\s+from\s+public\s*;/,
     'revoke … from public manquant'],
    ['revoke', /revoke\s+all\s+on\s+function\s+public\.mes_ecarts_caisse\(\)\s+from\s+anon\s*;/,
     'revoke … from anon manquant — sur Supabase, PUBLIC ne ferme pas anon'],
    ['grant',  /grant\s+execute\s+on\s+function\s+public\.mes_ecarts_caisse\(\)\s+to\s+authenticated\s*;/,
     'grant … to authenticated manquant'],
    ['grant',  /grant\s+execute\s+on\s+function\s+public\.mes_ecarts_caisse\(\)\s+to\s+service_role\s*;/,
     'grant … to service_role manquant : l\'ACL redevient héritée, donc indéterminée'],
  ];
  for (const [, motif, message] of ACL_ATTENDUE) {
    assert.ok(motif.test(sansCommentaires), message);
  }
  // Et surtout : aucun grant à anon ni à PUBLIC, sous aucune forme.
  assert.ok(!/grant[\s\S]{0,120}mes_ecarts_caisse\(\)\s+to\s+(anon|public)\b/i.test(sansCommentaires),
    'la migration accorde EXECUTE à anon ou à PUBLIC');
  passes++; console.log('OK — l\'ACL de la migration est écrite en toutes lettres : authenticated + service_role, jamais anon ni PUBLIC');

  console.log(`\n${passes} vérifications passées — l'authentification n'est pas une preuve de présence, et le terrain reste gardé.`);
})().catch(err => { console.error(err); process.exit(1); });
