<?php

declare(strict_types=1);

require __DIR__ . '/../api/bootstrap.php';

$email = strtolower(trim((string) getenv('FC_RESET_EMAIL')));
$password = (string) getenv('FC_RESET_PASSWORD');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 10) {
    fwrite(STDERR, "Set FC_RESET_EMAIL and FC_RESET_PASSWORD; the password must be at least 10 characters.\n");
    exit(1);
}

$statement = db()->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$statement->execute([$email]);
$userId = $statement->fetchColumn();

if ($userId === false) {
    fwrite(STDERR, "No account was found for that email.\n");
    exit(1);
}

$update = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
$update->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);

fwrite(STDOUT, "Password updated for the requested account.\n");
