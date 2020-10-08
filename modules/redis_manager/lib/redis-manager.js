const Q = require('q');
const redisModule = require('redis');

const log = require('log4js').getLogger('redis-manager-impl');

var redisInstances = {};

module.exports = function (config) {

	function redisConnectionOptions(opts) {
		var options =  '';
		if( opts ){
			options =  JSON.parse(JSON.stringify(opts));
		}
		if (options.auth_pass) {
			options.auth_pass = options.auth_pass.substr(0, 1) + '**********' + options.auth_pass.substr(options.auth_pass.length - 1);
		}
		return JSON.stringify(options)
	}

	function createConnectionByConfigProperty(configProperty, instanceName) {
		return createConnectionByConfiguration(config()[configProperty], configProperty, instanceName);
	}

	function createConnectionByConfiguration(redisConfiguration, redisAlias, instanceName) {
		var redisDefer = Q.defer();

		var key = instanceName || redisAlias || (redisConfiguration[0].toString() + redisConfiguration[1].toString());
		if (redisInstances[key]) {
			log.trace('Using already created connection to redis by key: "%s"', key);
			redisDefer.resolve(redisInstances[key]);
		} else {
			var redis = redisModule.createClient.apply(redisModule, redisConfiguration);

			redis.on('ready', function () {
				log.info('Redis is ready "%s". Connection params: [%s, %s], options: [%s]', key, redisConfiguration[0], redisConfiguration[1], redisConnectionOptions(redisConfiguration[2]));
					redisInstances[key] = redis;
				redisDefer.resolve(redis);
			});

			redis.on('error', function (err) {
				log.error('Redis', key, 'responded with error:', err.message);
				redisDefer.reject(err);
			});

			redis.on('end', function () {
				log.warn('Redis', key, 'emitted end event.');
			});
		}

		return redisDefer.promise;
	}

	return Q.when({
		createConnectionByConfigProperty: createConnectionByConfigProperty,
		createConnectionByConfiguration: createConnectionByConfiguration
	})
};
