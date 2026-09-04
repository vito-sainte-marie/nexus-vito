// NEXUS Missions — la progression appartient à UNE prise de poste (04/09/2026).
//
// Test réel de Frédéric avec le compte de Nadine, caissière du quart du
// soir : dès sa connexion, « Balayer et nettoyer la piste » s'affichait
// avec sa checklist entièrement cochée. mission_progress était unique sur
// (employee_id, mission_id, checklist_index) — ni date, ni site, ni quart,
// ni rôle, ni prise de poste : une coche posée un jour restait vraie pour
// toujours.
//
// Ce test n'inspecte pas des chaînes de caractères dans le HTML : il
// EXTRAIT les trois fonctions concernées de l'écran et les exécute contre
// un faux client qui reproduit les contraintes réelles de la base — dont
// `shift_id NOT NULL` et la nouvelle clé d'unicité. Si l'écran cessait de
// rattacher une coche à son service, le test échouerait ici, pas en
// production.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Missions-v1.html'), 'utf8');

// Extraction par bornes de fonction — on rejoue le vrai code de l'écran.
function extraireFonction(source, signature) {
  const debut = source.indexOf(signature);
  assert.ok(debut !== -1, `fonction introuvable dans l'écran : ${signature}`);
  let i = source.indexOf('{', debut), profondeur = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') profondeur++;
    else if (source[i] === '}') { profondeur--; if (profondeur === 0) return source.slice(debut, i + 1); }
  }
  throw new Error(`accolade fermante introuvable pour ${signature}`);
}

// ── Faux client : reproduit les garanties de la base, pas une version
//    complaisante. shift_id NOT NULL et unicité (shift_id, mission_id,
//    checklist_index) sont appliqués comme le fait Postgres.
function creerBase(lignesInitiales) {
  const table = [...(lignesInitiales || [])];
  const client = {
    from(nom) {
      assert.strictEqual(nom, 'mission_progress');
      return {
        select() {
          const filtres = {};
          const chainon = {
            eq(colonne, valeur) { filtres[colonne] = valeur; return chainon; },
            then(resoudre) {
              const data = table.filter(r => Object.entries(filtres).every(([c, v]) => r[c] === v));
              return Promise.resolve({ data, error: null }).then(resoudre);
            },
          };
          return chainon;
        },
        async upsert(ligne, options) {
          if (!ligne.shift_id) {
            return { error: { message: 'null value in column "shift_id" violates not-null constraint' } };
          }
          assert.strictEqual(options.onConflict, 'shift_id,mission_id,checklist_index',
            'la clé de conflit doit porter sur la prise de poste, jamais sur l’employé seul');
          const cle = r => `${r.shift_id}|${r.mission_id}|${r.checklist_index}`;
          const i = table.findIndex(r => cle(r) === cle(ligne));
          if (i >= 0) table[i] = Object.assign({}, table[i], ligne); else table.push(Object.assign({}, ligne));
          return { error: null };
        },
      };
    },
  };
  return { client, table };
}

const SOURCE = [
  extraireFonction(html, 'async function chargerProgressionSupabase('),
  extraireFonction(html, 'async function sauvegarderProgressionItem('),
  extraireFonction(html, 'async function cocherEtEnregistrer('),
].join('\n');

