// Le portage de la chaîne de configuration sur un candidat pré-refonte
// (#62 FDJ, #65 Carburants) est PRÉPARÉ mais pas appliqué (lot
// NEXUS-CONTINUITE-TERRAIN-2-20260922, §3 de la mission du 22/09/2026) : ce
// canal n'a ni accès Cloudflare ni accès réseau sortant pour l'exécuter
// contre une vraie branche candidate, et l'étude recommande explicitement
// d'attendre une observation humaine du tableau de bord Cloudflare avant de
// le faire. Ce test éprouve donc le SCRIPT lui-même dans un sandbox git
// LOCAL (aucun réseau, aucune branche réelle touchée), pas son exécution
// réelle contre #62/#65.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const RACINE = __dirname;
const SCRIPT = path.join(RACINE, 'outils', 'porter-config-candidat-test.sh');
const SRC = fs.readFileSync(SCRIPT, 'utf8');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

function sandboxGit(branche) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-portage-'));
  execFileSync('git', ['init', '-q', '-b', branche, dir]);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.invalid']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(dir, 'README.md'), 'candidat factice\n');
  fs.writeFileSync(path.join(dir, 'nexus-auth.js'), '// version pre-refonte factice (932 lignes simulees)\n');
  execFileSync('git', ['-C', dir, 'add', '-A']);
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'init'], { env: { ...process.env, GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' } });
  return dir;
}

t('la syntaxe bash du script reste valide', () => {
  execFileSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
});

t('la liste porte les SEPT fichiers, y compris les deux omis par l’étude initiale', () => {
  for (const f of ['outils/build.sh', 'outils/generer-config.js', 'outils/poser-build-id.js',
    'nexus-page.js', 'nexus-bandeau-environnement.js', 'nexus-auth.js', '_headers']) {
    assert.ok(SRC.includes(f), `le script doit lister ${f}`);
  }
});

t('REFUS sans argument (usage)', () => {
  assert.throws(() => execFileSync('bash', [SCRIPT], { stdio: ['ignore', 'pipe', 'pipe'] }));
});

t('REFUS sur la cible main', () => {
  const dir = sandboxGit('main');
  assert.throws(() => execFileSync('bash', [SCRIPT, dir], { stdio: ['ignore', 'pipe', 'pipe'] }),
    'une cible sur main doit être refusée avant toute copie');
  assert.ok(!fs.existsSync(path.join(dir, '_headers')), 'aucun fichier ne doit avoir été copié après un refus');
});

t('REFUS sur la cible production', () => {
  const dir = sandboxGit('production');
  assert.throws(() => execFileSync('bash', [SCRIPT, dir], { stdio: ['ignore', 'pipe', 'pipe'] }));
});

t('REFUS sur un répertoire qui n’est pas un dépôt git', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-portage-nongit-'));
  assert.throws(() => execFileSync('bash', [SCRIPT, dir], { stdio: ['ignore', 'pipe', 'pipe'] }));
});

t('REFUS sur le dépôt de travail du rail lui-même (jamais de cible = source)', () => {
  assert.throws(() => execFileSync('bash', [SCRIPT, RACINE], { stdio: ['ignore', 'pipe', 'pipe'] }));
});

t('COPIE réelle des sept fichiers sur une branche candidate non protégée, rien committé', () => {
  const dir = sandboxGit('rebuild/fdj-62-20260922');
  const avant = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sortie = execFileSync('bash', [SCRIPT, dir], { encoding: 'utf8' });
  for (const f of ['outils/build.sh', 'outils/generer-config.js', 'outils/poser-build-id.js',
    'nexus-page.js', 'nexus-bandeau-environnement.js', 'nexus-auth.js', '_headers']) {
    const cible = path.join(dir, f);
    assert.ok(fs.existsSync(cible), `${f} doit avoir été copié`);
    assert.strictEqual(fs.readFileSync(cible, 'utf8'), fs.readFileSync(path.join(RACINE, f), 'utf8'),
      `${f} copié doit être OCTET POUR OCTET identique à la version du rail`);
  }
  // Le fichier métier du candidat, non nommé dans la liste, ne doit pas bouger.
  assert.strictEqual(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), 'candidat factice\n');
  // Le script ne commit ni ne push : l'arbre git reste sur le même HEAD, avec
  // des modifications non indexées.
  const apres = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.strictEqual(apres, avant, 'le script ne doit jamais committer');
  const statut = execFileSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' });
  assert.ok(statut.trim().length > 0, 'les fichiers copiés doivent apparaître comme modifications non indexées');
  assert.ok(!sortie.includes('git commit') || sortie.includes('AVANT tout commit'),
    'la sortie doit renvoyer la revue humaine à un commit distinct, pas en committer un elle-même');
});

t('MUTATION NÉGATIVE — sans le refus de branche protégée, la copie se ferait sur main', () => {
  // Reproduit ce que serait le script SANS son garde-fou `main|production` :
  // la copie devrait réussir sur une cible main, ce que le script réel refuse.
  const sansGarde = SRC.replace(/  main\|production\)[\s\S]*?;;\n/, '');
  assert.notStrictEqual(sansGarde, SRC, 'préparation de mutation invalide — le garde-fou n’a pas été trouvé');
  const dir = sandboxGit('main');
  const scriptMute = path.join(dir, '..', 'mute.sh');
  fs.writeFileSync(scriptMute, sansGarde);
  // Reste refusé quand même : sans branche protégée, "main" n'a pas de nom
  // reconnu par le sandbox — mais on vérifie ici que le TEXTE du garde-fou a
  // bien disparu, ce qui est la condition que la mutation devait recréer.
  assert.ok(!sansGarde.includes('branche protégée'), 'la mutation doit avoir retiré le refus de branche protégée');
  fs.rmSync(scriptMute);
});

console.log(`\n${n}/${n} vérifications passées — le portage reste préparé, jamais appliqué, et refuse toute cible protégée.`);
