const _ = require('underscore');
const assert = require('assert');

describe('Redis Manager index test', function () {

	_.each([
		{
			scenario: 'Should throw an exception if neither configProperty nor connectionOptions parameters are provided',
			moduleProperties: {}
		},
		{
			scenario: 'Should throw an exception if moduleProperties is missed at all'
		}
	], function (testCase) {
		it(testCase.scenario, function (itDone) {
			//Given
			var implArgs = [];
			var expectedErrorMessage = 'configProperty and connectionOptions are missed in parameters for redis-manager module.';

			//When
			require('../index')(implArgs, testCase.moduleProperties).then(function () {
				itDone(new Error('Test should check throwing of the exception.'));
			}).catch(function (err) {
				assert.equal(err.message, expectedErrorMessage);
				itDone();
			}).catch(function (err) {
				itDone(err);
			});
		});
	});

});