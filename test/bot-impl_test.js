const assert = require('assert');
// const _ = require("underscore");
const log = require("log4js").getLogger(__filename.split('\\').pop().split('/').pop());
// const sinon = require('sinon');
const mockery = require('mockery');

const CommandMock = obj => (() => {
    return {
        invoke: () => {
            return {
                answer: () => {}
            }
        }
    }
})(obj);

const BotMock = obj => (() => {
    return {
        use: () => {},
        command: () => {
            return CommandMock();
        },
        texts: () => {}
    }
})(obj);
BotMock.sessionManager = {
    memory: () => {}
};


describe.skip("Bot impl", () => {
    let module;
    before(async () => {
        mockery.enable({
			warnOnUnregistered: false
		});
        let config = () => {
                return {
                    tlgbp: {}
                }
            },
            dataSource, currencyProfileFactory;
        mockery.registerMock('bot-brother', BotMock);
        module = await require('../lib/bot-impl')(config, dataSource, currencyProfileFactory);
    });

    after(() => {
        mockery.deregisterMock('bot-brother');
		mockery.disable();
    });

    it('renderHighestVolume should return formatted message', () => {
        log.info('STARTED');
        let array = [{
            volume: "512.57006087",
            pair: "BTC:USD",
			last: 1,
			priceChange: 1,
			priceChangePercentage: 1
        }];
        let cpMock = {
            parseAmount: (a, b) => b
        };
        const ret = module.visibleForTest.renderHighestVolume(array, cpMock);
        assert.deepStrictEqual(ret, { s1: 'BTC',
            s2: 'USD',
            pair: 'BTC:USD',
            volume: 512.57006087,
            last: 1,
            priceChange: 1,
            priceChangePercentage: 1 }
            );
    })
});

describe("Removing zeros", () => {
    let module;
    before(async () => {
        mockery.enable({
            warnOnUnregistered: false
        });
        let config = () => {
                return {
                    tlgbp: {},
                    redis_util: {}
                }
            },
            dataSource, currencyProfileFactory;
        mockery.registerMock('bot-brother', BotMock);
        module = await require('../lib/telegraf-impl')(config, dataSource, currencyProfileFactory);
    });

    after(() => {
        mockery.deregisterMock('bot-brother');
        mockery.disable();
    });

    it('removeTrailingZeros should remove zeros where required', () => {
        const given = ['2.00', '-0.01', '-0.010', (-1e-7).toFixed(8)];

        return given
            .map(it => module.visibleForTest.removeTrailingZeros(it))
            .map(it => assert.ok(!it.endsWith('0'), `${it} works wrong`))
    })
});
