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
    // http://api.advancedrestclient.com/v1/messages
    const url = /^https:\/\/api\.advancedrestclient\.com\/v1\/messages*/;
    this.srv.respondWith(url, function(request) {
      const result = {
        items: []
      };
      for (let i = 0; i < 20; i++) {
        result.items.push(MessagingServer.createListObject());
      }
      request.respond(200, {}, JSON.stringify(result));
    });
  },

  createListObject: function() {
    const result = {
      id: chance.string(),
      message: 'test',
      time: chance.hammertime()
    };

    return result;
  },

  restore: function() {
    this.srv.restore();
  }
};
