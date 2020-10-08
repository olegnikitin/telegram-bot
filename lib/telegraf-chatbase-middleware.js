const log = require("log4js").getLogger(__filename.split('\\').pop().split('/').pop());

class TelegrafChatbaseMiddleware {
    constructor (chatbaseApiToken) {
        this.token = chatbaseApiToken;
        this.client = require('@google/chatbase')
            .setApiKey(chatbaseApiToken)
            .setPlatform(`cex-io-${process.env.APP_ENV}`)
            .setVersion('1.0')
            .setIntent('chatbot');
    }
    middleware () {
        return (ctx, next) => {
            ctx.chatbase = new ChatbaseContext(this.client, ctx)
            return next()
        }
    }
}

class ChatbaseContext {
    constructor (client, ctx) {
        // log.trace('ChatbaseContext client='+JSON.stringify(client)+' ctx=', ctx);
        this.client = client
        this.ctx = ctx
    }
    async track (eventName, optionalResponse) {
        log.trace(`tracking ${eventName}`);
        if (!this.ctx.from) {
            throw new Error("Can't find sender info")
        }
        // debug('🤖 track', eventName)
        // this.client.track(
        //     ChatbaseContext.getPayload(this.ctx),
        //     eventName
        // )

        try {
            const chatbaseMessage = this.client.newMessage().setUserId(this.ctx.from.username).setAsTypeUser().setMessageId(this.ctx.message.message_id)
            // .setCustomSessionId(ctx.meta.sessionId) // ERROR 500
                .setIntent(eventName)
                .setMessage(this.ctx.message.text);
            if (eventName === undefined) chatbaseMessage.setAsNotHandled();
            await chatbaseMessage.send();
            if (optionalResponse && optionalResponse !== '') {
                await this.client.newMessage().setUserId(this.ctx.from.username).setAsTypeAgent().setMessageId(this.ctx.message.message_id).setMessage(optionalResponse).send();
            }
        } catch (e) {
            log.error(e, `Request is made by ${this.ctx.from.username}`);
        }
    }
    static getPayload (ctx) {
        log.trace('getPayload')
        return ctx.callbackQuery ? ctx.callbackQuery : ctx.message
    }
}

module.exports = TelegrafChatbaseMiddleware;
