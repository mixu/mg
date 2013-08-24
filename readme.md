# m3 - a model synchronization library

- Hydrates models with their 1:1 & 1:N associations. Models may be related to one or more other objects, and fetching each associated manually is painful.
- Ensures that only one instance exists for each model class + id pair. This ensures that updates made to a model in one part of a system are reflected in another.
- Data type assurance. Ensures that model properties with specific data types such as Dates and Regexps are always of the expected type.
- Cache preloading. Allows you to transmit a set of models as JSON data with your initial page load. These will be used from the cache, reducing the number of HTTP requests needed during page load.

- Mass loading models. Related to hydration, this provides an interface for requesting a that bunch of models matching various queries are loaded before something happens (e.g. before a UI is drawn / bound). For example, loading the set of all users.
- Streaming updates to collections. Rather than cherrypicking individual models manually, this allows you to create a collection that is connected to the stream of events on the page. When new models are created, they are automatically added to the collection.

-----

## Getting started

`m3` uses regular Backbone models, but adds a few additional properties, a model registry and a model cache. To set up `m3` hydration, define additional properties on the model and set the `sync` function. For example:

    var Post = Backbone.Model.extend({
      sync: m3.sync('Post')
    });

    m3.define('Post', Post);

The `sync` function is added so that `m3` can intercept `model.sync()`, allowing it to detect when new models are created.

The `m3.define()` call registers the model with hydration, so that relations can find the right model class and metadata.

## Defining relations

To define relations, define the type of the related model on `.rels["keyname"]`. For example, to have `Post.author` be hydrated as an instance of `Person`:

    var Post = Backbone.Model.extend({
      rels: {
        author: { type: 'Person' }
      }
    });

    m3.define('Post', Post);

`m3` supports both one-to-one, one-to-many and many-to-one relations. You do not need to explicitly define the type of relation, as it will be inferred from the JSON data.

For example, given the following JSON data, a one-to-one relation is detected:

    m3.hydrate('Post', {
      id: 1,
      author: 1000
    }, function(err, model) { ... });

This would be hydrated with `.get('author')` set to the Person with `id=1000`. If that model is not available from the local cache, it is fetched before returning the hydrated model.

Given the following JSON data, a one-to-many relation is detected:

    m3.hydrate('Post', {
      id: 1,
      author: [ 200, 300 ]
    }, function(err, model) { ... });

This would be hydrated with `.get('author')` set to a `Backbone.Collection` instance containing the Person models with `id=200` and `id=300`.

## Fetching models: the find API

Often you don't have the

The find API makes backend calls to find model ids, and returns fully hydrated models. `model.url` is used to fetch models (you can set this as documented in the Backbone docs).

Models are cached in-memory. This means that you should always use `.findById()`, since it will retrive the model from cache if possible.

`findById(name, id, onDone)`: retrieves a model by id. Reads the model from `model.url` + `/` + `id`.

`findOne(name, conditions, onDone)`: retrieves a single model by any condition. Reads the model from `model.url` + `?` + `condition=value`.

`find(name, conditions, onDone)` / : retrieves a model by a set of conditions.

Alternatively, you can use `model.fetch()` ??

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

    m3.define('Post', Post);

    var Posts = Backbone.Collection.extend({
      // additional property
      special: true
    });

    m3.define('Posts', Posts);

## Validation API

    field: {
      validation: RegExp|function|array of RegExp/function,
    }

Validation is optional and separate from saving. Built in validators (inspired by [mongoose](http://mongoosejs.com/docs/validation.html)):

- `required: true` is builtin.
- Numbers have min and max validators
- Strings have enum and match validators

For example:

    rels: {
      type: Date
    }

To validate:

    var err = model.validate();

## Creating / reading / updating / deleting

How `m3` hooks into CRUD:

- Create: `m3` uses the `.sync` function to get notified of newly created instances once the backend returns a response that contains an id. These models are added to the cache, and any streaming collections are notified.
- Read: `m3` provides the `.find` and `.hydrate` APIs for reading in and hydrating related models
- Update: the normal `Backbone.sync` behavior takes place. Since `m3` ensures that only one instance of a class + id pair exists on the client side, any updates trigger events on the same instance of the model. For properties that are models or collections of models, `m3` hooks into the `.save` and triggers a save on the related collection or model (one level deep).
- Delete: `m3` should also remove the model from all collections and remove it from the cache.

## Save API

Saving collection add/remove actions; should be done when the model containing the relation collection is saved.

For properties that are models or collections of models, `m3` hooks into the `.save` and triggers a save on the related collection or model (one level deep).

## Cache API

`.store(name, value)`: inserts a JSON structure into the cache.

For example, to store a JSON structure in order to preload a model:

    cache.store('test', { id: 7000, name: 'bar' });

`.fetch(name, uri, onDone)`: fetches a JSON structure from a remote URL.

`.keys(name)`: returns all the cache keys (e.g. model ids).

`.get(name, id, onDone)`: fetches a JSON structure by id (either remote or local).

`.local(name, id)`: returns `true` if a model is locally cached.

If a request is already pending to a particular URL, then the cache will not start a new request. Instead, the

## Remapping

    module.exports = {
      // inline define
      Post: m3.define('Post', Backbone.Model.extend({
        sync: m3.sync('Post'),
        plural: 'posts'
      })),
      // easier getter
      posts: function(conditions, onDone) {
        return m3.find('Post', conditions, onDone);
      }
    };


## Streaming collections

Streaming collections make it easy to track all instances of a specific type.

`stream(name, conditions, onLoaded)`
