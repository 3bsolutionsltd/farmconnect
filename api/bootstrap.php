<?php

declare(strict_types=1);

$localConfig = dirname(__DIR__) . '/config.local.php';
$fileConfig = is_file($localConfig) ? require $localConfig : [];

$env = static function (string $key, mixed $default = null) use ($fileConfig): mixed {
    $value = getenv($key);
    if ($value !== false && $value !== '') {
        return $value;
    }
    return $default;
};

$config = [
    'env' => $env('FC_APP_ENV', $fileConfig['env'] ?? 'production'),
    'app_url' => $env('FC_APP_URL', $fileConfig['app_url'] ?? ''),
    'session_name' => $env('FC_SESSION_NAME', 'farmconnect_session'),
    'oidc' => [
        'issuer' => $env('FC_OIDC_ISSUER', $fileConfig['oidc']['issuer'] ?? ''),
        'client_id' => $env('FC_OIDC_CLIENT_ID', $fileConfig['oidc']['client_id'] ?? ''),
        'client_secret' => $env('FC_OIDC_CLIENT_SECRET', $fileConfig['oidc']['client_secret'] ?? ''),
        'redirect_uri' => $env('FC_OIDC_REDIRECT_URI', $fileConfig['oidc']['redirect_uri'] ?? ''),
    ],
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) $env('FC_ALLOWED_ORIGINS', implode(',', $fileConfig['allowed_origins'] ?? [])))), static fn (string $origin): bool => $origin !== '')),
    'mobile_token_days' => (int) $env('FC_MOBILE_TOKEN_DAYS', $fileConfig['mobile_token_days'] ?? 90),
    'db' => [
        'host' => $env('FC_DB_HOST', $fileConfig['db']['host'] ?? 'localhost'),
        'port' => (int) $env('FC_DB_PORT', $fileConfig['db']['port'] ?? 3306),
        'name' => $env('FC_DB_NAME', $fileConfig['db']['name'] ?? ''),
        'user' => $env('FC_DB_USER', $fileConfig['db']['user'] ?? ''),
        'password' => $env('FC_DB_PASSWORD', $fileConfig['db']['password'] ?? ''),
    ],
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($requestOrigin !== '' && in_array($requestOrigin, $config['allowed_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

if ($config['env'] === 'development') {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

session_name($config['session_name']);
session_set_cookie_params([
    'path' => '/',
    'httponly' => true,
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'samesite' => 'Lax',
]);
session_start();

function db(): PDO
{
    global $config;
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if ($config['db']['name'] === '' || $config['db']['user'] === '') {
        throw new RuntimeException('Database configuration is incomplete.');
    }
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db']['host'], $config['db']['port'], $config['db']['name']);
    $pdo = new PDO($dsn, $config['db']['user'], $config['db']['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function jsonResponse(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function recordOrderEvent(PDO $pdo, int $orderId, ?string $fromStatus, string $toStatus, ?int $actorId, string $eventType = 'status_change', ?string $note = null): void
{
    $pdo->prepare('INSERT INTO order_events (order_id, from_status, to_status, event_type, note, actor_id) VALUES (?, ?, ?, ?, ?, ?)')->execute([$orderId, $fromStatus, $toStatus, $eventType, $note, $actorId]);
}

function requestBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    return is_array($body) ? $body : [];
}

function requireMethod(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        header('Allow: ' . $method);
        jsonResponse(['error' => 'Method not allowed.'], 405);
    }
}

function currentUser(): ?array
{
    $bearer = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $bearer, $matches) === 1) {
        $tokenHash = hash('sha256', trim($matches[1]));
        $statement = db()->prepare('SELECT u.id, u.role, u.name, u.email FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.expires_at > NOW() LIMIT 1');
        $statement->execute([$tokenHash]);
        $user = $statement->fetch();
        if ($user) {
            db()->prepare('UPDATE api_tokens SET last_used_at = NOW() WHERE token_hash = ?')->execute([$tokenHash]);
            return $user;
        }
    }
    return isset($_SESSION['user']) && is_array($_SESSION['user']) ? $_SESSION['user'] : null;
}

function userCapabilities(array $user): array
{
    $fallback = match ($user['role'] ?? null) {
        'buyer' => ['buyer.orders', 'buyer.contracts'],
        'farmer' => ['buyer.orders', 'buyer.contracts', 'supplier.catalogue', 'supplier.inventory', 'supplier.orders'],
        'admin' => ['admin.review', 'admin.products'],
        default => [],
    };
    try {
        $statement = db()->prepare("SELECT c.code FROM user_capabilities uc JOIN capabilities c ON c.id = uc.capability_id WHERE uc.user_id = ? AND uc.status = 'active' ORDER BY c.code");
        $statement->execute([(int) $user['id']]);
        $capabilities = array_values(array_map(static fn (array $row): string => $row['code'], $statement->fetchAll()));
        return $capabilities ?: $fallback;
    } catch (PDOException) {
        return $fallback;
    }
}

function userOrganisations(array $user): array
{
    try {
        $statement = db()->prepare("SELECT o.id, o.type, o.display_name, om.role, om.status FROM organisations o JOIN organisation_members om ON om.organisation_id = o.id WHERE om.user_id = ? ORDER BY o.display_name");
        $statement->execute([(int) $user['id']]);
        return $statement->fetchAll();
    } catch (PDOException) {
        return [];
    }
}

function userContext(array $user): array
{
    return [
        'capabilities' => userCapabilities($user),
        'organisations' => userOrganisations($user),
    ];
}

function issueMobileToken(int $userId): string
{
    global $config;
    $plainToken = bin2hex(random_bytes(32));
    $expiresAt = (new DateTimeImmutable(sprintf('+%d days', max(1, $config['mobile_token_days']))))->format('Y-m-d H:i:s');
    $statement = db()->prepare('INSERT INTO api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    $statement->execute([$userId, hash('sha256', $plainToken), $expiresAt]);
    return $plainToken;
}

function requireUser(?string $role = null): array
{
    $user = currentUser();
    if ($user === null) {
        jsonResponse(['error' => 'Authentication required.'], 401);
    }
    if ($role !== null && $user['role'] !== $role) {
        jsonResponse(['error' => 'This action is not available for your account.'], 403);
    }
    return $user;
}

function requireCapability(string $capability): array
{
    $user = requireUser();
    if (!in_array($capability, userCapabilities($user), true)) {
        jsonResponse(['error' => 'This action is not available for your account.'], 403);
    }
    return $user;
}

function requireOrganisationMember(int $organisationId, array $allowedRoles = ['owner', 'manager', 'staff']): array
{
    $user = requireUser();
    $statement = db()->prepare('SELECT organisation_id, user_id, role, status FROM organisation_members WHERE organisation_id = ? AND user_id = ? AND status = \'active\' LIMIT 1');
    $statement->execute([$organisationId, $user['id']]);
    $membership = $statement->fetch();
    if (!$membership || !in_array($membership['role'], $allowedRoles, true)) {
        jsonResponse(['error' => 'You do not have access to this organisation.'], 403);
    }
    return $membership;
}

function validateString(array $body, string $key, int $max = 255): string
{
    $value = trim((string) ($body[$key] ?? ''));
    if ($value === '' || strlen($value) > $max) {
        jsonResponse(['error' => sprintf('%s is required.', $key)], 422);
    }
    return $value;
}

function grantUserCapabilities(int $userId, array $requestedCapabilities): void
{
    $allowed = [
        'buyer.orders',
        'buyer.contracts',
        'supplier.catalogue',
        'supplier.inventory',
        'supplier.orders',
    ];
    $capabilities = array_values(array_intersect($allowed, array_map('strval', $requestedCapabilities)));
    if (!$capabilities) {
        $capabilities = ['buyer.orders'];
    }
    try {
        $statement = db()->prepare('SELECT id FROM capabilities WHERE code = ? LIMIT 1');
        $insert = db()->prepare('INSERT INTO user_capabilities (user_id, capability_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE status = \'active\'');
        foreach ($capabilities as $capability) {
            $statement->execute([$capability]);
            $row = $statement->fetch();
            if ($row) {
                $insert->execute([$userId, (int) $row['id']]);
            }
        }
    } catch (PDOException) {
        // Existing installations continue using the legacy role projection until migration 005 is applied.
    }
}

function oidcConfiguration(): array
{
    global $config;
    $issuer = rtrim((string) ($config['oidc']['issuer'] ?? ''), '/');
    $clientId = (string) ($config['oidc']['client_id'] ?? '');
    $clientSecret = (string) ($config['oidc']['client_secret'] ?? '');
    $redirectUri = (string) ($config['oidc']['redirect_uri'] ?? '');
    if ($issuer === '' || $clientId === '' || $clientSecret === '' || $redirectUri === '') {
        throw new RuntimeException('Auth0 is not configured.');
    }
    return compact('issuer', 'clientId', 'clientSecret', 'redirectUri');
}

function oidcRequest(string $url, ?array $form = null, ?string $authorization = null): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is required for Auth0.');
    }
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => $authorization ? ['Authorization: Basic ' . $authorization] : [],
    ]);
    if ($form !== null) {
        curl_setopt($handle, CURLOPT_POST, true);
        curl_setopt($handle, CURLOPT_POSTFIELDS, http_build_query($form));
        curl_setopt($handle, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    }
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    if ($response === false || $error !== '' || $status < 200 || $status >= 300) {
        throw new RuntimeException('The Auth0 request could not be completed.');
    }
    $payload = json_decode($response, true);
    if (!is_array($payload)) {
        throw new RuntimeException('Auth0 returned an invalid response.');
    }
    return $payload;
}

function base64UrlDecode(string $value): string
{
    $decoded = base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4), true);
    if ($decoded === false) {
        throw new RuntimeException('Invalid OIDC token encoding.');
    }
    return $decoded;
}

