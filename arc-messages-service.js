/**
@license
Copyright 2017 The Advanced REST client authors <arc@mulesoft.com>
Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.
*/
import { LitElement, html, css } from 'lit-element';
import { ArcMessagesServiceClient } from './arc-messages-service-client.js';
import '@polymer/iron-ajax/iron-ajax.js';
/**
Messages synchronization service for ARC

It gets the list of messages from ARC data store server and saves the list
of newly created messages in local indexed db. Leter calls to the service
will request for list of messages since last sync time.

### Example

```html
<arc-messages-service
  platform="electron"
  channel="stable"></arc-messages-service>
<script>
var service = document.querySelector('arc-messages-service');
service.addEventListener('unread-changed', function(e) {
  console.log('Unread messages list changed', e.detail.value);
  service.readMessages(); // Can be replaced with `auto-messages` property
});

service.addEventListener('messages-changed', function(e) {
  console.log('All messages list changed', e.detail.value);
});
</script>
```

@group Logic Elements
@element arc-messages-service
@demo demo/index.html
*/
export class ArcMessagesService extends LitElement {
  static get styles() {
    return css`:host {
      display: none !important;
    }`;
  }

  render() {
    const { _serviceUrl } = this;
    return html`
    <iron-ajax
      .url="${_serviceUrl}"
      auto
      handle-as="json"
      @last-response-changed="${this._messagesHandler}"></iron-ajax>`;
  }

  static get importMeta() {
    // return null;
    return import.meta;
  }

  static get properties() {
    return {
      // Name of the platform to serve data from
      platform: { type: String },
      /**
       * Application release channel.
       * Usually it's stable, beta and dev.
       */
      channel: { type: String },
      // Messages endpoint URI
      endpointUri: { type: String },
      // List of messages
      messages: { type: Array, notify: true },
      /**
       * List of unread messages
       */
      unread: { type: Array, notify: true },

      // Timestamp of last check opeartion
      lastChecked: { type: Number, notify: true },
      // List of query parameters to use with the request
      _queryParams: { type: Object },
      /**
       * A URL that points to the script to load for the corresponding
       * Worker instance that will be used for minimally-blocking operations
       * on IndexedDB.
       *
       * By default, this will be the path to
       * `app-indexeddb-mirror-worker.js` as resolved by
       * `Polymer.Base.resolveUrl` for the current element being created.
       */
      workerUrl: { type: String },
      /**
       * An instance of `ArcMessagesServiceClient`, which is
       * responsible for negotiating transactions with the corresponding
       * Worker spawned from `workerUrl`.
       */
      client: { type: Object },
      // If set it will read list of all message from the datastore
      autoMessages: { type: Boolean }
    };
  }

  get _serviceUrl() {
    const { endpointUri, platform, channel, _queryParams } = this;
    if (!endpointUri || !platform || !_queryParams) {
      return null;
    }
    let url = endpointUri + '?platform=' + platform;
    /* istanbul ignore else */
    if (channel) {
      url += '&channel=' + channel;
    }
    Object.keys(_queryParams).forEach((name) => {
      url += '&' + name + '=' + encodeURIComponent(_queryParams[name]);
    });
    return url;
  }

  get messages() {
    return this._messages;
  }

  set messages(value) {
    const old = this._messages;
    /* istanbul ignore if */
    if (old === value) {
      return;
    }
    this._messages = value;
    this.dispatchEvent(new CustomEvent('messages-changed', {
      detail: {
        value
      }
    }));
  }

  get unread() {
    return this._unread;
  }

  set unread(value) {
    const old = this._unread;
    /* istanbul ignore if */
    if (old === value) {
      return;
    }
    this._unread = value;
    this.dispatchEvent(new CustomEvent('unread-changed', {
      detail: {
        value
      }
    }));
  }

  constructor() {
    super();
    this.endpointUri = 'https://api.advancedrestclient.com/v1/messages';
    const workerUrl = new URL('./arc-messages-service-worker.js', ArcMessagesService.importMeta.url).toString()
    this.client = new ArcMessagesServiceClient(workerUrl);
    this.client.connect();
  }

