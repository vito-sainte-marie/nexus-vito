// Décisions du gérant (Guardian 7182241504) : journal 6 mois avec purge, code temporaire 24 h,
// alerte « connexion indisponible » réservée au gérant et aux managers, limitée à leur site.
// Épreuve de texte sur la migration d'étape 5, l'Edge Function et la procédure.
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const mig = lire('supabase/migrations/20261126230000_connexion_lot1_etape5_decisions_gerant.sql');
const fn = lire('supabase/functions/connexion/index.ts');
const proc = lire('docs/deploiement/procedure-connexion-production.md');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 1. Conservation 6 mois, purge automatique.
ok(/set default 180/.test(mig), 'le défaut de conservation doit être 180 jours');
ok(/retention_journal_j = 180 where id = 1 and retention_journal_j = 90/.test(mig), 'la valeur 90 déjà posée passe à 180');
ok(/cron\.schedule\('nexus-connexion-purge',\s*'15 3 \* \* \*',\s*'select nexus_connexion\.purger\(\)'\)/.test(mig), 'la purge est planifiée chaque jour');
ok(/pg_extension where extname = 'pg_cron'/.test(mig), 'la planification dépend de pg_cron');
const base = lire('supabase/migrations/20261126120000_connexion_lot1_etape2_etat_prive.sql');
ok(/retention_journal_j[\s\S]{0,200}delete from nexus_connexion\.journal where at < now\(\) - make_interval\(days => r\)/.test(base), 'purger() supprime selon la rétention');

// 2. Code temporaire : 24 h, refus neutre à l'échéance.
ok(/echeance = case when p_etat = 'code_temporaire_requis' then now\(\) \+ interval '24 hours' else null end/.test(mig), 'poser_code fixe 24 h');
ok(/function nexus_connexion\.code_temporaire_expire/.test(mig) && /c\.echeance > now\(\) then return false/.test(mig), 'expiration contrôlée');
ok((fn.match(/code_temporaire_expire/g) || []).length === 2, 'connexion et changer_code contrôlent l\'expiration');

// 3. Alerte : gérant et manager, site propre, aucune action technique pour le manager.
ok(/auteur\.role not in \('gerant','manager'\)/.test(mig) && /auteur\.actif is not true/.test(mig), 'seuls gérant et manager actifs');
ok(/'auteur_refuse'/.test(mig), 'refus journalisé');
ok(/'site_id', auteur\.site_id/.test(mig), 'la réponse porte le site de l\'appelant');
ok(/role = 'gerant' then 'verifier_service' else 'prevenir_gerant'/.test(mig), 'gérant : action technique ; manager : prévenir le gérant');
ok(/case "alerte_indisponible"/.test(fn), 'action routée');
ok(/revoke all on function %s from public, anon, authenticated/.test(mig) && /grant execute on function %s to service_role/.test(mig), 'droits refermés');

// 4. Procédure : décisions consignées.
ok(!/décisions du gérant à prendre/i.test(proc) && /180 jours|6 mois/.test(proc), 'procédure : conservation consignée');
console.log('test_connexion_decisions_gerant: ' + n + ' vérifications OK');
