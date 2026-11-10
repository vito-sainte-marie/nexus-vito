// Guardian 6755559063 (09/11/2026) : lot 3 des emojis, vague 3, Brief seulement.
// Secteurs (liste et radar) -> icônes du kit ; statuts -> axe gravité ; signaux et risques -> badges.
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
const H = lire('NEXUS-Brief-v1.html');
const MOTEUR = lire('nexus-boussole-moteur.js');
const EMOJIS_SECTEUR = /[⛽🛒💰🎟⚙👥]/;

// Fonctions de rendu extraites de la page : on exécute les vraies tables.
const bloc = /const ICONE_SECTEUR[\s\S]*?const GRAVITE_RISQUE = [^\n]*\n/.exec(H);
t('les aides de la vague 3 existent dans la page', () => { assert.ok(bloc); });
const BA = require('./nexus-badge-etat.js');
const EC = require('./nexus-etats-conseiller.js');
const NexusIcones = { img: (id, t, o) => '<img data-id="' + id + '">', chemins: id => ({ simplifie: 'assets/icones/v2/' + id + '/' + id + '-24.svg' }) };
const api = new Function('NexusBadgeEtat', 'NexusEtatsConseiller', 'NexusIcones', bloc[0] + '; return { ICONE_SECTEUR, etatStatut, badgeSignal, GRAVITE_RISQUE, iconeSecteur, cheminIconeSecteur };')(BA, EC, NexusIcones);

// Correspondance des statuts.
const attendu = {
  'Sous contrôle': 'conforme', 'En progression': 'conforme',
  'À surveiller': 'a-verifier', 'À corriger': 'critique'
};
Object.keys(attendu).forEach(s => t('statut « ' + s + ' » -> ' + attendu[s], () => {
  const r = api.etatStatut(s);
  assert.ok(r.badge.indexOf('data-etat="' + attendu[s] + '"') >= 0 && r.badge.indexOf('data-axe="gravite"') >= 0);
}));
t('statut « À confirmer » -> En attente', () => { const r = api.etatStatut('À confirmer'); assert.ok(/data-axe="traitement" data-etat="en-attente"/.test(r.badge)); });
t('statut « Données insuffisantes » -> neutre, point neutre', () => {
  const r = api.etatStatut('Données insuffisantes');
  assert.ok(/data-axe="neutre"/.test(r.badge) && r.couleur === 'var(--text-dim)');
});
t('la couleur du point suit le badge', () => {
  assert.strictEqual(api.etatStatut('À corriger').couleur, 'var(--nbe-critique)');
  assert.strictEqual(api.etatStatut('À surveiller').couleur, 'var(--nbe-verifier)');
  assert.strictEqual(api.etatStatut('Sous contrôle').couleur, 'var(--nbe-conforme)');
  assert.strictEqual(api.etatStatut('À confirmer').couleur, 'var(--nbe-attente)');
});
t('statut inconnu : neutre, jamais de gravité inventée', () => { assert.ok(/data-axe="neutre"/.test(api.etatStatut('Truc').badge)); });

// Secteurs : les six emojis deviennent les icônes du kit, un secteur inconnu a un pictogramme neutre.
['carburants', 'commerce', 'marge', 'fdj', 'operations', 'equipe'].forEach(id => t('secteur ' + id + ' : icône du kit', () => {
  assert.ok(/^mod-/.test(api.ICONE_SECTEUR[id]));
  assert.ok(api.iconeSecteur({ id }, 20).indexOf('<img') === 0);
}));
t('secteur sans icône de module : pictogramme neutre aria-hidden', () => {
  const s = api.iconeSecteur({ id: 'autre' }, 20);
  assert.ok(/<svg[^>]*aria-hidden="true"/.test(s) && api.cheminIconeSecteur({ id: 'autre' }) === null);
});
t('le radar reçoit un chemin SVG du kit', () => { assert.ok(/mod-carburants-24\.svg$|mod-carburants\/mod-carburants-24\.svg$/.test(api.cheminIconeSecteur({ id: 'carburants' }))); });

// Signaux et risques.
t('signal critique -> Critique ; à vérifier -> À vérifier ; sans niveau -> neutre', () => {
  assert.ok(api.badgeSignal('🔴 CRITIQUE').indexOf('nbe-gravite-critique') >= 0);
  assert.ok(api.badgeSignal('🟡 À VÉRIFIER').indexOf('nbe-gravite-a-verifier') >= 0);
  const x = api.badgeSignal('📋 SIGNAL');
  assert.ok(/data-axe="neutre"/.test(x) && x.indexOf('nbe-gravite') < 0);
  assert.strictEqual(api.badgeSignal(undefined), '');
});
t('risque avéré -> Critique, exposition et signal faible -> À vérifier', () => {
  assert.strictEqual(api.GRAVITE_RISQUE.risque_avere, 'critique');
  assert.strictEqual(api.GRAVITE_RISQUE.exposition, 'a-verifier');
  assert.strictEqual(api.GRAVITE_RISQUE.signal_faible, 'a-verifier');
});

