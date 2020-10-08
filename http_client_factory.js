const Q = require('q');
const clientBuilder = require('./http_client');

module.exports = function (implArgs, moduleProperties) {
	if (moduleProperties && moduleProperties.impl) {
		var config = implArgs[0]().http_clients;
		var client = clientBuilder(config[moduleProperties.impl], moduleProperties.impl);

		return Q(client);
	} else {
		return Q.when().thenReject(new Error('Missing mandatory property "impl"'));
	}
};
