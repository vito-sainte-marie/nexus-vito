'use strict';
// Type « Absence » dans « Ajouter une variable du mois » (#160, 07/11/2026).
// Une absence reste un événement RH unique du/au (règle du 03/09) : le menu
// Type la propose, mais l'enregistrement passe par declarerIndisponibilite.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-donnees.js'), 'utf8'), ctx);
const M = ctx.NexusPayeMoteur, D = ctx.NexusPayeDonnees;

let ok = 0;
function t(nom, f) { f(); ok++; console.log('OK  — ' + nom); }
async function ta(nom, f) { await f(); ok++; console.log('OK  — ' + nom); }
function garde(nom, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(HTML), 'la garde doit passer sur la source');
    assert.ok(HTML.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(HTML.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
function clientFactice() {
  const lignes = [];
  return { lignes, from(table) { assert.strictEqual(table, 'employee_indisponibilites');
    return { insert(l) { lignes.push(l); return { select() { return { maybeSingle: async () => ({ data: l, error: null }) }; } }; } }; } };
}

(async () => {
  // ---- Écran ----
  const types = HTML.match(/const TYPES_VARIABLE_MANUELLE=\[([^\]]*)\]/);
  t('le type « absence » existe dans le menu Type', () => {
    assert.ok(types && types[1].includes("'absence'"));
    assert.ok(/LIBELLES=\{[^}]*absence:'Absence'/.test(HTML));
  });
  garde('« Absence » est un motif de la carte « Déclarer un événement RH »',
    h => /MOTIFS_RH=\[[\s\S]{0,300}\['autre','Absence'\]\]/.test(h), "['autre','Absence']", "['autre','Autre']");
  garde('addManual route le type absence vers addAbsenceManuelle (pas de ligne par jour)',
    h => /if\(typeItem==='absence'\)return addAbsenceManuelle\(\);/.test(h), "if(typeItem==='absence')return addAbsenceManuelle();", '');
  garde('le motif est exigé avant tout enregistrement',
    h => /if\(!motifTexte\)return nexusErreur\('Motif obligatoire'/.test(h), "if(!motifTexte)return nexusErreur('Motif obligatoire'", "if(false)return nexusErreur('Motif obligatoire'");
  garde('l\'absence passe par declarerAbsenceDepuisVariable',
    h => /NexusPayeDonnees\.declarerAbsenceDepuisVariable\(/.test(h), 'declarerAbsenceDepuisVariable(nexusClient', 'ajouterItemsManuels(nexusClient');
  garde('minutes et montant sont masqués pour une absence, aide affichée',
    h => /manualMinutesField'\)\.hidden=absence/.test(h) && /manualAmountField'\)\.hidden=absence/.test(h) && /Une absence est enregistrée comme un événement RH unique\./.test(h),
    "manualAmountField').hidden=absence", "manualAmountField').hidden=false");

  garde('la phrase « Un congé se déclare dans Déclarer un événement RH » est masquée quand le type est Absence',
    h => /id="manualAbsenceInterdit">Un congé se déclare dans « Déclarer un événement RH »\. Pour une absence, choisissez le type Absence\./.test(h) && /manualAbsenceInterdit'\)\.hidden=absence/.test(h),
    "manualAbsenceInterdit').hidden=absence", "manualAbsenceInterdit').hidden=false");

  // ---- Données ----
  await ta('une absence crée UN seul événement RH sur la période', async () => {
    const c = clientFactice();
    await D.declarerAbsenceDepuisVariable(c, { siteId: 's', employeeId: 'e1', dateDebut: '2026-11-03', dateFin: '2026-11-07', motifTexte: 'Absence injustifiée', actorId: 'm' });
    assert.strictEqual(c.lignes.length, 1);
    assert.strictEqual(c.lignes[0].date_debut, '2026-11-03');
    assert.strictEqual(c.lignes[0].date_fin, '2026-11-07');
    assert.strictEqual(c.lignes[0].motif, 'autre');
    assert.strictEqual(c.lignes[0].commentaire, 'Absence injustifiée');
  });
  await ta('le motif est exigé (vide ou espaces refusés, rien écrit)', async () => {
    const c = clientFactice();
    for (const m of ['', '   ', undefined]) {
      let refuse = false;
      try { await D.declarerAbsenceDepuisVariable(c, { siteId: 's', employeeId: 'e1', dateDebut: '2026-11-03', dateFin: '2026-11-03', motifTexte: m }); } catch (e) { refuse = /motif/i.test(e.message); }
      assert.ok(refuse);
    }
    assert.strictEqual(c.lignes.length, 0);
  });
  t('la garde refuserEvenementRHParJournee reste active, y compris pour « absence »', () => {
    ['absence', 'conge_paye', 'arret_maladie', 'absence_a_verifier'].forEach(type => {
      assert.throws(() => D.refuserEvenementRHParJournee(type), /événement RH unique/);
    });
    ['acompte', 'autre', 'retard'].forEach(type => assert.doesNotThrow(() => D.refuserEvenementRHParJournee(type)));
  });

  // ---- Moteur / dossier comptable ----
  t('le libellé est « Absence » et le dossier compte les jours d\'absence', () => {
    assert.strictEqual(M.MOTIFS_INDISPO.autre, 'Absence');
    const emp = { id: 'e1', nom: 'test', actif: true };
    const rapport = M.construireRapport({ periode: '2026-11', employees: [emp],
      settings: [{ employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' }],
      indisponibilites: [{ id: 'i1', employee_id: 'e1', site_id: 's', date_debut: '2026-11-03', date_fin: '2026-11-07', type: 'indisponible', motif: 'autre', confirme_le: '2026-11-07T10:00:00Z' }],
      planning: [], audits: [], pointages: [], items: [], config: {} });
    const dossier = M.dossierComptable(rapport);
    const a = dossier.salaries[0].variables.autresAbsences;
    assert.strictEqual(a.jours, 5);
    assert.strictEqual(a.evenements, 1);
    assert.strictEqual(a.detail[0].libelle, 'Absence');
    assert.strictEqual(dossier.synthese.joursAutresAbsences, 5);
  });

  console.log(ok + ' épreuves OK');
})().catch(e => { console.error('ÉCHEC', e); process.exit(1); });
