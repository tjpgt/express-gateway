const should = require('should');
const adminHelper = require('../common/admin-helper')();

describe('REST: Users', () => {
  let createdUserIds;

  before(() =>
    adminHelper.start({
      config: {
        gatewayConfig: {
          admin: { port: 0 },
          pipelines: null
        }
      }
    }));

  after(() => adminHelper.stop());

  describe('Pagination features', () => {
    before(() => Promise.all(Array(100).fill().map((e, index) => adminHelper.admin.users.create({ username: index, firstname: 'Clark', lastname: 'Kent' })))
      .then(users => {
        createdUserIds = users.map(user => user.id);
      }));

    it('should return a numeric value for nextKey', () =>
      adminHelper.admin.users.list().then((data) => should(data).have.property('nextKey').Number().not.eql(0))
    );

    it('should respect the start parameter', async () => {
      const count = 40;
      const firstPage = await adminHelper.admin.users.list({ count });
      should(firstPage.nextKey).be.above(0);

      const nextPage = await adminHelper.admin.users.list({ count, start: firstPage.nextKey });
      should(nextPage.users).not.be.empty();
      should(nextPage.nextKey).not.eql(firstPage.nextKey);

      const pages = [firstPage, nextPage];
      let nextKey = nextPage.nextKey;
      while (nextKey !== 0) {
        const page = await adminHelper.admin.users.list({ count, start: nextKey });
        pages.push(page);
        nextKey = page.nextKey;
      }

      const returnedIds = pages.flatMap(page => page.users.map(user => user.id));
      const returnedIdSet = new Set(returnedIds);
      should(returnedIds).have.length(createdUserIds.length);
      should(returnedIdSet.size).equal(createdUserIds.length);
      createdUserIds.forEach(id => should(returnedIdSet.has(id)).be.true());
    });

    it('should respect a count parameter', () =>
      adminHelper.admin.users.list({ count: 40 }).then((data) => should(data.users.length).lessThanOrEqual(40))
    );
  });
});
