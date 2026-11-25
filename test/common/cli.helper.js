const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const dir = util.promisify(require('tmp').dir);
const _cpr = util.promisify(require('cpr'));

const modulePath = path.resolve(__dirname, '..', '..', 'bin', 'index.js');

module.exports.bootstrapFolder = function () {
  return dir()
    .then(tempDir => Promise.all([
      tempDir,
      _cpr(path.join(__dirname, '../../bin/generators/gateway/templates/getting-started/'), tempDir),
      _cpr(path.join(__dirname, '../../lib/config/models'), path.join(tempDir, 'config', 'models'))
    ])).then(([tempDir]) => ({
      basePath: tempDir,
      configDirectoryPath: path.join(tempDir, 'config'),
      gatewayConfigPath: path.join(tempDir, 'config', 'gateway.config.yml'),
      systemConfigPath: path.join(tempDir, 'config', 'system.config.yml')
    }));
};

module.exports.runCLICommand = function ({ adminPort, adminUrl, configDirectoryPath, cliArgs, cliExecOptions = {} }) {
  // TODO: it should not depend on configFolder, API only, now the last dependency is models
  const env = {
    ...(cliExecOptions.env || process.env),
    EG_CONFIG_DIR: configDirectoryPath,
    EG_ADMIN_URL: adminUrl || `http://localhost:${adminPort}`
  };
  const command = [`"${process.execPath}"`, `"${modulePath}"`].concat(cliArgs).join(' ');
  return new Promise((resolve, reject) => {
    exec(command, { ...cliExecOptions, env }, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const obj = JSON.parse(stdout);
        resolve(obj);
      } catch (err) {
        if (err instanceof SyntaxError) {
          resolve(stdout);
        } else {
          reject(err);
        }
      }
    });
  });
};
