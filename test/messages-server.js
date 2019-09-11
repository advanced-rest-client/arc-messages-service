/* global chance */
import 'chance/dist/chance.min.js';
import { fakeServer } from 'sinon/pkg/sinon-esm.js';
export const MessagingServer = {
  createServer: function() {
    this.srv = fakeServer.create({
      autoRespond: true
    });
    this.mock();
  },

  mock: function() {
    this.mockList();
  },

  mockList: function() {
    const url = /^https:\/\/app\.advancedrestclient\.com\/*/;
    this.srv.respondWith('GET', url, function(request) {
      const result = {
        data: []
      };
      for (let i = 0; i < 20; i++) {
        result.data.push(MessagingServer.createListObject());
      }
      request.respond(200, {}, JSON.stringify(result));
    });
  },

  createListObject: function() {
    const result = {
      key: chance.string(),
      message: 'test',
      time: chance.hammertime()
    };

    return result;
  },

  restore: function() {
    this.srv.restore();
  }
};
