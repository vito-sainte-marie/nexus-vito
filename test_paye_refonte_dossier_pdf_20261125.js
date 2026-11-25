// Refonte Paye — dossier comptable PDF A4 paysage, trois colonnes (GO gérant 25/11/2026,
// revue Guardian 7175272330 et 7175292222). Épreuves écrites AVANT le code : elles sont rouges.
// pdf-lib vient d'un CDN : faux PDFLib qui enregistre texte, page et taille de page.
// Données entièrement fictives. Aucune horloge : les dates sont injectées.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const RACINE = __dirname;
let passes = 0;
const echecs = [];
async function verifier(nom, fn) {
  try { await fn(); passes++; console.log('OK — ' + nom); } catch (e) { echecs.push(nom); console.log('ROUGE — ' + nom + ' : ' + e.message.split('\n')[0]); }
}

const LARGEUR_CAR = 5;
function fauxPdfLib(journal) {
  const fonte = { widthOfTextAtSize: (t, s) => String(t).length * LARGEUR_CAR * (s / 9) };
  const nouvellePage = (taille) => {
    const [w, h] = Array.isArray(taille) ? taille : [595.28, 841.89];
    journal.tailles.push([w, h]);
    const idx = journal.tailles.length;
    return {
      drawText(t, o) { journal.textes.push({ t: String(t), x: o.x, y: o.y, size: o.size, page: idx }); },
      drawRectangle() {}, drawLine() {}, drawImage() {}, drawSvgPath() {},
      getSize: () => ({ width: w, height: h }),
    };
  };
  const doc = new Proxy({
    addPage(t) { return nouvellePage(t); },
    async embedFont() { return fonte; },
    getPages() { return []; }, getPageCount() { return journal.tailles.length; },
    async save() { journal.sauvegardes++; return new Uint8Array([37, 80, 68, 70]); },
  }, { get: (c, p) => (p in c ? c[p] : (typeof p === 'symbol' || p === 'then' ? undefined : () => {})) });
  return { PDFDocument: { create: async () => doc }, StandardFonts: { Helvetica: 'H', HelveticaBold: 'HB' }, rgb: () => ({}), PageSizes: { A4: [595.28, 841.89] } };
}
function charger(journal, fichiers) {
  const faux = {}; faux.window = faux; faux.PDFLib = fauxPdfLib(journal); faux.document = {};
  for (const f of fichiers || ['nexus-pdf-moteur.js', 'nexus-paye-dossier-pdf.js']) {
    new Function('window', 'global', 'document', 'PDFLib', fs.readFileSync(path.join(RACINE, f), 'utf8'))(faux, faux, faux.document, faux.PDFLib);
  }
  return faux;
}

const vide = () => ({ jours: 0, detail: [] });
function salarie(nom, role, surcharge, statut) {
  const base = {
    nom, role, statut: statut || 'pret', statutLibelle: statut === 'donnee_manquante' ? 'Donnée manquante' : (statut === 'a_verifier' ? 'À vérifier' : 'Prêt'),
    variables: {
      elementsEnAttente: statut === 'a_verifier' ? 2 : 0,
      presence: { jours: 20, heures: 150, heuresNormales: 140, detailJours: [], joursMesures: 20, joursReconstitues: 0, joursPlanifies: 0, heuresParDefaut: 0 },
      absence: { jours: 0 }, congesPayes: vide(), maladieMaternite: vide(), autresAbsences: vide(),
      retards: { occurrences: 0, minutes: 0, detail: [] },
      heuresSupplementaires: { heures: 0, enAttente: 0, heuresDejaIncluses: 0 },
      joursFeries: { jours: 0, dates: [], detail: [] },
      financier: { acompteCentimes: 0, detteCentimes: 0, retenueEcartCentimes: 0, ecartsCaisseMois: { boutiqueCentimes: 0, pisteCentimes: 0, fdjCentimes: 0, totalCentimes: 0 }, ecartsInformatifs: 0, lignes: [] },
    },
  };
  return Object.assign(base, surcharge || {});
}
function dossierFictif(salaries) {
  return {
    periode: '2026-11-01', genereLe: '2026-11-20T10:00:00Z', statutGlobal: 'pret', ecartsNonAttribues: 0,
    synthese: { salaries: salaries.length, prets: salaries.length, aVerifier: 0, donneeManquante: 0, joursTravailles: 0, heuresConfirmees: 0,
      joursCongesPayes: 0, joursMaladieMaternite: 0, joursAbsenceNonDeclaree: 0, joursFeries: 0, heuresSupplementaires: 0, retardsMinutes: 0, acompteCentimes: 0, detteCentimes: 0 },
    salaries,
  };
}
const neuf = n => Array.from({ length: n }, (_, i) => salarie(`Salarié ${String.fromCharCode(65 + i)}`, ['caissier', 'pompiste', 'renfort'][i % 3]));
const textes = j => j.textes.map(e => e.t);
const aTexte = (j, re) => j.textes.some(e => re.test(e.t));