function contexte(base, shiftId, empId) {
  const ctx = {
    console, nexusClient: base.client,
    shiftIdActif: shiftId, employeeId: empId, SITE_ACTUEL: 'vito-sainte-marie',
    checkState: {}, itemPhotoState: {}, rendus: 0,
    render() { ctx.rendus += 1; },
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return ctx;
}

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

const SHIFT_SOIR = 'shift-nadine-soir';
const SHIFT_MATIN = 'shift-nadine-matin';
const SHIFT_AUTRE = 'shift-ruddy-soir';
const NADINE = 'emp-nadine';
const RUDDY = 'emp-ruddy';
const BALAYER = 'balayer-nettoyer-piste';

(async () => {
  // ── 1. Une nouvelle prise de poste n'hérite d'aucune coche ─────────────
  // Le cas exact de Nadine : des coches existent pour un service antérieur
  // du même employé, sur la même mission.
  const base1 = creerBase([
    { shift_id: SHIFT_MATIN, employee_id: NADINE, mission_id: BALAYER, checklist_index: 0, checked: true, photo_url: null },
    { shift_id: SHIFT_MATIN, employee_id: NADINE, mission_id: BALAYER, checklist_index: 1, checked: true, photo_url: null },
    { shift_id: SHIFT_MATIN, employee_id: NADINE, mission_id: BALAYER, checklist_index: 2, checked: true, photo_url: null },
  ]);
  const soir = contexte(base1, SHIFT_SOIR, NADINE);
  const progressionSoir = await soir.chargerProgressionSupabase(SHIFT_SOIR);
  verifier('une nouvelle prise de poste démarre sans aucune coche héritée',
    Object.keys(progressionSoir.checkState).length === 0);
  verifier('… ni aucune photo héritée',
    Object.keys(progressionSoir.photoState).length === 0);

  // ── 3. Deux quarts du même employé restent indépendants ────────────────
  const matin = contexte(base1, SHIFT_MATIN, NADINE);
  const progressionMatin = await matin.chargerProgressionSupabase(SHIFT_MATIN);
  verifier('le service précédent garde ses propres coches, intactes',
    Object.keys(progressionMatin.checkState).length === 3);

  soir.shiftIdActif = SHIFT_SOIR;
  await soir.cocherEtEnregistrer(`${BALAYER}_0`, BALAYER, 0, true, null);
  const matinApres = await matin.chargerProgressionSupabase(SHIFT_MATIN);
  const soirApres = await soir.chargerProgressionSupabase(SHIFT_SOIR);
  verifier('cocher sur le quart du soir ne touche pas le quart du matin',
    Object.keys(matinApres.checkState).length === 3);
  verifier('… et le quart du soir ne compte que sa propre coche',
    Object.keys(soirApres.checkState).length === 1);

  // ── 2. Deux employés simultanés restent indépendants ───────────────────
  const base2 = creerBase();
  const nadine = contexte(base2, SHIFT_SOIR, NADINE);
  const ruddy = contexte(base2, SHIFT_AUTRE, RUDDY);
  await nadine.cocherEtEnregistrer(`${BALAYER}_0`, BALAYER, 0, true, null);
  await nadine.cocherEtEnregistrer(`${BALAYER}_1`, BALAYER, 1, true, null);
  await ruddy.cocherEtEnregistrer(`${BALAYER}_0`, BALAYER, 0, true, null);
  const vueNadine = await nadine.chargerProgressionSupabase(SHIFT_SOIR);
  const vueRuddy = await ruddy.chargerProgressionSupabase(SHIFT_AUTRE);
  verifier('deux employés en service au même moment ont deux progressions distinctes',
    Object.keys(vueNadine.checkState).length === 2 && Object.keys(vueRuddy.checkState).length === 1);
  verifier('… et chaque ligne enregistrée porte bien son employé et son service',
    base2.table.length === 3
    && base2.table.filter(r => r.employee_id === NADINE).every(r => r.shift_id === SHIFT_SOIR)
    && base2.table.filter(r => r.employee_id === RUDDY).every(r => r.shift_id === SHIFT_AUTRE));

  // ── 4. Une actualisation de page conserve les coches du quart actif ────
  const rechargee = contexte(base2, SHIFT_SOIR, NADINE);
  const apresF5 = await rechargee.chargerProgressionSupabase(SHIFT_SOIR);
  verifier('actualiser la page conserve les coches du service en cours',
    apresF5.checkState[`${BALAYER}_0`] === true && apresF5.checkState[`${BALAYER}_1`] === true);

  // ── Garanties structurelles ────────────────────────────────────────────
  const base3 = creerBase();
  const sansService = contexte(base3, null, NADINE);
  sansService.checkState[`${BALAYER}_0`] = true;
  const enregistre = await sansService.cocherEtEnregistrer(`${BALAYER}_0`, BALAYER, 0, true, null);
  verifier('sans prise de poste, aucune coche ne peut être enregistrée',
    enregistre === false && base3.table.length === 0);
  verifier('… et l’écran revient à l’état réel plutôt que d’afficher une coche fantôme',
    sansService.checkState[`${BALAYER}_0`] === undefined && sansService.rendus > 0);

  const vide = await contexte(creerBase(), null, NADINE).chargerProgressionSupabase(null);
  verifier('une consultation sans service n’affiche jamais l’historique d’un autre',
    Object.keys(vide.checkState).length === 0);

  // ── 5. L'historique archivé reste lisible par le manager ───────────────
  const migration = fs.readFileSync(
    path.join(__dirname, 'supabase', 'migrations', '20260904010000_mission_progress_isolation_prise_de_poste.sql'), 'utf8');
  verifier('la migration archive avant de supprimer, et compare les deux comptes',
    /insert into public\.mission_progress_archive_2026_09/.test(migration)
    && /Archivage incomplet/.test(migration) && /Écart archivage\/suppression/.test(migration));
  verifier('l’archive est lisible par le manager et le gérant de son site',
    /create policy select_mission_progress_archive/.test(migration)
    && /current_employee_role\(\)\) = any \(array\['manager', 'gerant'\]\)/.test(migration));
  verifier('l’archive n’accepte aucune écriture — un historique ne se modifie pas',
    !/create policy .* on public\.mission_progress_archive_2026_09 for (insert|update|delete)/i.test(migration));
  verifier('shift_id devient obligatoire : plus aucune coche hors prise de poste',
    /alter column shift_id set not null/.test(migration)
    && /unique \(shift_id, mission_id, checklist_index\)/.test(migration));
  verifier('l’ancienne clé, celle qui faisait fuir les coches, est retirée',
    /drop constraint if exists mission_progress_employee_id_mission_id_checklist_index_key/.test(migration));

  console.log(`\nNEXUS Missions — isolation par prise de poste : ${ok}/${ok} vérifications passent.`);
})().catch(e => { console.error(e); process.exit(1); });