function validateOidcIdToken(string $token, array $discovery, array $oidc, string $nonce): array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new RuntimeException('Invalid OIDC identity token.');
    }
    $header = json_decode(base64UrlDecode($parts[0]), true);
    $claims = json_decode(base64UrlDecode($parts[1]), true);
    if (!is_array($header) || !is_array($claims) || ($header['alg'] ?? '') !== 'RS256') {
        throw new RuntimeException('Unsupported OIDC identity token.');
    }
    $claimIssuer = rtrim((string) ($claims['iss'] ?? ''), '/');
    if ($claimIssuer !== $oidc['issuer'] || !in_array($oidc['clientId'], (array) ($claims['aud'] ?? []), true) || ($claims['nonce'] ?? '') !== $nonce || (int) ($claims['exp'] ?? 0) <= time()) {
        throw new RuntimeException('OIDC identity token validation failed.');
    }
    $key = null;
    $jwks = oidcRequest((string) $discovery['jwks_uri']);
    foreach ((array) ($jwks['keys'] ?? []) as $candidate) {
        if (($candidate['kid'] ?? '') === ($header['kid'] ?? '') && !empty($candidate['x5c'][0])) {
            $certificate = chunk_split($candidate['x5c'][0], 64, "\n");
            $key = "-----BEGIN CERTIFICATE-----\n{$certificate}-----END CERTIFICATE-----\n";
            break;
        }
    }
    if ($key === null || openssl_verify($parts[0] . '.' . $parts[1], base64UrlDecode($parts[2]), $key, OPENSSL_ALGO_SHA256) !== 1) {
        throw new RuntimeException('OIDC identity token signature validation failed.');
    }
    return $claims;
}

function redirectToApp(string $fragment = 'dashboard'): never
{
    global $config;
    $base = rtrim((string) ($config['app_url'] ?? ''), '/');
    header('Location: ' . ($base !== '' ? $base . '/#' : '/#') . ltrim($fragment, '#'));
    exit;
}

function requireOidcStorage(): void
{
    try {
        $statement = db()->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'external_identities'");
        $statement->execute();
        if ((int) $statement->fetchColumn() !== 1) {
            throw new RuntimeException('Auth0 identity storage is not installed. Import migrations/005_identity_and_capabilities.sql.');
        }
    } catch (PDOException) {
        throw new RuntimeException('Auth0 identity storage is unavailable. Import migrations/005_identity_and_capabilities.sql.');
    }
}