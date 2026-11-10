// Ligne de commande des deux workflows du calendrier du site (10/11/2026).
// Tout le calcul vit dans nexus-calendrier-site.js (partagé avec l'épreuve). Ici : lecture réseau + écriture d'un
// fichier de migration, rien d'autre. Aucune connexion à une base. Silencieux (code 0, aucune sortie de fichier) si tout est déjà là.
//   node outils/calendrier-site-cli.js feries [annee]      -> écrit la migration de l'année N+1 si absente
//   node outils/calendrier-site-cli.js vacances            -> écrit la migration des périodes nouvellement publiées
// Sortie : une ligne JSON { fichier|null, resume }. Variables : SITE (défaut vito-sainte-marie), ACADEMIE (défaut Martinique).
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../nexus-calendrier-site.js');
const SITE = process.env.SITE || 'vito-sainte-marie';
const ACADEMIE = process.env.ACADEMIE || 'Martinique';
const DOSSIER = path.join(__dirname, '..', 'supabase', 'migrations');

function horodatage() { return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); }
function contenuMigrations() {
  return fs.readdirSync(DOSSIER).filter(f => f.endsWith('.sql')).map(f => fs.readFileSync(path.join(DOSSIER, f), 'utf8')).join('\n');
}
function enveloppe(entete, sql) {
  return entete + '\ndo $$\nbegin\n  if exists (select 1 from public.sites where site_id = \'' + SITE + '\') then\n' +
    sql.split('\n').map(l => '    ' + l).join('\n') + '\n  end if;\nend\n$$;\n';
}
function ecrire(nom, texte) {
  const f = path.join(DOSSIER, horodatage() + '_' + nom + '.sql');
  fs.writeFileSync(f, texte);
  return path.relative(path.join(__dirname, '..'), f);
}

function feries(annee) {
  const lignes = C.feriesSite(annee).map(j => ({ date: j.date, type: 'ferie', libelle: j.libelle }));
  const deja = contenuMigrations();
  if (lignes.every(l => deja.indexOf("'" + l.date + "', 'ferie'") >= 0)) return { fichier: null, resume: 'fériés ' + annee + ' déjà présents' };
  const f = ecrire('calendrier_site_feries_' + annee, enveloppe('-- Jours fériés ' + annee + ' du site (14 jours). Idempotent : on conflict (site, date, type) do nothing.', C.sqlInsertCalendrier(SITE, lignes)));
  return { fichier: f, resume: lignes.length + ' jours fériés ' + annee };
}

async function vacances() {
  const url = C.SOURCE_URL + '?limit=100&where=' + encodeURIComponent('location="' + ACADEMIE + '"');
  const r = await fetch(url);
  if (!r.ok) throw new Error('source indisponible : HTTP ' + r.status);
  const corps = await r.json();
  const periodes = C.periodesDepuisSource(corps.results || [], ACADEMIE);
  const deja = contenuMigrations();
  const nouvelles = periodes.filter(p => C.joursDesPeriodes([p]).some(l => deja.indexOf("'" + l.date + "', 'vacances'") < 0));
  if (!nouvelles.length) return { fichier: null, resume: 'aucune période nouvelle' };
  const lignes = C.joursDesPeriodes(nouvelles);
  const f = ecrire('calendrier_site_vacances_maj', enveloppe('-- Vacances scolaires publiées (académie ' + ACADEMIE + ', lues le ' + new Date().toISOString().slice(0, 10) + '). Source : ' + C.SOURCE_URL + '\n-- Jamais de date estimée ; une période sans fin publiée est ignorée. Idempotent.', C.sqlInsertCalendrier(SITE, lignes)));
  return { fichier: f, resume: nouvelles.length + ' période(s), ' + lignes.length + ' jours' };
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  const res = cmd === 'feries' ? feries(Number(arg) || new Date().getUTCFullYear() + 1) : cmd === 'vacances' ? await vacances() : null;
  if (!res) { console.error('usage : feries [annee] | vacances'); process.exit(2); }
  console.log(JSON.stringify(res));
})().catch(e => { console.error(e.message); process.exit(1); });
