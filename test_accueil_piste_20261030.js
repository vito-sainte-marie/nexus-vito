// Épreuve — 30/10/2026, lot ACCUEIL-EN-SERVICE-20261030 (Accueil du pompiste en service).
// Exigences : un seul bouton principal par état ; ce bouton mène exactement où mène le fil de l'Accueil (filLien, inchangé) ;
// tuile Réception présente pour le pompiste en service, mise en avant seulement avec une commande attendue AUJOURD'HUI dans un statut attendu ;
// le mode ne s'applique ni hors service, ni en consultation externe, ni à un autre rôle ; Missions absente pendant le fil, sans bouton une fois les missions faites ;
// la carte de poste a la même taille dans tous les états ; l'App ne réécrit pas le fil et n'écrit rien dans shifts.
// Le module est exécuté tel quel ; chaque épreuve est contrôlée par une mutation.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };
const SRC = lire('nexus-accueil-piste.js');
const APP = lire('NEXUS-App-v1.html');

const base = { enService: true, consultationExterne: false, roleDuJour: 'pompiste', prenom: 'Karim', libelleRole: 'Pompiste', quart: 'matin',
  heureDebut: '2026-10-30T05:05:00Z', fuseau: 'Indian/Reunion', jaugeageApplicable: true, jaugeageFait: false, indexApplicable: true, indexFait: false,
  inventaireApplicable: true, inventaireFait: false, inventaireOuvertureFaite: false, receptionApplicable: true, commandes: [], dateLocale: '2026-10-30',
  missions: { total: 3, faites: 0 }, points: 0, filLien: 'NEXUS-Carburant-Jaugeage-v1.html?x=1' };
const cmd = (o) => Object.assign({ livraison_prevue_le: '2026-10-30', statut: 'validee', carburants: { sp95: { volumeL: 5000 }, go: { volumeL: 8000 } } }, o);

const EPREUVES = {
  'un seul bouton principal pendant le fil, vers filLien': (M) => {
    const h = M.html(M.modele(base));
    assert.strictEqual((h.match(/class="ap-bouton"/g) || []).length, 1);
    assert(h.includes('href="NEXUS-Carburant-Jaugeage-v1.html?x=1"') && h.includes('Continuer : Jaugeage Veeder-Root'));
  },
  'fil terminé : aucun bouton du fil, un seul bouton Missions': (M) => {
    const v = M.modele(Object.assign({}, base, { jaugeageFait: true, indexFait: true, inventaireFait: true }));
    const h = M.html(v);
    assert(h.includes('Ouverture de la piste terminée') && !h.includes('apBoutonPrincipal'));
    assert.strictEqual((h.match(/class="ap-bouton"/g) || []).length, 1);
    assert(h.includes('apMissions'));
  },
  'Missions absente pendant le fil': (M) => { assert(!M.html(M.modele(base)).includes('apMissions')); },
  'missions toutes faites : plus de bouton': (M) => {
    const h = M.html(M.modele(Object.assign({}, base, { jaugeageFait: true, indexFait: true, inventaireFait: true, missions: { total: 3, faites: 3 } })));
    assert(!h.includes('class="ap-bouton"'));
  },
  'progression n sur 3 et étape sans objet comptée': (M) => {
    const v = M.modele(Object.assign({}, base, { jaugeageApplicable: false, indexFait: true }));
    assert.strictEqual(v.total, 3); assert.strictEqual(v.faites, 2);
    assert(M.html(v).includes('2 sur 3'));
  },
  'tuile Réception visible sans livraison : texte neutre': (M) => {
    const h = M.html(M.modele(base));
    assert(h.includes('id="apReception"') && h.includes('Un camion arrive ? Commencez ici') && !h.includes('ap-attendue'));
  },
  'tuile Réception mise en avant avec commande du jour': (M) => {
    const h = M.html(M.modele(Object.assign({}, base, { commandes: [cmd()] })));
    assert(h.includes('ap-attendue') && h.includes('Livraison prévue ce matin · SP95 et GO'));
  },
  'commande d\'un autre jour ou statut non attendu : pas de mise en avant': (M) => {
    const h = M.html(M.modele(Object.assign({}, base, { commandes: [cmd({ livraison_prevue_le: '2026-10-31' }), cmd({ statut: 'annulee' }), cmd({ statut: 'livree' })] })));
    assert(!h.includes('ap-attendue'));
  },
  'rôle Réception du site non employé : pas de tuile': (M) => {
    assert(!M.html(M.modele(Object.assign({}, base, { receptionApplicable: false }))).includes('apReception'));
  },
  'mode inactif hors service, en consultation externe, autre rôle': (M) => {
    assert.strictEqual(M.modele(Object.assign({}, base, { enService: false })), null);
    assert.strictEqual(M.modele(Object.assign({}, base, { consultationExterne: true })), null);
    assert.strictEqual(M.modele(Object.assign({}, base, { roleDuJour: 'caissiere' })), null);
  },
  'heure de début en heure de la station': (M) => {
    assert.strictEqual(M.heureLocale('2026-10-30T05:05:00Z', 'Indian/Reunion'), '09 h 05');
    assert(M.html(M.modele(base)).includes('En service depuis 09 h 05'));
  },
  'carte de poste : taille fixe, jamais écrasée': () => {
    assert(/\.ap-poste\{[^}]*height:104px[^}]*flex-shrink:0/.test(APP));
  },
  'bouton absent si le fil n\'a pas de lien': (M) => {
    assert(!M.html(M.modele(Object.assign({}, base, { filLien: null }))).includes('apBoutonPrincipal'));
  },
};
function jouer(M, nom) { EPREUVES[nom](M); }
const M0 = charger(SRC);
for (const nom of Object.keys(EPREUVES)) { jouer(M0, nom); }

