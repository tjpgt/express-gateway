const assert = require('assert');
const supertest = require('supertest');
const config = require('../lib/config');
const testHelper = require('./common/routing.helper');

describe('hostname', () => {
  const address = '127.0.0.1';
  const helper = testHelper();
  let app, originalGatewayConfig;

  before('setup', async () => {
    originalGatewayConfig = config.gatewayConfig;
    helper.addPolicy('test', () => (req, res) => {
      res.json({ result: 'test', hostname: req.hostname, url: req.url, apiEndpoint: req.egContext.apiEndpoint });
    });

    config.gatewayConfig = {
      http: {
        port: 0,
        hostname: address
      },
      apiEndpoints: { test: {} },
      policies: ['test'],
      pipelines: {
        pipeline1: {
          apiEndpoint: 'test',
          policies: { test: {} }
        }
      }
    };
    ({ app } = await helper.setup());
  });

  it('should bind only to the configured hostname', () => {
    assert.strictEqual(app.address().address, address);
  });

  it('should answer on the provided interface', () => {
    return supertest(app).get('/').expect(200);
  });

  after(() => {
    config.gatewayConfig = originalGatewayConfig;
    return helper.cleanup();
  });
});
