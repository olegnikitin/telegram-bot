var _ = require('underscore');
var Q = require("q");
var fs = require('fs');
var watchfs = _.extend({}, {watcher: require('node-watch')});//hard hack, need for 2 realisations of config.js
var path = require('path');
var log = require('log4js').getLogger('cex-config');
var aggregator_config_filename = path.join((process.env['APP_CONF'] || __dirname), '/config_aggregator.json');

log.info('FROM MODULE:Reading config file from: \'' + aggregator_config_filename + '\'.');

var config = {};
var defer = Q.defer();
var files_to_watch = [];

var init = function () {
	files_to_watch.push(aggregator_config_filename);
	return on_change().then(function () {
		_.each(files_to_watch, function (filename) {
			watchfs.watcher(filename, on_change)
		});
		log.info("FROM MODULE:End configuration change.");
		defer.resolve(getConfig)
	}).catch(function (error) {
		console.log("Configuration changes were not applied. Error:", error);
		log.error("Configuration changes were not applied. Error:", error);
		defer.reject("Configuration changes were not applied. Error: " + error);
		throw Error("Configuration changes were not applied. Error: " + error);
	})
};

var checkForDisabledCoins = function (config) {
	if (config.disabledCoins) {
		_.each(config.disabledCoins, function (depositWithdrawal, depositWithdrawalName) {
			var coins = [];
			_.each(depositWithdrawal, function (coin, coinName) {
				coins.push(coinName)
			});
			var warnMessage = coins.join(', ');
			if (warnMessage) {
				log.info(depositWithdrawalName, 'is disabled for:[', warnMessage, '] coins');
				console.log('INFO: ', depositWithdrawalName, ' is disabled for:[', warnMessage, '] coins')
			}
		})
	}
};

var mandatoryConfigFields = [
	"referral.bitcoincomSource",
	"referral.guardaSource",
	"allowed_widget_origins",
	"bundles.providerMapForEncrypting",
	"trade_users_groups",
	"defaultUserGroup"
];

function checkForMandatoryFields(config){
	var missingFields = [];
	_.each(mandatoryConfigFields, function (mandatoryField) {
		var pathArray = mandatoryField.split('.');
		var currField = config;
		var currentPos = '';
		var stopFlag = true;
		while (pathArray.length > 0 && stopFlag) {
			currField = currField[pathArray[0]];
			currentPos = currentPos + pathArray[0];
			if (!currField) {
				missingFields.push('field: ' + mandatoryField + ', cannot find path : ' + currentPos);
				stopFlag = false;
			} else {
				currentPos += '.';
				pathArray.shift()
			}
		}
	});
	if (missingFields.length > 0) {
		var error_message = 'Configuration is broken, missing fields:[' + missingFields.join('; ') + ']';
		console.log(error_message);
		log.fatal(error_message);
		throw Error(error_message);
	}
}

var update_config = function (data, modificationTime) {
	var temp_config = {};
	var isValid = true;
	var duplicate_fields = [];
	_.each(data, function (obj) {
		temp_config = _.defaults(temp_config, obj);
	});
	_.each(temp_config, function (element, name) {
		var counter = 0;
		_.each(data, function (config_chunk) {
			if (!_.isUndefined(config_chunk[name])) {
				counter++
			}
		});
		if (counter > 1) {
			isValid = false;
			duplicate_fields.push(name);
		}
	});
	if (isValid) {
		config = temp_config;
		config.modificationTime = modificationTime;
		checkForDisabledCoins(config);
		checkForMandatoryFields(config);
	} else {
		throw Error('Configuration files duplicate fields: ' + duplicate_fields.join(', '))
	}
};

var on_change = function () {
	files_to_watch = [];
	return Q.ninvoke(fs, 'readFile', aggregator_config_filename, {'encoding': 'utf8'}).then(function (configs) {
		var promises = [];
		var files = JSON.parse(configs);
		_.each(files, function (filename) {
			var full_filename = path.join((process.env['APP_CONF'] || __dirname), '/' + filename);
			promises.push(
				Q.ninvoke(fs, 'readFile', full_filename, {'encoding': 'utf8'})
			);
			files_to_watch.push(full_filename);
		});
		promises.push(Q.ninvoke(fs, 'stat', aggregator_config_filename));
		return Q.all(promises)
	}).then(function (config_chunks) {
		var modification_time = getModificationTime(config_chunks.splice(-1)[0]);
		var data = [];
		_.each(config_chunks, function (config_chunk) {
			data.push(JSON.parse(config_chunk))
		});
		update_config(data, modification_time);
	}).catch(function (error) {
		console.log("Configuration changes were not applied. Error: ", error);
		log.error("Configuration changes were not applied. Error: ", error);
		defer.reject("Configuration changes were not applied. Error: " + error);
		throw Error("Configuration changes were not applied. Error: " + error);
	});
};

var getModificationTime = function (obj) {
	return new Date(obj.mtime).getTime();
};

var getConfig = function () {
	return config;
};

if (typeof test_flag == 'undefined') {
	init();
}


module.exports = function () {
	return defer.promise;
};