  firstUpdated() {
    /* istanbul ignore else */
    if (!this.lastChecked) {
      this._whenChecked();
    }
  }
  /**
   * Computes `_queryParams` based on the value and stores assigned value
   * to the datastore.
   *
   * @param {Number} lastChecked Timestamp of last check time.
   */
  _lastCheckedChanged(lastChecked) {
    this._queryParams = undefined;
    const urlParams = {};
    if (lastChecked && lastChecked !== 'never') {
      urlParams.since = lastChecked;
      urlParams.until = Date.now();
    }
    this.lastChecked = Date.now();
    this._queryParams = urlParams;
    this._storeChecked(this.lastChecked);
  }
  /**
   * Checkes when the DB was synchronized and sets `lastChecked` property
   * that triggest `iron-ajax` to request a data.
   */
  async _whenChecked() {
    const result = await this.client.transaction('get', 'meta', 'updatetime')
    if (!result) {
      this.lastChecked = 'never';
    } else {
      this.lastChecked = result;
    }
    this._lastCheckedChanged(this.lastChecked);
  }
  // Stores the information when last time checked for a messages.
  async _storeChecked(when) {
    return await this.client.transaction('set', 'meta', 'updatetime', when);
  }
  /**
   * This is called only when the response is ready, not when any of the
   * @param {Object} response
   * @return {Promise} [description]
   */
  async _messagesResponseReady(response) {
    /* istanbul ignore if */
    if (!response) {
      return;
    }
    return await this.sync(response);
  }
  /**
   * Synchronizes incomming messages with the datastore.
   *
   * @param {Object} incommingMessages Response from ARC server.
   * @return {Promise}
   */
  async sync(incommingMessages) {
    if (!incommingMessages.items || !incommingMessages.items.length) {
      return this.updateUnread();
    }
    const keys = await this.client.keys('data')
    return await this._sync(incommingMessages.items, keys);
  }

  async _sync(incommingMessages, existingKeys) {
    existingKeys = existingKeys || [];
    let insert = [];
    if (existingKeys.length === 0) {
      insert = incommingMessages;
    } else {
      insert = incommingMessages.filter((message) =>
        existingKeys.indexOf(message.id) === -1);
    }
    if (!insert.length) {
      return await this.updateUnread();
    }
    insert.forEach((message) => message.read = 0);
    await this.client.transaction('set-all', 'data', insert)
    return await this.updateUnread();
  }
  /**
   * Updates list of unread messages.
   *
   * @return {Promise}
   */
  async updateUnread() {
    const unread = await this.client.indexObjects('data', 'read', 0);
    this.unread = unread;
    if (this.autoMessages) {
      setTimeout(() => this.readMessages());
    }
    return unread;
  }
  /**
   * Reads list of all messages from the data store.
   * It sets the `messages` property when ready.
   *
   * @return {Promise}
   */
  async readMessages() {
    const messages = await this.client.listObjects('data');
    messages.sort(this._messagesSort);
    this.messages = messages;
    return messages;
  }
  /**
   * Sort function for the messages.
   *
   * @param {Object} a
   * @param {Object} b
   * @return {Number}
   */
  _messagesSort(a, b) {
    if (a.time > b.time) {
      return -1;
    }
    if (a.time < b.time) {
      return 1;
    }
    return 0;
  }
  /**
   * Marks a single message as read.
   *
   * Note, this changes the `unread` property.
   *
   * @param {String} key Message key property
   * @return {Promise}
   */
  async markRead(key) {
    const unread = this.unread || [];
    const index = unread.findIndex((item) => item.key === key);
    if (index < 0) {
      return;
    }
    const message = unread[index];
    message.read = 1;
    await this.client.transaction('set', 'data', undefined, message);
    unread.splice(index, 1);
    this.unread = [...unread];
  }

  async makrkAllRead() {
    const unread = this.unread;
    if (!unread || !unread.length) {
      return;
    }
    unread.forEach((item) => item.read = 1);
    await this.client.transaction('set-all', 'data', unread);
    this.unread = [];
  }
  /**
   * Closes datastore connection in shared worker.
   *
   * @return {Promise}
   */
  async closeDb() {
    return await this.client.closeDb();
  }

  _messagesHandler(e) {
    this._messagesResponseReady(e.detail.value);
  }
}
window.customElements.define('arc-messages-service', ArcMessagesService);
