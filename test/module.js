const assert = require('assert');
const { promisify } = require('util');
const gateway = require('../lib');
const config = require('../lib/config');

describe('main module', () => {
  it('fires up a new gateway instance with valid config', async () => {
    const originalGatewayConfig = config.gatewayConfig;
    config.gatewayConfig = {
      ...originalGatewayConfig,
      http: { port: 0 },
      admin: { host: '127.0.0.1', port: 0 }
    };

    try {
      const [{ app }, adminServer] = await gateway().run();
      try {
        assert(app.listening);
        assert(adminServer.listening);
        assert(config.systemConfig);
      } finally {
        await Promise.all([app, adminServer].map(server => promisify(server.close).call(server)));
      }
    } finally {
      config.gatewayConfig = originalGatewayConfig;
    }
  });
});
