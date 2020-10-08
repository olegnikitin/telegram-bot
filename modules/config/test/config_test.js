var test_flag = true;//need, check in realisation(config.js)
var fs = require('fs');
var assert = require("assert");
var Q = require('q');
var _ = require('underscore');


// hard including module:
eval(fs.readFileSync(__dirname + '/../lib/config.js') + '');
var logMessage;
log.info = log.error = log.warn= function () {
	logMessage = _.toArray(arguments) .join(', ')
};

var config_chunk1_mock = JSON.stringify(
	{configField: 'field'}
);
var config_chunk2_mock = JSON.stringify(
	{configField2: 'field1'}
);
var config_master_mock = JSON.stringify(
	['chunk1', 'chunk2']
);


describe('Config module. Config.js test.', function () {

	var fsReadFileArgs = {};


	var oldAsyncFileRead;
	var oldAsyncStat;
	var oldPathJoin;
	before(function () {
		oldAsyncFileRead = fs.readFile;
		oldPathJoin = path.join;
		oldAsyncStat = fs.stat;

		fs.readFile = function (filename, params, cb) {
			fsReadFileArgs = params;
			if (filename == 'chunk1') {
				cb(null, config_chunk1_mock)
			} else if (filename == 'chunk2') {
				cb(null, config_chunk2_mock)
			} else if (filename == 'master') {
				cb(null, config_master_mock)
			} else {
				cb('Some error occured', null)
			}
		};

		fs.stat = function (filename, cb) {
			cb(null, {mtime: '1231'})
		};

		path.join = function (firstArg, secondArg) {
			return secondArg.substr(1);
		}
	});

	after(function () {
		fs.readFile = oldAsyncFileRead;
		fs.stat = oldAsyncStat;
		path.join = oldPathJoin;
	});

	beforeEach(function () {
		fsReadFileArgs = {};
		config = {};
		files_to_watch = [];
		logMessage = null;
	});

	it('Should correctly compile config from chunks', function () {
		var givenData = [{a: 'a'}, {b: 'b'}, {
			referral: {
				bitcoincomSource: "test",
				guardaSource: "test"
			},
			allowed_widget_origins: [],
			bundles: {
				providerMapForEncrypting: {
					a: "a",
					b: "b"
				}
			}
		}, {"invoiceBank":{
			"USD": {
				"beneficiaryName": "Crypto Capital Corp",
				"beneficiaryAddress": "Torres De Las Americas, Torre A Piso 12, Punta Pacifica, 83390, Panama",
				"beneficiaryBankIban": "PL63102027910000760202481398",
				"beneficiaryBankName": "PKO Bank Polski SA",
				"beneficiaryBankAddress": "Oddzial 1 w Koszalinie, ul.Mlynska 20 Koszalin 75-054, Poland",
				"beneficiaryBankSwift": "BPKOPLPWXXX",
				"reference": "9120345516"
			},
			"EUR": {
				"beneficiaryName": "Crypto Capital Corp",
				"beneficiaryAddress": "Torres De Las Americas, Torre A Piso 12, Punta Pacifica, 83390, Panama",
				"beneficiaryBankIban": "PL21102027910000720202481380",
				"beneficiaryBankName": "PKO Bank Polski SA",
				"beneficiaryBankAddress": "Oddzial 1 w Koszalinie, ul.Mlynska 20 Koszalin 75-054, Poland",
				"beneficiaryBankSwift": "BPKOPLPWXXX",
				"reference": "9120352394"
			},
			"RUB": {
				"beneficiaryName": "CEX.IO LTD",
				"beneficiaryAddress": "2nd floor, 1-5 Clerkenwell Road, London, EC1M 5PA, United Kingdom",
				"beneficiaryBankIban": "LV37CBBR1123669900010",
				"beneficiaryBankName": "Baltikums Bank AS",
				"beneficiaryBankAddress": "Smilsu Street 6, Riga, LV-1050, Latvia",
				"beneficiaryBankSwift": "CBBRLV22",
				"correspondentBankName": "Raiffeisenbank ZAO",
				"correspondentBankAddress": "Moscow, Russia",
				"correspondentBankSwift": "RZBMRUMM",
				"correspondentAccountNumber": "30111810800000110554",
				"correspondentInn": "7744000302",
				"correspondentBik": "044525700",
				"paymentDetails": "Payment under the Terms of use (CEX.IO) Ref."
			}
		},
      "trade_users_groups":[],
			"defaultUserGroup":"qwe"

		}];
		var givenModificationDate = '123';
		var expectedConfig = {
			a: 'a',
			b: 'b',
			modificationTime: '123',
      allowed_widget_origins: [],
			referral: {
				"bitcoincomSource": "test",
				"guardaSource": "test"
			},
			bundles: {
				providerMapForEncrypting: {
					a: "a",
					b: "b"
				}
			},
			"invoiceBank": {
				"USD": {
					"beneficiaryName": "Crypto Capital Corp",
					"beneficiaryAddress": "Torres De Las Americas, Torre A Piso 12, Punta Pacifica, 83390, Panama",
					"beneficiaryBankIban": "PL63102027910000760202481398",
					"beneficiaryBankName": "PKO Bank Polski SA",
					"beneficiaryBankAddress": "Oddzial 1 w Koszalinie, ul.Mlynska 20 Koszalin 75-054, Poland",
					"beneficiaryBankSwift": "BPKOPLPWXXX",
					"reference": "9120345516"
				},
				"EUR": {
					"beneficiaryName": "Crypto Capital Corp",
					"beneficiaryAddress": "Torres De Las Americas, Torre A Piso 12, Punta Pacifica, 83390, Panama",
					"beneficiaryBankIban": "PL21102027910000720202481380",
					"beneficiaryBankName": "PKO Bank Polski SA",
					"beneficiaryBankAddress": "Oddzial 1 w Koszalinie, ul.Mlynska 20 Koszalin 75-054, Poland",
					"beneficiaryBankSwift": "BPKOPLPWXXX",
					"reference": "9120352394"
				},
				"RUB": {
					"beneficiaryName": "CEX.IO LTD",
					"beneficiaryAddress": "2nd floor, 1-5 Clerkenwell Road, London, EC1M 5PA, United Kingdom",
					"beneficiaryBankIban": "LV37CBBR1123669900010",
					"beneficiaryBankName": "Baltikums Bank AS",
					"beneficiaryBankAddress": "Smilsu Street 6, Riga, LV-1050, Latvia",
					"beneficiaryBankSwift": "CBBRLV22",
					"correspondentBankName": "Raiffeisenbank ZAO",
					"correspondentBankAddress": "Moscow, Russia",
					"correspondentBankSwift": "RZBMRUMM",
					"correspondentAccountNumber": "30111810800000110554",
					"correspondentInn": "7744000302",
					"correspondentBik": "044525700",
					"paymentDetails": "Payment under the Terms of use (CEX.IO) Ref."
				}
			},
      "trade_users_groups":[],
      "defaultUserGroup":"qwe"
		};
		update_config(givenData, givenModificationDate);
		assert.deepEqual(config, expectedConfig);
	});

	it('Should not compile config from chunks(duplicate field, throw Error)', function () {
		var givenData = [{a: 'a'}, {a: '2', b: 'b'}];
		var givenModificationDate = '123';
		var expectedConfig = {};
		var expectedError = 'Configuration files duplicate fields: a';
		try {
			update_config(givenData, givenModificationDate);
		} catch (error) {
			assert.deepEqual(config, expectedConfig);
			assert.deepEqual(error.message, expectedError);
		}
	});

	it('Should correctly initialize module', function (itDone) {
		var errMessage = null;
		var oldOnChange = on_change;
		var oldWatcher = watchfs.watcher;
		var watcherFile = [];
		on_change = function () {
			files_to_watch = ['file1', 'file2'];
			return Q.when();
		};
		watchfs.watcher = function (filename) {
			watcherFile.push(filename)
		};
		var expectedWatcherFiles = ['file1', 'file2'];
		init().then(function () {
			assert.deepEqual(watcherFile, expectedWatcherFiles)
		}).catch(function (error) {
			errMessage = error
		}).done(function () {
			on_change = oldOnChange;
			watchfs.watcher = oldWatcher;
			itDone(errMessage);
		})
	});

	it('Should not initialize module (some error occured)', function (itDone) {
		var errMessage = null;
		var oldOnChange = on_change;
		on_change = function () {
			var d = Q.defer();
			d.reject('Some Error');
			return d.promise;
		};
		init().then(function () {
			assert.deepEqual(0, 1, 'Realisation was changed, please check it')
		}).catch(function (error) {
			assert.deepEqual(error.message, 'Configuration changes were not applied. Error: Some Error');
		}).done(function () {
			on_change = oldOnChange;
			itDone(errMessage);
		})
	});

	it('Should correctly read config chunks from files and transform it to objects', function (itDone) {
		var update_configArgs = {};
		var errMessage = null;
		var old_update_config = update_config;
		update_config = function (data, modification_time) {
			update_configArgs.data = data;
			update_configArgs.modification_time = modification_time;
		};
		getModificationTime = function () {
			return '123'
		};
		aggregator_config_filename = 'master';
		var expectedUpdateConfigArgs = {
			"data": [{"configField": "field"}, {"configField2": "field1"}],
			"modification_time": "123"
		};


		on_change().then(function () {
			assert.deepEqual(update_configArgs, expectedUpdateConfigArgs)
		}).catch(function (error) {
			errMessage = error;
		}).done(function () {
			update_config = old_update_config;
			itDone(errMessage);
		})
	});

	it('Should check config for disabled CCY for deposit/withdrawal and log all disabled coins', function () {
		var tempConfig = {
			"disabledCoins":{
				"withdrawal":{
					"DOGE":"NONONO",
					"LTC":"Try DOGE"
				}
			}
		};
		checkForDisabledCoins(tempConfig);
		assert.deepEqual(logMessage, 'withdrawal, is disabled for:[, DOGE, LTC, ] coins')
	});

	it('Should check config for disabled CCY for deposit/withdrawal and not log them if absent', function () {
		var tempConfig = {
			someProp:'3'
		};
		checkForDisabledCoins(tempConfig);
		assert.deepEqual(logMessage, null)
	});

});