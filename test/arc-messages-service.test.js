import { fixture, assert, aTimeout } from '@open-wc/testing';
import { MessagingServer } from './messages-server.js';
import '../arc-messages-service.js';

describe('<arc-messages-service>', function() {
  async function autoFixture() {
    return await fixture(`<arc-messages-service
      platform="chrome"
      channel="stable"
      automessages></arc-messages-service>`);
  }

  before(function() {
    MessagingServer.createServer();
  });

  after(function() {
    MessagingServer.restore();
  });

  const deleteDatastore = function() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase('arc-messages');
      request.onerror = function() {
        reject(new Error('Error deleting database'));
      };
      request.onsuccess = function() {
        console.log('CLEARING DATASTORE');
        resolve();
      };
      request.onblocked = function() {
        console.log('TRANSACTION BLOCKED. Whatev.');
        resolve();
      };
      request.onupgradeneeded = function() {
        resolve();
      };
    });
  };

  describe('processing messages', () => {
    let element;
    // suiteSetup(() => deleteDatastore());
    after(async () => {
      if (element) {
        await element.closeDb();
      }
      await deleteDatastore();
    });

    beforeEach(async () => {
      element = await autoFixture();
    });

    afterEach(async () => {
      await element.closeDb();
      await aTimeout();
    });

    async function untilUnread(element) {
      return new Promise((resolve) => {
        element.addEventListener('unread-changed', function clb(e) {
          element.removeEventListener('unread-changed', clb);
          resolve(e.detail.value);
        });
      });
    }

    it('Has messages', (done) => {
      element.addEventListener('messages-changed', function clb(e) {
        element.removeEventListener('messages-changed', clb);
        assert.typeOf(element.messages, 'array');
        done();
      });
    });

    it('Has unread', (done) => {
      element.addEventListener('unread-changed', function clb(e) {
        element.removeEventListener('unread-changed', clb);
        assert.typeOf(e.detail.value, 'array');
        done();
      });
    });

    it('marks message as read', async () => {
      const messages = await untilUnread(element);
      const length = messages.length;
      await element.markRead(messages[0].key);
      assert.equal(element.unread.length, length - 1);
    });

    it('marks all as read', async () => {
      await untilUnread(element);
      await element.makrkAllRead();
      assert.lengthOf(element.unread, 0);
    });
  });
});
