<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = trim((string) ($_GET['path'] ?? ''), '/');
$path = preg_replace('#^v1/?#', '', $path) ?? $path;
$segments = $path === '' ? [] : explode('/', $path);

try {
    if ($path === 'health' && $method === 'GET') {
        db()->query('SELECT 1');
        jsonResponse(['ok' => true, 'service' => 'farmconnect-api']);
    }

    if ($path === 'locations' && $method === 'GET') {
        $level = trim((string) ($_GET['level'] ?? ''));
        $parentId = (int) ($_GET['parent_id'] ?? 0);
        $conditions = [];
        $parameters = [];
        if ($level !== '') {
            $conditions[] = 'level = ?';
            $parameters[] = $level;
        }
        if ($parentId > 0) {
            $conditions[] = 'parent_id = ?';
            $parameters[] = $parentId;
        }
        $where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';
        $statement = db()->prepare("SELECT id, parent_id, level, name, code, latitude, longitude FROM locations{$where} ORDER BY name");
        $statement->execute($parameters);
        jsonResponse(['locations' => $statement->fetchAll()]);
    }

    if ($path === 'organisations' && $method === 'POST') {
        $user = requireUser();
        $body = requestBody();
        $displayName = validateString($body, 'display_name', 200);
        $legalName = trim((string) ($body['legal_name'] ?? $displayName));
        $type = (string) ($body['type'] ?? 'supplier');
        if (!in_array($type, ['supplier', 'cooperative', 'institution', 'buyer_business', 'platform_partner'], true) || strlen($legalName) > 200) {
            jsonResponse(['error' => 'Use a supported organisation type and valid name.'], 422);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $statement = $pdo->prepare('INSERT INTO organisations (type, legal_name, display_name, phone, email, status) VALUES (?, ?, ?, ?, ?, \'pending\')');
        $statement->execute([$type, $legalName, $displayName, trim((string) ($body['phone'] ?? '')), trim((string) ($body['email'] ?? ''))]);
        $organisationId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO organisation_members (organisation_id, user_id, role, status) VALUES (?, ?, \'owner\', \'active\')')->execute([$organisationId, $user['id']]);
        $pdo->commit();
        jsonResponse(['id' => $organisationId], 201);
    }

    if (preg_match('#^organisations/(\d+)/locations$#', $path, $matches) === 1 && $method === 'POST') {
        $organisationId = (int) $matches[1];
        requireOrganisationMember($organisationId);
        $body = requestBody();
        $name = validateString($body, 'name', 160);
        $locationId = (int) ($body['location_id'] ?? 0);
        $statement = db()->prepare('INSERT INTO supplier_locations (organisation_id, location_id, name, address, latitude, longitude, phone, status) VALUES (?, NULLIF(?, 0), ?, ?, ?, ?, ?, \'draft\')');
        $statement->execute([$organisationId, $locationId, $name, trim((string) ($body['address'] ?? '')), $body['latitude'] ?? null, $body['longitude'] ?? null, trim((string) ($body['phone'] ?? ''))]);
        jsonResponse(['id' => (int) db()->lastInsertId()], 201);
    }

    if ($path === 'nurseries' && $method === 'POST') {
        $body = requestBody();
        $organisationId = (int) ($body['organisation_id'] ?? 0);
        $supplierLocationId = (int) ($body['supplier_location_id'] ?? 0);
        requireOrganisationMember($organisationId);
        $location = db()->prepare('SELECT id FROM supplier_locations WHERE id = ? AND organisation_id = ? LIMIT 1');
        $location->execute([$supplierLocationId, $organisationId]);
        if (!$location->fetch()) {
            jsonResponse(['error' => 'The supplier location does not belong to this organisation.'], 422);
        }
        $statement = db()->prepare('INSERT INTO nurseries (organisation_id, supplier_location_id, description, operator_name, whatsapp, years_operating) VALUES (?, ?, ?, ?, ?, ?)');
        $statement->execute([$organisationId, $supplierLocationId, trim((string) ($body['description'] ?? '')), trim((string) ($body['operator_name'] ?? '')), trim((string) ($body['whatsapp'] ?? '')), ($body['years_operating'] ?? null)]);
        jsonResponse(['id' => (int) db()->lastInsertId()], 201);
    }

    if ($path === 'products' && $method === 'GET') {
        $statement = db()->query("SELECT ap.id, ap.name, ap.unit, COALESCE(JSON_ARRAYAGG(CASE WHEN pv.id IS NULL THEN NULL ELSE JSON_OBJECT('id', pv.id, 'name', pv.name) END), JSON_ARRAY()) AS varieties FROM agricultural_products ap LEFT JOIN product_varieties pv ON pv.product_id = ap.id AND pv.status = 'active' WHERE ap.status = 'active' GROUP BY ap.id, ap.name, ap.unit ORDER BY ap.name");
        $products = $statement->fetchAll();
        foreach ($products as &$product) {
            $product['varieties'] = array_values(array_filter(json_decode((string) $product['varieties'], true) ?: [], static fn (mixed $variety): bool => is_array($variety) && isset($variety['id'])));
        }
        unset($product);
        jsonResponse(['products' => $products]);
    }

    if ($path === 'admin/products' && $method === 'GET') {
        requireUser('admin');
        $statement = db()->query("SELECT ap.id, ap.name, ap.description, ap.unit, ap.status, pc.name AS category, COALESCE(JSON_ARRAYAGG(CASE WHEN pv.id IS NULL THEN NULL ELSE JSON_OBJECT('id', pv.id, 'name', pv.name, 'status', pv.status) END), JSON_ARRAY()) AS varieties FROM agricultural_products ap JOIN product_categories pc ON pc.id = ap.category_id LEFT JOIN product_varieties pv ON pv.product_id = ap.id GROUP BY ap.id, ap.name, ap.description, ap.unit, ap.status, pc.name ORDER BY ap.name");
        $products = $statement->fetchAll();
        foreach ($products as &$product) {
            $product['varieties'] = array_values(array_filter(json_decode((string) $product['varieties'], true) ?: [], static fn (mixed $variety): bool => is_array($variety) && isset($variety['id'])));
        }
        unset($product);
        jsonResponse(['products' => $products]);
    }

    if ($path === 'admin/product-categories' && $method === 'GET') {
        requireUser('admin');
        $statement = db()->query("SELECT id, name FROM product_categories WHERE status = 'active' ORDER BY name");
        jsonResponse(['categories' => $statement->fetchAll()]);
    }

    if ($path === 'admin/products' && $method === 'POST') {
        requireUser('admin');
        $body = requestBody();
        $name = validateString($body, 'name', 200);
        $unit = validateString($body, 'unit', 32);
        $categoryId = (int) ($body['category_id'] ?? 0);
        $category = db()->prepare("SELECT id FROM product_categories WHERE id = ? AND status = 'active' LIMIT 1");
        $category->execute([$categoryId]);
        if (!$category->fetch()) {
            jsonResponse(['error' => 'Choose an active product category.'], 422);
        }
        $statement = db()->prepare('INSERT INTO agricultural_products (category_id, name, description, unit) VALUES (?, ?, ?, ?)');
        $statement->execute([$categoryId, $name, trim((string) ($body['description'] ?? '')), $unit]);
        jsonResponse(['id' => (int) db()->lastInsertId()], 201);
    }

    if (preg_match('#^admin/products/(\d+)/varieties$#', $path, $matches) === 1 && $method === 'POST') {
        requireUser('admin');
        $productId = (int) $matches[1];
        $name = validateString(requestBody(), 'name', 160);
        $product = db()->prepare("SELECT id FROM agricultural_products WHERE id = ? AND status = 'active' LIMIT 1");
        $product->execute([$productId]);
        if (!$product->fetch()) {
            jsonResponse(['error' => 'Active product not found.'], 404);
        }
        try {
            $statement = db()->prepare('INSERT INTO product_varieties (product_id, name) VALUES (?, ?)');
            $statement->execute([$productId, $name]);
        } catch (PDOException $exception) {
            if ((int) $exception->errorInfo[1] === 1062) {
                jsonResponse(['error' => 'That variety already exists for this product.'], 409);
            }
            throw $exception;
        }
        jsonResponse(['id' => (int) db()->lastInsertId()], 201);
    }

    if ($path === 'supplier/locations' && $method === 'GET') {
        $user = requireCapability('supplier.catalogue');
        $statement = db()->prepare("SELECT sl.id, sl.organisation_id, sl.name, sl.status, o.display_name AS organisation_name FROM supplier_locations sl JOIN organisations o ON o.id = sl.organisation_id JOIN organisation_members om ON om.organisation_id = o.id AND om.user_id = ? AND om.status = 'active' WHERE om.role IN ('owner', 'manager', 'staff') AND sl.status <> 'closed' ORDER BY o.display_name, sl.name");
        $statement->execute([$user['id']]);
        jsonResponse(['locations' => $statement->fetchAll()]);
    }

    if ($path === 'supplier/organisations' && $method === 'GET') {
        $user = requireCapability('supplier.catalogue');
        $statement = db()->prepare("SELECT o.id, o.display_name FROM organisations o JOIN organisation_members om ON om.organisation_id = o.id AND om.user_id = ? AND om.status = 'active' WHERE o.type = 'supplier' AND om.role IN ('owner', 'manager') ORDER BY o.display_name");
        $statement->execute([$user['id']]);
        jsonResponse(['organisations' => $statement->fetchAll()]);
    }

    if ($path === 'supplier/listings' && $method === 'GET') {
        $user = requireCapability('supplier.catalogue');
        $statement = db()->prepare("SELECT sl.id, sl.supplier_location_id, sl.status, sl.price, sl.currency, sl.unit, sl.available_quantity, sl.minimum_quantity, sl.published_at, sl.updated_at, ap.id AS product_id, ap.name AS product, pv.id AS variety_id, pv.name AS variety, loc.name AS location_name, o.display_name AS organisation_name FROM supplier_listings sl JOIN supplier_locations loc ON loc.id = sl.supplier_location_id JOIN organisations o ON o.id = loc.organisation_id JOIN organisation_members om ON om.organisation_id = o.id AND om.user_id = ? AND om.status = 'active' JOIN agricultural_products ap ON ap.id = sl.product_id LEFT JOIN product_varieties pv ON pv.id = sl.variety_id WHERE om.role IN ('owner', 'manager', 'staff') ORDER BY sl.updated_at DESC, sl.id DESC");
        $statement->execute([$user['id']]);
        jsonResponse(['listings' => $statement->fetchAll()]);
    }

    if (preg_match('#^nurseries/(\d+)/verification-submissions$#', $path, $matches) === 1 && $method === 'POST') {
        $user = requireUser();
        $nurseryId = (int) $matches[1];
        $statement = db()->prepare('SELECT organisation_id, supplier_location_id FROM nurseries WHERE id = ? LIMIT 1');
        $statement->execute([$nurseryId]);
        $nursery = $statement->fetch();
        if (!$nursery) {
            jsonResponse(['error' => 'Nursery not found.'], 404);
        }
        requireOrganisationMember((int) $nursery['organisation_id']);
        db()->prepare('INSERT INTO supplier_verifications (organisation_id, supplier_location_id, status, submitted_by, notes) VALUES (?, ?, \'submitted\', ?, ?)')->execute([(int) $nursery['organisation_id'], (int) $nursery['supplier_location_id'], $user['id'], trim((string) (requestBody()['notes'] ?? ''))]);
        db()->prepare("UPDATE nurseries SET verification_status = 'submitted' WHERE id = ?")->execute([$nurseryId]);
        jsonResponse(['ok' => true], 201);
    }

    if ($path === 'admin/verification-submissions' && $method === 'GET') {
        requireUser('admin');
        $statement = db()->query("SELECT sv.id, sv.organisation_id, sv.supplier_location_id, sv.status, sv.submitted_by, sv.notes, sv.created_at, o.display_name AS organisation_name, sl.name AS location_name, sl.address, sl.phone, n.id AS nursery_id, n.operator_name, n.whatsapp, n.description, n.years_operating, submitter.name AS submitted_by_name, submitter.email AS submitted_by_email FROM supplier_verifications sv JOIN organisations o ON o.id = sv.organisation_id LEFT JOIN supplier_locations sl ON sl.id = sv.supplier_location_id LEFT JOIN nurseries n ON n.organisation_id = sv.organisation_id AND n.supplier_location_id = sv.supplier_location_id JOIN users submitter ON submitter.id = sv.submitted_by WHERE sv.status IN ('submitted', 'under_review') ORDER BY sv.created_at ASC");
        jsonResponse(['submissions' => $statement->fetchAll()]);
    }

    if ($path === 'admin/organisations' && $method === 'GET') {
        requireUser('admin');
        $statement = db()->query("SELECT o.id, o.type, o.display_name, o.legal_name, o.phone, o.email, CASE WHEN o.status = 'suspended' THEN 'suspended' WHEN EXISTS (SELECT 1 FROM nurseries verified_nursery WHERE verified_nursery.organisation_id = o.id AND verified_nursery.verification_status = 'verified') THEN 'active' ELSE o.status END AS status, o.created_at, (SELECT COUNT(*) FROM organisation_members om WHERE om.organisation_id = o.id AND om.status = 'active') AS member_count, (SELECT COUNT(*) FROM supplier_locations sl WHERE sl.organisation_id = o.id) AS location_count, (SELECT COUNT(*) FROM nurseries n WHERE n.organisation_id = o.id) AS nursery_count, (SELECT COUNT(*) FROM nurseries n WHERE n.organisation_id = o.id AND n.verification_status = 'verified') AS verified_nursery_count, (SELECT COUNT(*) FROM supplier_listings li JOIN supplier_locations sl2 ON sl2.id = li.supplier_location_id WHERE sl2.organisation_id = o.id) AS listing_count, COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('user_id', om.user_id, 'name', u.name, 'email', u.email, 'role', om.role, 'status', om.status)) FROM organisation_members om JOIN users u ON u.id = om.user_id WHERE om.organisation_id = o.id), JSON_ARRAY()) AS members FROM organisations o WHERE o.type = 'supplier' ORDER BY o.created_at DESC");
        $organisations = $statement->fetchAll();
        foreach ($organisations as &$organisation) {
            $organisation['members'] = json_decode((string) $organisation['members'], true) ?: [];
        }
        unset($organisation);
        jsonResponse(['organisations' => $organisations]);
    }

    if (preg_match('#^admin/organisations/(\d+)/status$#', $path, $matches) === 1 && $method === 'PATCH') {
        requireUser('admin');
        $organisationId = (int) $matches[1];
        $status = (string) (requestBody()['status'] ?? '');
        if (!in_array($status, ['active', 'suspended'], true)) {
            jsonResponse(['error' => 'Organisation status must be active or suspended.'], 422);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $statement = $pdo->prepare("UPDATE organisations SET status = ? WHERE id = ? AND type = 'supplier'");
        $statement->execute([$status, $organisationId]);
        if ($statement->rowCount() === 0) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Supplier organisation not found.'], 404);
        }
        $locationStatus = $status === 'suspended' ? 'closed' : 'active';
        $pdo->prepare('UPDATE supplier_locations SET status = ? WHERE organisation_id = ?')->execute([$locationStatus, $organisationId]);
        $pdo->commit();
        jsonResponse(['ok' => true, 'status' => $status]);
    }

    if (preg_match('#^admin/organisations/(\d+)/members/(\d+)/status$#', $path, $matches) === 1 && $method === 'PATCH') {
        requireUser('admin');
        $organisationId = (int) $matches[1];
        $userId = (int) $matches[2];
        $status = (string) (requestBody()['status'] ?? '');
        if (!in_array($status, ['active', 'suspended'], true)) {
            jsonResponse(['error' => 'Member status must be active or suspended.'], 422);
        }
        $pdo = db();
        $membership = $pdo->prepare('SELECT role, status FROM organisation_members WHERE organisation_id = ? AND user_id = ? LIMIT 1');
        $membership->execute([$organisationId, $userId]);
        $member = $membership->fetch();
        if (!$member) {
            jsonResponse(['error' => 'Organisation member not found.'], 404);
        }
        if ($status === 'suspended' && $member['role'] === 'owner' && $member['status'] === 'active') {
            $owners = $pdo->prepare("SELECT COUNT(*) FROM organisation_members WHERE organisation_id = ? AND role = 'owner' AND status = 'active'");
            $owners->execute([$organisationId]);
            if ((int) $owners->fetchColumn() <= 1) {
                jsonResponse(['error' => 'The organisation must retain an active owner.'], 409);
            }
        }
        $update = $pdo->prepare('UPDATE organisation_members SET status = ? WHERE organisation_id = ? AND user_id = ?');
        $update->execute([$status, $organisationId, $userId]);
        jsonResponse(['ok' => true, 'status' => $status]);
    }

    if ($path === 'admin/listings' && $method === 'GET') {
        requireUser('admin');
        $statement = db()->query("SELECT sl.id, sl.status, sl.price, sl.currency, sl.unit, sl.available_quantity, sl.minimum_quantity, sl.published_at, sl.updated_at, ap.name AS product, pv.name AS variety, o.id AS organisation_id, o.display_name AS organisation_name, loc.id AS supplier_location_id, loc.name AS location_name FROM supplier_listings sl JOIN supplier_locations loc ON loc.id = sl.supplier_location_id JOIN organisations o ON o.id = loc.organisation_id JOIN agricultural_products ap ON ap.id = sl.product_id LEFT JOIN product_varieties pv ON pv.id = sl.variety_id WHERE o.type = 'supplier' ORDER BY sl.updated_at DESC, sl.id DESC");
        jsonResponse(['listings' => $statement->fetchAll()]);
    }

    if (preg_match('#^admin/listings/(\d+)/status$#', $path, $matches) === 1 && $method === 'PATCH') {
        requireUser('admin');
        $listingId = (int) $matches[1];
        $status = (string) (requestBody()['status'] ?? '');
        if (!in_array($status, ['draft', 'published', 'paused', 'archived'], true)) {
            jsonResponse(['error' => 'Unsupported listing status.'], 422);
        }
        $listing = db()->prepare('SELECT sl.id FROM supplier_listings sl JOIN supplier_locations loc ON loc.id = sl.supplier_location_id JOIN organisations o ON o.id = loc.organisation_id WHERE sl.id = ? AND o.type = \'supplier\' LIMIT 1');
        $listing->execute([$listingId]);
        if (!$listing->fetch()) {
            jsonResponse(['error' => 'Supplier listing not found.'], 404);
        }
        $publishedAt = $status === 'published' ? ', published_at = COALESCE(published_at, NOW())' : '';
        db()->prepare('UPDATE supplier_listings SET status = ?' . $publishedAt . ' WHERE id = ?')->execute([$status, $listingId]);
        jsonResponse(['ok' => true, 'status' => $status]);
    }

    if (preg_match('#^admin/verification-submissions/(\d+)/(approve|reject)$#', $path, $matches) === 1 && $method === 'POST') {
        $admin = requireUser('admin');
        $status = $matches[2] === 'approve' ? 'verified' : 'rejected';
        $submissionId = (int) $matches[1];
        $statement = db()->prepare('SELECT organisation_id, supplier_location_id FROM supplier_verifications WHERE id = ? AND status IN (\'submitted\', \'under_review\') LIMIT 1');
        $statement->execute([$submissionId]);
        $submission = $statement->fetch();
        if (!$submission) {
            jsonResponse(['error' => 'Verification submission not found or already decided.'], 404);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE supplier_verifications SET status = ?, reviewed_by = ?, reviewed_at = NOW(), notes = ? WHERE id = ?')->execute([$status, $admin['id'], trim((string) (requestBody()['notes'] ?? '')), $submissionId]);
        if ($submission['supplier_location_id'] !== null) {
            $pdo->prepare('UPDATE nurseries SET verification_status = ? WHERE organisation_id = ? AND supplier_location_id = ?')->execute([$status, $submission['organisation_id'], $submission['supplier_location_id']]);
            if ($status === 'verified') {
                $pdo->prepare('UPDATE supplier_locations SET status = \'active\' WHERE id = ? AND organisation_id = ?')->execute([$submission['supplier_location_id'], $submission['organisation_id']]);
                $pdo->prepare('UPDATE organisations SET status = \'active\' WHERE id = ?')->execute([$submission['organisation_id']]);
            }
        }
        $pdo->commit();
        jsonResponse(['ok' => true, 'status' => $status]);
    }

    if ($path === 'listings' && $method === 'POST') {
        $body = requestBody();
        $supplierLocationId = (int) ($body['supplier_location_id'] ?? 0);
        $location = db()->prepare('SELECT organisation_id FROM supplier_locations WHERE id = ? AND status <> \'closed\' LIMIT 1');
        $location->execute([$supplierLocationId]);
        $supplierLocation = $location->fetch();
        if (!$supplierLocation) {
            jsonResponse(['error' => 'Supplier location not found.'], 404);
        }
        requireOrganisationMember((int) $supplierLocation['organisation_id']);
        $productId = (int) ($body['product_id'] ?? 0);
        $price = (float) ($body['price'] ?? 0);
        $quantity = (float) ($body['available_quantity'] ?? 0);
        $unit = validateString($body, 'unit', 32);
        if ($productId <= 0 || $price <= 0 || $quantity < 0) {
            jsonResponse(['error' => 'Product, positive price, and valid stock are required.'], 422);
        }
        $product = db()->prepare("SELECT id FROM agricultural_products WHERE id = ? AND status = 'active' LIMIT 1");
        $product->execute([$productId]);
        if (!$product->fetch()) {
            jsonResponse(['error' => 'Choose an active catalogue product.'], 422);
        }
        $varietyId = (int) ($body['variety_id'] ?? 0);
        if ($varietyId > 0) {
            $variety = db()->prepare("SELECT id FROM product_varieties WHERE id = ? AND product_id = ? AND status = 'active' LIMIT 1");
            $variety->execute([$varietyId, $productId]);
            if (!$variety->fetch()) {
                jsonResponse(['error' => 'Choose a variety belonging to the selected product.'], 422);
            }
        }
        $status = (string) ($body['status'] ?? 'draft');
        if (!in_array($status, ['draft', 'published'], true)) {
            jsonResponse(['error' => 'Listings may start as draft or published.'], 422);
        }
        $pdo = db();
        try {
            $pdo->beginTransaction();
            $columnCheck = $pdo->prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_listings' AND COLUMN_NAME IN ('sku')");
            $columnCheck->execute();
            $hasSku = $columnCheck->fetchColumn() !== false;
            $currency = strtoupper((string) ($body['currency'] ?? 'UGX'));
            $minimumQuantity = max(1, (float) ($body['minimum_quantity'] ?? 1));
            $sku = 'FC-' . $supplierLocationId . '-' . $productId . '-' . ($varietyId ?: 'ALL') . '-' . bin2hex(random_bytes(3));
            $publishedAt = $status === 'published' ? date('Y-m-d H:i:s') : null;
            if ($hasSku) {
                $statement = $pdo->prepare("INSERT INTO supplier_listings (supplier_location_id, product_id, variety_id, sku, price, currency, unit, available_quantity, minimum_quantity, status, published_at) VALUES (?, ?, NULLIF(?, 0), ?, ?, ?, ?, ?, ?, ?, ?)");
                $statement->execute([$supplierLocationId, $productId, $varietyId, $sku, $price, $currency, $unit, $quantity, $minimumQuantity, $status, $publishedAt]);
            } else {
                $statement = $pdo->prepare("INSERT INTO supplier_listings (supplier_location_id, product_id, variety_id, price, currency, unit, available_quantity, minimum_quantity, status, published_at) VALUES (?, ?, NULLIF(?, 0), ?, ?, ?, ?, ?, ?, ?)");
                $statement->execute([$supplierLocationId, $productId, $varietyId, $price, $currency, $unit, $quantity, $minimumQuantity, $status, $publishedAt]);
            }
            $listingId = (int) $pdo->lastInsertId();
            if ($quantity > 0) {
                $movementType = 'opening';
                $movementTypeCheck = $pdo->prepare("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_movements' AND COLUMN_NAME = 'movement_type'");
                $movementTypeCheck->execute();
                $columnType = (string) $movementTypeCheck->fetchColumn();
                if ($columnType !== '' && strpos($columnType, "'opening'") === false) {
                    $movementType = 'received';
                }
                $pdo->prepare("INSERT INTO inventory_movements (listing_id, movement_type, quantity, note, created_by) VALUES (?, ?, ?, ?, ?)")->execute([$listingId, $movementType, $quantity, 'Opening stock', currentUser()['id']]);
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Catalogue listing creation failed: ' . $exception->getMessage());
            throw $exception;
        }
        jsonResponse(['id' => $listingId], 201);
    }

    if (preg_match('#^listings/(\d+)$#', $path, $matches) === 1 && $method === 'PATCH') {
        $listingId = (int) $matches[1];
        $statement = db()->prepare('SELECT sl.supplier_location_id, loc.organisation_id FROM supplier_listings sl JOIN supplier_locations loc ON loc.id = sl.supplier_location_id WHERE sl.id = ? LIMIT 1');
        $statement->execute([$listingId]);
        $listing = $statement->fetch();
        if (!$listing) {
            jsonResponse(['error' => 'Listing not found.'], 404);
        }
        requireOrganisationMember((int) $listing['organisation_id']);
        $body = requestBody();
        if (array_key_exists('price', $body) && (float) $body['price'] <= 0) {
            jsonResponse(['error' => 'Price must be positive.'], 422);
        }
        if (array_key_exists('minimum_quantity', $body) && (float) $body['minimum_quantity'] <= 0) {
            jsonResponse(['error' => 'Minimum quantity must be positive.'], 422);
        }
        if (array_key_exists('unit', $body) && (trim((string) $body['unit']) === '' || strlen((string) $body['unit']) > 32)) {
            jsonResponse(['error' => 'Unit is required and must be 32 characters or fewer.'], 422);
        }
        if (array_key_exists('status', $body) && !in_array($body['status'], ['draft', 'published', 'paused', 'archived'], true)) {
            jsonResponse(['error' => 'Unsupported listing status.'], 422);
        }
        $fields = [];
        $parameters = [];
        foreach (['price' => 'price', 'unit' => 'unit', 'minimum_quantity' => 'minimum_quantity', 'status' => 'status'] as $input => $column) {
            if (array_key_exists($input, $body)) {
                $fields[] = "{$column} = ?";
                $parameters[] = $body[$input];
            }
        }
        if (isset($body['status']) && $body['status'] === 'published') {
            $fields[] = 'published_at = COALESCE(published_at, NOW())';
        }
        if (!$fields) {
            jsonResponse(['error' => 'No listing changes supplied.'], 422);
        }
        $parameters[] = $listingId;
        db()->prepare('UPDATE supplier_listings SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($parameters);
        jsonResponse(['ok' => true]);
    }

    if (preg_match('#^listings/(\d+)/inventory-movements$#', $path, $matches) === 1 && $method === 'POST') {
        $listingId = (int) $matches[1];
        $statement = db()->prepare('SELECT sl.available_quantity, loc.organisation_id FROM supplier_listings sl JOIN supplier_locations loc ON loc.id = sl.supplier_location_id WHERE sl.id = ? LIMIT 1');
        $statement->execute([$listingId]);
        $listing = $statement->fetch();
        if (!$listing) {
            jsonResponse(['error' => 'Listing not found.'], 404);
        }
        requireOrganisationMember((int) $listing['organisation_id']);
        $body = requestBody();
        $movementType = (string) ($body['movement_type'] ?? 'adjusted');
        $quantity = (float) ($body['quantity'] ?? 0);
        if (!in_array($movementType, ['received', 'released', 'adjusted'], true) || $quantity <= 0) {
            jsonResponse(['error' => 'Use a supported stock movement and positive quantity.'], 422);
        }
        $newQuantity = $movementType === 'adjusted' ? $quantity : (float) $listing['available_quantity'] + ($movementType === 'received' || $movementType === 'released' ? $quantity : 0);
        if ($newQuantity < 0) {
            jsonResponse(['error' => 'Stock cannot fall below zero.'], 422);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE supplier_listings SET available_quantity = ? WHERE id = ?')->execute([$newQuantity, $listingId]);
        $pdo->prepare('INSERT INTO inventory_movements (listing_id, movement_type, quantity, note, created_by) VALUES (?, ?, ?, ?, ?)')->execute([$listingId, $movementType, $quantity, trim((string) ($body['note'] ?? '')), currentUser()['id']]);
        $pdo->commit();
        jsonResponse(['ok' => true, 'available_quantity' => $newQuantity]);
    }

    if (preg_match('#^listings/(\d+)/inventory-movements$#', $path, $matches) === 1 && $method === 'GET') {
        $listingId = (int) $matches[1];
        $statement = db()->prepare("SELECT sl.id FROM supplier_listings sl JOIN supplier_locations loc ON loc.id = sl.supplier_location_id JOIN organisation_members om ON om.organisation_id = loc.organisation_id AND om.user_id = ? AND om.status = 'active' WHERE sl.id = ? AND om.role IN ('owner', 'manager', 'staff') LIMIT 1");
        $statement->execute([requireCapability('supplier.inventory')['id'], $listingId]);
        if (!$statement->fetch()) {
            jsonResponse(['error' => 'Listing not found.'], 404);
        }
        $movements = db()->prepare('SELECT im.id, im.movement_type, im.quantity, im.reference_type, im.reference_id, im.note, im.created_at, u.name AS created_by_name FROM inventory_movements im JOIN users u ON u.id = im.created_by WHERE im.listing_id = ? ORDER BY im.created_at DESC, im.id DESC');
        $movements->execute([$listingId]);
        jsonResponse(['movements' => $movements->fetchAll()]);
    }

    if ($path === 'orders' && $method === 'POST') {
        $buyer = requireCapability('buyer.orders');
        $body = requestBody();
        $listingId = (int) ($body['listing_id'] ?? 0);
        $quantity = (float) ($body['quantity'] ?? 0);
        $fulfilmentMethod = (string) ($body['fulfilment_method'] ?? 'collection');
        if ($listingId <= 0 || $quantity <= 0 || !in_array($fulfilmentMethod, ['collection', 'delivery'], true)) {
            jsonResponse(['error' => 'A listing, positive quantity, and valid fulfilment method are required.'], 422);
        }
        if ($fulfilmentMethod === 'delivery' && trim((string) ($body['delivery_address'] ?? '')) === '') {
            jsonResponse(['error' => 'A delivery address is required for delivery orders.'], 422);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $statement = $pdo->prepare("SELECT sl.id, sl.supplier_location_id, sl.product_id, sl.variety_id, sl.price, sl.currency, sl.unit, sl.available_quantity, sl.minimum_quantity, loc.organisation_id FROM supplier_listings sl JOIN supplier_locations loc ON loc.id = sl.supplier_location_id WHERE sl.id = ? AND sl.status = 'published' FOR UPDATE");
        $statement->execute([$listingId]);
        $listing = $statement->fetch();
        if (!$listing || (float) $listing['available_quantity'] < $quantity || $quantity < (float) $listing['minimum_quantity']) {
            $pdo->rollBack();
            jsonResponse(['error' => 'The listing is unavailable for that quantity.'], 409);
        }
        $total = $quantity * (float) $listing['price'];
        $pdo->prepare("INSERT INTO orders (buyer_id, supplier_organisation_id, supplier_location_id, fulfilment_method, delivery_address) VALUES (?, ?, ?, ?, ?)")->execute([$buyer['id'], $listing['organisation_id'], $listing['supplier_location_id'], $fulfilmentMethod, trim((string) ($body['delivery_address'] ?? ''))]);
        $orderId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO order_items (order_id, listing_id, product_id, variety_id, quantity, unit_price, currency, unit, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([$orderId, $listingId, $listing['product_id'], $listing['variety_id'], $quantity, $listing['price'], $listing['currency'], $listing['unit'], $total]);
        $pdo->prepare('UPDATE supplier_listings SET available_quantity = available_quantity - ? WHERE id = ?')->execute([$quantity, $listingId]);
        $pdo->prepare("INSERT INTO inventory_movements (listing_id, movement_type, quantity, reference_type, reference_id, note, created_by) VALUES (?, 'reserved', ?, 'order', ?, 'Reserved for nursery order', ?)")->execute([$listingId, $quantity, $orderId, $buyer['id']]);
        recordOrderEvent($pdo, $orderId, null, 'pending_supplier', $buyer['id'], 'created', 'Order placed and stock reserved');
        $pdo->commit();
        jsonResponse(['id' => $orderId, 'total' => $total, 'currency' => $listing['currency']], 201);
    }

    if ($path === 'orders' && $method === 'GET') {
        $user = requireUser();
        $where = $user['role'] === 'buyer'
            ? 'o.buyer_id = ?'
            : 'EXISTS (SELECT 1 FROM organisation_members om WHERE om.organisation_id = o.supplier_organisation_id AND om.user_id = ? AND om.status = \'active\')';
        $statement = db()->prepare("SELECT o.id, o.buyer_id, o.status, o.fulfilment_method, o.delivery_address, o.requested_at, o.confirmed_at, o.completed_at, org.display_name AS supplier, sl.name AS location_name, buyer.name AS buyer, GROUP_CONCAT(DISTINCT CONCAT(ap.name, COALESCE(CONCAT(' - ', pv.name), '')) ORDER BY ap.name SEPARATOR ', ') AS products, COALESCE(SUM(oi.quantity), 0) AS quantity, COALESCE(SUM(oi.line_total), 0) AS total, MAX(oi.currency) AS currency FROM orders o JOIN organisations org ON org.id = o.supplier_organisation_id JOIN supplier_locations sl ON sl.id = o.supplier_location_id JOIN users buyer ON buyer.id = o.buyer_id JOIN order_items oi ON oi.order_id = o.id JOIN agricultural_products ap ON ap.id = oi.product_id LEFT JOIN product_varieties pv ON pv.id = oi.variety_id WHERE {$where} GROUP BY o.id, o.buyer_id, o.status, o.fulfilment_method, o.delivery_address, o.requested_at, o.confirmed_at, o.completed_at, org.display_name, sl.name, buyer.name ORDER BY o.requested_at DESC");
        $statement->execute([$user['id']]);
        jsonResponse(['orders' => $statement->fetchAll()]);
    }

    if (preg_match('#^orders/(\d+)/events$#', $path, $matches) === 1 && $method === 'GET') {
        $user = requireUser();
        $orderId = (int) $matches[1];
        $statement = db()->prepare('SELECT buyer_id, supplier_organisation_id FROM orders WHERE id = ? LIMIT 1');
        $statement->execute([$orderId]);
        $order = $statement->fetch();
        if (!$order) {
            jsonResponse(['error' => 'Order not found.'], 404);
        }
        if ((int) $order['buyer_id'] !== (int) $user['id']) {
            requireOrganisationMember((int) $order['supplier_organisation_id']);
        }
        if (db()->query("SHOW TABLES LIKE 'order_events'")->fetchColumn() === false) {
            jsonResponse(['error' => 'Order history is not enabled. Import migrations/004_order_events.sql.'], 503);
        }
        $events = db()->prepare('SELECT id, from_status, to_status, event_type, note, actor_id, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC, id ASC');
        $events->execute([$orderId]);
        jsonResponse(['events' => $events->fetchAll()]);
    }

    if (preg_match('#^orders/(\d+)/(confirm|reject)$#', $path, $matches) === 1 && $method === 'POST') {
        $user = requireUser();
        $orderId = (int) $matches[1];
        $statement = db()->prepare('SELECT supplier_organisation_id FROM orders WHERE id = ? LIMIT 1');
        $statement->execute([$orderId]);
        $order = $statement->fetch();
        if (!$order) {
            jsonResponse(['error' => 'Order not found.'], 404);
        }
        $supplier = requireOrganisationMember((int) $order['supplier_organisation_id']);
        $status = $matches[2] === 'confirm' ? 'confirmed' : 'rejected';
        $pdo = db();
        $pdo->beginTransaction();
        $statement = $pdo->prepare('SELECT supplier_organisation_id, status FROM orders WHERE id = ? FOR UPDATE');
        $statement->execute([$orderId]);
        $order = $statement->fetch();
        if (!$order || $order['status'] !== 'pending_supplier') {
            $pdo->rollBack();
            jsonResponse(['error' => 'Pending order not found.'], 409);
        }
        if ($status === 'rejected') {
            $items = $pdo->prepare('SELECT listing_id, quantity FROM order_items WHERE order_id = ?');
            $items->execute([$orderId]);
            foreach ($items->fetchAll() as $item) {
                $pdo->prepare('UPDATE supplier_listings SET available_quantity = available_quantity + ? WHERE id = ?')->execute([$item['quantity'], $item['listing_id']]);
                $pdo->prepare("INSERT INTO inventory_movements (listing_id, movement_type, quantity, reference_type, reference_id, note, created_by) VALUES (?, 'released', ?, 'order', ?, 'Released after supplier rejection', ?)")->execute([$item['listing_id'], $item['quantity'], $orderId, $supplier['user_id']]);
            }
        }
        $pdo->prepare('UPDATE orders SET status = ?, confirmed_at = CASE WHEN ? = \'confirmed\' THEN NOW() ELSE NULL END WHERE id = ?')->execute([$status, $status, $orderId]);
        recordOrderEvent($pdo, $orderId, 'pending_supplier', $status, $supplier['user_id'], $status === 'rejected' ? 'rejected' : 'confirmed');
        $pdo->commit();
        jsonResponse(['ok' => true, 'status' => $status]);
    }

    if (preg_match('#^orders/(\d+)/cancel$#', $path, $matches) === 1 && $method === 'POST') {
        $buyer = requireCapability('buyer.orders');
        $orderId = (int) $matches[1];
        $pdo = db();
        $pdo->beginTransaction();
        $statement = $pdo->prepare("SELECT id, status FROM orders WHERE id = ? AND buyer_id = ? AND status IN ('pending_supplier', 'confirmed') FOR UPDATE");
        $statement->execute([$orderId, $buyer['id']]);
        $order = $statement->fetch();
        if (!$order) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Order cannot be cancelled.'], 409);
        }
        $items = $pdo->prepare('SELECT listing_id, quantity FROM order_items WHERE order_id = ?');
        $items->execute([$orderId]);
        foreach ($items->fetchAll() as $item) {
            $pdo->prepare('UPDATE supplier_listings SET available_quantity = available_quantity + ? WHERE id = ?')->execute([$item['quantity'], $item['listing_id']]);
            $pdo->prepare("INSERT INTO inventory_movements (listing_id, movement_type, quantity, reference_type, reference_id, note, created_by) VALUES (?, 'released', ?, 'order', ?, 'Released after buyer cancellation', ?)")->execute([$item['listing_id'], $item['quantity'], $orderId, $buyer['id']]);
        }
        $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute(['cancelled', $orderId]);
        recordOrderEvent($pdo, $orderId, $order['status'], 'cancelled', $buyer['id'], 'cancelled', 'Cancelled by buyer');
        $pdo->commit();
        jsonResponse(['ok' => true, 'status' => 'cancelled']);
    }

    if (preg_match('#^orders/(\d+)/status$#', $path, $matches) === 1 && $method === 'POST') {
        $orderId = (int) $matches[1];
        $nextStatus = (string) (requestBody()['status'] ?? '');
        if (!in_array($nextStatus, ['ready_for_collection', 'out_for_delivery', 'received', 'disputed'], true)) {
            jsonResponse(['error' => 'Unsupported order status.'], 422);
        }
        $statement = db()->prepare('SELECT id, buyer_id, supplier_organisation_id, fulfilment_method, status FROM orders WHERE id = ? LIMIT 1');
        $statement->execute([$orderId]);
        $order = $statement->fetch();
        if (!$order) {
            jsonResponse(['error' => 'Order not found.'], 404);
        }
        $user = requireUser();
        if ($nextStatus === 'ready_for_collection' || $nextStatus === 'out_for_delivery') {
            requireOrganisationMember((int) $order['supplier_organisation_id']);
            if ($order['status'] !== 'confirmed') {
                jsonResponse(['error' => 'Only confirmed orders can be marked ready.'], 409);
            }
            if ($nextStatus === 'out_for_delivery' && $order['fulfilment_method'] !== 'delivery') {
                jsonResponse(['error' => 'Only delivery orders can be dispatched.'], 409);
            }
        } else {
            if ((int) $order['buyer_id'] !== (int) $user['id']) {
                jsonResponse(['error' => 'Only the buyer can mark this order received.'], 403);
            }
            if ($nextStatus === 'received' && !in_array($order['status'], ['ready_for_collection', 'out_for_delivery'], true)) {
                jsonResponse(['error' => 'Only ready or dispatched orders can be marked received.'], 409);
            }
            if ($nextStatus === 'disputed' && !in_array($order['status'], ['ready_for_collection', 'out_for_delivery'], true)) {
                jsonResponse(['error' => 'Only ready or dispatched orders can be disputed.'], 409);
            }
        }
        $pdo = db();
        $pdo->beginTransaction();
        $lockedStatement = $pdo->prepare('SELECT id, buyer_id, supplier_organisation_id, fulfilment_method, status FROM orders WHERE id = ? FOR UPDATE');
        $lockedStatement->execute([$orderId]);
        $lockedOrder = $lockedStatement->fetch();
        if (!$lockedOrder || $lockedOrder['status'] !== $order['status']) {
            $pdo->rollBack();
            jsonResponse(['error' => 'The order changed before this action could be applied.'], 409);
        }
        $order = $lockedOrder;
        if ($nextStatus === 'received') {
            $items = $pdo->prepare('SELECT listing_id, quantity FROM order_items WHERE order_id = ?');
            $items->execute([$orderId]);
            foreach ($items->fetchAll() as $item) {
                $pdo->prepare("INSERT INTO inventory_movements (listing_id, movement_type, quantity, reference_type, reference_id, note, created_by) VALUES (?, 'sold', ?, 'order', ?, 'Order received by buyer', ?)")->execute([$item['listing_id'], $item['quantity'], $orderId, $user['id']]);
            }
        }
        if ($nextStatus === 'disputed') {
            $items = $pdo->prepare('SELECT listing_id, quantity FROM order_items WHERE order_id = ?');
            $items->execute([$orderId]);
            foreach ($items->fetchAll() as $item) {
                $pdo->prepare('UPDATE supplier_listings SET available_quantity = available_quantity + ? WHERE id = ?')->execute([$item['quantity'], $item['listing_id']]);
                $pdo->prepare("INSERT INTO inventory_movements (listing_id, movement_type, quantity, reference_type, reference_id, note, created_by) VALUES (?, 'released', ?, 'order', ?, 'Released after buyer dispute', ?)")->execute([$item['listing_id'], $item['quantity'], $orderId, $user['id']]);
            }
        }
        $pdo->prepare('UPDATE orders SET status = ?, completed_at = CASE WHEN ? = \'received\' THEN NOW() ELSE completed_at END WHERE id = ?')->execute([$nextStatus, $nextStatus, $orderId]);
        recordOrderEvent($pdo, $orderId, $order['status'], $nextStatus, $user['id'], $nextStatus === 'disputed' ? 'disputed' : 'status_change');
        $pdo->commit();
        jsonResponse(['ok' => true, 'status' => $nextStatus]);
    }

    if ($path === 'quotation-requests' && $method === 'POST') {
        $buyer = requireCapability('buyer.orders');
        $body = requestBody();
        $product = validateString($body, 'crop_or_product', 200);
        $unit = validateString($body, 'unit', 32);
        $quantity = (float) ($body['quantity'] ?? 0);
        $deliveryMethod = (string) ($body['delivery_method'] ?? 'collection');
        if ($quantity <= 0 || !in_array($deliveryMethod, ['collection', 'delivery'], true)) {
            jsonResponse(['error' => 'Use a positive quantity and valid delivery method.'], 422);
        }
        $statement = db()->prepare('INSERT INTO quotation_requests (buyer_id, supplier_organisation_id, crop_or_product, quantity, unit, delivery_method, delivery_address, notes) VALUES (?, NULLIF(?, 0), ?, ?, ?, ?, ?, ?)');
        $statement->execute([$buyer['id'], (int) ($body['supplier_organisation_id'] ?? 0), $product, $quantity, $unit, $deliveryMethod, trim((string) ($body['delivery_address'] ?? '')), trim((string) ($body['notes'] ?? ''))]);
        jsonResponse(['id' => (int) db()->lastInsertId()], 201);
    }

    if ($path === 'quotation-requests' && $method === 'GET') {
        $user = requireUser();
        $statement = db()->prepare('SELECT id, crop_or_product, quantity, unit, delivery_method, delivery_address, notes, status, created_at FROM quotation_requests WHERE buyer_id = ? ORDER BY created_at DESC');
        $statement->execute([$user['id']]);
        jsonResponse(['quotation_requests' => $statement->fetchAll()]);
    }

    if ($path === 'nurseries' && $method === 'GET') {
        $conditions = ["n.verification_status = 'verified'", "sloc.status = 'active'"];
        $parameters = [];
        foreach (['district', 'subcounty', 'parish', 'village'] as $level) {
            $value = trim((string) ($_GET[$level] ?? ''));
            if ($value !== '') {
                $conditions[] = "EXISTS (SELECT 1 FROM locations filter_location WHERE filter_location.id = sloc.location_id AND filter_location.level = ? AND filter_location.name LIKE ? )";
                $parameters[] = $level;
                $parameters[] = '%' . $value . '%';
            }
        }
        $crop = trim((string) ($_GET['crop'] ?? ''));
        if ($crop !== '') {
            $conditions[] = '(ap.name LIKE ? OR pv.name LIKE ?)';
            $parameters[] = '%' . $crop . '%';
            $parameters[] = '%' . $crop . '%';
        }
        $available = filter_var($_GET['available'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($available) {
            $conditions[] = 'slist.available_quantity > 0';
        }
        $limit = min(max((int) ($_GET['limit'] ?? 20), 1), 50);
        $offset = max((int) ($_GET['offset'] ?? 0), 0);
        $parameters[] = $limit;
        $parameters[] = $offset;
        $statement = db()->prepare("SELECT n.id, n.description, n.operator_name, n.whatsapp, n.years_operating, n.verification_status, o.display_name AS nursery_name, sloc.id AS supplier_location_id, sloc.name AS location_name, sloc.address, sloc.latitude, sloc.longitude, l.name AS administrative_location, GROUP_CONCAT(DISTINCT CONCAT(ap.name, COALESCE(CONCAT(' - ', pv.name), '')) ORDER BY ap.name SEPARATOR ', ') AS products, featured.id AS order_listing_id, featured.price AS starting_price, featured.available_quantity AS available_quantity FROM nurseries n JOIN organisations o ON o.id = n.organisation_id JOIN supplier_locations sloc ON sloc.id = n.supplier_location_id LEFT JOIN locations l ON l.id = sloc.location_id LEFT JOIN supplier_listings slist ON slist.supplier_location_id = sloc.id AND slist.status = 'published' LEFT JOIN supplier_listings featured ON featured.id = (SELECT selected.id FROM supplier_listings selected WHERE selected.supplier_location_id = sloc.id AND selected.status = 'published' ORDER BY selected.price ASC, selected.id ASC LIMIT 1) LEFT JOIN agricultural_products ap ON ap.id = slist.product_id LEFT JOIN product_varieties pv ON pv.id = slist.variety_id WHERE " . implode(' AND ', $conditions) . " GROUP BY n.id, n.description, n.operator_name, n.whatsapp, n.years_operating, n.verification_status, o.display_name, sloc.id, sloc.name, sloc.address, sloc.latitude, sloc.longitude, l.name, featured.id, featured.price, featured.available_quantity ORDER BY o.display_name LIMIT ? OFFSET ?");
        $statement->execute($parameters);
        $nurseries = $statement->fetchAll();
        $statsStatement = db()->query("SELECT COUNT(DISTINCT n.id) AS verified_nurseries, COALESCE(SUM(slist.available_quantity), 0) AS available_seedlings, COUNT(DISTINCT l.level) AS location_levels FROM nurseries n JOIN supplier_locations sloc ON sloc.id = n.supplier_location_id LEFT JOIN locations l ON l.id = sloc.location_id LEFT JOIN supplier_listings slist ON slist.supplier_location_id = sloc.id AND slist.status = 'published' WHERE n.verification_status = 'verified' AND sloc.status = 'active'");
        jsonResponse(['nurseries' => $nurseries, 'stats' => $statsStatement->fetch(), 'pagination' => ['limit' => $limit, 'offset' => $offset]]);
    }

    if (preg_match('#^nurseries/(\d+)$#', $path, $matches) === 1 && $method === 'GET') {
        $statement = db()->prepare("SELECT n.id, n.description, n.operator_name, n.whatsapp, n.years_operating, n.verification_status, o.display_name AS nursery_name, sl.name AS location_name, sl.address, sl.phone, sl.latitude, sl.longitude, l.name AS administrative_location FROM nurseries n JOIN organisations o ON o.id = n.organisation_id JOIN supplier_locations sl ON sl.id = n.supplier_location_id LEFT JOIN locations l ON l.id = sl.location_id WHERE n.id = ? AND n.verification_status = 'verified' AND sl.status = 'active' LIMIT 1");
        $statement->execute([(int) $matches[1]]);
        $nursery = $statement->fetch();
        if (!$nursery) {
            jsonResponse(['error' => 'Nursery not found.'], 404);
        }
        $listings = db()->prepare("SELECT sl.id, ap.name AS product, pv.name AS variety, sl.price, sl.currency, sl.unit, sl.available_quantity, sl.minimum_quantity FROM supplier_listings sl JOIN agricultural_products ap ON ap.id = sl.product_id LEFT JOIN product_varieties pv ON pv.id = sl.variety_id WHERE sl.supplier_location_id = (SELECT supplier_location_id FROM nurseries WHERE id = ?) AND sl.status = 'published' ORDER BY ap.name, pv.name");
        $listings->execute([(int) $matches[1]]);
        $nursery['listings'] = $listings->fetchAll();
        jsonResponse(['nursery' => $nursery]);
    }

    if ($path === 'auth/me' && $method === 'GET') {
        $user = currentUser();
        $notice = $_SESSION['auth_notice'] ?? null;
        unset($_SESSION['auth_notice']);
        jsonResponse(['user' => $user, 'context' => $user ? userContext($user) : ['capabilities' => [], 'organisations' => []], 'notice' => $notice]);
    }

    if ($path === 'auth/oidc/start' && $method === 'GET') {
        $oidc = oidcConfiguration();
        $linkUser = null;
        if (($_GET['mode'] ?? '') === 'link') {
            $linkUser = requireUser();
        }
        $discovery = oidcRequest($oidc['issuer'] . '/.well-known/openid-configuration');
        $authorizationEndpoint = (string) ($discovery['authorization_endpoint'] ?? '');
        if ($authorizationEndpoint === '') {
            throw new RuntimeException('Auth0 authorization endpoint is unavailable.');
        }
        $state = bin2hex(random_bytes(32));
        $nonce = bin2hex(random_bytes(32));
        $_SESSION['oidc'] = ['state' => $state, 'nonce' => $nonce, 'created_at' => time(), 'link_user_id' => $linkUser ? (int) $linkUser['id'] : null];
        $query = http_build_query([
            'response_type' => 'code',
            'client_id' => $oidc['clientId'],
            'redirect_uri' => $oidc['redirectUri'],
            'scope' => 'openid profile email',
            'state' => $state,
            'nonce' => $nonce,
        ]);
        header('Location: ' . $authorizationEndpoint . '?' . $query);
        exit;
    }

    if ($path === 'auth/oidc/callback' && $method === 'GET') {
        $oidc = oidcConfiguration();
        $expected = $_SESSION['oidc'] ?? null;
        unset($_SESSION['oidc']);
        if (!is_array($expected) || !hash_equals((string) ($expected['state'] ?? ''), (string) ($_GET['state'] ?? '')) || time() - (int) ($expected['created_at'] ?? 0) > 600) {
            jsonResponse(['error' => 'The Auth0 sign-in session expired. Please try again.'], 400);
        }
        if (!empty($_GET['error']) || empty($_GET['code'])) {
            jsonResponse(['error' => 'Auth0 sign-in was not completed.'], 400);
        }
        $discovery = oidcRequest($oidc['issuer'] . '/.well-known/openid-configuration');
        $tokenEndpoint = (string) ($discovery['token_endpoint'] ?? '');
        if ($tokenEndpoint === '') {
            throw new RuntimeException('Auth0 token endpoint is unavailable.');
        }
        $tokenResponse = oidcRequest($tokenEndpoint, [
            'grant_type' => 'authorization_code',
            'code' => (string) $_GET['code'],
            'redirect_uri' => $oidc['redirectUri'],
            'client_id' => $oidc['clientId'],
            'client_secret' => $oidc['clientSecret'],
        ]);
        $claims = validateOidcIdToken((string) ($tokenResponse['id_token'] ?? ''), $discovery, $oidc, (string) $expected['nonce']);
        $provider = 'auth0';
        $subject = trim((string) ($claims['sub'] ?? ''));
        $email = strtolower(trim((string) ($claims['email'] ?? '')));
        $name = trim((string) ($claims['name'] ?? $claims['nickname'] ?? ''));
        if ($subject === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['error' => 'Auth0 did not provide a usable account identity.'], 422);
        }
        requireOidcStorage();
        $identity = db()->prepare('SELECT u.id, u.role, u.name, u.email FROM external_identities ei JOIN users u ON u.id = ei.user_id WHERE ei.provider = ? AND ei.subject = ? LIMIT 1');
        $identity->execute([$provider, $subject]);
        $user = $identity->fetch();
        $linkUserId = (int) ($expected['link_user_id'] ?? 0);
        if ($linkUserId > 0 && $user && (int) $user['id'] !== $linkUserId) {
            jsonResponse(['error' => 'This Auth0 identity is already linked to another FarmConnect account.'], 409);
        }
        if (!$user) {
            if ($linkUserId > 0) {
                $current = $_SESSION['user'] ?? null;
                if (!is_array($current) || (int) ($current['id'] ?? 0) !== $linkUserId) {
                    jsonResponse(['error' => 'The account-linking session is no longer active.'], 401);
                }
                db()->prepare('INSERT INTO external_identities (user_id, provider, subject, email, display_name, last_login_at) VALUES (?, ?, ?, ?, ?, NOW())')->execute([$linkUserId, $provider, $subject, $email, $name]);
                db()->prepare('UPDATE external_identities SET last_login_at = NOW() WHERE provider = ? AND subject = ?')->execute([$provider, $subject]);
                $user = $current;
            }
        }
        if (!$user) {
            $existing = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
            $existing->execute([$email]);
            if ($existing->fetch()) {
                $_SESSION['auth_notice'] = 'This email already has a FarmConnect account. Sign in with email first, then choose Link Auth0 account.';
                redirectToApp('auth');
            }
            $displayName = $name !== '' ? $name : strstr($email, '@', true);
            $statement = db()->prepare('INSERT INTO users (role, name, email, password_hash) VALUES (\'buyer\', ?, ?, ?)');
            $statement->execute([$displayName, $email, password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT)]);
            $userId = (int) db()->lastInsertId();
            db()->prepare('INSERT INTO external_identities (user_id, provider, subject, email, display_name, last_login_at) VALUES (?, ?, ?, ?, ?, NOW())')->execute([$userId, $provider, $subject, $email, $name]);
            grantUserCapabilities($userId, ['buyer.orders']);
            $user = ['id' => $userId, 'role' => 'buyer', 'name' => $displayName, 'email' => $email];
        } else {
            db()->prepare('UPDATE external_identities SET email = ?, display_name = ?, last_login_at = NOW() WHERE provider = ? AND subject = ?')->execute([$email, $name, $provider, $subject]);
        }
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        redirectToApp('dashboard');
    }

    if ($path === 'auth/register') {
        requireMethod('POST');
        $body = requestBody();
        $name = validateString($body, 'name', 160);
        $email = strtolower(validateString($body, 'email', 255));
        $password = (string) ($body['password'] ?? '');
        $role = (string) ($body['role'] ?? 'buyer');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 10 || !in_array($role, ['buyer', 'farmer'], true)) {
            jsonResponse(['error' => 'Use a valid email, a password of at least 10 characters, and a supported role.'], 422);
        }
        $statement = db()->prepare('INSERT INTO users (role, name, email, password_hash) VALUES (?, ?, ?, ?)');
        $statement->execute([$role, $name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        grantUserCapabilities((int) db()->lastInsertId(), is_array($body['activities'] ?? null) ? $body['activities'] : []);
        $_SESSION['user'] = ['id' => (int) db()->lastInsertId(), 'role' => $role, 'name' => $name, 'email' => $email];
        session_regenerate_id(true);
        jsonResponse(['user' => $_SESSION['user'], 'context' => userContext($_SESSION['user']), 'access_token' => issueMobileToken((int) $_SESSION['user']['id']), 'token_type' => 'Bearer'], 201);
    }

    if ($path === 'auth/login') {
        requireMethod('POST');
        $body = requestBody();
        $email = strtolower(validateString($body, 'email', 255));
        $password = (string) ($body['password'] ?? '');
        $statement = db()->prepare('SELECT id, role, name, email, password_hash FROM users WHERE email = ? LIMIT 1');
        $statement->execute([$email]);
        $user = $statement->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonResponse(['error' => 'Email or password is incorrect.'], 401);
        }
        unset($user['password_hash']);
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        jsonResponse(['user' => $user, 'context' => userContext($user), 'access_token' => issueMobileToken((int) $user['id']), 'token_type' => 'Bearer']);
    }

    if ($path === 'auth/logout') {
        requireMethod('POST');
        $bearer = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $bearer, $matches) === 1) {
            db()->prepare('DELETE FROM api_tokens WHERE token_hash = ?')->execute([hash('sha256', trim($matches[1]))]);
        }
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            setcookie(session_name(), '', time() - 42000, session_get_cookie_params()['path'] ?? '/');
        }
        session_destroy();
        jsonResponse(['ok' => true]);
    }

    if ($path === 'demands' && $method === 'GET') {
        $statement = db()->query('SELECT d.id, d.crop, d.quantity, d.unit, d.target_price, d.location, d.delivery_date, d.notes, d.status, d.created_at, u.name AS buyer FROM demands d JOIN users u ON u.id = d.buyer_id WHERE d.status IN (\'open\', \'in_contract\') ORDER BY d.created_at DESC');
        jsonResponse(['demands' => $statement->fetchAll()]);
    }

    if ($path === 'demands' && $method === 'POST') {
        $user = requireCapability('buyer.contracts');
        $body = requestBody();
        $crop = validateString($body, 'crop', 160);
        $unit = validateString($body, 'unit', 32);
        $location = validateString($body, 'location', 160);
        $quantity = (float) ($body['quantity'] ?? 0);
        $price = (float) ($body['target_price'] ?? 0);
        $delivery = validateString($body, 'delivery_date', 10);
        if ($quantity <= 0 || $price <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $delivery)) {
            jsonResponse(['error' => 'Quantity, target price, and a valid delivery date are required.'], 422);
        }
        $statement = db()->prepare('INSERT INTO demands (buyer_id, crop, quantity, unit, target_price, location, delivery_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([$user['id'], $crop, $quantity, $unit, $price, $location, $delivery, trim((string) ($body['notes'] ?? ''))]);
        jsonResponse(['id' => (int) db()->lastInsertId()], 201);
    }

    if (count($segments) === 3 && $segments[0] === 'demands' && $segments[2] === 'offers' && $method === 'GET') {
        $user = requireCapability('buyer.contracts');
        $statement = db()->prepare('SELECT o.id, o.quantity, o.price, o.note, o.status, o.created_at, u.name AS farmer FROM offers o JOIN users u ON u.id = o.farmer_id JOIN demands d ON d.id = o.demand_id WHERE o.demand_id = ? AND d.buyer_id = ? ORDER BY o.created_at DESC');
        $statement->execute([(int) $segments[1], $user['id']]);
        jsonResponse(['offers' => $statement->fetchAll()]);
    }

    if (count($segments) === 3 && $segments[0] === 'demands' && $segments[2] === 'offers' && $method === 'POST') {
        $user = requireCapability('supplier.orders');
        $body = requestBody();
        $quantity = (float) ($body['quantity'] ?? 0);
        $price = (float) ($body['price'] ?? 0);
        if ($quantity <= 0 || $price <= 0) {
            jsonResponse(['error' => 'A positive quantity and price are required.'], 422);
        }
        $statement = db()->prepare('INSERT INTO offers (demand_id, farmer_id, quantity, price, note) SELECT id, ?, ?, ?, ? FROM demands WHERE id = ? AND status = \'open\'');
        $statement->execute([$user['id'], $quantity, $price, trim((string) ($body['note'] ?? '')), (int) $segments[1]]);
        if ($statement->rowCount() !== 1) {
            jsonResponse(['error' => 'Demand is unavailable for offers.'], 409);
        }
        jsonResponse(['id' => (int) db()->lastInsertId()], 201);
    }

    if (count($segments) === 2 && $segments[0] === 'offers' && $segments[1] !== '' && $method === 'POST') {
        requireCapability('buyer.contracts');
        $offerId = (int) $segments[1];
        $pdo = db();
        $pdo->beginTransaction();
        $statement = $pdo->prepare('SELECT o.id, o.demand_id, o.farmer_id, d.buyer_id FROM offers o JOIN demands d ON d.id = o.demand_id WHERE o.id = ? FOR UPDATE');
        $statement->execute([$offerId]);
        $offer = $statement->fetch();
        if (!$offer || (int) $offer['buyer_id'] !== (int) currentUser()['id']) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Offer not found.'], 404);
        }
        $pdo->prepare('UPDATE offers SET status = CASE WHEN id = ? THEN \'accepted\' ELSE \'rejected\' END WHERE demand_id = ?')->execute([$offerId, $offer['demand_id']]);
        $pdo->prepare('UPDATE demands SET status = \'in_contract\' WHERE id = ?')->execute([$offer['demand_id']]);
        $pdo->prepare('INSERT INTO contracts (demand_id, offer_id, buyer_id, farmer_id, milestone_note) VALUES (?, ?, ?, ?, ?)')->execute([$offer['demand_id'], $offerId, $offer['buyer_id'], $offer['farmer_id'], 'Offer accepted. Waiting for buyer funding.']);
        $pdo->commit();
        jsonResponse(['ok' => true], 201);
    }

    if ($path === 'contracts' && $method === 'GET') {
        $user = requireUser();
        $statement = db()->prepare('SELECT c.id, c.status, c.milestone_note, c.created_at, c.updated_at, d.crop, d.quantity, d.unit, d.target_price, b.name AS buyer, f.name AS farmer FROM contracts c JOIN demands d ON d.id = c.demand_id JOIN users b ON b.id = c.buyer_id JOIN users f ON f.id = c.farmer_id WHERE c.buyer_id = ? OR c.farmer_id = ? ORDER BY c.updated_at DESC');
        $statement->execute([$user['id'], $user['id']]);
        jsonResponse(['contracts' => $statement->fetchAll()]);
    }

    jsonResponse(['error' => 'Route not found.'], 404);
} catch (PDOException $exception) {
    error_log($exception->getMessage());
    jsonResponse(['error' => 'A database error occurred.'], 500);
} catch (RuntimeException $exception) {
    error_log($exception->getMessage());
    jsonResponse(['error' => $exception->getMessage()], 503);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    jsonResponse(['error' => 'The server could not complete the request.'], 500);
}