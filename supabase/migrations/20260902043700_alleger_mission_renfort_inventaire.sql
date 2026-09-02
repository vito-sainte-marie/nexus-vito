-- Sainte-Marie : le contrôle Renfort pendant le quart reste piloté par les
-- paramètres du site, mais devient une rotation intelligente courte au lieu
-- d'imposer toutes les références boissons/huiles à chaque présence.
update public.inventaire_mission_rules
set mode_selection = 'intelligent',
    nombre_references = 6,
    inclure_surprise = false,
    nombre_surprises = null
where id = '245db1db-b07d-4f3a-a362-a7df1da28e97'
  and site = 'vito-sainte-marie'
  and role_code = 'renfort'
  and moment_code = 'pendant';
