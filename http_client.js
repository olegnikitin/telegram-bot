const Q = require('q');
const https = require('https');
const _ = require('underscore');
const log4js = require('log4js');

module.exports = function (httpClientConfig, httpClientName) {
	httpClientName = httpClientName ? ` ${httpClientName}` : '';
	const log = log4js.getLogger(`cex/http_client${httpClientName}`);

	const DEFAULT_CONTENT_TYPE = 'application/json';
	const DEFAULT_REQUEST_URL = '/';
	const DEFAULT_REQUEST_METHOD = 'POST';

	var host = httpClientConfig.host;
	var port = httpClientConfig.port;
	var req_t = httpClientConfig.req_timeout || 5000;
	var res_t = httpClientConfig.res_timeout || 5000;

	var impl = {};

	impl.call = function (params, type, url, opts) {
		url = url || httpClientConfig.url || DEFAULT_REQUEST_URL;

		var reqData;
		var resData = '';
		var deferred = Q.defer();

		if (typeof params != 'string') {
			reqData = JSON.stringify(params);
		} else {
			reqData = params;
		}

		var request_headers = {
			'User-Agent': 'http-client',
			'Content-Type': type || DEFAULT_CONTENT_TYPE,
			'Content-Length': Buffer.byteLength(reqData)
		};

		var req = _.extend({
			hostname: host,
			path: url,
			port: port,
			method: httpClientConfig.method || DEFAULT_REQUEST_METHOD,
			headers: request_headers,
			rejectUnauthorized: httpClientConfig.rejectUnauthorized
		}, opts);

		var request = https.request(req, function (res) {
			res.setEncoding('utf8');

			res.on('error', function (err) {
				log.error('Cannot get response from remote server:' + host + ' port=' + port + ' url=' + url + ' error:' , err);
				deferred.reject({code: '500', message: 'Can get response from remote server:' + err});
			});

			res.on('data', function (chunk) {
				res.setTimeout(res_t, function () {
					log.error('Response time out expired');
					deferred.reject({ code: '500', message: 'Response time out expired' });
				});
				resData += chunk;
			});

			res.on('end', function () {
				log.trace('Received end of response, response=' , resData , '. Headers:' , res.headers);
				try {
					deferred.resolve(JSON.parse(resData));
				} catch (err) {
					deferred.reject({code: '500', message: 'Http client gate received not JSON structure in response - ' + resData});
				}
			});
		});

		request.setTimeout(req_t, function () {
			log.error('Request time out expired');
			deferred.reject({code: '500', message: 'Http client request time out expired'});
		});

		request.on('error', function (err) {
			log.error('Client caught error: ' + err, req);
			deferred.reject({code: '500', message: 'Client caught error: ' + err});

		});

		log.trace('Send request data', reqData);

		request.write(reqData);
		request.end();

		return deferred.promise;
	};

	return impl;
};
