import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const root = path.resolve('operations/workshop-pc');
const execFileAsync = promisify(execFile);
const expectedFiles = [
  'psi_uploads.py',
  'requirements.txt',
  'Start-PSIWorkshopUploader.ps1',
  'Start-PSIWorkshopWatcher.ps1',
  'Start-PSIWorkshopTray.ps1',
  'Update-PSIWorkshopUploader.ps1',
];

test('workshop update manifest allowlists and hashes every executable file', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'workshop-update.json'), 'utf8'));
  assert.equal(manifest.schema, 1);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(
    manifest.baseUrl,
    'https://raw.githubusercontent.com/Juztforkickz/psi-performance-booking-app/main/operations/workshop-pc/',
  );
  assert.deepEqual(manifest.files.map(file => file.name), expectedFiles);
  for (const file of manifest.files) {
    const { stdout } = await execFileAsync('git', ['show', `:operations/workshop-pc/${file.name}`], {
      encoding: 'buffer',
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(createHash('sha256').update(stdout).digest('hex'), file.sha256, file.name);
  }
});

test('installer and tray expose an explicit verified update flow', async () => {
  const installer = await readFile(path.join(root, 'Install-PSIWorkshopUploader.ps1'), 'utf8');
  const tray = await readFile(path.join(root, 'Start-PSIWorkshopTray.ps1'), 'utf8');
  const updater = await readFile(path.join(root, 'Update-PSIWorkshopUploader.ps1'), 'utf8');

  assert.match(installer, /Update-PSIWorkshopUploader\.ps1/);
  assert.match(installer, /workshop-update\.json/);
  assert.match(tray, /Install workshop app update/);
  assert.match(tray, /MessageBoxButtons\]::YesNo/);
  assert.match(updater, /Get-FileHash.+SHA256/);
  assert.match(updater, /\.update-backup/);
  assert.match(updater, /Stop-PSIWatcherSafely/);
  assert.doesNotMatch(updater, /Copy-Item[^\n]+(?:config\.json|session\.dpapi)/);
});
