  'can convert a new plain model to a JSON POST': function() {
    // Backbone sync call convention:
    // .sync('create', model, { success: cb, error: cb })
    // .sync('update', model, { success: cb, error: cb })
    // .sync('patch', model, { success: cb, error: cb })
    //
    // Url is either in model.url or passed in as options.url

    // Expect:
    // POST /posts
    // Content-Type: application/json
    // Accept: application/json
    // { posts: [{ ... }] }


  },

  'can convert a plain model attribute change to a JSON PATCH': function() {

    // Expect:
    // PATCH /photos/1
    // Content-Type: application/json-patch+json
    //
    // [
    //  { "op": "replace", "path": "/src", "value": "http://example.com/hamster.png" }
    // ]


  },

  'can convert a new one-one relationship to a JSON PATCH': function() {

    // Expect:
    /*
    PATCH /photos/1
    Content-Type: application/json-patch+json
    Accept: application/json

    [
      { "op": "replace", "path": "/links/author", "value": 2 }
    ]
    */

  },

  'can convert a removal of a one-one relationship to a JSON PATCH': function() {

    /*
    PATCH /photos/1
    Content-Type: application/json-patch+json
    Accept: application/json

    [
      { "op": "remove", "path": "/links/author", "value": 2 }
    ]
    */


  },

  'can add a new one-many relationship to a JSON PATCH': function() {
    /*
    PATCH /photos/1

    [
      { "op": "add", "path": "/links/comments/-", "value": 30 }
    ]
    */

  },

  'can convert a removal of a one-many relationship to a JSON PATCH': function() {
    /*
    PATCH /photos/1

    [
      { "remove": "links/comments/5" }
    ]
    */
  },