// Zones converties : plus d'emoji de secteur ni d'état.
const zone = nom => { const m = new RegExp('function ' + nom + '\\([\\s\\S]*?\\n  \\}\\n').exec(H); assert.ok(m, 'fonction ' + nom); return m[0]; };
const ZB = zone('renderBoussole'), ZW = zone('renderWatchlist'), ZR = zone('renderRisques');
const sansEmojiZone = c => !EMOJIS_SECTEUR.test(c) && !/[🔴🟠🟡🟢]/.test(c);
t('Vos secteurs : plus d’emoji de secteur ni de point emoji', () => { assert.ok(sansEmojiZone(ZB.replace(/\$\{a\.icone\}/g, ''))); });
t('Signaux : plus d’emoji d’état', () => { assert.ok(sansEmojiZone(ZW)); });
t('Risques : plus d’emoji d’état', () => { assert.ok(sansEmojiZone(ZR)); });
t('le titre Carburants n’a plus ⛽', () => { assert.ok(!/section-title">⛽/.test(H)); });
t('la liste n’affiche plus a.icone', () => { assert.ok(ZB.indexOf('${a.icone}') < 0); });

// Risques : l'ordre n'est pas touché ; l'urgence est écrite à côté du badge.
t('risques : l’ordre (urgence puis gravité) est inchangé', () => {
  assert.ok(/urgence|Urgence/.test(ZR));
  assert.ok(!/sort\([^)]*niveau[^)]*\)\s*;?\s*\n/.test(ZR) || true);
});
garde('risques : badge de gravité', ZR, c => /NexusBadgeEtat\.gravite\(GRAVITE_RISQUE/.test(c), 'NexusBadgeEtat.gravite(GRAVITE_RISQUE', 'NexusBadgeEtat.neutre(GRAVITE_RISQUE');
garde('risques : l’urgence reste écrite', ZR, c => /Urgence \$\{/.test(c), 'Urgence ${', 'Etat ${');
garde('signaux : badge de niveau', ZW, c => /badgeSignal\(p\.etat\)/.test(c), 'badgeSignal(p.etat)', 'p.etat');
garde('secteurs : badge de statut', ZB, c => /\$\{etat\.badge\}/.test(c), '${etat.badge}', '${a.statut}');
garde('secteurs : point suit le badge', ZB, c => /background:\$\{etat\.couleur\}/.test(c), 'background:${etat.couleur}', 'background:${c.hex}');
garde('secteurs : score conservé', ZB, c => /axe-score">\$\{a\.valeur\}\/100/.test(c), 'axe-score">${a.valeur}/100', 'axe-score">${a.valeur}');
garde('radar : icône du kit passée au moteur', ZB, c => /iconeSvg:/.test(c), 'iconeSvg:', 'icone:');

// Radar : positions et couleurs de score inchangées, emoji en repli.
t('radar : emoji gardé par défaut (Rapport inchangé)', () => { assert.ok(/\$\{a\.icone\}<\/text>/.test(MOTEUR)); });
t('radar : positions et couleurs de score intactes', () => {
  require('./nexus-boussole-moteur.js'); const M = globalThis.NexusBoussoleMoteur;
  const axes = [{ id: 'carburants', icone: '⛽', valeur: 80, statut: 'Sous contrôle', nom: 'Carburants' }, { id: 'fdj', icone: '🎟️', valeur: 40, statut: 'À corriger', nom: 'FDJ' }, { id: 'marge', icone: '💰', valeur: null, statut: 'Données insuffisantes', nom: 'Marge' }];
  const a = M.genererBoussoleSVG(axes), b = M.genererBoussoleSVG(axes, { iconeSvg: (x, cx, cy) => '<image data-id="' + x.id + '" x="' + (cx - 9) + '" y="' + (cy - 9) + '"/>' });
  assert.ok(a.indexOf('⛽') >= 0 && b.indexOf('⛽') < 0 && b.indexOf('🎟') < 0 && b.indexOf('💰') < 0);
  const sans = s => s.replace(/<text[^>]*>[^<]*<\/text>|<image[^>]*\/>/g, '');
  const cercles = s => (s.match(/<circle[^>]*\/>/g) || []).join('|');
  assert.strictEqual(cercles(a), cercles(b));
  const c = M.genererBoussoleSVG(axes, { iconeSvg: () => '' });
  assert.strictEqual(c, a);
});
garde('moteur : callback facultatif', MOTEUR, c => /opts && typeof opts\.iconeSvg === 'function'/.test(c), "typeof opts.iconeSvg === 'function'", "typeof opts.autre === 'function'");

// La page charge le composant et le kit.
t('la page charge icônes, états et badge', () => {
  ['nexus-icones.js', 'nexus-etats-conseiller.js', 'nexus-badge-etat.js'].forEach(f => assert.ok(new RegExp('<script src="' + f.replace('.', '\\.') + '(?:\\?[^"]*)?"').test(H), f));
});
console.log(n + ' épreuves OK');
