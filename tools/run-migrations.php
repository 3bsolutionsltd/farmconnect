<?php

declare(strict_types=1);

$migrationRoot = dirname(__DIR__);
$applicationRoot = getenv('FARMCONNECT_APP_ROOT') ?: $migrationRoot;
require $applicationRoot . '/api/bootstrap.php';

$pdo = db();
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS farmconnect_migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB'
);

$files = [$migrationRoot . DIRECTORY_SEPARATOR . 'schema.sql'];
$files = array_merge($files, glob($migrationRoot . DIRECTORY_SEPARATOR . 'migrations' . DIRECTORY_SEPARATOR . '*.sql') ?: []);

foreach ($files as $file) {
    $filename = basename($file);
    $check = $pdo->prepare('SELECT 1 FROM farmconnect_migrations WHERE filename = ? LIMIT 1');
    $check->execute([$filename]);
    if ($check->fetchColumn() !== false) {
        echo "Skipping {$filename}; already recorded.\n";
        continue;
    }

    if ($filename === 'schema.sql') {
        $tableCheck = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'");
        $tableCheck->execute();
        if ((int) $tableCheck->fetchColumn() > 0) {
            $pdo->prepare('INSERT INTO farmconnect_migrations (filename) VALUES (?)')->execute([$filename]);
            echo "Recording {$filename}; base schema already exists.\n";
            continue;
        }
    }

    $sql = file_get_contents($file);
    if ($sql === false || trim($sql) === '') {
        throw new RuntimeException("Migration {$filename} is empty or unreadable.");
    }

    echo "Applying {$filename}.\n";
    $pdo->exec($sql);
    $pdo->prepare('INSERT INTO farmconnect_migrations (filename) VALUES (?)')->execute([$filename]);
}

echo "Migration run completed.\n";
