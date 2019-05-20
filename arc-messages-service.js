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
import {PolymerElement} from '../../@polymer/polymer/polymer-element.js';
import {afterNextRender} from '../../@polymer/polymer/lib/utils/render-status.js';
import '../../@polymer/iron-ajax/iron-ajax.js';
import {ArcMessagesServiceClient} from './arc-messages-service-client.js';
import {html} from '../../@polymer/polymer/lib/utils/html-tag.js';
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
export class ArcMessagesService extends PolymerElement {
  static get template() {
    return html`
    <style>
    :host {
      display: none !important;
    }
    </style>
    <iron-ajax url="[[_serviceUrl]]" auto="" handle-as="json" last-response="{{messagesResponse}}"></iron-ajax>`;
  }

  static get is() {
    return 'arc-messages-service';
  }

  static get importMeta() {
    return import.meta;
  }

  static get properties() {
    return {
      // Name of the platform to serve data from
      platform: String,
      /**
       * Application release channel.
       * Usually it's stable, beta and dev.
       */
      channel: String,
      // Messages endpoint URI
      endpointUri: {
        type: String,
        value: 'https://app.advancedrestclient.com/info/messages'
        // value: 'http://localhost:8080/info/messages'
      },
      // List of messages
      messages: {
        type: Array,
        notify: true
      },
      /**
       * List of unread messages
       */
      unread: {
        type: Array,
        notify: true
      },

      // Timestamp of last check opeartion
      lastChecked: {
        type: Number,
        notify: true
      },
      // List of query parameters to use with the request
      _queryParams: Object,
      // Full URL to the messages endpoint with parameters.
      _serviceUrl: {
        type: String,
        computed: '_computeServiceUrl(endpointUri, platform, channel, _queryParams)'
      },
      /**
       * A URL that points to the script to load for the corresponding
       * Worker instance that will be used for minimally-blocking operations
       * on IndexedDB.
       *
       * By default, this will be the path to
       * `app-indexeddb-mirror-worker.js` as resolved by
       * `Polymer.Base.resolveUrl` for the current element being created.
       */
      workerUrl: {
        type: String,
        value: function() {
          return this.resolveUrl('./arc-messages-service-worker.js');
        }
      },
      /**
       * An instance of `ArcMessagesServiceClient`, which is
       * responsible for negotiating transactions with the corresponding
       * Worker spawned from `workerUrl`.
       */
      client: {
        type: Object,
        computed: '__computeClient(workerUrl)',
        observer: '__clientChanged'
      },
      /**
       * Response ferom the ARC messages endpoint.
       */
      messagesResponse: Object,
      // If set it will read list of all mesages from the datastore
      autoMessages: Boolean
    };
  }

  static get observers() {
    return [
      '_lastCheckedChanged(lastChecked)',
      '_messagesResponseReady(messagesResponse)',
      '_updateState(messages.*)',
      '_updateState(unread.*)'
    ];
  }

  ready() {
    super.ready();
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
    if (this.__prohibitQuery) {
      this._storeChecked(lastChecked);
      return;
    }
    // Prohibits service URL observer to be called.
    this._queryParams = undefined;
    const urlParams = {};
    if (lastChecked && lastChecked !== 'never') {
      urlParams.since = lastChecked;
      urlParams.until = Date.now();
    }
    this.__prohibitQuery = true;
    this.lastChecked = Date.now();
    this.__prohibitQuery = false;
    this._queryParams = urlParams;
  }
  /**
   * Checkes when the DB was synchronized and sets `lastChecked` property
   * that triggest `iron-ajax` to request a data.
   */
  _whenChecked() {
    // this.lastChecked = 'never';
    this.client.transaction('get', 'meta', 'updatetime')
    .then((result) => {
      if (!result) {
        this.lastChecked = 'never';
      } else {
        this.lastChecked = result;
      }
    });
  }
  /**
   * Computes service URL depending on platform and url parameters
   *
   * @param {String} endpointUri API endpoint URI.
   * @param {String} platform Application platform
   * @param {String} channel Application release channel
   * @param {Object} params Additional query parameters
   * @return {String} Full URL to the messages service endpoint.
   */
  _computeServiceUrl(endpointUri, platform, channel, params) {
    if (!endpointUri || !platform || !params) {
      return;
    }
    let url = endpointUri + '?platform=' + platform;
    if (channel) {
      url += '&channel=' + channel;
    }
    Object.keys(params).forEach((name) => {
      url += '&' + name + '=' + encodeURIComponent(params[name]);
    });
    return url;
  }
  // Stores the information when last time checked for a messages.
  _storeChecked(when) {
    return this.client.transaction('set', 'meta', 'updatetime', when);
  }
  // Connectes the web worker client.
  __clientChanged(client) {
    return client.connect();
  }
  // Computes value for the client.
  __computeClient(workerUrl) {
    return new ArcMessagesServiceClient(workerUrl);
  }
  /**
   * This is called only when the response is ready, not when any of the
   * @param {Object} response
   * @return {Promise} [description]
   */
  _messagesResponseReady(response) {
    if (!response) {
      return;
    }
    return this.sync(response);
  }
  /**
   * Synchronizes incomming messages with the datastore.
   *
   * @param {Object} incommingMessages Response from ARC server.
   * @return {Promise}
   */
  sync(incommingMessages) {
    if (!incommingMessages.data || !incommingMessages.data.length) {
      return this.updateUnread();
    }
    return this.client.keys('data')
    .then((keys) => this._sync(incommingMessages.data, keys));
  }

