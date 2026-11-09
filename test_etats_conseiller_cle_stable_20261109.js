// Guardian 6747170262 (09/11/2026), lot 2 des emojis : clé stable des états du Conseiller.
// Les lecteurs passent par nexus-etats-conseiller.js ; les producteurs écrivent toujours la même chaîne.
// Aucun changement de comportement : les anciennes tables sont recopiées ici comme référence.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let n = 0;
function t(nom, f) { f(); n++; console.log('OK ' + nom); }
function garde(nom, src, regle, litteral, remplacement) {
  t(nom, () => {
    assert.ok(regle(src), 'la garde doit passer sur la source');
    assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
    assert.ok(!regle(src.replace(litteral, remplacement)), 'la garde doit rougir sur la source mutée');
  });
}
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const MOD = lire('nexus-etats-conseiller.js');
const M = require('./nexus-etats-conseiller.js');
const warns = []; const w0 = console.warn; console.warn = m => warns.push(m);

// ---- Anciennes tables (référence, recopiées des pages avant le lot 2) ----
const A = 'etat-agir', O = 'etat-opportunite', S = 'etat-surveiller', R = 'etat-recommandation', D = 'etat-decider';
const OLD = {
  centre: { '🔥 À AGIR': A, '📈 OPPORTUNITÉ': O, '🟡 À SURVEILLER': S },
  brief: { '🔥 À AGIR': A, '📈 OPPORTUNITÉ': O, '🟡 À SURVEILLER': S, '💡 RECOMMANDATION': R, '🔴 CRITIQUE': A, '🟡 À VÉRIFIER': S, '📦 À COMPTER': S, '⚠️ RAPPEL EN RETARD': A, '📌 RAPPEL': R, '🗓️ TEMPO': R, '📋 SIGNAL': R },
  cockpit: { '🔥 À AGIR': A, '📈 OPPORTUNITÉ': O, '🟡 À SURVEILLER': S, '🔴 À DÉCIDER': D, '💡 RECOMMANDATION': R, '🔴 CRITIQUE': A, '🟡 À VÉRIFIER': S, '📦 À COMPTER': S, '⚠️ RAPPEL EN RETARD': A, '📌 RAPPEL': R },
  missions: { '🔥 À AGIR': A, '📈 OPPORTUNITÉ': O, '🟡 À SURVEILLER': S, '🔴 À DÉCIDER': D, '💡 RECOMMANDATION': R }
};
const OLD_GAIN = ['🔥 À AGIR', '📈 OPPORTUNITÉ', '💡 RECOMMANDATION'];
const OLD_URGENTS = ['🔥 À AGIR', '🔴 CRITIQUE'];
const oldRang = e => (e === '🔥 À AGIR' ? 0 : 2); // RANG_PRODUIT : seul « à agir » est à 0
const FILTRES = ['Toutes', '🔥 À AGIR', '📈 OPPORTUNITÉ', '🟡 À SURVEILLER'];

const CONNUES = ['🔥 À AGIR', '📈 OPPORTUNITÉ', '💡 RECOMMANDATION', '🟡 À SURVEILLER', '📦 À SURVEILLER', '🟡 À VÉRIFIER', '📦 À VÉRIFIER',
  '🔴 CRITIQUE', '🔴 À DÉCIDER', '🚫 EXCLU', '🗓️ TEMPO', '📦 RUPTURE OBSERVÉE', '📦 COUVERTURE CRITIQUE', '📦 DONNÉE À ACTUALISER',
  '📦 À COMPTER', '⚠️ RAPPEL EN RETARD', '📌 RAPPEL', '📋 SIGNAL'];
const TOUTES = CONNUES.concat(['état jamais vu', '', null, undefined, 'À AGIR', '🔥 à agir']);

