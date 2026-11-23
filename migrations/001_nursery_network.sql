CREATE TABLE organisations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type ENUM('supplier', 'cooperative', 'institution', 'buyer_business', 'platform_partner') NOT NULL DEFAULT 'supplier',
    legal_name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(255) NULL,
    status ENUM('pending', 'active', 'suspended', 'archived') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_organisations_type_status (type, status)
) ENGINE=InnoDB;

CREATE TABLE organisation_members (
    organisation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role ENUM('owner', 'manager', 'staff', 'viewer') NOT NULL DEFAULT 'staff',
    status ENUM('invited', 'active', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organisation_id, user_id),
    CONSTRAINT fk_org_members_organisation FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_org_members_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE locations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT UNSIGNED NULL,
    level ENUM('district', 'subcounty', 'parish', 'village') NOT NULL,
    name VARCHAR(160) NOT NULL,
    code VARCHAR(80) NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    CONSTRAINT fk_locations_parent FOREIGN KEY (parent_id) REFERENCES locations(id) ON DELETE SET NULL,
    UNIQUE KEY uq_locations_parent_name (parent_id, name),
    INDEX idx_locations_level_name (level, name)
) ENGINE=InnoDB;

CREATE TABLE supplier_locations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NULL,
    name VARCHAR(160) NOT NULL,
    address VARCHAR(255) NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    phone VARCHAR(40) NULL,
    status ENUM('draft', 'active', 'closed') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_supplier_locations_organisation FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_locations_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    INDEX idx_supplier_locations_org_status (organisation_id, status),
    INDEX idx_supplier_locations_location (location_id)
) ENGINE=InnoDB;

CREATE TABLE nurseries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    supplier_location_id BIGINT UNSIGNED NOT NULL,
    description TEXT NULL,
    operator_name VARCHAR(160) NULL,
    whatsapp VARCHAR(40) NULL,
    years_operating SMALLINT UNSIGNED NULL,
    verification_status ENUM('unverified', 'submitted', 'under_review', 'verified', 'rejected', 'suspended') NOT NULL DEFAULT 'unverified',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_nurseries_organisation FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
    CONSTRAINT fk_nurseries_supplier_location FOREIGN KEY (supplier_location_id) REFERENCES supplier_locations(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_nurseries_supplier_location (supplier_location_id),
    INDEX idx_nurseries_verification (verification_status)
) ENGINE=InnoDB;

CREATE TABLE product_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT UNSIGNED NULL,
    name VARCHAR(160) NOT NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    CONSTRAINT fk_product_categories_parent FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE SET NULL,
    UNIQUE KEY uq_product_categories_parent_name (parent_id, name)
) ENGINE=InnoDB;

CREATE TABLE agricultural_products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    unit VARCHAR(32) NOT NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    CONSTRAINT fk_agricultural_products_category FOREIGN KEY (category_id) REFERENCES product_categories(id),
    INDEX idx_agricultural_products_category_status (category_id, status)
) ENGINE=InnoDB;

CREATE TABLE product_varieties (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT NULL,
    status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    CONSTRAINT fk_product_varieties_product FOREIGN KEY (product_id) REFERENCES agricultural_products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_varieties_product_name (product_id, name)
) ENGINE=InnoDB;

CREATE TABLE supplier_listings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_location_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    variety_id BIGINT UNSIGNED NULL,
    price DECIMAL(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'UGX',
    unit VARCHAR(32) NOT NULL,
    available_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
    minimum_quantity DECIMAL(12, 2) NOT NULL DEFAULT 1,
    status ENUM('draft', 'published', 'paused', 'archived') NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_supplier_listings_location FOREIGN KEY (supplier_location_id) REFERENCES supplier_locations(id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_listings_product FOREIGN KEY (product_id) REFERENCES agricultural_products(id),
    CONSTRAINT fk_supplier_listings_variety FOREIGN KEY (variety_id) REFERENCES product_varieties(id) ON DELETE SET NULL,
    INDEX idx_supplier_listings_discovery (status, product_id, available_quantity),
    INDEX idx_supplier_listings_location (supplier_location_id)
) ENGINE=InnoDB;

CREATE TABLE inventory_movements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    listing_id BIGINT UNSIGNED NOT NULL,
    movement_type ENUM('opening', 'received', 'reserved', 'released', 'adjusted', 'sold') NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    reference_type VARCHAR(80) NULL,
    reference_id BIGINT UNSIGNED NULL,
    note VARCHAR(500) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_movements_listing FOREIGN KEY (listing_id) REFERENCES supplier_listings(id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_movements_user FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_inventory_movements_listing_created (listing_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE supplier_verifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organisation_id BIGINT UNSIGNED NOT NULL,
    supplier_location_id BIGINT UNSIGNED NULL,
    status ENUM('submitted', 'under_review', 'verified', 'rejected', 'suspended') NOT NULL DEFAULT 'submitted',
    submitted_by BIGINT UNSIGNED NOT NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    notes TEXT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_supplier_verifications_organisation FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_verifications_location FOREIGN KEY (supplier_location_id) REFERENCES supplier_locations(id) ON DELETE SET NULL,
    CONSTRAINT fk_supplier_verifications_submitter FOREIGN KEY (submitted_by) REFERENCES users(id),
    CONSTRAINT fk_supplier_verifications_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_supplier_verifications_status (status, created_at)
) ENGINE=InnoDB;
