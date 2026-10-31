// Épreuve — 31/10/2026, lot FERMETURE-PISTE-20261031 (Accueil du pompiste : fermeture de la piste).
// Exigences (decision-1) : la fermeture s'ouvre 45 min avant la fin du quart, lue dans station_config.horaires selon le
// régime normal/étendu et le fuseau de la station, sans constante d'heure ; trois accès (heure, lien, menu) mènent au même fil ;
// un seul bouton plein par écran ; récapitulatif sans valeur inventée ; bouton final = « Pointer mon départ » (pointage existant,
// aucune écriture dans shifts) ; écran de choix du manager préservé. Chaque épreuve est contrôlée par une mutation.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };
const chargerStation = (src) => { const w = {}; new Function('window', src)(w); return w.NexusStation; };

const SRC = lire('nexus-accueil-piste.js');
const SRC_FIL = lire('nexus-fil-fin-quart.js');
const SRC_STATION = lire('nexus-station.js');
const SRC_MENU = lire('nexus-menu-accueil.js');
const APP = lire('NEXUS-App-v1.html');

const HORAIRES = { quart1: { normal: '05:00', etendu: '05:00', fin_normal: '13:15', fin_etendu: '14:15' },
  quart2: { normal: '13:15', etendu: '14:15', fin_normal: '20:10', fin_etendu: '22:10' } };
const attr = (u) => u.replace(/&/g, '&amp;'); // l'attribut HTML échappe l'esperluette ; le lien reste le même
const LIEN = 'NEXUS-Releves-Piste-v1.html?fil=fin-quart&etape=1&moment=fin_q1&plan=1.2';
// Mercredi 28/10/2026 : régime normal, fin du quart 1 à 13 h 15 -> 795 min ; fermeture proposée à 12 h 30 (750).
const base = { enService: true, consultationExterne: false, roleDuJour: 'pompiste', prenom: 'Karim', libelleRole: 'Pompiste', quart: 'matin',
  heureDebut: '2026-10-28T01:05:00Z', fuseau: 'Indian/Reunion', jaugeageApplicable: true, jaugeageFait: true, indexApplicable: true, indexFait: true,
  inventaireApplicable: true, inventaireFait: false, inventaireOuvertureFaite: true, receptionApplicable: true, commandes: [], dateLocale: '2026-10-28',
  missions: { total: 3, faites: 1 }, points: 2, filLien: null,
  finMinutes: 795, maintenantMinutes: 600, finIndexApplicable: true, finIndexFait: false, clotureInventaireFait: false, fermetureLien: LIEN };
const avant = (o) => Object.assign({}, base, o);
const apres = (o) => Object.assign({}, base, { maintenantMinutes: 760 }, o);          // 12 h 40 : dans la fenêtre
const terminee = (o) => Object.assign({}, base, { maintenantMinutes: 780, finIndexFait: true, clotureInventaireFait: true, pointageActif: true }, o);
const pleins = (h) => (h.match(/class="ap-bouton"/g) || []).length;

