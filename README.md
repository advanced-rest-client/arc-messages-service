[![Build Status](https://travis-ci.org/advanced-rest-client/arc-messages-service.svg?branch=stage)](https://travis-ci.org/advanced-rest-client/arc-messages-service)  

# arc-messages-service

Messages synchronization service for ARC

It gets the list of messages from ARC data store server and saves the list
of newly created messages in local indexed db. Leter calls to the service
will request for list of messages since last sync time.

### Example

```html
<arc-messages-service platform="electron"></arc-messages-service>
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