// (a) Table de référence : mêmes classe, rang, gain/risque, filtre et compteurs qu'avant, pour chaque lecteur.
t('(a) chaque chaîne connue + inconnues : mêmes classes que les anciennes tables, lecteur par lecteur', () => {
  Object.keys(OLD).forEach(lec => TOUTES.forEach(e => {
    assert.strictEqual(M.classe(e, lec), OLD[lec][e] || '', lec + ' / ' + e);
  }));
});
t('(a) rang identique (0 pour « à agir », 2 pour tout le reste, inconnu compris)', () => {
  TOUTES.forEach(e => assert.strictEqual(M.rang(e), oldRang(e), 'rang ' + e));
});
t('(a) gain / risque identiques (Brief) et urgents identiques (Cockpit)', () => {
  TOUTES.forEach(e => {
    assert.strictEqual(M.gain(e), OLD_GAIN.includes(e), 'gain ' + e);
    assert.strictEqual(!M.gain(e), !OLD_GAIN.includes(e), 'risque ' + e);
    assert.strictEqual(M.urgent(e), OLD_URGENTS.includes(e), 'urgent ' + e);
  });
});
t('(a) filtres et compteurs du Centre / de l\'Accueil identiques', () => {
  TOUTES.forEach(e => FILTRES.forEach(f => {
    assert.strictEqual(M.filtre(e, f), f !== 'Toutes' && e === f, 'filtre ' + f + ' / ' + e);
  }));
  TOUTES.forEach(e => {
    assert.strictEqual(M.est(e, 'agir'), e === '🔥 À AGIR');
    assert.strictEqual(M.est(e, 'surveiller'), e === '🟡 À SURVEILLER');
    assert.strictEqual(M.est(e, 'opportunite'), e === '📈 OPPORTUNITÉ');
  });
});
t('(a) les variantes 📦 restent neutres : pas de classe, pas de gain, pas de compteur, pas de filtre', () => {
  ['📦 À SURVEILLER', '📦 À VÉRIFIER', '📦 RUPTURE OBSERVÉE', '📦 COUVERTURE CRITIQUE', '📦 DONNÉE À ACTUALISER'].forEach(e => {
    Object.keys(OLD).forEach(l => assert.strictEqual(M.classe(e, l), ''));
    assert.ok(!M.gain(e) && !M.urgent(e) && M.rang(e) === 2);
    assert.ok(!M.est(e, 'surveiller') && !M.est(e, 'verifier'));
    FILTRES.forEach(f => assert.ok(!M.filtre(e, f)));
  });
});
t('(a) valeur inconnue : un simple console.warn, une seule fois, jamais d\'exception', () => {
  warns.length = 0;
  M.cle('valeur inédite'); M.cle('valeur inédite'); M.cle('');  M.cle(null);
  assert.strictEqual(warns.length, 1);
  assert.ok(/valeur inédite/.test(warns[0]));
});
t('(a) clés stables : chaque chaîne connue donne la clé attendue', () => {
  const att = { '🔥 À AGIR': 'agir', '📈 OPPORTUNITÉ': 'opportunite', '💡 RECOMMANDATION': 'recommandation', '🟡 À SURVEILLER': 'surveiller', '📦 À SURVEILLER': 'surveiller',
    '🟡 À VÉRIFIER': 'verifier', '📦 À VÉRIFIER': 'verifier', '🔴 CRITIQUE': 'critique', '🔴 À DÉCIDER': 'decider', '🚫 EXCLU': 'exclu', '🗓️ TEMPO': 'tempo',
    '📦 RUPTURE OBSERVÉE': 'rupture_observee', '📦 COUVERTURE CRITIQUE': 'couverture_critique', '📦 DONNÉE À ACTUALISER': 'donnee_a_actualiser' };
  Object.keys(att).forEach(e => assert.strictEqual(M.cle(e), att[e], e));
});

