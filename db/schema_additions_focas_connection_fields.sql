-- Adds the FOCAS-equivalent of mtconnect_agent_url/mtconnect_device_name
-- (schema_additions_mtconnect_connector.sql) -- shop_machine_protocol
-- already had 'fanuc_focas' as a value, but there was nowhere on the
-- machine record to actually store ITS connection details the way
-- MTConnect machines already could. Needed specifically so the machine
-- edit form can fully describe a Fanuc/FOCAS machine's connection, which
-- in turn is what lets IronIQ Edge fetch a complete, real config for it
-- (see schema_additions_edge_config_endpoint.sql) instead of always
-- generating a placeholder for anything that isn't MTConnect.

ALTER TABLE public.shop_machines
  ADD COLUMN IF NOT EXISTS focas_host TEXT,
  ADD COLUMN IF NOT EXISTS focas_port INTEGER;
