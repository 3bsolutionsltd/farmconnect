CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role ENUM('buyer', 'farmer', 'admin') NOT NULL,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE demands (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_id BIGINT UNSIGNED NOT NULL,
    crop VARCHAR(160) NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    target_price DECIMAL(12, 2) NOT NULL,
    location VARCHAR(160) NOT NULL,
    delivery_date DATE NOT NULL,
    notes TEXT NULL,
    status ENUM('open', 'in_contract', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_demands_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
    INDEX idx_demands_status_delivery (status, delivery_date)
) ENGINE=InnoDB;

CREATE TABLE offers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    demand_id BIGINT UNSIGNED NOT NULL,
    farmer_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    note TEXT NULL,
    status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_offers_demand FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE,
    CONSTRAINT fk_offers_farmer FOREIGN KEY (farmer_id) REFERENCES users(id),
    INDEX idx_offers_demand_status (demand_id, status)
) ENGINE=InnoDB;

CREATE TABLE contracts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    demand_id BIGINT UNSIGNED NOT NULL UNIQUE,
    offer_id BIGINT UNSIGNED NOT NULL UNIQUE,
    buyer_id BIGINT UNSIGNED NOT NULL,
    farmer_id BIGINT UNSIGNED NOT NULL,
    status ENUM('accepted', 'funded', 'production', 'delivery', 'complete', 'disputed') NOT NULL DEFAULT 'accepted',
    milestone_note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_contracts_demand FOREIGN KEY (demand_id) REFERENCES demands(id),
    CONSTRAINT fk_contracts_offer FOREIGN KEY (offer_id) REFERENCES offers(id),
    CONSTRAINT fk_contracts_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
    CONSTRAINT fk_contracts_farmer FOREIGN KEY (farmer_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE api_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL DEFAULT 'mobile app',
    expires_at DATETIME NOT NULL,
    last_used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_api_tokens_user_expiry (user_id, expires_at)
) ENGINE=InnoDB;