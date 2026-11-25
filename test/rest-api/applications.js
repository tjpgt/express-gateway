const should = require('should');
const idGen = require('../../lib/uuid62');
const adminHelper = require('../common/admin-helper')();
const username = idGen.v4();
let createdApplicationIds = [];

describe('REST: Applications', () => {
  before(() =>
    adminHelper.start({
      config: {
        gatewayConfig: {
          admin: { port: 0 },
          pipelines: null
        }
      }
    }).then(() => adminHelper.admin.users.create({ username, firstname: 'La', lastname: 'Deeda' })));

  after(() => adminHelper.stop());

  describe('Insert two applications with the same name under the same user', () => {
    before(() =>
      adminHelper.admin.apps.create(username, { name: 'appy1', redirectUri: 'http://localhost:3000/cb' })
        .then(app => {
          createdApplicationIds.push(app.id);
        })
    );

    it('should return an error on the second attemp', () =>
      should(adminHelper.admin.apps.create(username, {
        name: 'appy1',
        redirectUri: 'http://localhost:3000/cb'
      })).be.rejected()
    );
  });

  describe('Insert an application with an user that does not exist', () => {
    it('should return an error on the second attemp', () =>
      should(adminHelper.admin.apps.create('IDoNotExist', {
        name: 'appy1',
        redirectUri: 'http://localhost:3000/cb'
      })).be.rejectedWith({ status: 409 })
    );
  });

  describe('Get an application by name', () => {
    it('should return the app if looking for it by name', () =>
      adminHelper.admin.apps.info('appy1').then((app) => {
        should(app).have.property('name');
        should(app.name).be.equal('appy1');
      })
    );
  });

  describe('Pagination features', () => {
    before(() => Promise.all(Array(100).fill().map((e, index) => adminHelper.admin.apps.create(username, { name: index })))
      .then(apps => {
        createdApplicationIds = createdApplicationIds.concat(apps.map(app => app.id));
      }));

    it('should return a numeric value for nextKey', () =>
      adminHelper.admin.apps.list().then((data) => should(data).have.property('nextKey').Number().not.eql(0))
    );

    it('should respect the start parameter', async () => {
      const count = 40;
      const firstPage = await adminHelper.admin.apps.list({ count });
      should(firstPage.nextKey).be.above(0);

      const nextPage = await adminHelper.admin.apps.list({ count, start: firstPage.nextKey });
      should(nextPage.apps).not.be.empty();
      should(nextPage.nextKey).not.eql(firstPage.nextKey);

      const pages = [firstPage, nextPage];
      let nextKey = nextPage.nextKey;
      while (nextKey !== 0) {
        const page = await adminHelper.admin.apps.list({ count, start: nextKey });
        pages.push(page);
        nextKey = page.nextKey;
      }

      const returnedIds = pages.flatMap(page => page.apps.map(app => app.id));
      const returnedIdSet = new Set(returnedIds);
      should(returnedIds).have.length(createdApplicationIds.length);
      should(returnedIdSet.size).equal(createdApplicationIds.length);
      createdApplicationIds.forEach(id => should(returnedIdSet.has(id)).be.true());
    });

    it('should respect a count parameter', () =>
      adminHelper.admin.apps.list({ count: 3 }).then((data) => should(data.apps.length).lessThanOrEqual(3))
    );
  });
});
