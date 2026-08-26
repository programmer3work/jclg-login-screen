CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS jclg_user (
    user_id BIGSERIAL PRIMARY KEY,
    campus_id BIGINT,
    username VARCHAR(100) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    gender VARCHAR(20),
    profile_photo TEXT,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jclg_role (
    role_id BIGSERIAL PRIMARY KEY,
    role_code VARCHAR(50) NOT NULL UNIQUE,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_code UNIQUE (role_code)
);

ALTER TABLE jclg_role DROP COLUMN IF EXISTS user_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_jclg_role_code ON jclg_role (role_code);
CREATE TABLE IF NOT EXISTS jclg_auth_provider (
    auth_provider_id BIGSERIAL PRIMARY KEY,
    provider_code VARCHAR(30) UNIQUE NOT NULL,
    provider_name VARCHAR(100) NOT NULL,
    issuer_url TEXT,
    client_id VARCHAR(255),
    config_json JSONB,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jclg_user_auth (
    user_auth_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES jclg_user(user_id),
    auth_provider_id BIGINT NOT NULL REFERENCES jclg_auth_provider(auth_provider_id),
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(150),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    token_expires_at TIMESTAMPTZ,
    last_authenticated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(auth_provider_id, provider_user_id)
);
CREATE TABLE IF NOT EXISTS jclg_login_session (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES jclg_user(user_id),
    selected_role_id BIGINT REFERENCES jclg_role(role_id),
    selected_module_code VARCHAR(50),
    session_token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    phone_verified_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS jclg_user_role (
    user_role_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES jclg_user(user_id),
    role_id BIGINT NOT NULL REFERENCES jclg_role(role_id),
    campus_id BIGINT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by BIGINT REFERENCES jclg_user(user_id),
    CONSTRAINT unique_user_role_assignment UNIQUE (user_id, role_id)
);

ALTER TABLE jclg_user_role DROP CONSTRAINT IF EXISTS jclg_user_role_user_id_role_id_campus_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_jclg_user_role_user_role ON jclg_user_role (user_id, role_id);
CREATE TABLE IF NOT EXISTS jclg_role_module (
    role_module_id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES jclg_role(role_id),
    module_code VARCHAR(50) NOT NULL,
    module_name VARCHAR(100),
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, module_code)
);
CREATE TABLE IF NOT EXISTS jclg_login_audit (
    login_audit_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES jclg_user(user_id),
    auth_provider_id BIGINT REFERENCES jclg_auth_provider(auth_provider_id),
    session_id UUID REFERENCES jclg_login_session(session_id),
    event_type VARCHAR(30) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    failure_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    event_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jclg_login_otp (
    otp_id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES jclg_login_session(session_id),
    phone VARCHAR(20) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO jclg_role (role_code, role_name, description) VALUES
('ADMIN', 'Admin', 'System administrator'),
('PRINCIPAL', 'Principal', 'Institution principal'),
('FACULTY', 'Faculty', 'Faculty member'),
('STUDENT', 'Student', 'Day scholar student'),
('PARENT', 'Parent', 'Student parent or guardian')
ON CONFLICT (role_code) DO NOTHING;
INSERT INTO jclg_role_module (role_id, module_code, module_name)
SELECT role_id, module_code, module_name FROM jclg_role CROSS JOIN (VALUES
('STUDENT_PROFILE', 'Student Profile & Day Scholar'),
('STUDENT_WELFARE', 'Student Welfare Programmes'),
('ACADEMICS', 'Academic & Intermediate Groups'),
('AI_ANALYSIS', 'AI Student Analysis'),
('CAREER_GUIDANCE', 'Personalized Programme & Career Guidance'),
('PROGRESS_ALERTS', 'Progress Monitoring & AI Alerts'),
('REPORTS_COMMUNICATION', 'AI Reports & Communication')
) AS module_list(module_code, module_name)
ON CONFLICT (role_id, module_code) DO NOTHING;
INSERT INTO jclg_auth_provider (provider_code, provider_name, issuer_url)
VALUES ('GOOGLE', 'Google', 'https://accounts.google.com')
ON CONFLICT (provider_code) DO NOTHING;
