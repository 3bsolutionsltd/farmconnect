<?php

declare(strict_types=1);

$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (str_starts_with($uriPath, '/api/')) {
    $_GET['path'] = ltrim(substr($uriPath, strlen('/api/')), '/');
    require __DIR__ . '/api/index.php';
    return true;
}

$filePath = __DIR__ . $uriPath;
if ($uriPath !== '/' && is_file($filePath)) {
    return false;
}

require __DIR__ . '/index.html';
return true;
