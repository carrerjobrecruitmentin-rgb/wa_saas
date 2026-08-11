<?php
require 'C:/hk/_public_html/backend/config/dependencies.php';
$stmt = $pdo->query("SELECT count(*) FROM job_applications");
echo "Total records: " . $stmt->fetchColumn() . "\n";
$stmt = $pdo->query("SELECT count(*) FROM job_applications WHERE phone IS NOT NULL AND phone != ''");
echo "With phone: " . $stmt->fetchColumn() . "\n";
