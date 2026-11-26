// Un essai refusé pendant l'attente (ou le verrou, ou la limite par IP) n'augmente ni le compteur d'échecs du compte,
// ni le compteur par IP (Guardian 7184143591). Épreuve de texte sur la dernière définition d'avant_essai et sur l'Edge Function.
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const dir = path.join(__dirname, 'supabase/migrations');
const defs = fs.readdirSync(dir).filter(f => /^\d+_.*\.sql$/.test(f)).sort()
  .filter(f => /function nexus_connexion\.avant_essai/.test(lire('supabase/migrations/' + f)));
const derniere = lire('supabase/migrations/' + defs[defs.length - 1]);
const av = derniere.slice(derniere.indexOf('function nexus_connexion.avant_essai'), derniere.indexOf('function nexus_connexion.apres_echec'));
ok(av.length > 500, 'définition d\'avant_essai trouvée');

// 1. avant_essai ne touche jamais compte.echecs ni dernier_echec.
ok(!/update\s+nexus_connexion\.compte/i.test(av), 'avant_essai ne modifie pas le compte');
ok(!/echecs\s*=/.test(av), 'avant_essai n\'écrit pas echecs');

// 2. Compteur par IP : un refus s'inscrit sous un type qui ne compte pas.
ok(/type = 'echec'[\s\S]{0,80}interval '10 minutes'/.test(av) && /type = 'echec'[\s\S]{0,80}interval '1 hour'/.test(av), 'fenêtres IP : échecs réels seulement');
ok(/dec = 'ip_limite'[\s\S]{0,200}'refus_ip'/.test(av), 'refus par limite IP inscrit en refus_ip');
ok(/dec <> 'ok' then[\s\S]{0,200}'refus_verrou'/.test(av), 'refus attente/verrou inscrit en refus_verrou');
ok(!/elsif dec <> 'ok' then[^;]*'echec'/.test(av), 'un refus attente/verrou n\'est jamais inscrit en echec');
const insertsEchec = av.match(/insert into nexus_connexion\.essais_ip[^;]*'echec'/g) || [];
ok(insertsEchec.length === 1 && /elsif r\.user_id is null then\s+insert into nexus_connexion\.essais_ip[^;]*'echec'/.test(av), 'seul un prénom inconnu ou ambigu (dec = ok) inscrit un echec dans avant_essai');

// 3. Edge Function : tout refus sort avant apres_echec.
const fn = lire('supabase/functions/connexion/index.ts');
const ligneRefus = /av\.decision !== "ok"[^\n]*return rep\(401, REFUS/;
ok((fn.match(new RegExp(ligneRefus.source, 'g')) || []).length === 2, 'connexion et changer_code sortent sur tout refus');
for (const m of fn.matchAll(/av\.decision !== "ok"[^\n]*/g)) {
  ok(!/apres_echec/.test(m[0]), 'la ligne de refus n\'appelle pas apres_echec');
}
console.log('test_connexion_refus_ne_compte_pas_20261127 : ' + n + ' vérifications OK');
