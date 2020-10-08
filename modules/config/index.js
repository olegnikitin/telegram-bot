const log = require('log4js').getLogger('db');
const Q = require("q");

module.exports = function(implArgs, moduleProperties) {
	var ModuleClass;
	if (moduleProperties && moduleProperties.impl) {
		ModuleClass = require((__dirname + "/lib/" + moduleProperties.impl));
		return ModuleClass.apply(ModuleClass, implArgs);
	}
	ModuleClass = require((__dirname + "/lib/config.js"));
	return ModuleClass.apply(ModuleClass, implArgs);
};
