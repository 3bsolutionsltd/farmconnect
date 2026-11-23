CREATE TABLE capabilities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_capabilities (
    user_id BIGINT UNSIGNED NOT NULL,
    capability_id BIGINT UNSIGNED NOT NULL,
    status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
    granted_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, capability_id),
    CONSTRAINT fk_user_capabilities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_capabilities_capability FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_capabilities_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_capabilities_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE external_identities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(80) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    display_name VARCHAR(160) NULL,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_external_identities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_external_identity_provider_subject (provider, subject),
    INDEX idx_external_identities_user (user_id)
) ENGINE=InnoDB;

INSERT INTO capabilities (code, description) VALUES
    ('buyer.orders', 'Place and manage nursery procurement orders'),
    ('buyer.contracts', 'Create and manage produce contracts'),
    ('supplier.catalogue', 'Manage supplier products and catalogue listings'),
    ('supplier.inventory', 'Receive, adjust, release, and review supplier stock'),
    ('supplier.orders', 'Confirm and fulfil supplier orders'),
    ('admin.review', 'Review supplier verification and operational queues'),
    ('admin.products', 'Manage shared products, categories, and varieties')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id
FROM users u
JOIN capabilities c ON c.code IN ('buyer.orders', 'buyer.contracts')
WHERE u.role = 'buyer'
ON DUPLICATE KEY UPDATE status = 'active';

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id
FROM users u
JOIN capabilities c ON c.code IN ('buyer.orders', 'buyer.contracts', 'supplier.catalogue', 'supplier.inventory', 'supplier.orders')
WHERE u.role = 'farmer'
ON DUPLICATE KEY UPDATE status = 'active';

INSERT INTO user_capabilities (user_id, capability_id)
SELECT u.id, c.id
FROM users u
JOIN capabilities c ON c.code IN ('admin.review', 'admin.products')
WHERE u.role = 'admin'
ON DUPLICATE KEY UPDATE status = 'active';
