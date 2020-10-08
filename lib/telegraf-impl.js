const log = require("log4js").getLogger(__filename.split('\\').pop().split('/').pop());
const _pkg = require(__dirname + '/../package.json');
const version = `${_pkg.version} (${process.env.VERSION})`;
const _ = require('underscore');
const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const RedisSession = require('telegraf-session-redis');
const Stage = require('telegraf/stage');
const WizardScene = require('telegraf/scenes/wizard');

const HTTP_REGEX = new RegExp(/(https|http:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi);
const PREFERRED_RESULTS = 10;

const removeTrailingZeros = numberAsString => numberAsString.replace(/(\.[0-9]*[1-9])0*|(\.0*)/, "$1");

const getLargestPhoto = (mess) => {
    return mess.photo.reduce((max, file) => max.file_size > file.file_size ? max : file, mess.photo[0]);
};

const _prepareTickerMessageParameters = (lastPrice) => {
    /*
	{"timestamp":"1547567796","pair":"BTC:USD","low":"12979","high":"15849.3","last":"12979",
	"volume":"0.04363644","volume30d":"118.98131808","priceChange":"-11.00000000","priceChangePercentage":"-0.08","bid":12979,"ask":15849.3}
	 */
    const [s1, s2] = lastPrice.pair.split(':');
    // log.trace(lastPrice);
    // return `Last Price: ${lastPrice.last} ${s2}, Change 24 hours: ${parseFloat(lastPrice.priceChange)} ${s2} (${lastPrice.priceChangePercentage}%), Volume: ${parseFloat(lastPrice.volume)} ${s1}`
    return {...lastPrice, s1, s2}
};

const getProduct = (pair) => {
    const [currency] = pair.split(':');
    return currency;
};

const mapToInt = (cp, p) => cp.parseAmount(getProduct(p.pair), p.volume);

const _prepareTickerItemMessageParameters = (item, cp) => {
    const { volume, pair, last, priceChange, priceChangePercentage } = item;
    const [s1, s2] = pair.split(':');
    return {
        s1, s2, pair: pair.replace(':', '/'),
        volume: removeTrailingZeros(volume),
        last: removeTrailingZeros(cp.formatPrice1(pair, last)),
        priceChange: removeTrailingZeros(priceChange),
        priceChangePercentage: parseFloat(priceChangePercentage)
    }
};

const prepareHighestVolume = (array, cp) => {
    const highestVolumeItem = array.reduce((tickerWithMaxVolume, p) => {
        const [product, market] = p.pair.split(':');
        if (market === 'BTC') {
            return cp.symbol1ToSymbol2(product, market, mapToInt(cp, p), p.last) > mapToInt(cp, tickerWithMaxVolume) ? p : tickerWithMaxVolume;
        } else if (product === 'BTC') {
            return mapToInt(cp, p) > mapToInt(cp, tickerWithMaxVolume) ? p : tickerWithMaxVolume;
        } else {
            const tickerToBtc = _.findWhere(array, { pair: `${product}:BTC` });
            if (!_.isEmpty(tickerToBtc)) {
                return cp.symbol1ToSymbol2(product, 'BTC', mapToInt(cp, p), tickerToBtc.last) > mapToInt(cp, tickerWithMaxVolume) ? p : tickerWithMaxVolume;
            } else {
                log.trace(`No conversion to BTC for pair ${p.pair}`);
                return tickerWithMaxVolume;
            }
        }
    }, array[0]);
    return _prepareTickerItemMessageParameters(highestVolumeItem, cp);
};

const prepareHighestChange = (array, cp) => {
    const highestChangeItem = array.reduce((max, p) => parseFloat(p.priceChangePercentage) > parseFloat(max.priceChangePercentage) ? p : max, array[0]);
    return _prepareTickerItemMessageParameters(highestChangeItem, cp);
};

const prepareLowestChange = (array, cp) => {
    const lowestChangeItem = array.reduce((min, p) => parseFloat(p.priceChangePercentage) < parseFloat(min.priceChangePercentage) && p.priceChangePercentage !== '-' ? p : min, array[0]);
    return _prepareTickerItemMessageParameters(lowestChangeItem, cp);
};

const prepareTickersMessageParameters = (tickers, cp) => {
    return {
        hv: prepareHighestVolume(tickers, cp),
        hc: prepareHighestChange(tickers, cp),
        lc: prepareLowestChange(tickers, cp)
    }
};

const getTickersMessage = async (tickers, _i18n, currencyProfileFactory) => {
    const cp = await currencyProfileFactory.qGetFullCurrencyProfileWithoutRestricted();
    const getRandomElem = Math.floor(Math.random() * _i18n.repository.en.command.tickers.length);
    return _i18n.t(`command.tickers.${getRandomElem}`, prepareTickersMessageParameters(tickers, cp));
};

const getProactiveMessage = async (msgType, tickers, _i18n, currencyProfileFactory) => {
    const cp = await currencyProfileFactory.qGetFullCurrencyProfileWithoutRestricted();
    const getRandomElem = Math.floor(Math.random() * _i18n.repository.en.proactive[msgType].length);
    return _i18n.t(`proactive.${msgType}.${getRandomElem}`, prepareTickersMessageParameters(tickers, cp));
};

module.exports = (config, dataSource, currencyProfileFactory) => {
    const resolvedConfig = config();
    const configuration = resolvedConfig.redis_util;
    const impl = {};
    impl.init = () => {
        return Promise.resolve();
        // TODO: Initialize here
    };
    const botApiToken = resolvedConfig.tlgbp.botApiToken;
    const I18n = require('telegraf-i18n');
    const path = require('path');
    const _i18n = new I18n({
        // defaultLanguage: 'en',
        allowMissing: false,
        directory: path.resolve('./node_modules/@cex-static/tbot-templates'),
        // sessionName: 'session',
        useSession: true
    });
    const bot = new Telegraf(botApiToken);
    const TelegrafChatbase = require('./telegraf-chatbase-middleware');
    const chatbase = new TelegrafChatbase(config().tlgbp.chatbaseApiToken);
    bot.use(chatbase.middleware());
    const redisSession = new RedisSession({
        store: {
            host: configuration[1],
            port: configuration[0],
            password: configuration[2] && configuration[2].auth_pass,
            prefix: 'tlg:'
        }
    });
    bot.use(redisSession);
    bot.use(_i18n.middleware());
    bot.use((ctx, next) => {
        // const fromStr = `${ctx.from.id}:${ctx.from.username}:${ctx.from.first_name}`;
        // const msg = ctx.message || {};
        // log.debug(`Incoming message type ${ctx.updateType}.${ctx.updateSubTypes.join(',')} from ${fromStr} '${msg.text || JSON.stringify(msg.sticker)}'`)
        log.debug(`>>> ${JSON.stringify(ctx.update[ctx.updateType])}`)
        ctx.session.from = ctx.from;
        return next();
    });


    const tickerWizard = new WizardScene(
        "ticker",
        async ({ i18n, replyWithMarkdown, wizard, message, scene, chatbase }) => {
            const pairStr = message.text.substr(8);
            const lastPrice = await dataSource.getLastPrices(pairStr);
            if (lastPrice) {
                const replyMessageText = i18n.t('command.ticker', _prepareTickerMessageParameters(lastPrice));
                replyWithMarkdown(
                    replyMessageText,
                    Markup.removeKeyboard().extra()
                );
                chatbase.track('ticker', replyMessageText);
                return scene.leave();
            }
            const pairsList = await dataSource.getPairs();
            const preparedPairListKeyboard = pairsList.map(pairStr => Markup.callbackButton(pairStr.replace(':', '/'), `ticker ${pairStr}`));
            const kb = Markup.keyboard(preparedPairListKeyboard, {columns: 3}).oneTime().resize().extra();
            const replyMessageText = i18n.t('prompt.select_pair');
            replyWithMarkdown(replyMessageText, kb);
            chatbase.track('ticker', replyMessageText);
            return wizard.next();
        },
        async ctx => {
            const text = ctx.message.text;
            const lastPrice = await dataSource.getLastPrices(text);
            const { i18n, replyWithMarkdown, wizard, scene, chatbase } = ctx;
            if (lastPrice) {
                const replyMessageText = i18n.t('command.ticker', _prepareTickerMessageParameters(lastPrice));
                replyWithMarkdown(
                    replyMessageText,
                    Markup.removeKeyboard().extra()
                );
                chatbase.track('ticker', replyMessageText);
                return scene.leave();
            } else {
                wizard.back(); // Set the listener to the previous function
                return wizard.steps[wizard.cursor](ctx); // Manually trigger the listener with the current ctx
            }
        },
    );
    const postUploadScene = new WizardScene("postUploadScene",
        async (ctx) => {
            log.trace(`User [${ctx.message.chat.username}] has started post creation`);
            await ctx.reply(ctx.i18n.t('command.new_post.0', {first_name: ctx.message.chat.first_name}));
            return ctx.wizard.next();
        },
        async (ctx) => {
            log.trace(`User ${ctx.message.chat.username} has started entering text`);
            if (ctx.message.text.length) {
                await dataSource.updateFuturePost({post_text: ctx.message.text});
                log.trace(`User [${ctx.message.from.username}] has successfully uploaded text to future post`);
                await ctx.reply(ctx.i18n.t('command.new_post.1'));
                return ctx.wizard.next();
            }
            await ctx.reply(ctx.i18n.t('post_upload_message.0'));
        },
        async (ctx) => {
            log.trace(`User ${ctx.message.chat.username} has started uploading photo`);
            if (ctx.message.photo) {
                const post = await dataSource.getFuturePost();
                const largestPhoto = getLargestPhoto(ctx.message);
                await dataSource.updateFuturePost({...JSON.parse(post), photo: largestPhoto});
                log.trace(`User [${ctx.message.from.username}] has successfully uploaded photo to future post`);
                await ctx.reply(ctx.i18n.t('command.new_post.2'));
                return ctx.wizard.next();
            }
            await ctx.reply(ctx.i18n.t('post_upload_message.1'));
        },
        async ctx => {
            if (HTTP_REGEX.test(ctx.message.text)) {
                const post = await dataSource.getFuturePost();
                await dataSource.updateFuturePost({...JSON.parse(post), link: {link: ctx.message.text}});
                await ctx.reply(ctx.i18n.t('command.new_post.3'));
                return ctx.wizard.next();
            }
            await ctx.reply(ctx.i18n.t('command.new_post.2'));
        },
        async ctx => {
            if (ctx.message.text.length) {
                const post = await dataSource.getFuturePost();
                const p = JSON.parse(post);
                await dataSource.updateFuturePost({...p, link: {...p.link, text: ctx.message.text}});
                return await ctx.reply(ctx.i18n.t('command.new_post.4'));
            }
            return await ctx.reply(ctx.i18n.t('command.new_post.3'));
        });

    const stage = new Stage([tickerWizard, postUploadScene]);
    stage.command('ticker', ({scene}) => {
        scene.enter('ticker');
    });
    stage.command('new_post', async ({message, scene, reply, i18n}) => {
        const admins = resolvedConfig.tlgbp.admins;
        if (admins.includes(message.from.id.toString())) {
            return scene.enter('postUploadScene');
        }
        await reply(i18n.t('error.not_allowed_user_to_create_post'));
    });
    stage.start(async ctx => {
        ctx.scene.leave();
        let replyMessageText = ctx.i18n.t('command.start', {user: {first_name: ctx.message.from.first_name}});
        const chatId = ctx.update.message.chat.id;
        const userSubscribed = await dataSource.addToSubscribers(chatId);
        log.trace(`User was subscribed with status: ${Boolean(userSubscribed)}`);
        if (userSubscribed) {
            replyMessageText += `\n${ctx.i18n.t('answers.subscribed')}`;
        }
        return await ctx.replyWithMarkdown(
            replyMessageText,
            Markup.removeKeyboard().extra()
        );
    });
    ['help', 'menu'].forEach(helpCmd => {
        stage.command(helpCmd, (({ i18n, replyWithMarkdown, scene, chatbase }) => {
            scene.leave();
            const replyMessageText = i18n.t('command.menu');
            const reply = replyWithMarkdown(
                replyMessageText,
                Markup.removeKeyboard().extra()
            );
            chatbase.track(helpCmd, replyMessageText);
            return reply;
        }));
    });
    stage.command('tickers', async ({ i18n, replyWithMarkdown, chatbase, scene }) => {
        scene.leave();
        const replyMessageText = await getTickersMessage(await dataSource.getAllTickers(), i18n, currencyProfileFactory);
        const reply = await replyWithMarkdown(
            replyMessageText,
            Markup.removeKeyboard().extra()
        );
        chatbase.track('tickers', replyMessageText);
        return reply;
    });
    ['hv', 'hc', 'lc'].forEach(type => {
        stage.command(`p${type}`, async ({ i18n, replyWithMarkdown, chatbase, scene }) => {
            scene.leave();
            const tickers = await dataSource.getAllTickers();
            const cp = await currencyProfileFactory.qGetFullCurrencyProfileWithoutRestricted();
            const getRandomElem = Math.floor(Math.random() * i18n.repository.en.proactive.hv.length);
            const replyMessageText = i18n.t(`proactive.${type}.${getRandomElem}`, prepareTickersMessageParameters(tickers, cp));
            const reply = await replyWithMarkdown(
                replyMessageText,
                Markup.removeKeyboard().extra()
            );
            chatbase.track(`p${type}`, replyMessageText);
            return reply;
        });
    });
    stage.command('cancel', async ctx => {
        await dataSource.clearFuturePost();
        await ctx.reply(ctx.i18n.t('command.new_post_cancel'));
        return postUploadScene.leave();
    });
    stage.command('done', async ctx => {
        const record = await dataSource.getFuturePost();
        const post = JSON.parse(record);
        try {
            if (post && post.photo) {
                const subscribers = await dataSource.getSubscribers();
                const buttons = [
                    Markup.callbackButton('👍', 'upvote'),
                    Markup.callbackButton('👎', 'downvote'),
                ];
                if (post.link) {
                    if (post.link.text) {
                        buttons.push(Markup.urlButton(post.link.text, post.link.link));
                    } else {
                        buttons.push(Markup.urlButton(post.link.link, post.link.link));
                    }
                }
                const keyboard = Markup.inlineKeyboard(buttons, {columns: 2});
                const postRes = await dataSource.createUpvotePost(post);
                if (!!postRes) {
                    log.info(`Post was created with status ${!!postRes}`);
                    subscribers.forEach(async s => {
                        await bot.telegram.sendPhoto(s, post.photo.file_id, {caption: post.post_text, reply_markup: keyboard});
                    });
                    await ctx.reply(ctx.i18n.t('command.new_post_done'));
                } else {
                    await ctx.reply(ctx.i18n.t("error.vote_exists"));
                }
                await dataSource.deleteUpvotePost(post);
            } else if (post && !post.photo) {
                await ctx.reply(ctx.i18n.t("error.post_must_contain_photo"));
            } else {
                await ctx.reply(ctx.i18n.t('error.post_is_not_in_db'));
            }
        } catch (e) {
            log.error(e);
        }
        await dataSource.clearFuturePost();
        // ctx.scene.leave();
        return postUploadScene.leave();
    });
    stage.action(['upvote', 'downvote'], async ctx => {
        const voteRes = await dataSource.getVoteMessage(getLargestPhoto(ctx.update.callback_query.message).file_id);
        const vote = JSON.parse(voteRes);
        if (vote) {
            log.info(`[${ctx.session.from.username}] has made ${ctx.match} message ${ctx.update.callback_query.message.message_id}`);
            await dataSource[`${ctx.match}Message`](getLargestPhoto(ctx.update.callback_query.message).file_id);
            await ctx.editMessageCaption(`${ctx.update.callback_query.message.caption}\n\n${ctx.i18n.t('vote.success')}`);
        } else {
            await ctx.editMessageCaption(`${ctx.update.callback_query.message.caption}\n\n${ctx.i18n.t('vote.error')}`);
        }
    });
    stage.command('votes', async ctx => {
        log.info(`${ctx.message.chat.username} with id ${ctx.session.from.id.toString()} tries to see logs`);
        const admins = resolvedConfig.tlgbp.admins;
        if (admins.includes(ctx.message.from.id.toString())) {
            const votes = await dataSource.listOfVotes();
            if (votes.length && votes.length > PREFERRED_RESULTS) {//show first PREFERRED_RESULTS
                const votesKeyboard = votes.filter(i => !i.includes('photo'))
                    .slice(0, PREFERRED_RESULTS).map((vote, i) => Markup.callbackButton(`vote ${i}`, `vote ${vote.substr(10)}`));
                votesKeyboard.push(Markup.callbackButton('Next', `votes 10`));
                return await ctx.reply(ctx.i18n.t('vote.list'), Markup.inlineKeyboard(votesKeyboard, {columns: 2}).extra());
            } else if (votes.length) {
                const votesKeyboard = votes.filter(i => !i.includes('photo'))
                    .slice(0, PREFERRED_RESULTS).map((vote, i) => Markup.callbackButton(`vote ${i}`, `vote ${vote.substr(10)}`));
                return await ctx.reply(`${ctx.i18n.t('vote.list')}`, Markup.inlineKeyboard(votesKeyboard, {columns: 2}).extra());
            } else {
                return await ctx.reply(`${ctx.i18n.t('vote.empty_list')}`);
            }
        } else {
            return await ctx.reply("You are not allowed to do it!");
        }
    });
    //pagination
    stage.action(/votes\s\w+$/, async ctx => {
        const offset = ctx.match.input.substr(6);
        const votes = await dataSource.listOfVotes();
        const votesKeyboard = votes.slice(offset, PREFERRED_RESULTS).map((vote, i) => Markup.callbackButton(`vote ${i}`, `vote ${vote.substr(10)}`));
        if ((offset + PREFERRED_RESULTS) < votes.length) votesKeyboard.append(Markup.callbackButton('Next', `votes ${offset + PREFERRED_RESULTS}`));
        if ((offset - PREFERRED_RESULTS) >= 0) votesKeyboard.append(Markup.callbackButton('Previous', `votes ${offset - PREFERRED_RESULTS}`));
        return await ctx.reply(ctx.i18n.t('vote.list'), Markup.inlineKeyboard(votesKeyboard, {columns: 2}).extra());
    });
    //results
    stage.action(/vote\s\w+$/, async ctx => {
        const admins = resolvedConfig.tlgbp.admins;
        if (admins.includes(ctx.session.from.id.toString())) {
            const voteStr = ctx.match.input.substr(5);
            const u = await dataSource.getUpvotes(voteStr);
            const d = await dataSource.getDownvotes(voteStr);
            return await ctx.reply(ctx.i18n.t('vote.results', {u: +u, d: +d}));
        }
    });
    const languageMenu = Telegraf.Extra
        .markdown()
        .markup((m) => m.inlineKeyboard([
            m.callbackButton('English', 'en'), m.callbackButton('Русский', 'ru')
        ]));
    bot.command('locale', async (ctx) => await ctx.reply(ctx.i18n.t('command.locale'), languageMenu)); // TODO: Move it to Wizard
    stage.action('en', async (ctx) => {
        ctx.i18n.locale('en');
        // return ctx.replyWithHTML(ctx.i18n.t('answers.locale_changed'));
        return await ctx.editMessageText( ctx.i18n.t('answers.locale_changed') );
        // return await ctx.answerCbQuery(ctx.i18n.t('answers.locale_changed'));
    })
        .action('ru', async (ctx) => {
            ctx.i18n.locale('ru');
            // return ctx.replyWithHTML(ctx.i18n.t('answers.locale_changed'));
            return await ctx.editMessageText( ctx.i18n.t('answers.locale_changed') );
            // return await ctx.answerCbQuery(ctx.i18n.t('answers.locale_changed'));
        });
    stage.command('subscribe', async (ctx) => {
        const chatId = ctx.update.message.chat.id;
        const userSubscribed = await dataSource.addToSubscribers(chatId);
        log.trace(`User was subscribed with status: ${Boolean(userSubscribed)}`);
        const text = ctx.i18n.t(userSubscribed ? 'answers.subscribed' : 'answers.subscribed_already');
        return ctx.replyWithMarkdown(
            text,
            Markup.removeKeyboard().extra()
        );
    });
    stage.command('unsubscribe', async (ctx) => {
        const chatId = ctx.update.message.chat.id;
        const userUnsubscribed = await dataSource.removeFromSubscribers(chatId);
        log.trace(`User was unsubscribed with status: ${Boolean(userUnsubscribed)}`);
        const text = ctx.i18n.t(userUnsubscribed ? 'answers.unsubscribed' : 'answers.unsubscribed_already');
        return ctx.replyWithMarkdown(
            text,
            Markup.removeKeyboard().extra()
        );
    });
    // Admin command to get amount of active subscribers
    stage.command('subscribers', async ctx => {
        const admins = resolvedConfig.tlgbp.admins;
        if (admins.includes(ctx.message.from.id.toString())) {
            const subscribersCount = await dataSource.getSubscribersCount();
            return ctx.replyWithMarkdown(
                `Active subscribers count: ${subscribersCount}`,
                Markup.removeKeyboard().extra()
            );
        }
    });

    /*
        FAQ command handler
     */
    const FAQ_KEYS = Object.keys(_i18n.repository.en.faq);
    stage.command('faq', ({replyWithMarkdown, i18n, scene}) => {
        const inlineKeyboard = _.map(FAQ_KEYS, k => {
            const link = i18n.repository.en.faq[k].link;
            if (link) {
                return Markup.urlButton(i18n.t(`faq.${k}.title`), link());
            } else {
                return Markup.callbackButton(i18n.t(`faq.${k}.title`), `faq.${k}`)
            }
        });
        const inlineMessageFaqKeyboard = Markup.inlineKeyboard(
            inlineKeyboard,
            {columns: 1}).extra();
        scene.leave();
        return replyWithMarkdown(i18n.t('prompt.select_faq'), inlineMessageFaqKeyboard);
    });
    stage.action(/faq\.\d+$/, ctx => ctx.editMessageText(ctx.i18n.t(`${ctx.match}.content`)));
    bot.command('version', async ctx => {
        return await ctx.reply(version);
    });

    bot.use(stage.middleware());
    bot.hears(/.+/, async ({ i18n, replyWithMarkdown, chatbase }) => {
        const replyMessageText = i18n.t('error.wrong_argument');
        const reply = await replyWithMarkdown(replyMessageText);
        chatbase.track();
        return reply;
    });
    bot.catch(err => {
        // TODO: Add tracking of unhandled message
        log.error(err);
    });

    impl.launch = () => bot.launch();
    impl.copySubscribersToQueue = async () => log.trace(`Scheduled collection was created with status: ${Boolean(await dataSource.copyToRecipientCollection())}`);
    impl.removeAndGetRandomSubscriber = async () => await dataSource.removeAndGetRandomSubscriber();
    impl.getScheduledMessage = async (subscriber, msgType) => {
        let sMessageParams = await dataSource.getScheduledMessageParams();
        if (!sMessageParams) {
            const tickers = await dataSource.getAllTickers();
            const res = await dataSource.createScheduledMessageParams(tickers);
            if (res !== 'OK') throw new Error("Error on create scheduled message");
            sMessageParams = tickers;
        }
        const sessionKey = `${subscriber}:${subscriber}`;
        const session = await redisSession.getSession(sessionKey);
        const lang = session.__language_code || 'en';
        log.trace(`session ${sessionKey}=`, session);
        return await getProactiveMessage(msgType, sMessageParams, _i18n.createContext(lang), currencyProfileFactory);
    };
    impl.sendMessage = async (chatId, text, options) => {
        try {
            await bot.telegram.sendMessage(chatId, text, options);
        } catch (e) {
            if (e.code === 403) {
                await dataSource.removeFromSubscribers(chatId);
                log.error(`User [${chatId}] has blocked this bot and was unsubscribed"`);
            } else {
                log.error(`Request has ended with error by [${chatId}] with text "${text}"`);
            }
        }
    };
    log.trace('Initialized');
    return Promise.resolve({
        impl: impl,
        visibleForTest: {
            removeTrailingZeros,
            _formatLastPrice: _prepareTickerMessageParameters,
            renderHighestVolume: prepareHighestVolume, renderHighestChange: prepareHighestChange, renderLowestChange: prepareLowestChange
        }
    });
};
