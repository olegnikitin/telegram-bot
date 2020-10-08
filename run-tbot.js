const fs = require("fs");
const log4js = require('log4js');
const modulesConfig = JSON.parse(fs.readFileSync(__dirname + "/tbot-modules-config.json"));
const _ = require('underscore');

const loadLoggerConfiguration = () => {
	var appConf = process.env['APP_CONF'];
	var lof4jsPath = appConf + '/log4js-tbot.json';
	console.log('Try to load log4js config from file:', lof4jsPath );
	if(fs.existsSync(lof4jsPath)) {
		log4js.configure(lof4jsPath, {});
		console.log('log4js config file has been loaded:', lof4jsPath );
	}
};

loadLoggerConfiguration();
const log = log4js.getLogger(__filename.split('\\').pop().split('/').pop());
(async () => {
	try {
        const modulesCtx = await require("@cex/initialization-context")(modulesConfig);
        const bot = modulesCtx.bot;
        bot.launch().catch(console.error);
        log.info("Started");
    } catch (err) {
		log.error(err);
        await new Promise((resolve) => setTimeout(resolve,2000));
		process.exit(1);
	}
})();
