const yaml = require('js-yaml');
const fs = require('fs');
const { fork } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const copy = promisify(require('cpr'));
const { generateBackendServer } = require('../common/server-helper');

// Set gateway.config or system.config yml files
module.exports.setYmlConfig = function ({ ymlConfigPath, newConfig }) {
  fs.writeFileSync(ymlConfigPath, yaml.dump(newConfig));
};

// Get config by path (gateway.config.yml or system.config.yml)
module.exports.getYmlConfig = function ({ ymlConfigPath }) {
  const content = fs.readFileSync();
  return yaml.load(content);
};

module.exports.startGatewayInstance = async function ({ dirInfo, gatewayConfig, backendServers = 1 }) {
  await copy(path.join(__dirname, '../../lib/config/models'), path.join(dirInfo.configDirectoryPath, 'models'), { overwrite: true });
  const backends = await Promise.all(Array.from({ length: backendServers }, () => generateBackendServer(0)));
  const backendPorts = backends.map(({ port }) => port);
  let gatewayProcess;

  try {
    gatewayConfig.http = { port: 0 };
    gatewayConfig.admin = { port: 0 };
    gatewayConfig.serviceEndpoints = gatewayConfig.serviceEndpoints || {};
    gatewayConfig.serviceEndpoints.backend = { urls: backendPorts.map(port => `http://localhost:${port}`) };
    this.setYmlConfig({ ymlConfigPath: dirInfo.gatewayConfigPath, newConfig: gatewayConfig });

    const childEnv = { ...process.env, EG_CONFIG_DIR: dirInfo.configDirectoryPath };
    delete childEnv.EG_DISABLE_CONFIG_WATCH;
    gatewayProcess = fork(path.join(__dirname, 'gateway-process.js'), [], {
      cwd: dirInfo.basePath,
      env: childEnv,
      stdio: ['ignore', 'ignore', 'inherit', 'ipc']
    });
    const { gatewayPort, adminPort } = await new Promise((resolve, reject) => {
      gatewayProcess.once('error', reject);
      gatewayProcess.once('exit', (code, signal) => reject(new Error(`Test gateway exited before startup (${signal || code})`)));
      gatewayProcess.once('message', message => {
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message);
        }
      });
    });

    gatewayConfig.http.port = gatewayPort;
    gatewayConfig.admin.port = adminPort;
    return { gatewayProcess, gatewayPort, adminPort, backendPorts, dirInfo, backendServers: backends.map(({ app }) => app) };
  } catch (err) {
    if (gatewayProcess) {
      gatewayProcess.kill();
    }
    await Promise.all(backends.map(({ app }) => promisify(app.close).call(app)));
    throw err;
  }
};
