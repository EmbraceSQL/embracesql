CREATE TABLE multi_tenant_things (
  thing_id INTEGER PRIMARY KEY,
  thing_value TEXT NOT NULL,
  tenant_id INTEGER NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id)
);

INSERT INTO multi_tenant_things(thing_id, thing_value, tenant_id) VALUES(0, "for news", 0);
INSERT INTO multi_tenant_things(thing_id, thing_value, tenant_id) VALUES(1, "for hence", 1);