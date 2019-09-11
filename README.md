[![Published on NPM](https://img.shields.io/npm/v/@advanced-rest-client/arc-messages-service.svg)](https://www.npmjs.com/package/@advanced-rest-client/arc-messages-service)

[![Build Status](https://travis-ci.org/advanced-rest-client/arc-messages-service.svg?branch=stage)](https://travis-ci.org/advanced-rest-client/arc-messages-service)

[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/advanced-rest-client/arc-messages-service)


# arc-messages-service

A service to synchronize messages from service provider to app users.

The service queries ARC application server for new messages and stores in local data store. The messages are presented to the user in message center of Advanced REST Client.

## Usage

### Installation
```
npm install --save @advanced-rest-client/arc-messages-service
```

### In a LitElement

```js
import { LitElement, html } from 'lit-element';
import '@advanced-rest-client/arc-messages-service/arc-messages-service.js';

class SampleElement extends LitElement {
  render() {
    return html`
    <arc-messages-service
      platform="electron-app"
      channel="stable"
      automessages
      @messages-changed="${this._messagesHandler}"
      @unread-changed="${this._unreadHandler}"></arc-messages-service>
    `;
  }
}
customElements.define('sample-element', SampleElement);
```

Note that `unread` messages are included in `messages`.

To mark a message as read use `markRead()` function which takes message `key` property
as only argument. This operation changes size of `unread` property.

To mark all are read use `makrkAllRead()` function. This eventually clears `unread` array.

## Development

```sh
git clone https://github.com/advanced-rest-client/arc-messages-service
cd arc-messages-service
npm install
```

### Running the tests

```sh
npm test
```

## API components

This components is a part of [API components ecosystem](https://elements.advancedrestclient.com/)
