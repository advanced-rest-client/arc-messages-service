/* global sinon, chance */

const MessagingServer = {
  createServer: function() {
    this.srv = sinon.fakeServer.create({
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
      let result = {
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
      message: 'test'
    };

    return result;
  },

  restore: function() {
    this.srv.restore();
  }
};
