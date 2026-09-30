-- ==============================================================================
-- Technical Specification: "Unsanitized Input Injections Remediation" (Phase 4)
-- Migration 002: PostgreSQL Least-Privilege Database Role Provisioning
-- Engine: PostgreSQL 14+
-- Purpose: Eliminate Superuser Runtime Access & Harden DB Privilege Boundaries
-- ==============================================================================

BEGIN;

-- 1. Provision 'app_runtime_user' (Exclusively for production application services)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime_user') THEN
        CREATE ROLE app_runtime_user WITH 
            LOGIN 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOINHERIT 
            NOREPLICATION
            PASSWORD 'REPLACE_WITH_SECURE_VAULT_PASSWORD_RUNTIME';
        RAISE NOTICE 'Role app_runtime_user created successfully';
    ELSE
        -- Ensure security attributes are strictly enforced if role already exists
        ALTER ROLE app_runtime_user WITH 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOINHERIT 
            NOREPLICATION;
        RAISE NOTICE 'Role app_runtime_user attributes hardened';
    END IF;
END $$;

-- 2. Provision 'migration_admin_user' (Exclusively for CI/CD Migration Pipelines)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_admin_user') THEN
        CREATE ROLE migration_admin_user WITH 
            LOGIN 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOINHERIT 
            NOREPLICATION
            PASSWORD 'REPLACE_WITH_SECURE_VAULT_PASSWORD_MIGRATION';
        RAISE NOTICE 'Role migration_admin_user created successfully';
    ELSE
        ALTER ROLE migration_admin_user WITH 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOINHERIT 
            NOREPLICATION;
        RAISE NOTICE 'Role migration_admin_user attributes hardened';
    END IF;
END $$;

-- 3. Revoke all default public permissions to enforce zero-trust schema isolation
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- 4. Configure 'app_runtime_user' Permissions
-- Grant exclusively CONNECT and USAGE
GRANT CONNECT ON DATABASE current_database() TO app_runtime_user;
GRANT USAGE ON SCHEMA public TO app_runtime_user;

-- Grant strictly DML operations on application tables (NO DDL: DROP/ALTER/TRUNCATE strictly revoked)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime_user;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM app_runtime_user;

-- Grant sequence access for auto-generated identifiers
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime_user;

-- Ensure future tables and sequences created by migrations inherit the least-privilege boundary
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM app_runtime_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO app_runtime_user;

-- 5. Configure 'migration_admin_user' Permissions
-- Granted DDL privileges strictly for running schema migrations in CI/CD deployment jobs
GRANT CONNECT ON DATABASE current_database() TO migration_admin_user;
GRANT USAGE, CREATE ON SCHEMA public TO migration_admin_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_admin_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migration_admin_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL ON TABLES TO migration_admin_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL ON SEQUENCES TO migration_admin_user;

COMMIT;

-- Verification Queries (Run as superuser/postgres):
-- SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolinherit FROM pg_roles WHERE rolname IN ('app_runtime_user', 'migration_admin_user');
-- SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'app_runtime_user';
