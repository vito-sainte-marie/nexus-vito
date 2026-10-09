// Paye dans la barre latérale bureau (09/10/2026, demande de Frédéric).
// L'écran NEXUS-Paye-v1.html n'était joignable que par le menu ☰ de
// l'accueil : on vérifie qu'il figure dans NEXUS_SIDEBAR_GROUPES (groupe
// Équipe), que son lien est bien rendu, et qu'il s'allume sur sa page.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, 'nexus-desktop.js'), 'utf8');
function charger(page) {
  const sandbox = { window: { location: { pathname: '/' + page } }, document: { addEventListener: () => {} }, localStorage: { getItem: () => null, setItem() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nthis.__groups = NEXUS_SIDEBAR_GROUPES; this.__html = nexusConstruireSidebarHTML();', sandbox);
  return sandbox;
}
const ok = (m) => console.log('  ✓ ' + m);

{
  const s = charger('NEXUS-App-v1.html');
  const equipe = s.__groups.find(g => g.nom === 'Équipe');
  assert.ok(equipe, 'groupe Équipe absent');
  const paye = equipe.items.find(i => i.href === 'NEXUS-Paye-v1.html');
  assert.ok(paye, 'Paye absente du groupe Équipe');
  assert.strictEqual(paye.label, 'Paye');
  assert.ok(paye.desc && (paye.desc.match(/[.!?]/g) || []).length === 1, 'description d’une phrase attendue');
  const toutes = s.__groups.flatMap(g => g.items).filter(i => i.href === 'NEXUS-Paye-v1.html');
  assert.strictEqual(toutes.length, 1, 'Paye doit figurer une seule fois');
  assert.ok(fs.existsSync(path.join(__dirname, paye.href)), 'la cible du lien doit exister');
  assert.ok(s.__html.includes('href="NEXUS-Paye-v1.html" data-tooltip="Paye"'));
  assert.ok(!/nexus-sidebar-link active" href="NEXUS-Paye-v1.html"/.test(s.__html));
  ok('Paye figure une fois, dans Équipe, avec une description d’une phrase et un lien rendu');
}
{
  const s = charger('NEXUS-Paye-v1.html');
  assert.ok(/nexus-sidebar-link active" href="NEXUS-Paye-v1.html"/.test(s.__html), 'lien Paye non actif sur sa page');
  ok('le lien Paye est marqué actif sur NEXUS-Paye-v1.html');
}
{
  const ecran = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
  assert.ok(/<script[^>]+src="nexus-desktop\.js/.test(ecran), 'NEXUS-Paye-v1.html doit charger nexus-desktop.js');
  ok('NEXUS-Paye-v1.html charge nexus-desktop.js (la barre s’y affiche)');
}
console.log('test_nav_paye_sidebar_20261009 : OK');