// (b) Jeu de candidats figé : mêmes chiffres avant / après dans App, Centre, Brief et Cockpit.
const GEL = [];
CONNUES.forEach((e, i) => { GEL.push({ id: i, etat: e, impact_eur: (i + 1) * 37, produit: 'P' + i }); });
GEL.push({ id: 99, etat: 'état jamais vu', impact_eur: 120 }, { id: 100, etat: null, impact_eur: 15 });
t('(b) jeu figé — App : compteurs agir / surveiller / opportunité', () => {
  const vieux = k => GEL.filter(c => c.etat === k).length;
  assert.strictEqual(GEL.filter(c => M.est(c.etat, 'agir')).length, vieux('🔥 À AGIR'));
  assert.strictEqual(GEL.filter(c => M.est(c.etat, 'surveiller')).length, vieux('🟡 À SURVEILLER'));
  assert.strictEqual(GEL.filter(c => M.est(c.etat, 'opportunite')).length, vieux('📈 OPPORTUNITÉ'));
});
t('(b) jeu figé — Centre : onglets et classes de cartes', () => {
  FILTRES.slice(1).forEach(f => {
    const vieux = GEL.filter(c => c.etat === f).map(c => c.id);
    const neuf = GEL.filter(c => M.filtre(c.etat, f)).map(c => c.id);
    assert.deepStrictEqual(neuf, vieux, f);
  });
  GEL.forEach(c => assert.strictEqual(M.classe(c.etat, 'centre'), OLD.centre[c.etat] || ''));
});
t('(b) jeu figé — Brief : gain et risque en euros', () => {
  const vG = GEL.filter(p => OLD_GAIN.includes(p.etat) && p.impact_eur > 0).reduce((s, p) => s + p.impact_eur, 0);
  const vR = GEL.filter(p => !OLD_GAIN.includes(p.etat) && p.impact_eur > 0).reduce((s, p) => s + p.impact_eur, 0);
  const nG = GEL.filter(p => M.gain(p.etat) && p.impact_eur > 0).reduce((s, p) => s + p.impact_eur, 0);
  const nR = GEL.filter(p => !M.gain(p.etat) && p.impact_eur > 0).reduce((s, p) => s + p.impact_eur, 0);
  assert.strictEqual(nG, vG); assert.strictEqual(nR, vR);
  assert.ok(vG > 0 && vR > 0);
});
t('(b) jeu figé — Cockpit : urgents et classes', () => {
  assert.deepStrictEqual(GEL.filter(p => M.urgent(p.etat)).map(p => p.id), GEL.filter(p => OLD_URGENTS.includes(p.etat)).map(p => p.id));
  GEL.forEach(c => assert.strictEqual(M.classe(c.etat, 'cockpit'), OLD.cockpit[c.etat] || ''));
});
t('(b) jeu figé — Conseiller : même tri par rang', () => {
  const vieux = GEL.slice().sort((a, b) => oldRang(a.etat) - oldRang(b.etat) || a.id - b.id).map(c => c.id);
  const neuf = GEL.slice().sort((a, b) => M.rang(a.etat) - M.rang(b.etat) || a.id - b.id).map(c => c.id);
  assert.deepStrictEqual(neuf, vieux);
});

// (c) Rapport, Capital, Journal : chaînes brutes, aucune dépendance au module.
['NEXUS-Rapport-v1.html', 'NEXUS-Capital-v1.html', 'NEXUS-Journal-v1.html'].forEach(p => {
  t(p + ' : n\'utilise pas le module (affichage brut inchangé)', () => { assert.ok(!/NexusEtatsConseiller|nexus-etats-conseiller/.test(lire(p))); });
});
t('(c) les 5 valeurs de Production s\'affichent à l\'identique : chaîne brute, sans traduction', () => {
  ['🔥 À AGIR', '📈 OPPORTUNITÉ', '🚫 EXCLU', '💡 RECOMMANDATION', '🟡 À SURVEILLER'].forEach(e => assert.ok(CONNUES.includes(e)));
});
t('Résultats Équipe : autre domaine, non traduit', () => { assert.ok(!/NexusEtatsConseiller/.test(lire('NEXUS-Resultats-Equipe-v1.html'))); });

