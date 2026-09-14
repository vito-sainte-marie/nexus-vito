// La reconstruction de Test survit-elle à une IPv6 indisponible ?
//
// Le 09/09/2026, `db.<ref>.supabase.co` est devenu injoignable en pleine
// répétition — « Operation timed out » sur une adresse 2600:1f18:… — après
// avoir fonctionné le matin même. Cet hôte ne publie QU'UNE adresse IPv6.
// Une reconstruction qui dépend d'une IPv6 disponible n'est pas reproductible.
//
// Le pooler répond en IPv4. Son nom d'hôte dépend de la région et de
// l'instance, et une erreur dessus produit un « tenant not found » qu'on prend
// à tort pour un mauvais mot de passe : il ne doit JAMAIS être deviné.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SCRIPTS = ['reconstruire-base-test.sh', 'repeter-lot-production-readiness-test.sh']
  .map(f => ({ nom: f, src: fs.readFileSync(path.join(__dirname, 'outils', f), 'utf8') }));

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('les deux scripts tentent le direct PUIS le pooler', () => {
  for (const { nom, src } of SCRIPTS) {
    assert.ok(/URL_DIRECTE=/.test(src), `${nom} : hôte direct absent`);
    assert.ok(/URL_POOLER=/.test(src), `${nom} : repli pooler absent`);
    assert.ok(src.indexOf('URL_DIRECTE') < src.indexOf('elif psql "$URL_POOLER"'),
      `${nom} : le direct doit être tenté en premier`);
  }
});

t('le nom d’hôte du pooler n’est jamais DEVINÉ', () => {
  for (const { nom, src } of SCRIPTS) {
    assert.ok(/POOLER_HOTE="aws-0-us-east-1\.pooler\.supabase\.com"/.test(src),
      `${nom} : l’hôte doit être celui que la CI emploie déjà, écrit en clair`);
    assert.ok(!/aws-\$\{|aws-\$\(|REGION/.test(src),
      `${nom} : aucune composition dynamique de l’hôte — un « tenant not found » se prend pour un mauvais mot de passe`);
  }
});

t('une URL fournie l’emporte sur toute déduction', () => {
  for (const { nom, src } of SCRIPTS) {
    assert.ok(/NEXUS_TEST_DB_URL:-/.test(src) || /-n "\$\{NEXUS_TEST_DB_URL:-\}"/.test(src),
      `${nom} : NEXUS_TEST_DB_URL doit pouvoir remplacer la déduction`);
  }
});

t('l’échec des DEUX voies est dit sans accuser le mot de passe', () => {
  // Le message d'origine faisait croire à un mauvais credential alors que la
  // cause était le réseau. Une garde qui accuse la mauvaise chose fait perdre
  // plus de temps qu'une garde absente.
  for (const { nom, src } of SCRIPTS) {
    assert.ok(/AUCUNE connexion possible/.test(src), `${nom} : l’échec total doit être nommé`);
    assert.ok(/pas nécessairement le mot de passe/.test(src),
      `${nom} : le message doit écarter la fausse piste du credential`);
    assert.ok(/IPv6 seulement/.test(src), `${nom} : la vraie cause doit être dite`);
  }
});

t('le script parent IMPOSE son choix au script enfant', () => {
  // Sans cela, la répétition pourrait passer par le pooler et la
  // reconstruction retomber sur l'IPv6 injoignable, au milieu du travail.
  const parent = SCRIPTS.find(s => s.nom.startsWith('repeter')).src;
  assert.ok(/export NEXUS_TEST_DB_URL="\$URL"/.test(parent),
    'la répétition doit transmettre l’URL retenue à la reconstruction');
});

t('PRODUCTION reste refusée avant toute connexion', () => {
  for (const { nom, src } of SCRIPTS) {
    const iRefus = src.indexOf('PRODUCTION');
    const iConnexion = src.indexOf('URL_DIRECTE=');
    assert.ok(iRefus > 0 && iRefus < iConnexion,
      `${nom} : le refus de Production doit précéder toute tentative de connexion`);
  }
});

console.log(`\n${n}/${n} vérifications passées — une reconstruction ne dépend pas d’une IPv6 disponible.`);
