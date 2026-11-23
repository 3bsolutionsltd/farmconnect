CREATE TABLE orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_id BIGINT UNSIGNED NOT NULL,
    supplier_organisation_id BIGINT UNSIGNED NOT NULL,
    supplier_location_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending_supplier', 'confirmed', 'rejected', 'ready_for_collection', 'out_for_delivery', 'received', 'cancelled', 'disputed') NOT NULL DEFAULT 'pending_supplier',
    fulfilment_method ENUM('collection', 'delivery') NOT NULL,
    delivery_address VARCHAR(255) NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
    CONSTRAINT fk_orders_supplier_organisation FOREIGN KEY (supplier_organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_orders_supplier_location FOREIGN KEY (supplier_location_id) REFERENCES supplier_locations(id),
    INDEX idx_orders_buyer_status (buyer_id, status, requested_at),
    INDEX idx_orders_supplier_status (supplier_organisation_id, status, requested_at)
) ENGINE=InnoDB;

CREATE TABLE order_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    listing_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    variety_id BIGINT UNSIGNED NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'UGX',
    unit VARCHAR(32) NOT NULL,
    line_total DECIMAL(14, 2) NOT NULL,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_listing FOREIGN KEY (listing_id) REFERENCES supplier_listings(id),
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES agricultural_products(id),
    CONSTRAINT fk_order_items_variety FOREIGN KEY (variety_id) REFERENCES product_varieties(id) ON DELETE SET NULL,
    INDEX idx_order_items_listing (listing_id)
) ENGINE=InnoDB;

CREATE TABLE quotation_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_id BIGINT UNSIGNED NOT NULL,
    supplier_organisation_id BIGINT UNSIGNED NULL,
    crop_or_product VARCHAR(200) NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    delivery_method ENUM('collection', 'delivery') NOT NULL,
    delivery_address VARCHAR(255) NULL,
    notes TEXT NULL,
    status ENUM('open', 'quoted', 'accepted', 'closed', 'cancelled') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotation_requests_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
    CONSTRAINT fk_quotation_requests_supplier FOREIGN KEY (supplier_organisation_id) REFERENCES organisations(id) ON DELETE SET NULL,
    INDEX idx_quotation_requests_buyer_status (buyer_id, status, created_at),
    INDEX idx_quotation_requests_supplier_status (supplier_organisation_id, status, created_at)
) ENGINE=InnoDB;

CREATE TABLE quotations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quotation_request_id BIGINT UNSIGNED NOT NULL,
    supplier_organisation_id BIGINT UNSIGNED NOT NULL,
    total_price DECIMAL(14, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'UGX',
    note TEXT NULL,
    status ENUM('submitted', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'submitted',
    expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotations_request FOREIGN KEY (quotation_request_id) REFERENCES quotation_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_quotations_supplier FOREIGN KEY (supplier_organisation_id) REFERENCES organisations(id),
    INDEX idx_quotations_request_status (quotation_request_id, status)
) ENGINE=InnoDB;
