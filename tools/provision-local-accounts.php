<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDOUT, "Provisioning stopped: run this script from PowerShell or another CLI.\n");
    exit(1);
}

require dirname(__DIR__) . '/api/bootstrap.php';

$localConfigPath = dirname(__DIR__) . '/config.local.php';
$localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
$localAccounts = is_array($localConfig['local_accounts'] ?? null) ? $localConfig['local_accounts'] : [];
$localValue = static function (string $key, mixed $fallback = null) use ($localAccounts): mixed {
    $value = getenv($key);
    return $value !== false && $value !== '' ? $value : $fallback;
};

$adminPassword = (string) $localValue('FC_LOCAL_ADMIN_PASSWORD', $localAccounts['admin_password'] ?? '');
$supplierPassword = (string) $localValue('FC_LOCAL_SUPPLIER_PASSWORD', $localAccounts['supplier_password'] ?? '');
$buyerPassword = (string) $localValue('FC_LOCAL_BUYER_PASSWORD', $localAccounts['buyer_password'] ?? '');
$organisationId = (int) $localValue('FC_LOCAL_SUPPLIER_ORGANISATION_ID', $localAccounts['supplier_organisation_id'] ?? 1);

if (strlen($adminPassword) < 10 || strlen($supplierPassword) < 10 || strlen($buyerPassword) < 10) {
    fwrite(STDOUT, "Provisioning stopped: set FC_LOCAL_ADMIN_PASSWORD, FC_LOCAL_SUPPLIER_PASSWORD, and FC_LOCAL_BUYER_PASSWORD to passwords of at least 10 characters in this PowerShell window.\n");
    exit(1);
}

try {
    $pdo = db();
} catch (Throwable $error) {
    fwrite(STDOUT, "Provisioning stopped: database connection failed. Check the FC_DB_* variables used by the PHP server.\n");
    exit(1);
}

$upsertUser = static function (PDO $pdo, string $role, string $name, string $email, string $password): int {
    $lookup = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $lookup->execute([$email]);
    $existingId = $lookup->fetchColumn();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($existingId !== false) {
        $update = $pdo->prepare('UPDATE users SET role = ?, name = ?, password_hash = ? WHERE id = ?');
        $update->execute([$role, $name, $hash, $existingId]);
        return (int) $existingId;
    }
    $insert = $pdo->prepare('INSERT INTO users (role, name, email, password_hash) VALUES (?, ?, ?, ?)');
    $insert->execute([$role, $name, $email, $hash]);
    return (int) $pdo->lastInsertId();
};

$adminId = $upsertUser($pdo, 'admin', 'FarmConnect Local Admin', 'admin@farmconnect.local', $adminPassword);
$supplierId = $upsertUser($pdo, 'farmer', 'Local Nursery Operator', 'supplier@farmconnect.local', $supplierPassword);
$buyerId = $upsertUser($pdo, 'buyer', 'Local Nursery Buyer', 'buyer@farmconnect.local', $buyerPassword);

$organisation = $pdo->prepare('SELECT id FROM organisations WHERE id = ? LIMIT 1');
$organisation->execute([$organisationId]);
if ($organisation->fetchColumn() === false) {
    fwrite(STDOUT, "Provisioning stopped: supplier organisation {$organisationId} was not found.\n");
    exit(1);
}

$membership = $pdo->prepare('SELECT 1 FROM organisation_members WHERE organisation_id = ? AND user_id = ? LIMIT 1');
$membership->execute([$organisationId, $supplierId]);
if ($membership->fetchColumn() === false) {
    $insertMembership = $pdo->prepare("INSERT INTO organisation_members (organisation_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')");
    $insertMembership->execute([$organisationId, $supplierId]);
}

fwrite(STDOUT, "Local accounts provisioned.\n");
fwrite(STDOUT, "Admin: {$adminId} / admin@farmconnect.local\n");
fwrite(STDOUT, "Supplier: {$supplierId} / supplier@farmconnect.local\n");
fwrite(STDOUT, "Buyer: {$buyerId} / buyer@farmconnect.local\n");
fwrite(STDOUT, "Supplier organisation: {$organisationId}\n");