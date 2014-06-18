# mg - a model synchronization library

- Hydrates models with their 1:1 & 1:N associations. Models may be related to one or more other objects, and fetching each associated manually is painful.
- Ensures that only one instance exists for each model class + id pair. This ensures that updates made to a model in one part of a system are reflected in another.
- Data type assurance. Ensures that model properties with specific data types such as Dates and Regexps are always of the expected type.
- Cache preloading. Allows you to transmit a set of models as JSON data with your initial page load. These will be used from the cache, reducing the number of HTTP requests needed during page load.

-----

## Getting started

## Changelog

`v1.1.x`: The `collection` property on models is now called `collectionType` to avoid collisions with the Backbone `collection` property. If you receive an error such as "A "url" property or function must be specified", you are probably missing the collectionType property and hence attempting to fetch a plain Backbone.Collection.

### Define model relations

To set up `mg` hydration, define a `rels` property. For example, to have `Post.author` be hydrated as an instance of `Person`:

    var Post = Backbone.Model.extend({
      url: function()  {
        return '/posts/' + this.id;
      },
      collectionType: 'Posts', // <= collections of Post are created using the associated Collection (or Backbone.Collection by default)
      rels: {
        comment: { type: 'Comment' } // <= convert the comment field to a instance of Comment or a Collection of Comments
      }
    });

    mg.define('Post', Post);

    var Posts = Backbone.Collection.extend({
      url: '/posts'
    });

    mg.define('Posts', Posts);

The `mg.define()` call registers the model with hydration, so that relations can find the right model class and metadata.

`mg` supports both one-to-one, one-to-many and many-to-one relations. You do not need to explicitly define the type of relation, as it will be inferred from the JSON data.

### Find models and collections

`findById(name, id, rels, onDone)`: retrieves a model by id. Reads the model from `model.url` + `/` + `id`.

`stream(name, rels, onDone)`: retrieves a model by id. Reads the model from `model.url` + `/` + `id`.

Example:

    // Fetch a model
    // Note you can specify which related objects to load dynamically.
    mg.findById('Project', 1, { rels: 'Script' } function(err, project) {
        // And then retrieve those related objects using .get
        var script = project.get('script');
    });

    // Fetch a collection
    mg.stream('Post', { rels: 'Comment' } function(err, project) {
        // And then retrieve those related objects using .get
        var script = project.get('script');
    });

Alternatively, you can use `model.fetch()` and `collection.fetch()` and call `hydrate` on the result.

Example `model.fetch()`/`collection.fetch()`:

    project.fetch({ data: { rels: ['script', 'dataset'] }}).done(function(data) {
      mg.hydrate('Post', post, data);
      var script = project.get('script');
    });

The URL is determined using `model.url`, following the Backbone conventions.

Models are cached in-memory. This means that you should always use `.findById()`, since it will retrive the model from cache if possible.

### Link associated models

Example:

    // comment1 and comment2 are instances of Comment
    project.link([comment1, comment2], function(err) {
      // comment to project link has been saved
    });

Example:

    // comment1 is an instance of Comment
    project.unlink(comment1, function(err) {
      // comment to project link has been removed
    });
