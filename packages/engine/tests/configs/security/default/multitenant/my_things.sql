SELECT thing_id, thing_value
FROM multi_tenant_things
WHERE tenant_id = :tenant_id