const EPREUVES = {
  // 1
  'bloc de fermeture absent avant l\'heure, présent après': (M) => {
    assert(!M.html(M.modele(avant())).includes('id="apFermeture"'));
    const h = M.html(M.modele(apres()));
    assert(h.includes('id="apFermeture"') && h.includes('Fermeture de la piste · avant 13 h 15') && h.includes('0 sur 2'));
    assert(!M.html(M.modele(avant({ maintenantMinutes: 749 }))).includes('id="apFermeture"'));
    assert(M.html(M.modele(avant({ maintenantMinutes: 750 }))).includes('id="apFermeture"'));
  },
  // 2
  'avant l\'heure : ligne d\'ouverture réduite, sous-ligne de proposition, lien texte': (M) => {
    const h = M.html(M.modele(avant()));
    assert(h.includes('Ouverture de la piste terminée') && h.includes('Fermeture proposée à partir de 12 h 30'));
    assert(h.includes('id="apFermerMaintenant"') && h.includes('Fermer la piste maintenant'));
    assert(/<a class="ap-lien-discret" id="apFermerMaintenant"/.test(h) && !/class="ap-bouton"[^>]*id="apFermerMaintenant"/.test(h));
    assert(!h.includes('ap-etapes'), 'l\'ouverture n\'affiche plus ses trois étapes');
  },
  // 3
  'les trois accès mènent au même fil, à la même étape': (M, MENU) => {
    const lien = M.html(M.modele(avant()));
    const heure = M.html(M.modele(apres()));
    assert(lien.includes('id="apFermerMaintenant" href="' + attr(LIEN) + '"'));
    assert(heure.includes('id="apBoutonFermeture" href="' + attr(LIEN) + '"'));
    const entrees = [].concat(...MENU.groupes({ enService: true, roleDuJour: 'pompiste', fermetureLien: LIEN }).map((g) => g.entrees));
    const fermer = entrees.find((e) => e.code === 'fermeture');
    assert(fermer && fermer.href === LIEN);
  },
  'fermeture reprise à l\'étape restante : le lien est celui du fil, jamais recalculé': (M) => {
    const autre = 'NEXUS-Inventaire-v1.html?fil=fin-quart&etape=2&plan=2';
    const h = M.html(M.modele(apres({ finIndexFait: true, fermetureLien: autre })));
    assert(h.includes('href="' + attr(autre) + '"') && !h.includes(LIEN) && h.includes('1 sur 2'));
  },
  // 4
  'un seul bouton plein par écran': (M) => {
    assert.strictEqual(pleins(M.html(M.modele(avant()))), 1);               // A : Commencer les missions
    assert.strictEqual(pleins(M.html(M.modele(apres()))), 1);               // B : Commencer la fermeture
    assert.strictEqual(pleins(M.html(M.modele(terminee()))), 1);            // C : Pointer mon départ
    assert(M.html(M.modele(avant())).includes('Commencer les missions'));
    assert(M.html(M.modele(apres())).includes('Commencer la fermeture'));
  },
  // 5
  'récapitulatif : rien d\'inventé, valeur absente omise': (M) => {
    const h = M.html(M.modele(terminee({ missions: { total: 4, faites: 3 }, points: 5 })));
    assert(h.includes('Quart terminé. Merci Karim') && h.includes('La piste est prête pour le quart du soir'));
    assert(h.includes('3 sur 4') && h.includes('+5 point'));
    assert(!/Ouverture[^<]*\d{2} h \d{2}/.test(h), 'aucune heure d\'ouverture sans donnée');
    assert(!/\d{2} h \d{2}\s*(→|à|-)\s*\d{2} h \d{2}/.test(h), 'aucune plage horaire sans donnée');
    const avecHeures = M.html(M.modele(terminee({ recap: { ouvertureDe: '2026-10-28T01:05:00Z', ouvertureA: '2026-10-28T01:20:00Z' } })));
    assert(avecHeures.includes('05 h 05') && avecHeures.includes('05 h 20'));
    assert(!M.html(M.modele(terminee({ missions: { total: 0, faites: 0 } }))).includes('0 sur 0'));
  },
  'le soir : aucune formule inventée': (M) => {
    const h = M.html(M.modele(terminee({ quart: 'soir', finMinutes: 1210 })));
    assert(!h.includes('prête pour le quart') && h.includes('Quart terminé. Merci Karim'));
  },
  // 6
  'régime normal le mercredi, étendu le jeudi, fuseau de la station': (M, MENU, ST) => {
    const mer = ST.finDuQuartMinutes(HORAIRES, 'quart1', 'Indian/Reunion', new Date('2026-10-28T06:00:00Z'));
    const jeu = ST.finDuQuartMinutes(HORAIRES, 'quart1', 'Indian/Reunion', new Date('2026-10-29T06:00:00Z'));
    assert.strictEqual(mer, 795); assert.strictEqual(jeu, 855);
    // mercredi 21 h UTC = jeudi 01 h à La Réunion : c'est le jour de la station qui compte, pas celui de l'appareil
    assert.strictEqual(ST.finDuQuartMinutes(HORAIRES, 'quart1', 'Indian/Reunion', new Date('2026-10-28T21:00:00Z')), 855);
    assert.strictEqual(ST.finDuQuartMinutes(HORAIRES, 'quart2', 'Indian/Reunion', new Date('2026-10-30T06:00:00Z')), 1330);
    assert.strictEqual(ST.finDuQuartMinutes({ quart1: { fin_normal: '13:15' } }, 'quart1', 'Indian/Reunion', new Date('2026-10-29T06:00:00Z')), 795, 'repli en bloc sur normal');
    assert.strictEqual(ST.finDuQuartMinutes({}, 'quart1', 'Indian/Reunion', new Date('2026-10-29T06:00:00Z')), null);
    assert.throws(() => ST.finDuQuartMinutes(HORAIRES, 'quart1', '', new Date()), TypeError, 'fuseau obligatoire');
  },
  'horaire indéterminé : aucune fermeture proposée, aucune devinette': (M) => {
    const h = M.html(M.modele(avant({ finMinutes: null, maintenantMinutes: 800 })));
    assert(!h.includes('id="apFermeture"') && !h.includes('Fermeture proposée') && !h.includes('apFermerMaintenant'));
  },
  // 8
  'bouton final : « Pointer mon départ » vers le pointage existant': (M) => {
    const h = M.html(M.modele(terminee()));
    assert(/<a class="ap-bouton" id="apBoutonDepart" href="NEXUS-Pointage-v1\.html">Pointer mon départ<\/a>/.test(h));
    assert(h.includes('Je reste encore : voir les missions') && h.includes('NEXUS-Missions-v1.html'));
    assert(!h.includes('apFermeture"'));
  },
  // 8 bis : corrections du Guardian (rapport 6545741605)
  'sans pointage actif : pas de « Pointer mon départ », un bouton plein « Se déconnecter »': (M) => {
    const h = M.html(M.modele(terminee({ pointageActif: false })));
    assert(!h.includes('Pointer mon départ') && !h.includes('apBoutonDepart'));
    assert(/<a class="ap-bouton" id="apLogout" href="#">Se déconnecter<\/a>/.test(h) && (h.match(/id="apLogout"/g) || []).length === 1);
    assert.strictEqual(pleins(h), 1);
    assert(M.html(M.modele(terminee())).includes('Pointer mon départ'));
  },
  'récapitulatif : coche seulement sur ce qui est fait, heures issues des relevés': (M) => {
    const h = M.html(M.modele(terminee({ missions: { total: 3, faites: 0 }, points: 0,
      recap: { ouvertureA: '2026-10-28T02:10:00Z', fermetureDe: '2026-10-28T08:40:00Z', fermetureA: '2026-10-28T09:05:00Z' } })));
    assert(/ap-a_faire"><span class="ap-marque" aria-hidden="true">○<\/span>Missions · 0 sur 3/.test(h));
    assert(/ap-a_faire"><span class="ap-marque" aria-hidden="true">○<\/span>\+0 point/.test(h));
    assert(/ap-fait"><span class="ap-marque" aria-hidden="true">✓<\/span>Fermeture · 12 h 40/.test(h) && h.includes('13 h 05'));
    assert(/Ouverture · /.test(h) && h.includes('06 h 10'));
    const v = M.html(M.modele(terminee({ missions: { total: 3, faites: 3 }, points: 2 })));
    assert(/✓<\/span>Missions · 3 sur 3/.test(v) && !/Ouverture ·|Fermeture ·/.test(v), 'valeur absente : ligne omise');
  },
  'la carte de poste figure sur l\'écran terminé et la fin du quart avant l\'heure': (M) => {
    const t = M.html(M.modele(terminee()));
    assert(t.includes('id="apPoste"') && t.includes('Quart du matin · fin à 13 h 15'));
    assert(M.html(M.modele(avant())).includes('Quart du matin · fin à 13 h 15'));
    assert(!M.html(M.modele(avant({ finMinutes: null }))).includes('fin à'));
  },
  'bloc de fermeture : étapes nommées, barre remplie de gauche à droite': (M) => {
    const h = M.html(M.modele(apres({ finIndexFait: false, clotureInventaireFait: true })));
    assert(h.includes('id="apEtapesFermeture"') && h.includes('Index de fin de quart') && h.includes('Inventaire de clôture zone piste'));
    assert(/ap-a_faire"><span class="ap-marque" aria-hidden="true">○<\/span>Index de fin/.test(h));
    assert(/ap-fait"><span class="ap-marque" aria-hidden="true">✓<\/span>Inventaire de clôture/.test(h));
    assert(h.includes('<div class="ap-segments"><i class="ap-plein"></i><i class=""></i></div>'), 'une étape faite : premier segment plein');
    assert(M.html(M.modele(apres())).includes('<div class="ap-segments"><i class=""></i><i class=""></i></div>'));
  },
  'le lien « Voir » est discret, souligné et gris': () => {
    const css = fs.readFileSync('NEXUS-App-v1.html', 'utf8');
    assert(/\.ap-fil-resume a\s*\{[^}]*text-decoration:\s*underline/.test(css) && /\.ap-etape\.ap-a_faire\s*\{[^}]*color/.test(css));
  },
  'l\'App passe le pointage du site, le récapitulatif et l\'heure de finalisation': () => {
    const app = fs.readFileSync('NEXUS-App-v1.html', 'utf8');
    assert(/pointageActif:\s*pointageActifSite === true/.test(app) && /recap:\s*recapQuart/.test(app) && /finalise_le/.test(app) && /cloture_le/.test(app));
  },
  'le manager et un autre rôle n\'entrent pas dans le mode': (M) => {
    assert.strictEqual(M.modele(apres({ roleDuJour: 'caissiere' })), null);
    assert.strictEqual(M.modele(apres({ enService: false })), null);
  },
  'fermeture non commencée tant que l\'ouverture n\'est pas faite': (M) => {
    const h = M.html(M.modele(apres({ inventaireOuvertureFaite: false, inventaireFait: false, filLien: 'NEXUS-Inventaire-v1.html?fil=debut-quart&etape=3' })));
    assert(!h.includes('id="apFermeture"') && h.includes('Continuer : Inventaire zone piste'));
  },
};

const FIL = charger(SRC_FIL);
const EPREUVES_FIL = {
  'fil de fermeture : deux étapes, clé de stockage distincte': () => {
    assert.strictEqual(FIL.NOMBRE_ETAPES, 2);
    assert.strictEqual(FIL.etapeDe('?fil=fin-quart&etape=2'), 2);
    assert.strictEqual(FIL.etapeDe('?fil=debut-quart&etape=2'), null);
    assert.strictEqual(FIL.etapeDe('?fil=fin-quart&etape=3'), null);
    const mem = {}; const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
    FIL.atteindre(st, 'e1', '2026-10-28', 2);
    assert(Object.keys(mem)[0].startsWith('nexus_fil_fin_quart_') && !Object.keys(mem)[0].includes('debut'));
  },
  'fil de fermeture : index de fin puis inventaire de clôture, reprise à l\'étape restante': () => {
    assert(FIL.urlEtape(1, 'fin_q1', [1, 2]).startsWith('NEXUS-Releves-Piste-v1.html?fil=fin-quart&etape=1&moment=fin_q1'));
    assert(FIL.urlEtape(2, 'fin_q1', [1, 2]).startsWith('NEXUS-Inventaire-v1.html?fil=fin-quart&etape=2'));
    assert.strictEqual(FIL.urlApres(2, 'fin_q1', [1, 2]), FIL.ACCUEIL);
    assert.deepStrictEqual(FIL.planSelonFaits({ resteIndex: false, resteInventaire: true }), [2]);
    const st = { getItem: () => null, setItem: () => {} };
    assert(FIL.urlRepriseSelonFaits(st, 'e1', 'd', 'fin_q1', { resteIndex: false, resteInventaire: true }).includes('etape=2'));
    assert.strictEqual(FIL.urlRepriseSelonFaits(st, 'e1', 'd', 'fin_q1', { resteIndex: false, resteInventaire: false }), null);
    assert.strictEqual(FIL.libelleProgression(2, [2]), 'Étape 1 sur 1');
  },
};

function jouer(M, MENU, ST) { for (const nom of Object.keys(EPREUVES)) EPREUVES[nom](M, MENU, ST); }
const M0 = charger(SRC); const MENU0 = charger(SRC_MENU); const ST0 = chargerStation(SRC_STATION);
jouer(M0, MENU0, ST0);
for (const nom of Object.keys(EPREUVES_FIL)) EPREUVES_FIL[nom]();

// 7 : aucune constante d'heure dans les modules de la fermeture (les horaires viennent de station_config.horaires).
function sansHeureEnDur(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!/['"`]\d{1,2}:\d{2}['"`]/.test(code), 'heure HH:MM en dur');
  assert(!/\b(1[0-9]|2[0-3]|0?[0-9]) ?h ?[0-5]\d\b/.test(code.replace(/'09 h 05'/g, '')), 'heure « H h MM » en dur');
}
function corpsFinDuQuart(src) { const i = src.indexOf('function finDuQuartMinutes'); assert(i >= 0, 'finDuQuartMinutes absente'); return src.slice(i, i + 900); }
sansHeureEnDur(SRC); sansHeureEnDur(SRC_FIL); sansHeureEnDur(corpsFinDuQuart(SRC_STATION));
assert(/DELAI_FERMETURE_MIN\s*=\s*45/.test(SRC), 'le délai de 45 minutes est une constante nommée');

// L'App : fil de fermeture câblé, horaires lus dans station_config, écran de choix du manager préservé, aucune écriture dans shifts.
assert(APP.includes('nexus-fil-fin-quart.js'), 'App charge le fil de fermeture');
assert(/finDuQuartMinutes\(/.test(APP) && /station_config/.test(APP), 'App : fin du quart lue dans station_config.horaires');
assert(/fermetureLien/.test(APP) && /finMinutes/.test(APP) && /maintenantMinutes/.test(APP), 'App transmet les faits de fermeture');
assert(!/from\('shifts'\)\s*\.(insert|update|upsert)/.test(APP), 'aucune écriture dans shifts');
assert(/code: 'index'[^\n]*href: URL\.index/.test(SRC_MENU) && /manager/.test(SRC_MENU.slice(SRC_MENU.indexOf("'index'") - 200, SRC_MENU.indexOf("'index'"))), 'manager : écran de choix conservé');
for (const p of ['NEXUS-Releves-Piste-v1.html', 'NEXUS-Inventaire-v1.html']) {
  const s = lire(p);
  assert(s.includes('nexus-fil-fin-quart.js') && /NexusFilFinQuart/.test(s), p + ' : honore fil=fin-quart');
}

// Menu : le pompiste en service voit « Fermeture de la piste » à la place de « Relevés d'index » ; le manager garde l'écran de choix.
const entreesMenu = (M, f) => [].concat(...M.groupes(f).map((g) => g.entrees));
function epreuvesMenu(M) {
  const p = entreesMenu(M, { enService: true, roleDuJour: 'pompiste', receptionApplicable: true, fermetureLien: LIEN });
  const f = p.find((e) => e.code === 'fermeture');
  assert(f && f.libelle === 'Fermeture de la piste' && /Index de fin, puis inventaire de clôture/.test(f.sousTitre || ''), 'entrée Fermeture + sous-titre');
  assert(!p.some((e) => e.code === 'index'), 'le pompiste n\'a plus « Relevés d\'index »');
  assert(p.findIndex((e) => e.code === 'reception') < p.findIndex((e) => e.code === 'fermeture'), 'Réception puis Fermeture');
  const m = entreesMenu(M, { estNiveauManager: true, roleDuJour: 'manager', fermetureLien: LIEN });
  assert(m.some((e) => e.code === 'index' && e.href === 'NEXUS-Releves-Piste-v1.html') && !m.some((e) => e.code === 'fermeture'), 'manager : écran de choix');
}
epreuvesMenu(MENU0);

const MUTATIONS = [
  ['fermeture toujours ouverte', SRC, (s) => s.replace(/maintenant\s*>=\s*debut/, 'true'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['fenêtre à 30 min', SRC, (s) => s.replace('DELAI_FERMETURE_MIN = 45', 'DELAI_FERMETURE_MIN = 30'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['lien texte absent', SRC, (s) => s.replace('Fermer la piste maintenant', 'Fermer'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['lien texte en bouton', SRC, (s) => s.replace('class="ap-lien-discret" id="apFermerMaintenant"', 'class="ap-bouton" id="apFermerMaintenant"'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['bouton de fermeture hors du fil', SRC, (s) => s.replace("id=\"apBoutonFermeture\" href=\"' + esc(fe.href)", "id=\"apBoutonFermeture\" href=\"NEXUS-Inventaire-v1.html"), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['deux boutons pleins à l\'écran C', SRC, (s) => s.replace('Je reste encore', '<a class="ap-bouton" href="#">x</a>Je reste encore'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['libellé final inventé', SRC, (s) => s.replace('Pointer mon départ', 'Terminer mon quart'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['formule du soir inventée', SRC, (s) => s.replace("f.quart === 'matin'", 'true'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['heure estimée sans donnée', SRC, (s) => s.replace('heureLocale(rc.ouvertureDe, f.fuseau)', 'heureLocale(rc.ouvertureDe || f.heureDebut, f.fuseau)'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['missions 0 sur 0 affichées', SRC, (s) => s.replace('m.total > 0', 'true'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['fermeture avant la fin de l\'ouverture', SRC, (s) => s.replace('filTermine && fermetureOuverte', 'fermetureOuverte'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['horaire indéterminé deviné', SRC, (s) => s.replace('f.finMinutes != null', 'true'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['régime toujours normal', SRC_STATION, (s) => s.replace("const regime = cleHoraireDuJour(timezone, instant);", "const regime = 'normal';"), (s) => { const M = charger(SRC); jouer(M, MENU0, chargerStation(s)); }],
  ['pas de repli en bloc sur normal', SRC_STATION, (s) => s.replace("|| q['fin_normal']", ''), (s) => { jouer(M0, MENU0, chargerStation(s)); }],
  ['menu : lien différent', SRC_MENU, (s) => s.replace('href: f.fermetureLien', "href: URL.index"), (s) => { jouer(M0, charger(s), ST0); }],
  ['menu : le pompiste garde les index', SRC_MENU, (s) => s.replace("if (manager || (f.enService && !f.fermetureLien)) carburant.push({ code: 'index'", "if (true) carburant.push({ code: 'index'"), (s) => { epreuvesMenu(charger(s)); }],
  ['menu : le manager perd son écran de choix', SRC_MENU, (s) => s.replace("if (manager || (f.enService && !f.fermetureLien)) carburant.push({ code: 'index'", "if (!manager && f.enService) carburant.push({ code: 'index'"), (s) => { epreuvesMenu(charger(s)); }],
  ['pointer son départ sans pointage actif', SRC, (s) => s.replace('t.pointageActif\n          ?', 'true\n          ?').replace("(t.pointageActif\n", "(true\n"), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['coche posée sur ce qui n\'est pas fait', SRC, (s) => s.replace("['Missions', t.missions, t.missionsToutes]", "['Missions', t.missions, true]"), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['point sans coche conditionnelle', SRC, (s) => s.replace("v.points > 0) + '</ul>'", "true) + '</ul>'"), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['carte de poste absente du récapitulatif', SRC, (s) => s.replace("+ '</div>' + carte;\n      out += '<section class=\"ap-fil\" id=\"apRecap\">", "+ '</div>';\n      out += '<section class=\"ap-fil\" id=\"apRecap\">"), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['fin du quart omise de la carte', SRC, (s) => s.replace("p.fin ? 'fin à ' + p.fin : ''", "''"), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['étapes de fermeture non listées', SRC, (s) => s.replace('id="apEtapesFermeture"', 'id="apX"'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['barre remplie par position et non par nombre', SRC, (s) => s.replace('i < fermetureFaites', 'e.fait'), (s) => { const M = charger(s); jouer(M, MENU0, ST0); }],
  ['fil : clé de stockage du début de quart', SRC_FIL, (s) => s.replace('nexus_fil_fin_quart_', 'nexus_fil_debut_quart_'), (s) => { const F = charger(s); const mem = {}; F.atteindre({ getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } }, 'e', 'd', 2); assert(Object.keys(mem)[0].startsWith('nexus_fil_fin_quart_')); }],
  ['fil : trois étapes', SRC_FIL, (s) => s.replace('NOMBRE_ETAPES = 2', 'NOMBRE_ETAPES = 3'), (s) => { assert.strictEqual(charger(s).NOMBRE_ETAPES, 2); }],
  ['fil : inventaire avant les index', SRC_FIL, (s) => s.replace(/PAGES = \{ 1: '[^']+', 2: '[^']+' \}/, "PAGES = { 1: 'NEXUS-Inventaire-v1.html', 2: 'NEXUS-Releves-Piste-v1.html' }"), (s) => { const F = charger(s); assert(F.urlEtape(1, 'fin_q1', [1, 2]).startsWith('NEXUS-Releves-Piste-v1.html')); }],
];
for (const [nom, src, mut, preuve] of MUTATIONS) {
  const m = mut(src); assert.notStrictEqual(m, src, 'mutation sans effet : ' + nom);
  if (!preuve) continue;
  assert.throws(() => preuve(m), undefined, 'mutation survivante : ' + nom);
}
console.log('OK — ' + (Object.keys(EPREUVES).length + Object.keys(EPREUVES_FIL).length) + ' épreuves, ' + MUTATIONS.filter((x) => x[3]).length + ' mutations tuées');
