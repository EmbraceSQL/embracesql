CREATE TABLE tenants (
  tenant_id INTEGER PRIMARY KEY,
  domain TEXT NOT NULL,
  UNIQUE(domain)
);
INSERT INTO tenants(tenant_id, domain) VALUES(0, "news.com");
INSERT INTO tenants(tenant_id, domain) VALUES(1, "hence.com");