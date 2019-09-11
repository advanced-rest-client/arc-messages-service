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
const WORKER_URL = '__workerUrl';
const CONNECTS_TO_WORKER = '__connectsToWorker';
const CONNECTED = '__connected';
const MESSAGE_ID = '__messageId';

export class ArcMessagesServiceClient {
  constructor(workerUrl) {
    this[WORKER_URL] = workerUrl;
    this[CONNECTED] = false;
    this[MESSAGE_ID] = 0;
    this[CONNECTS_TO_WORKER] = null;
  }

  /**
   * Sends a message to the worker and awaits and handles a corresponding
   * response.
   *
   * @param {*} message Any value that can be sent via `postMessage` to the
   * worker.
   * @return {Promise} A promise that resolves when a corresponding response
   * message has been received by from the worker. Requests are given a
   * unique ID, so the first worker response that echos this ID will be
   * used to resolve the promise.
   */
  post(message) {
    return this.connect()
    .then((worker) => this._postImpl(message, worker));
  }

  _postImpl(message, worker) {
    return new Promise((resolve) => {
      const id = this[MESSAGE_ID]++;
      const port = worker.port;
      port.addEventListener('message', function onMessage(event) {
        if (event.data && event.data.id === id) {
          port.removeEventListener('message', onMessage);
          resolve(event.data.result);
        }
      });
      message.id = id;
      port.postMessage(message);
    });
  }

  /**
   * Requests that the worker perform a transaction (supported verbs are
   * `get` and `set`) against a provided `key` and optional `value` in the
   * IndexedDB object store.
   *
   * @param {string} method The method of the transaction (`"get"` or
   * `"set"`)
   * @param {String} type Data type. Can be either `meta` or `data`.
   * @param {string} key The key in the IndexedDB object store to operate
   * on.
   * @param {Object} value The value to set at `key`, if using the `"set"`
   * `method`.
   * @return {Promise} A promise that resolves when the worker indicates
   * that the transaction has completed.
   */
  transaction(method, type, key, value) {
    return this.post({
      payload: 'message-service-transaction',
      type: type,
      method: method,
      key: key,
      value: value
    });
  }

  keys(type) {
    return this.post({
      payload: 'message-service-list-keys',
      type: type
    });
  }

  listObjects(type) {
    return this.post({
      payload: 'message-service-list-objects',
      type: type
    });
  }

  indexObjects(type, index, value) {
    return this.post({
      payload: 'message-service-list-objects-index',
      type: type,
      index: index,
      value: value
    });
  }

  closeDb() {
    return this.post({
      payload: 'message-service-close-db'
    });
  }

  /**
   * Instantiates (if necessary) and connects to the backing worker
   * instance.
   *
   * @return {Promise} A promise that resolves when the worker has been
   * created and a handshake has been returned. The worker is an instance
   * of `SharedWorker` (if available), or else `Polymer.CommonWorker`.
   */
  connect() {
    if (this[CONNECTED] || this[CONNECTS_TO_WORKER]) {
      return this[CONNECTS_TO_WORKER];
    }
    this[CONNECTS_TO_WORKER] = this._connectImpl();
    return this[CONNECTS_TO_WORKER];
  }

  _connectImpl() {
    return new Promise((resolve) => {
      const worker = new SharedWorker(this[WORKER_URL]);
      worker.port.addEventListener('message', (event) => {
        if (event.data && event.data.payload === 'message-service-connected') {
          this[CONNECTED] = true;
          resolve(worker);
        }
      });
      worker.addEventListener('error', function(error) {
        /* eslint-disable-next-line */
        console.error(error.message || error);
      });
      worker.port.start();
      worker.port.postMessage({
        payload: 'message-service-connect'
      });
    });
  }
}
