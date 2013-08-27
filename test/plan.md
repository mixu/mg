# mg testing plan

- Implement a .get() function that supports paths so that long chains of gets do not need a million checks
  - Ensure that if the field is type:string but empty, the result is an empty string
  - Ensure that if the field is type:object but empty, the result is ?? something with a getter?
  - Ensure that if the field is type:collection but empty, the results is a collection
  - Ensure that if the field is type:array but empty, the result is an array
- Allow the .get function to also traverse arrays and collections (equivalently)
  - ?? when content changes ??
- Allow the .get function to also access object properties and model properties (equivalently)
  - .. and object properties of an array / collection
  - .. and model properties of a collection / an array
- Figure out how to handle the case where if a get path is not empty, we should do a thing (e.g. like returning from a ternary or iterating a collection)
- Test the ability to specify an arbitrary set of objects as dependencies and a onDone function
- Test the ability to stream two collections from the same set of criteria, but apply a sort on only one of them.
- Test optional validation based on field types (+ required)
- Test offering models fetched from nonstandard endpoints (e.g. /datasources/uploads) into the cache
- Test hydrating collections of models from nonstandard/bulk endpoints where the models are already in the cache
- Test loading from a serialized format (e.g. for initial load)
- Test custom parse actions, such as instantiating a custom model from an object structure
- Test re-serializing hydrated models to JSON (particularly after adding / removing associated models)
- Allow hydrating from a custom endpoint, where the URL is given by the user and the result JSON is either a single model or a collection
- Test reverse associations (e.g. script.projectId <=> project.scripts)

# Refactoring plan

## HTTP adapters

- ajax.js: environment-specific shim with environment-specific defaults
- http/rest-client.js: RESTful HTTP client (different adapter for JSON-API)
- http/rest-server.js: RESTful server

## Data storage

- cache.js: in-memory storage
- meta.js: metadata store (e.g. relation definition lookup)

## Data processing

- hydrate.js: uses cache to get items, performs hydration
- stream.js: indirection layer for events related to a specific type of model. Updated from cache (find*) and from sync (save).

# All tests

## Cache

- can initialize the cache from a json blob
- can store() and get() a model
- fetching a stored model gets from the cache
- fetching a model thats not available causes a external fetch
- storing an existing model causes it to be updated

## Hydrate

- hydrate values...
  - date string as date object
  - empty date as a 1970's date object
  - regexp string as regexp object
  - empty regexp as regexp object
  - hydrate a default value

- hydrate associations...
  - a model with no associations
  - an array of no-assoc models
  - a model with an association
  - a model with two associations
  - a model with an association that has a child association
  - a model with a circular association
  - if the model to be hydrated exists in cache, then update and reuse the cached model

## Integration tests

- given a simple model
  - can find by id
  - multiple find calls return same instance
  - hydration
    - can hydrate a one-one relationship
    - can hydrate a one-many relationship to a array
    - can hydrate a collection of individual models from a stream
    - can hydrate a collection of one-many relationship models from a stream
    - when hydrating a collection of items and the collection is empty, do not create any models
  - find(..., [id1, id2], ...) should be interpreted as findById
  - will wait properly for a pending request to complete rather than launching multiple requests

## Notify

- given two subscriptions to a model by id
  - model
    - can get notified of a change on the original instance
  - collection
    - can be notified of newly available model after save
    - can be notified of newly deleted model after destroy

## http/json-client

- can convert a new plain model to a JSON POST
- can convert a plain model attribute change to a JSON PATCH
- can convert a new one-one relationship to a JSON PATCH
- can convert a removal of a one-one relationship to a JSON PATCH
- can add a new one-many relationship to a JSON PATCH
- can convert a removal of a one-many relationship to a JSON PATCH

## http/rest-server

- reading items
  - can read /item/:id
  - can read /item?ids=:id1,:id2
  - can read /item/:id1,:id2
- creating, updating, deleting
  - can create a new item via POST /comments
  - can update a item via PATCH+replace /comments
  - can associate a item via PATCH+add /posts
  - can remove an association via PATCH+remove /posts
  - can delete a item via DELETE /posts/id
