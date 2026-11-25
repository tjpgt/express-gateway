if (require.main === module) {
  require('../../lib')().run().then(([{ app }, adminServer]) => {
    process.send({ gatewayPort: app.address().port, adminPort: adminServer.address().port });
  }).catch(err => process.send({ error: err.stack }));
}
