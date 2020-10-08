module.exports = function(implArgs, moduleProperties) {
    if (moduleProperties && moduleProperties.impl) {
        var ModuleClass = require((__dirname + "/lib/" + moduleProperties.impl));
        return ModuleClass.apply(ModuleClass, implArgs)
            .then(function(initializedModule) {
                return initializedModule.impl
            });
    } else {
        return Promise.reject(new Error("Missing mandatory property 'impl'"));
    }
};
