const Q = require('q');
const assert = require('assert');

const log = require('log4js').getLogger('redis-manager_test');
const appConfig = require('../../../config');

describe('Redis Manager Test', function () {

	var config = {
		testInstance: appConfig().redisCleanTestInstance,
		invalidInstance: [1235, 'localhost']
	};
	var configFunc = function () {
		return config;
	};
	var impl = null;

	before(function (itDone) {
		require('../lib/redis-manager')(configFunc).then(function (initializedImpl) {
			impl = initializedImpl;
			itDone();
		}).catch(function (err) {
			itDone(err);
		});
	});

	it('Should create connection to redis db', function (itDone) {
		//Given
		var configProperty = 'testInstance';

		//When
		impl.createConnectionByConfigProperty(configProperty)
			.then(function (redis) {
				return Q.ninvoke(redis, 'info')
			})
			.then(function () {
				return impl.createConnectionByConfigProperty(configProperty)
			})
			.then(function () {
				return require('../lib/redis-manager')(configFunc).then(function (initializedImpl) {
					initializedImpl.createConnectionByConfigProperty(configProperty);
				})
			})
			.then(function (redisInfo) {
				log.debug(redisInfo);
				itDone();
			})
			.catch(function (err) {
				itDone(err);
			})
	});

	it('Should throw an exception if redis is not available by specified configuration params', function (itDone) {
		//Given
		const configProperty = 'invalidInstance';
		const expectedErrorMsg = 'Redis connection to localhost:1235 failed - connect ECONNREFUSED 127.0.0.1:1235';

		//When
		impl.createConnectionByConfigProperty(configProperty)
			.then(function () {
				itDone(new Error('Test should check throwing of the exception'));
			})
			.catch(function (err) {
				assert.equal(err.message, expectedErrorMsg);
				itDone();
			})
			.catch(function (err) {
				itDone(err);
			})
	});

});