// L'App : fil inchangé, aucune écriture dans shifts, bouton alimenté par filLien.
assert(/missions: missionsInfo, points: missionsInfo\.pointsAujourdhui, filLien,/.test(APP), 'App : filLien transmis tel quel');
assert(!/from\('shifts'\)\s*\.insert/.test(APP));
assert(/\.in\('statut', NexusAccueilPiste\.STATUTS_COMMANDE_ATTENDUE\)/.test(APP) && /eq\('livraison_prevue_le', todayISO\)/.test(APP));
assert(APP.includes('nexus-accueil-piste.js'));

// Mutations : chacune doit rougir au moins une épreuve.
const MUTATIONS = [
  ['deux boutons', (s) => s.replace("(v.bouton ? '<a class=\"ap-bouton\"", "(true ? '<a class=\"ap-bouton\"").replace("' + esc(v.bouton.libelle) + '</a>' : '')", "' + esc(v.bouton ? v.bouton.libelle : '') + '</a>' : '') + '<a class=\"ap-bouton\" href=\"#\">x</a>'")],
  ['bouton hors filLien', (s) => s.replace('href: f.filLien }', "href: 'NEXUS-Missions-v1.html' }")],
  ['Missions pendant le fil', (s) => s.replace('missions: filTermine ?', 'missions: true ?')],
  ['tuile sans commande du jour', (s) => s.replace("c.livraison_prevue_le !== dateLocale", 'false')],
  ['statut quelconque', (s) => s.replace('STATUTS_COMMANDE_ATTENDUE.indexOf(c.statut) === -1', 'false')],
  ['tuile ignore le rôle du site', (s) => s.replace('reception: f.receptionApplicable ?', 'reception: true ?')],
  ['mode hors service', (s) => s.replace('!f.enService || ', '')],
  ['mode consultation externe', (s) => s.replace(' || f.consultationExterne', '')],
  ['mode tout rôle', (s) => s.replace(" || f.roleDuJour !== 'pompiste'", '')],
  ['heure en UTC', (s) => s.replace('timeZone: fuseau || undefined', "timeZone: 'UTC'")],
  ['étape sans objet non comptée', (s) => s.replace("e.etat !== 'a_faire'", "e.etat === 'fait'")],
  ['bouton sans filLien', (s) => s.replace('(!filTermine && f.filLien)', '(!filTermine)')],
];
for (const [nom, mut] of MUTATIONS) {
  const src = mut(SRC); assert.notStrictEqual(src, SRC, 'mutation sans effet : ' + nom);
  let rouge = false;
  try { const M = charger(src); for (const e of Object.keys(EPREUVES)) { try { jouer(M, e); } catch (_) { rouge = true; break; } } } catch (_) { rouge = true; }
  assert(rouge, 'mutation survivante : ' + nom);
}
console.log('OK — ' + Object.keys(EPREUVES).length + ' épreuves, ' + MUTATIONS.length + ' mutations tuées');
