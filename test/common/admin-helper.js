const { promisify } = require('util');
const rest = require('../../lib/rest');
const adminClient = require('../../admin');
module.exports = function () {
  return {
    start ({ config } = {}) {
      const defaultConfig = { gatewayConfig: { admin: { host: '127.0.0.1', port: 0 } } };
      return rest({ config: config || defaultConfig }).then((srv) => {
        this.adminSrv = srv;
        const srvInfo = srv.address();
        const host = srvInfo.family === 'IPv6' ? `[${srvInfo.address}]` : srvInfo.address;
        const baseUrl = `http://${host}:${srvInfo.port}`;
        this.admin = adminClient({ baseUrl });
        if (!config) {
          this.previousAdminUrl = process.env.EG_ADMIN_URL;
          process.env.EG_ADMIN_URL = baseUrl;
        }
        return this.adminSrv;
      });
    },
    async stop () {
      if (Object.prototype.hasOwnProperty.call(this, 'previousAdminUrl')) {
        if (this.previousAdminUrl === undefined) {
          delete process.env.EG_ADMIN_URL;
        } else {
          process.env.EG_ADMIN_URL = this.previousAdminUrl;
        }
        delete this.previousAdminUrl;
      }
      if (this.adminSrv) {
        const server = this.adminSrv;
        this.adminSrv = null;
        await promisify(server.close).call(server);
      }
      return this.reset();
    },
    reset () {
      const db = require('../../lib/db');
      return db.flushdb();
    }
  };
};
