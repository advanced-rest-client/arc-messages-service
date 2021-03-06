/**
 * DO NOT EDIT
 *
 * This file was automatically generated by
 *   https://github.com/Polymer/tools/tree/master/packages/gen-typescript-declarations
 *
 * To modify these typings, edit the source file(s):
 *   arc-messages-service.js
 */


// tslint:disable:variable-name Describing an API that's defined elsewhere.
// tslint:disable:no-any describes the API as best we are able today

import {LitElement, html, css} from 'lit-element';

import {ArcMessagesServiceClient} from './arc-messages-service-client.js';

export {ArcMessagesService};

/**
 * Messages synchronization service for ARC
 *
 * It gets the list of messages from ARC data store server and saves the list
 * of newly created messages in local indexed db. Leter calls to the service
 * will request for list of messages since last sync time.
 *
 * ### Example
 *
 * ```html
 * <arc-messages-service
 *   platform="electron"
 *   channel="stable"></arc-messages-service>
 * <script>
 * var service = document.querySelector('arc-messages-service');
 * service.addEventListener('unread-changed', function(e) {
 *   console.log('Unread messages list changed', e.detail.value);
 *   service.readMessages(); // Can be replaced with `auto-messages` property
 * });
 *
 * service.addEventListener('messages-changed', function(e) {
 *   console.log('All messages list changed', e.detail.value);
 * });
 * </script>
 * ```
 */
declare class ArcMessagesService extends LitElement {
  readonly _serviceUrl: any;

  /**
   * List of messages
   */
  messages: any[]|null|undefined;

  /**
   * List of unread messages
   */
  unread: any[]|null|undefined;

  /**
   * Name of the platform to serve data from
   */
  platform: string|null|undefined;

  /**
   * Application release channel.
   * Usually it's stable, beta and dev.
   */
  channel: string|null|undefined;

  /**
   * Messages endpoint URI
   */
  endpointUri: string|null|undefined;

  /**
   * Timestamp of last check opeartion
   */
  lastChecked: number|null|undefined;

  /**
   * List of query parameters to use with the request
   */
  _queryParams: object|null|undefined;

  /**
   * A URL that points to the script to load for the corresponding
   * Worker instance that will be used for minimally-blocking operations
   * on IndexedDB.
   *
   * By default, this will be the path to
   * `app-indexeddb-mirror-worker.js` as resolved by
   * `Polymer.Base.resolveUrl` for the current element being created.
   */
  workerUrl: string|null|undefined;

  /**
   * An instance of `ArcMessagesServiceClient`, which is
   * responsible for negotiating transactions with the corresponding
   * Worker spawned from `workerUrl`.
   */
  client: object|null|undefined;

  /**
   * If set it will read list of all message from the datastore
   */
  autoMessages: boolean|null|undefined;
  constructor();
  firstUpdated(): void;
  render(): any;

  /**
   * Computes `_queryParams` based on the value and stores assigned value
   * to the datastore.
   *
   * @param lastChecked Timestamp of last check time.
   */
  _lastCheckedChanged(lastChecked: Number|null): void;

  /**
   * Checkes when the DB was synchronized and sets `lastChecked` property
   * that triggest `iron-ajax` to request a data.
   */
  _whenChecked(): any;

  /**
   * Stores the information when last time checked for a messages.
   */
  _storeChecked(when: any): any;

  /**
   * This is called only when the response is ready, not when any of the
   *
   * @returns [description]
   */
  _messagesResponseReady(response: object|null): Promise<any>|null;

  /**
   * Synchronizes incomming messages with the datastore.
   *
   * @param incommingMessages Response from ARC server.
   */
  sync(incommingMessages: object|null): Promise<any>|null;
  _sync(incommingMessages: any, existingKeys: any): any;

  /**
   * Updates list of unread messages.
   */
  updateUnread(): Promise<any>|null;

  /**
   * Reads list of all messages from the data store.
   * It sets the `messages` property when ready.
   */
  readMessages(): Promise<any>|null;

  /**
   * Sort function for the messages.
   */
  _messagesSort(a: object|null, b: object|null): Number|null;

  /**
   * Marks a single message as read.
   *
   * Note, this changes the `unread` property.
   *
   * @param key Message key property
   */
  markRead(key: String|null): Promise<any>|null;
  makrkAllRead(): any;

  /**
   * Closes datastore connection in shared worker.
   */
  closeDb(): Promise<any>|null;
  _messagesHandler(e: any): void;
}

declare global {

  interface HTMLElementTagNameMap {
    "arc-messages-service": ArcMessagesService;
  }
}
