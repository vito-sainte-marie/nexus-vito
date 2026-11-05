// Alerte « sonde à vérifier » (05/11/2026, GO Frédéric) — garde-fous de la
// migration et câblage du Brief. Le comportement du déclencheur (cas GO réel
// +983 / +330 / +528 / +457 / +695 L) a été exécuté sur Test dans une
// transaction annulée ; ici on fige ce qui doit rester vrai dans les fichiers.
const assert = require('assert');
const fs = require('fs');

let echecs = 0;
function t(nom, fn) {
  try { fn(); console.log('OK — ' + nom); } catch (e) { echecs++; console.log('FAIL — ' + nom + '\n  ' + e.message); }
}

const mig = fs.readFileSync('supabase/migrations/20261105190000_carburant_sonde_alertes.sql', 'utf8');
const brief = fs.readFileSync('NEXUS-Brief-v1.html', 'utf8');

t('la fonction est SECURITY DEFINER avec search_path figé et fermée à anon/authenticated', () => {
  assert(/security definer/i.test(mig));
  assert(/set search_path = public/.test(mig));
  assert(/revoke all on function public\.nexus_detecter_sonde_a_verifier\(\) from public, anon, authenticated/.test(mig));
});

t('la table est sous RLS, sans écriture directe sauf le « Vu »', () => {
  assert(/enable row level security/.test(mig));
  assert(/revoke all on public\.carburant_sonde_alertes from public, anon, authenticated/.test(mig));
  assert(/grant update \(vue, vue_par, vue_le\) on public\.carburant_sonde_alertes to authenticated/.test(mig));
  assert(!/grant (insert|delete)/i.test(mig));
});

t('expiration à 7 jours par défaut', () => {
  assert(/expire_le timestamptz not null default now\(\) \+ interval '7 days'/.test(mig));
});

t('seuils lus dans reception_carburant_config avec défauts 5 / 3 / 2 %', () => {
  assert(/sonde_fenetre.*, ''\)::int, 5\)/.test(mig));
  assert(/sonde_nb_min.*, ''\)::int, 3\)/.test(mig));
  assert(/sonde_seuil_ecart_pct.*, ''\)::numeric, 2\)/.test(mig));
});

t('la migration ne modifie ni les lignes de réception ni station_config', () => {
  assert(!/update public\.carburant_reception_visite_lignes|alter table public\.carburant_reception_visite_lignes|update public\.station_config/i.test(mig));
});

t('le Brief affiche une ligne + « Vu », filtrée sur le site, non vue, non expirée', () => {
  assert(/from\('carburant_sonde_alertes'\)/.test(brief));
  assert(/\.eq\('vue', false\)\.gt\('expire_le'/.test(brief));
  assert(/\$\{renderSondeAlertes\(\)\}/.test(brief));
  assert(/class="sonde-alerte-vu"/.test(brief));
  assert(/sonde à faire vérifier/.test(brief));
});

t('une lecture en échec ne bloque pas le Brief', () => {
  assert(/SONDE_ALERTES = error \? \[\] : \(data \|\| \[\]\)/.test(brief));
  assert(/catch \(e\) \{ SONDE_ALERTES = \[\]; \}/.test(brief));
});

if (echecs) { console.log(echecs + ' échec(s)'); process.exit(1); }
console.log('Tous les contrôles passent.');
