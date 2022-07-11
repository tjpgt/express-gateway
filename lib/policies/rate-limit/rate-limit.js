const { createHash } = require('crypto');
const RateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const config = require('../../config');
const logger = require('../../logger').policy;
const db = require('../../db');

const redisOptions = config.systemConfig.db && config.systemConfig.db.redis;
const emulate = process.argv[2] === 'emulate' || redisOptions.emulate;
module.exports = (params) => {
  if (params.rateLimitBy) {
    params.keyGenerator = (req) => {
      try {
        return req.egContext.evaluateAsTemplateString(params.rateLimitBy);
      } catch (err) {
        logger.error('Failed to generate rate-limit key with config: %s; %s', params.rateLimitBy, err.message);
      }
    };
  }
  let store;
  if (emulate) {
    let scriptSha;
    const sendCommand = async (
      client,
      args
    ) => {
      // `SCRIPT LOAD`, called when the store is initialized. This loads the lua script
      // for incrementing a client's hit counter.
      if (args[0] === 'SCRIPT') {
        // `ioredis-mock` doesn't have a `SCRIPT LOAD` function, so we have to compute
        // the SHA manually and `EVAL` the script to get it saved.
        const shasum = createHash('sha1');
        shasum.update(args[2]);
        scriptSha = shasum.digest('hex');
        await client.eval(args[2], 1, '__test', '0', '100');

        // Return the SHA to the store.
        return scriptSha;
      }

      // `EVALSHA` executes the script that was loaded already with the given arguments
      if (args[0] === 'EVALSHA') { return client.evalsha(scriptSha, ...args.slice(2)); }
      // `DECR` decrements the count for a client.
      if (args[0] === 'DECR') return client.decr(args[1]);
      // `DEL` resets the count for a client by deleting the key.
      if (args[0] === 'DEL') return client.del(args[1]);

      // This should not happen
      return -99;
    };

    store = new RedisStore({
      sendCommand: async (...args) => sendCommand(db, args)
    });
  } else {
    store = new RedisStore({
      sendCommand: (...args) => db.call(...args)
    });
  }
  store.init({ windowMs: params.windowMs });
  return RateLimit(Object.assign(params, {
    store
  }));
};