(async () => {
  const PAYSAGE = [841.89, 595.28];
  async function generer(dossier, opts) {
    const j = { textes: [], tailles: [], sauvegardes: 0 };
    const faux = charger(j);
    const r = await faux.NexusPayeDossierPdf.construireDossierPdf(dossier, Object.assign({ site: 'site-fictif', nomEntreprise: 'Entreprise Fictive' }, opts || {}));
    return { j, faux, r };
  }

  await verifier('toutes les pages sont A4 paysage', async () => {
    const { j } = await generer(dossierFictif(neuf(9)), { provisoire: false });
    assert.ok(j.tailles.length >= 1);
    for (const t of j.tailles) assert.deepStrictEqual(t.map(v => Math.round(v * 100) / 100), PAYSAGE);
  });

  await verifier('trois colonnes : marges 28 pt, gouttière 14 pt, environ 252 pt', async () => {
    const { j } = await generer(dossierFictif(neuf(9)), { provisoire: false });
    const noms = j.textes.filter(e => /^Salarié [A-I]$/.test(e.t) && e.size === 11.5);
    const xs = [...new Set(noms.map(e => Math.round(e.x * 10) / 10))].sort((a, b) => a - b);
    const col = (841.89 - 56 - 28) / 3;
    assert.strictEqual(xs.length, 3, 'trois x distincts, trouvé ' + JSON.stringify(xs));
    assert.ok(Math.abs(xs[0] - 28) < 0.2 && Math.abs(xs[1] - (28 + col + 14)) < 0.2 && Math.abs(xs[2] - (28 + 2 * (col + 14))) < 0.2);
    for (const e of j.textes) assert.ok(e.x >= 28 - 0.01 && e.x + e.t.length * LARGEUR_CAR * (e.size / 9) <= 841.89 - 28 + 0.01, 'hors marges : ' + e.t);
  });

  await verifier('neuf fiches tiennent sur deux pages, remplies colonne par colonne, ordre alphabétique', async () => {
    const { j } = await generer(dossierFictif(neuf(9)), { provisoire: false });
    const noms = j.textes.filter(e => /^Salarié [A-I]$/.test(e.t) && e.size === 11.5);
    assert.strictEqual(noms.length, 9);
    assert.ok(new Set(noms.map(e => e.page)).size <= 2, 'au plus deux pages');
    const ordre = noms.map(e => e.t.slice(-1)).join('');
    assert.strictEqual(ordre, 'ABCDEFGHI');
    for (let i = 1; i < noms.length; i++) {
      const a = noms[i - 1], b = noms[i];
      assert.ok(b.page > a.page || b.x > a.x + 1 || (Math.abs(b.x - a.x) < 1 && b.y < a.y), 'ordre colonne par colonne rompu à ' + b.t);
    }
  });

  await verifier('fonction de référence : Caisse, Piste, Renfort (jamais « Employé » ni le code brut)', async () => {
    const { j } = await generer(dossierFictif(neuf(3)), { provisoire: false });
    for (const l of ['Caisse', 'Piste', 'Renfort']) assert.ok(aTexte(j, new RegExp('^' + l + '$')), l);
    assert.ok(!aTexte(j, /Employé|caissier|pompiste|renfort$/));
  });

  await verifier('une rubrique vide disparaît ; ni « Aucun… » ni tiret cadratin dans le PDF', async () => {
    const { j } = await generer(dossierFictif(neuf(3)), { provisoire: false });
    assert.ok(!aTexte(j, /^Aucun/i), 'aucun « Aucun… »');
    assert.ok(!aTexte(j, /—/), 'aucun tiret cadratin');
    assert.ok(!aTexte(j, /Acomptes|Dettes|Retards|Congés payés/), 'rubriques vides absentes');
  });

  await verifier('« 0 h » d’heures supplémentaires toujours affiché ; écart général « 0,00 € » si données complètes', async () => {
    const { j } = await generer(dossierFictif(neuf(1)), { provisoire: false });
    assert.ok(aTexte(j, /^0 h$/), '0 h');
    assert.ok(aTexte(j, /^0,00 €$/), '0,00 €');
    assert.ok(aTexte(j, /Heures supplémentaires/) && aTexte(j, /Écart général du mois/));
  });

  await verifier('écart sans montant : « donnée manquante » (jamais confondu avec 0,00 €)', async () => {
    const s = salarie('Salarié X', 'caissier'); s.variables.financier.ecartsCaisseMois = { boutiqueCentimes: null, pisteCentimes: 0, fdjCentimes: 0, totalCentimes: null };
    const { j } = await generer(dossierFictif([s]), { provisoire: false });
    assert.ok(aTexte(j, /^donnée manquante$/));
    assert.ok(!aTexte(j, /^0,00 €$/));
  });

  await verifier('congés en jours calendaires : libellé « j cal. »', async () => {
    const s = salarie('Salarié X', 'caissier');
    s.variables.congesPayes = { jours: 5, detail: [{ motif: 'conge', libelle: 'Congés payés', debut: '2026-11-03', fin: '2026-11-07', jours: 5, evenementDebut: '2026-11-03', evenementFin: '2026-11-07' }] };
    const { j } = await generer(dossierFictif([s]), { provisoire: false });
    assert.ok(aTexte(j, /^5 j cal\.$/));
  });

  await verifier('événement qui déborde du mois : sous-ligne grise « période réelle … »', async () => {
    const s = salarie('Salarié X', 'caissier');
    s.variables.maladieMaternite = { jours: 30, detail: [{ motif: 'conge_maternite', libelle: 'Congé maternité', debut: '2026-11-01', fin: '2026-11-30', jours: 30, evenementDebut: '2026-07-01', evenementFin: '2027-01-15' }] };
    const { j } = await generer(dossierFictif([s]), { provisoire: false });
    assert.ok(aTexte(j, /^période réelle/));
  });

  await verifier('absence : « Absence justifiée », « Absence injustifiée », « Absence » suivie de « justification non renseignée »', async () => {
    const mk = (justifiee, debut) => ({ motif: 'autre', libelle: 'Autre', debut, fin: debut, jours: 1, evenementDebut: debut, evenementFin: debut, justifiee });
    const s = salarie('Salarié X', 'caissier');
    s.variables.autresAbsences = { jours: 3, detail: [mk(true, '2026-11-04'), mk(false, '2026-11-05'), mk(null, '2026-11-06')] };
    const { j } = await generer(dossierFictif([s]), { provisoire: false });
    assert.ok(aTexte(j, /^Absence justifiée$/));
    assert.ok(aTexte(j, /^Absence injustifiée$/));
    assert.ok(aTexte(j, /^Absence$/) && aTexte(j, /^justification non renseignée$/));
  });

  await verifier('forme réelle : écart lu dans ecartsCaisseMois.totalCentimes (négatif en rouge, sans recalcul)', async () => {
    const s = salarie('Salarié X', 'caissier');
    s.variables.financier.ecartsCaisseMois = { boutiqueCentimes: -1500, pisteCentimes: 0, fdjCentimes: -500, totalCentimes: -2000 };
    const { j } = await generer(dossierFictif([s]), { provisoire: false });
    assert.ok(aTexte(j, /^-20,00 €$|^−20,00 €$|^-20,00\s?€$/) || aTexte(j, /20,00/), 'écart -20,00');
    assert.ok(!aTexte(j, /^donnée manquante$/));
  });

  await verifier('forme réelle : fériés en tableau (date, nom, heures) et retards datés avec total', async () => {
    const s = salarie('Salarié X', 'caissier');
    s.variables.joursFeries = { jours: 1, dates: ['2026-11-01'], detail: [{ date: '2026-11-01', nom: 'Toussaint' }] };
    s.variables.presence.detailJours = [{ date: '2026-11-01', poste: 'caisse', presence: 8, normales: 7, supplementaires: 1, autres: 0, source: 'mesure' }];
    s.variables.retards = { occurrences: 2, minutes: 25, detail: [{ date: '2026-11-03', minutes: 10 }, { date: '2026-11-09', minutes: 15 }] };
    const { j } = await generer(dossierFictif([s]), { provisoire: false });
    assert.ok(aTexte(j, /^01\/11$/) && aTexte(j, /^Toussaint$/));
    assert.ok(aTexte(j, /^03\/11$/) && aTexte(j, /^10 min$/) && aTexte(j, /^Total retards$/) && aTexte(j, /^25 min$/));
  });

  await verifier('provisoire : un mois validé suit snapshot.genere_le, un brouillon est toujours provisoire', async () => {
    const { faux } = await generer(dossierFictif(neuf(1)), { provisoire: false });
    const d = faux.NexusPayeDossierPdf.dossierProvisoire;
    assert.strictEqual(d('brouillon', '2026-11-30T12:00:00Z', '2026-11-01', 'America/Martinique'), true);
    assert.strictEqual(d('valide', '2026-11-20T12:00:00Z', '2026-11-01', 'America/Martinique'), true);
    assert.strictEqual(d('valide', '2026-11-30T12:00:00Z', '2026-11-01', 'America/Martinique'), false);
  });

  await verifier('salarié bloqué : son statut est écrit sur la fiche', async () => {
    const s1 = salarie('Salarié A', 'caissier', {}, 'donnee_manquante');
    const s2 = salarie('Salarié B', 'pompiste', {}, 'a_verifier');
    const { j } = await generer(dossierFictif([s1, s2]), { provisoire: true });
    assert.ok(aTexte(j, /donnée manquante/i));
    assert.ok(aTexte(j, /à vérifier/i));
  });

  await verifier('en-tête « Validé » ou « Provisoire » (jamais « Définitif »)', async () => {
    const a = await generer(dossierFictif(neuf(1)), { provisoire: true });
    const b = await generer(dossierFictif(neuf(1)), { provisoire: false });
    assert.ok(aTexte(a.j, /Provisoire/) && !aTexte(a.j, /Validé/));
    assert.ok(aTexte(b.j, /Validé/) && !aTexte(b.j, /Provisoire/));
    assert.ok(!aTexte(a.j, /Définitif/i) && !aTexte(b.j, /Définitif/i));
  });

  await verifier('nom de fichier NEXUS_Paye_<site>_<AAAA-MM>.pdf, suffixe _PROVISOIRE', async () => {
    const a = await generer(dossierFictif(neuf(1)), { provisoire: true });
    const b = await generer(dossierFictif(neuf(1)), { provisoire: false });
    assert.strictEqual(b.r.nomFichier, 'NEXUS_Paye_site-fictif_2026-11.pdf');
    assert.strictEqual(a.r.nomFichier, 'NEXUS_Paye_site-fictif_2026-11_PROVISOIRE.pdf');
  });

  await verifier('estProvisoire : genere_le (fuseau du site) avant le dernier jour du mois, date injectée', async () => {
    const { faux } = await generer(dossierFictif(neuf(1)), { provisoire: false });
    const f = faux.NexusPayeDossierPdf.estProvisoire;
    assert.strictEqual(typeof f, 'function');
    assert.strictEqual(f('2026-11-20T10:00:00Z', '2026-11-01', 'America/Martinique'), true);
    assert.strictEqual(f('2026-11-30T12:00:00Z', '2026-11-01', 'America/Martinique'), false);
    assert.strictEqual(f('2026-12-01T02:00:00Z', '2026-11-01', 'America/Martinique'), false);
    // 01/12 01:00 UTC = 30/11 21:00 en Martinique : encore le dernier jour, donc non provisoire.
    assert.strictEqual(f('2026-12-01T01:00:00Z', '2026-11-01', 'America/Martinique'), false);
    // 29/11 23:00 en Martinique = 30/11 03:00 UTC : veille du dernier jour, donc provisoire.
    assert.strictEqual(f('2026-11-30T03:00:00Z', '2026-11-01', 'America/Martinique'), true);
    assert.strictEqual(f('2027-02-15T12:00:00Z', '2027-02-01', 'America/Martinique'), true);
    assert.strictEqual(f('2027-02-28T12:00:00Z', '2027-02-01', 'America/Martinique'), false);
  });

  await verifier('deux générations : contenu identique page par page, hors ligne « Généré le »', async () => {
    const d1 = dossierFictif(neuf(5)); const d2 = JSON.parse(JSON.stringify(d1)); d2.genereLe = '2026-11-21T09:00:00Z';
    const a = await generer(d1, { provisoire: false }); const b = await generer(d2, { provisoire: false });
    const norm = j => j.textes.filter(e => !/Généré le/.test(e.t)).map(e => `${e.page}|${e.t}`);
    assert.deepStrictEqual(norm(a.j), norm(b.j));
  });

  await verifier('« aucune retenue automatique » écrit une seule fois', async () => {
    const { j } = await generer(dossierFictif(neuf(9)), { provisoire: false });
    assert.strictEqual(j.textes.filter(e => /aucune retenue automatique/i.test(e.t)).length, 1);
  });

  await verifier('la génération ne touche à aucune base (aucun appel réseau ni écriture)', async () => {
    const j = { textes: [], tailles: [], sauvegardes: 0 };
    const faux = charger(j);
    let appels = 0; faux.fetch = () => { appels++; }; faux.supabase = { from() { appels++; return {}; } }; faux.NexusPayeDonnees = new Proxy({}, { get() { appels++; return () => {}; } });
    await faux.NexusPayeDossierPdf.construireDossierPdf(dossierFictif(neuf(2)), { site: 's', provisoire: true });
    assert.strictEqual(appels, 0);
  });

  // Panneau : aperçu par lien <a target=_blank> préparé avant le clic, jamais window.open après un await.
  const html = fs.readFileSync(path.join(RACINE, 'NEXUS-Paye-v1.html'), 'utf8');
  await verifier('panneau : « Télécharger le PDF » actif en brouillon (dossier provisoire)', () => {
    assert.ok(/Télécharger le PDF/.test(html));
    assert.ok(/PROVISOIRE|provisoire/.test(html) && /dossierComptable\(RAPPORT\)/.test(html));
    assert.ok(!/id="dossierPdf"[^>]*disabled/.test(html));
  });
  await verifier('panneau : aperçu en <a target="_blank"> sur blob préparé, sans window.open après await', () => {
    assert.ok(/target="_blank"/.test(html) && /createObjectURL/.test(html) && /revokeObjectURL/.test(html));
    const fn = html.slice(html.indexOf('genererDossierPdf'));
    assert.ok(!/await[\s\S]{0,400}window\.open/.test(fn), 'window.open après await');
  });

  console.log(`\n${passes} verts, ${echecs.length} rouges`);
  if (echecs.length) process.exit(1);
})().catch(e => { console.error('ÉCHEC —', e.message); process.exit(1); });