  _sync(incommingMessages, existingKeys) {
    existingKeys = existingKeys || [];
    let insert = [];
    if (existingKeys.length === 0) {
      insert = incommingMessages;
    } else {
      insert = incommingMessages.filter((message) =>
        existingKeys.indexOf(message.key) === -1);
    }
    if (!insert.length) {
      return this.updateUnread();
    }
    insert.forEach((message) => message.read = 0);
    return this.client.transaction('set-all', 'data', insert)
    .then(() => this.updateUnread());
  }
  /**
   * Updates list of unread messages.
   *
   * @return {Promise}
   */
  updateUnread() {
    return this.client.indexObjects('data', 'read', 0)
    .then((result) => {
      this.set('unread', result);
      return result;
    })
    .then((unread) => {
      if (this.autoMessages) {
        afterNextRender(this, () => {
          this.readMessages();
        });
      }
      return unread;
    });
  }
  /**
   * Reads list of all messages from the data store.
   * It sets the `messages` property when ready.
   *
   * @return {Promise}
   */
  readMessages() {
    return this.client.listObjects('data')
    .then((messages) => {
      messages.sort(this._messagesSort);
      this.set('messages', messages);
      return messages;
    });
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
   * Updates a status of a message in the data store when a message
   * part changes. This only works when a single message in the array has been
   * updated (either `unread` or `messages`).
   *
   * @param {Object} record Polymer's change record
   * @return {Promise}
   */
  _updateState(record) {
    if (!record || !record.path || !record.base) {
      return;
    }
    if (['messages', 'unread'].indexOf(record.path) !== -1) {
      return;
    }
    const parts = record.path.split('.');
    const index = Number(parts[1]);
    if (index !== index) {
      return;
    }
    const dataType = parts[0];
    const item = this.get(`${dataType}.${index}`);
    if (!item || !item.key) {
      console.warn('Item not recognized for path ', record.path);
      return;
    }
    return this.client.transaction('set', 'data', undefined, item)
    .then(() => this._postUpdateMessage(dataType, item));
  }
  /**
   * Updates `unread` array depending on update state.
   *
   * @param {String} dataType Either `unread` or `messages`.
   * @param {Object} item Updated item object
   * @param {String} indexPath Polymer's data path index. It's `#index`.
   */
  _postUpdateMessage(dataType, item) {
    if (dataType === 'messages' && item.read === 0) {
      if (!this.unread) {
        this.unread = [];
      }
      this.push('unread', item);
      this.unread.sort(this._messagesSort);
      return;
    }
    if (dataType === 'unread' || item.read === 1) {
      let index = this.unread.findIndex((_obj) => _obj === item);
      if (index === -1) {
        console.warn('Message index not found');
        return;
      }
      this.splice(dataType, index, 1);
      return;
    }
  }
  /**
   * Closes datastore connection in shared worker.
   *
   * @return {Promise}
   */
  closeDb() {
    return this.client.closeDb();
  }
}
window.customElements.define('arc-messages-service', ArcMessagesService);