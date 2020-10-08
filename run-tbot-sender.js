const fs = require("fs");
const log4js = require('log4js');
const cron = require('node-cron');
const modulesConfig = JSON.parse(fs.readFileSync(__dirname + "/tbot-modules-config.json"));
const _ = require('underscore');

const TIMEOUT_BETWEEN_REQUESTS = 1000;

const loadLoggerConfiguration = () => {
	var appConf = process.env['APP_CONF'];
	var lof4jsPath = appConf + '/log4js-tbot.json';
	console.log('Try to load log4js config from file:', lof4jsPath );
	if(fs.existsSync(lof4jsPath)) {
		log4js.configure(lof4jsPath, {});
		console.log('log4js config file has been loaded:', lof4jsPath );
	}
};

const delay = (delay) => new Promise(resolve => setTimeout(resolve, delay));

const sendNext = (bot, msgType) => async () => {
	let subscriber = await bot.removeAndGetRandomSubscriber();
	if (subscriber) {
		try {
			const scheduledMessage = await bot.getScheduledMessage(subscriber, msgType);
			log.trace(`User with chatId [${subscriber}] is going to receive message ${msgType} [${scheduledMessage}]`);
			await bot.sendMessage(subscriber, scheduledMessage, {parse_mode: 'Markdown'});
			await delay(TIMEOUT_BETWEEN_REQUESTS);
			process.nextTick(sendNext(bot, msgType));
		} catch (e) {
			log.error(`User with chatId [${subscriber}] has failed to receive message with error:`, e);
		}
	} else {
        log.info(`Scheduler ${msgType} has completed all tasks at ${new Date()}`);
	}
};

loadLoggerConfiguration();
const log = log4js.getLogger(__filename.split('\\').pop().split('/').pop());
(async () => {
	try {
        const modulesCtx = await require("@cex/initialization-context")(modulesConfig);
        const bot = modulesCtx.bot;
        const botConfig = modulesCtx.config().tlgbp.sender;
        log.info("Started");
        _.each(botConfig.cron, (cronExpression, msgType) => {
            log.info(`Scheduled ${msgType} message with cron: ${cronExpression}`);
            cron.schedule(cronExpression, async () => {
                log.info(`Scheduler ${msgType} has started at ${new Date()}`);
                await bot.copySubscribersToQueue();
                process.nextTick(sendNext(bot, msgType));
            }, botConfig.options);
        })
    } catch (err) {
		log.error(err);
        await new Promise((resolve) => setTimeout(resolve,2000));
		process.exit(1);
	}
})();
