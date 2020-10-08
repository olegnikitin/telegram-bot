const Q = require("q");

const log = require('log4js').getLogger('redis-manager');

/**
 * Creates connection to redis database. Parameters should contain one of 2 property: "configProperty" or
 * "connectionOptions". The first one has the bigger priority.
 *
 * Expected configuration of the module:
 *
 "redis_ro" : {
		"module": "./modules/redis-manager.js",
		"dependencies": [ "config" ],
		"parameters" : {
			"configProperty": "redis_ro"
			"connectionOptions": [ 6488, "localhost" ]
		}
	},
 *
 *
 * optional parameter "instanceName" can be set if we need create separate instance of the same configProperty
 * redis connection (for example, for subscription redis)
 *
 *
 * @param implArgs
 * @param moduleProperties
 * @returns {*}
 */
module.exports = function (implArgs, moduleProperties) {
	if (!moduleProperties || !moduleProperties['configProperty'] && !moduleProperties['connectionOptions']) {
		return Q.when().thenReject(new Error('configProperty and connectionOptions are missed in parameters for redis-manager module.'));
	}

	var ModuleClass = require('./lib/redis-manager');
	return ModuleClass.apply(ModuleClass, implArgs)
		.then(function (redisManager) {
			return moduleProperties['configProperty']
				? redisManager.createConnectionByConfigProperty(moduleProperties['configProperty'], moduleProperties.instanceName)
				: redisManager.createConnectionByConfiguration(moduleProperties['connectionOptions']);
		});
};
