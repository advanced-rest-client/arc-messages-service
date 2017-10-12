/**
 * @license
 * Copyright 2017 The Advanced REST client authors <arc@mulesoft.com>
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

(function() {
  'use strict';
  /* global self */
  const DB_VERSION = 1;

  const CLIENT_PORTS = '__clientPorts';
  const DB_NAME = '__dbName';
  const DB_OPENS = '__dbOpens';
  const STORE_NAMES = ['messages', 'meta'];

  var MIGRATIONS = [
    // v1
    function(context) {
      const msgs = context.database.createObjectStore(STORE_NAMES[0], {keyPath: 'key'});
      msgs.createIndex('time', 'time', {unique: true});
      msgs.createIndex('read', 'read', {unique: false});
      context.database.createObjectStore(STORE_NAMES[1]);
    }
  ];

  /**
   * Class that implements a worker process negotiates connections from clients
   * in other threads, and operates on an IndexedDB database object store.
   */
  class ArcMessagesServiceWorker {
    /**
     * @param {string=} _dbName The name of the IndexedDB database to create and
     * open.
     */
    constructor(_dbName) {
      _dbName = _dbName || 'arc-messages';
      this[DB_NAME] = _dbName;
      // Maybe useful in case we want to notify clients of changes..
      this[CLIENT_PORTS] = [];
      this[DB_OPENS] = null;
      this.openDb();
      self.addEventListener('unhandledrejection', function(error) {
        console.error(error);
      });
      self.addEventListener('error', function(error) {
        console.error(error);
      });
    }

    openDb() {
      this[DB_OPENS] = this[DB_OPENS] || new Promise((resolve, reject) => {
        var request = self.indexedDB.open(this[DB_NAME], DB_VERSION);
        request.onupgradeneeded = function(event) {
          console.log('Upgrade needed:', event.oldVersion, '=>', event.newVersion);
          var context = {
            database: request.result,
            dbName: this[DB_NAME]
          };

          for (var i = event.oldVersion; i < event.newVersion; ++i) {
            MIGRATIONS[i].call(this, context);
          }
        }.bind(this);

        request.onsuccess = function() {
          resolve(request.result);
        };
        request.onerror = function() {
          reject(request.error);
        };
      });

      return this[DB_OPENS];
    }

    closeDb() {
      if (this[DB_OPENS] === null) {
        return Promise.resolve();
      }

      return this.openDb().then((db) => {
        this[DB_OPENS] = null;
        db.close();
      });
    }

    /**
     * Perform a transaction on an IndexedDB object store.
     *
     * @param {string} operation The name of the method to call on the object
     * store instance.
     * @param {string} storeName The name of the object store to operate on.
     * @param {string} mode The mode of the transaction that will be performed.
     * @param {...*} operationArgs The arguments to call the method named by
     * the operation parameter.
     * @return {Promise} A promise that resolves when the transaction completes,
     * with the result of the transaction, or rejects if the transaction fails
     * with the error reported by the transaction.
     */
    operateOnStore(operation, storeName, mode, ...operationArgs) {
      return this.openDb()
      .then(db => {
        return new Promise(function(resolve, reject) {
          var transaction;
          var request;
          try {
            transaction = db.transaction(storeName, mode);
            var store = transaction.objectStore(storeName);
            request = store[operation].apply(store, operationArgs);
          } catch (e) {
            return reject(e);
          }
          transaction.oncomplete = function() {
            resolve(request.result);
          };
          transaction.onabort = function() {
            reject(transaction.error);
          };
        });
      });
    }

    keysFor(type) {
      const name = this.storeName(type);
      if (!name) {
        return Promise.reject(new Error('Type not supported: ' + type));
      }
      return this.listKeys(name);
    }

    listKeys(storeName) {
      return this.openDb()
      .then(db => {
        return new Promise(function(resolve, reject) {
          let transaction;
          let keys = [];
          try {
            transaction = db.transaction(storeName, 'readonly');
            let store = transaction.objectStore(storeName);
            let request = store.openKeyCursor();
            request.onsuccess = function(event) {
              let cursor = event.target.result;
              if (cursor) {
                keys.push(cursor.key);
                cursor.continue();
              }
            };
          } catch (e) {
            return reject(e);
          }
          transaction.oncomplete = function() {
            resolve(keys);
          };
          transaction.onabort = function() {
            reject(transaction.error);
          };
        });
      });
    }

    dataFor(type) {
      return this.dataForIndex(type);
    }

    dataForIndex(type, index, value) {
      const name = this.storeName(type);
      if (!name) {
        return Promise.reject(new Error('Type not supported: ' + type));
      }
      return this.listObjects(name, index, value);
    }

    listObjects(storeName, index, value) {
      /* global IDBKeyRange */
      return this.openDb()
      .then(db => {
        return new Promise(function(resolve, reject) {
          let transaction;
          let keys = [];
          try {
            transaction = db.transaction(storeName, 'readonly');
            let store = transaction.objectStore(storeName);

            let cursorSource;
            let range;
            if (index) {
              cursorSource = store.index(index);
              range = IDBKeyRange.only(value);
            } else {
              cursorSource = store;
            }

            let request = cursorSource.openCursor(range);
            request.onsuccess = function(event) {
              let cursor = event.target.result;
              if (cursor) {
                keys.push(cursor.value);
                cursor.continue();
              }
            };
          } catch (e) {
            return reject(e);
          }
          transaction.oncomplete = function() {
            resolve(keys);
          };
          transaction.onabort = function() {
            reject(transaction.error);
          };
        });
      });
    }

    /**
     * Perform a "get" operation on an IndexedDB object store.
     *
     * @param {string} storeName The name of the object store to operate on.
     * @param {string} key The key in the object store that corresponds to the
     * value that should be got.
     * @return {Promise} A promise that resolves with the outcome of the
     * operation.
     */
    get(storeName, key) {
      return this.operateOnStore('get', storeName, 'readonly', key);
    }

    /**
     * Perform a "put" operation on an IndexedDB object store.
     *
     * @param {string} storeName The name of the object store to operate on.
     * @param {string} key The key in the object store that corresponds to the
     * value that should be put.
     * @param {*} value The value to be put in the object store at the given key.
     * @return {Promise} A promise that resolves with the outcome of the
     * operation.
     */
    set(storeName, key, value) {
      return this.operateOnStore('put', storeName, 'readwrite', value, key);
    }

    /**
     * Perform a "clear" operation on an IndexedDB object store.
     *
     * @param {string} storeName The name of the object store to operate on.
     * @return {Promise} A promise that resolves with the outcome of the
     * operation.
     */
    clear(storeName) {
      return this.operateOnStore('clear', storeName, 'readwrite');
    }

    /**
     * Performs a transaction (in the parlance of the the client).
     *
     * @param {string} method The method of the transaction. Supported methods
     * are `"get"` and `"set"`.
     * @param {String} type Data type. Can be either `meta` or `data`.
     * @param {string} key The key to get or set.
     * @param {Object} value The value to set, when the method is `"set"`.
     * @return {Promise} A promise that resolves with the outcome of the
     * transaction, or rejects if an unsupported method is attempted.
     */
    transaction(method, type, key, value) {
      value = value || null;
      var store = this.storeName(type);
      if (!store) {
        return Promise.reject(new Error('Type not supported: ' + type));
      }
      switch (method) {
        case 'get':
          return this.get(store, key);
        case 'set':
          return this.set(store, key, value);
        case 'set-all':
          return this.bulkSet(store, key); // key is an array of values
      }
      return Promise.reject(new Error('Method not supported: ' + method));
    }
    /**
     * Adds many records to the data store in single transaction.
     *
     * @param {String} storeName Data store name
     * @param {Array<Object>} values List of objects to put into the store
     * @return {Promise} Promise resolved when operation is completed.
     */
    bulkSet(storeName, values) {
      return this.openDb()
      .then(db => {
        return new Promise(function(resolve, reject) {
          var transaction;
          try {
            transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            values.forEach(obj => {
              store.put(obj);
            });
          } catch (e) {
            return reject(e);
          }
          transaction.oncomplete = function() {
            resolve();
          };
          transaction.onabort = function() {
            reject(transaction.error);
          };
        });
      });
    }

    /**
     * Returns a store name for given data type.
     * @param {String} type Data type. Can be either `meta` or `data`.
     * @return {String|undefined} Store name for data type.
     */
    storeName(type) {
      var store;
      switch (type) {
        case 'meta': store = STORE_NAMES[1]; break;
        case 'data': store = STORE_NAMES[0]; break;
      }
      return store;
    }

    /**
     * Registers a client, represented by a MessagePort. The port is
     * presumed to be a direct, unshared channel to the client being registerd.
     *
     * @param {MessagePort} port The port that represents the client being
     * registered.
     */
    registerClient(port) {
      port.addEventListener('message', (event) => {
        this.handleClientMessage(event, port);
      });
      var isPortInClient = port.toString() in this[CLIENT_PORTS];
      if (!isPortInClient) {
        this[CLIENT_PORTS].push(port);
      }

      port.start();
      port.postMessage({
        payload: 'message-service-connected'
      });
    }

    /**
     * Triages messages received from a specific client, dispatches their
     * data to the appropriate methods and responds to the client if applicable.
     *
     * @param {MessageEvent} event The event that contains the message sent by
     * the client.
     * @param {MessagePort} port The port the represents the client the sent the
     * message.
     */
    handleClientMessage(event, port) {
      if (!event.data) {
        return null;
      }

      var id = event.data.id;
      switch (event.data.payload) {
        case 'message-service-close-db':
          this.closeDb()
          .then(function() {
            port.postMessage({payload: 'message-service-db-closed', 'id': id});
          });
        break;
        case 'message-service-transaction':
          let d = event.data;
          this.transaction(d.method, d.type, d.key, d.value)
          .then(function(result) {
            port.postMessage({
              payload: 'message-service-transaction-result',
              id: id,
              result: result
            });
          });
        break;
        case 'message-service-list-keys':
          this.keysFor(event.data.type)
          .then(function(result) {
            port.postMessage({
              payload: 'message-service-list-keys-result',
              id: id,
              result: result
            });
          });
        break;
        case 'message-service-list-objects':
          this.dataFor(event.data.type)
          .then(function(result) {
            port.postMessage({
              payload: 'message-service-list-objects-result',
              id: id,
              result: result
            });
          });
        break;
        case 'message-service-list-objects-index':
          this.dataForIndex(event.data.type, event.data.index, event.data.value)
          .then(function(result) {
            port.postMessage({
              payload: 'message-service-list-objects-index-result',
              id: id,
              result: result
            });
          });
        break;
        case 'message-service-disconnect':
          var index = this[CLIENT_PORTS].indexOf(port);
          if (index !== -1) {
            this[CLIENT_PORTS].splice(index, 1);
          }
        break;
      }
    }
  }

  self.messagesServiceWorker = new ArcMessagesServiceWorker();
  self.addEventListener('connect', function(event) {
    self.messagesServiceWorker.registerClient(event.ports[0]);
  });
})();
