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

$migrationTables = [
    '001_nursery_network.sql' => [
        'organisations',
        'organisation_members',
        'locations',
        'supplier_locations',
        'nurseries',
        'product_categories',
        'agricultural_products',
        'product_varieties',
        'supplier_listings',
        'inventory_movements',
        'supplier_verifications',
    ],
    '003_orders_and_quotations.sql' => [
        'orders',
        'order_items',
        'quotation_requests',
        'quotations',
    ],
    '004_order_events.sql' => ['order_events'],
];

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

    if (isset($migrationTables[$filename])) {
        $tableCheck = $pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?");
        $allTablesExist = true;
        foreach ($migrationTables[$filename] as $tableName) {
            $tableCheck->execute([$tableName]);
            if ((int) $tableCheck->fetchColumn() === 0) {
                $allTablesExist = false;
                break;
            }
        }
        if ($allTablesExist) {
            $pdo->prepare('INSERT INTO farmconnect_migrations (filename) VALUES (?)')->execute([$filename]);
            echo "Recording {$filename}; all migration tables already exist.\n";
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
