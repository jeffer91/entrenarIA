if (!process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const result = spawnSync(process.execPath, [path.join(path.dirname(require.resolve('electron/package.json')), 'install.js')], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