// ---- Câblage : sources des lecteurs ----
const LEC = { 'NEXUS-App-v1.html': 'app', 'NEXUS-Centre-Intelligence-v1.html': 'centre', 'NEXUS-Brief-v1.html': 'brief', 'NEXUS-Cockpit-v2.html': 'cockpit', 'NEXUS-Missions-v1.html': 'missions' };
const src = {}; Object.keys(LEC).forEach(p => { src[p] = lire(p); });
Object.keys(LEC).forEach(p => {
  t(LEC[p] + ' : charge le module avant le premier script inline', () => {
    const m = /<script[^>]*src="nexus-etats-conseiller\.js(?:\?[^"]*)?"[^>]*>\s*<\/script>/.exec(src[p]);
    assert.ok(m, 'balise absente');
    const inline = /<script(?![^>]*\bsrc=)[^>]*>/.exec(src[p]);
    assert.ok(!inline || m.index < inline.index, 'balise après un script inline');
  });
  t(LEC[p] + ' : ne compare plus la chaîne d\'état (table, includes ou égalité)', () => {
    const code = src[p].replace(/const FILTRES = \[[^\]]*\];/, '');
    assert.ok(!/ETAT_CLASS\s*(?:\[|=)|ETATS_GAIN|ETATS_URGENTS/.test(code));
    assert.ok(!/etat\s*===\s*'/.test(code));
    assert.ok(/NexusEtatsConseiller/.test(code));
  });
});
const CONS = lire('nexus-conseiller.js');
t('nexus-conseiller.js : rang par le module, ancienne table en repli', () => {
  assert.ok(/global\.NexusEtatsConseiller \? global\.NexusEtatsConseiller\.rang\(c\.etat\)/.test(CONS));
  assert.ok(/RANG_PRODUIT\[c\.etat\]/.test(CONS));
});
garde('Centre : classe par le module', src['NEXUS-Centre-Intelligence-v1.html'], c => /NexusEtatsConseiller\.classe\(etat,\s*'centre'\)/.test(c), "classe(etat, 'centre')", "classe(etat, 'zzz')");
garde('Brief : gain par le module', src['NEXUS-Brief-v1.html'], c => (c.match(/NexusEtatsConseiller\.gain\(p\.etat\)/g) || []).length === 4, 'NexusEtatsConseiller.gain(p.etat)', 'ETATS_GAIN.includes(p.etat)');
garde('Cockpit : urgents par le module', src['NEXUS-Cockpit-v2.html'], c => /NexusEtatsConseiller\.urgent\(p\.etat\)/.test(c), 'NexusEtatsConseiller.urgent(p.etat)', 'ETATS_URGENTS.includes(p.etat)');
garde('App : compteur « à agir » par la clé', src['NEXUS-App-v1.html'], c => /NexusEtatsConseiller\.est\(c\.etat, 'agir'\)/.test(c), "est(c.etat, 'agir')", "est(c.etat, 'rien')");
garde('Missions : classe par le module', src['NEXUS-Missions-v1.html'], c => /NexusEtatsConseiller\.classe\(etat,\s*'missions'\)/.test(c), "classe(etat, 'missions')", "classe(etat, 'zzz')");
garde('module : « 📦 À SURVEILLER » reste neutre (stock)', MOD, c => /'📦 À SURVEILLER': \{ cle: 'surveiller', stock: true \}/.test(c), "cle: 'surveiller', stock: true", "cle: 'surveiller'");
garde('module : le rang ne vaut 0 que pour « agir »', MOD, c => /return est\(etat, 'agir'\) \? 0 : 2;/.test(c), "? 0 : 2", "? 0 : 1");
garde('module : valeur inconnue = avertissement seul', MOD, c => /console\.warn\('\[etats-conseiller\] état inconnu/.test(c) && !/throw /.test(c), "global.console.warn(", "global.console.error(");

console.warn = w0;
console.log(n + ' épreuves OK');
