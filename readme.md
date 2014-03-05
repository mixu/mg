# mg - a model synchronization library

- Hydrates models with their 1:1 & 1:N associations. Models may be related to one or more other objects, and fetching each associated manually is painful.
- Ensures that only one instance exists for each model class + id pair. This ensures that updates made to a model in one part of a system are reflected in another.
- Data type assurance. Ensures that model properties with specific data types such as Dates and Regexps are always of the expected type.
- Cache preloading. Allows you to transmit a set of models as JSON data with your initial page load. These will be used from the cache, reducing the number of HTTP requests needed during page load.

- Mass loading models. Related to hydration, this provides an interface for requesting a that bunch of models matching various queries are loaded before something happens (e.g. before a UI is drawn / bound). For example, loading the set of all users.
- Streaming updates to collections. Rather than cherrypicking individual models manually, this allows you to create a collection that is connected to the stream of events on the page. When new models are created, they are automatically added to the collection.

-----

## Getting started

### 1. Define model relations

To set up `mg` hydration, define a `rels` property. For example, to have `Post.author` be hydrated as an instance of `Person`:

    var Post = Backbone.Model.extend({
      rels: {
        author: { type: 'Person' }
      }
    });

    mg.define('Post', Post);

The `mg.define()` call registers the model with hydration, so that relations can find the right model class and metadata.

`mg` supports both one-to-one, one-to-many and many-to-one relations. You do not need to explicitly define the type of relation, as it will be inferred from the JSON data.

For example, given the following JSON data, a one-to-one relation is detected:

    mg.hydrate('Post', {
      id: 1,
      author: {
        id: 100,
        name: 'Foo'
      }
    }, function(err, model) { ... });

This would be hydrated with `.get('author')` set to the Person with `id=1000`. If that model is not available from the local cache, it is fetched before returning the hydrated model.

Given the following JSON data, a one-to-many relation is detected:

    mg.hydrate('Post', {
      id: 1,
      author: [ { id: 123, ... }, { ... } ]
    }, function(err, model) { ... });

### 2. Find models and collections

`findById(name, id, rels, onDone)`: retrieves a model by id. Reads the model from `model.url` + `/` + `id`.

`stream(name, rels, onDone)`: retrieves a model by id. Reads the model from `model.url` + `/` + `id`.

Alternatively, you can use

`model.fetch()`

`collection.fetch()`

The URL is determined using `model.url`, following the Backbone conventions.

Models are cached in-memory. This means that you should always use `.findById()`, since it will retrive the model from cache if possible.

### 3. Link associated models




## Hydration API

The hydration API allows you to take data loaded via some other channel, and hydrate it.

`hydrate(name, data, onDone)`: hydrate an existing JSON blob (with related model hydration).

Hydration fetches all related models and finally calls `onDone` with `err, result`.

## Defining data types for hydration

To define data types for models and validation:

    field: {
      type: Number|Boolean|RegExp|Date|'Person',
      default: (value)
    }

When fields have a defined data type, the hydration layer ensure that the values are of the correct type (e.g. ensuring that numbers are numbers, booleans are booleans and RegExps are regexps).

## Setting the collection class

By default, collections of Post models are contained inside a Backbone.Collection. However, your can define a different container class if you prefer (e.g. with Post-specific collection methods).

    var Post = Backbone.Model.extend({
      collection: 'Posts',
    });

    mg.define('Post', Post);

    var Posts = Backbone.Collection.extend({
      // additional property
      special: true
    });

    mg.define('Posts', Posts);

## Creating / reading / updating / deleting

How `mg` hooks into CRUD:

- Create: `mg` uses the `.sync` function to get notified of newly created instances once the backend returns a response that contains an id. These models are added to the cache, and any streaming collections are notified.
- Read: `mg` provides the `.find` and `.hydrate` APIs for reading in and hydrating related models
- Update: the normal `Backbone.sync` behavior takes place. Since `mg` ensures that only one instance of a class + id pair exists on the client side, any updates trigger events on the same instance of the model. For properties that are models or collections of models, `mg` hooks into the `.save` and triggers a save on the related collection or model (one level deep).
- Delete: `mg` should also remove the model from all collections and remove it from the cache.

## Save API

Saving collection add/remove actions; should be done when the model containing the relation collection is saved.

For properties that are models or collections of models, `mg` hooks into the `.save` and triggers a save on the related collection or model (one level deep).

## Cache API

`.store(name, value)`: inserts a JSON structure into the cache.

For example, to store a JSON structure in order to preload a model:

    cache.store('test', { id: 7000, name: 'bar' });

`.fetch(name, uri, onDone)`: fetches a JSON structure from a remote URL.

`.keys(name)`: returns all the cache keys (e.g. model ids).

`.get(name, id, onDone)`: fetches a JSON structure by id (either remote or local).

`.local(name, id)`: returns `true` if a model is locally cached.

If a request is already pending to a particular URL, then the cache will not start a new request. Instead, the

-----

## High level API

`mg.findById(name, { id: 1, rels: rels }, onDone)`: find a model by id

`model.fetch({ rels: '...', success: function(model, response, options){ }, error: ... })`: ensure that the given rels are loaded, return jqXHR

`model.get(rel)`: throws an error if the related model has not been loaded

`model.link(instances, onDone)`: perform a REST call to link the given instances to the model

`model.unlink(instances, onDone)`: perform a REST call to unlink the given instances from the model

Changes:

- model.get needs to become relationship aware
- hydration needs to become boundary aware
- cache prefilling
- cache invalidation
- skipping cache
- .plural is deprecated

## Low level API

`hydrate(name, json, onDone)`

    new Hydration()
      .filter(function(parent, child) {
        if(parent.model == origClass && parent.id == origModel &&
           child.model in rels) {
            return true;
        }
        return false;
      })
      .addJson(json)
      .exec(onDone)

-----

Cacheable: single fetch by id
Uncacheable: collection fetch (due to sorting etc.)

done(data)

