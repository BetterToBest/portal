<?php
// Runs the 41 odd Ed25519 cases (../ed25519-odd-cases.json) through PHP's sodium extension (libsodium)
// and prints a JSON result to standard output. Evidence only: no verifier in this repository uses it.
//   php run.php > php-results.json
$cases = json_decode(file_get_contents(__DIR__ . '/../ed25519-odd-cases.json'), true)['cases'];
$out = [];
foreach ($cases as $c) {
    try {
        $r = sodium_crypto_sign_verify_detached(hex2bin($c['sig']), $c['msg'], hex2bin($c['pub']));
    } catch (Throwable $e) {
        $r = false; // an exception counts as "refused"
    }
    $out[] = (bool)$r;
}
$name = 'PHP sodium (libsodium)';
echo json_encode([
    'versions' => [$name => PHP_VERSION . ' (libsodium ' . SODIUM_LIBRARY_VERSION . ')'],
    'results' => [$name => $out],
]), "\n";
