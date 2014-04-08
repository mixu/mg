TESTS += test/ajax.test.js
TESTS += test/cache.test.js
TESTS += test/hydrate.test.js
TESTS += test/integration.test.js
TESTS += test/model-extensions.test.js
TESTS += test/notify_local.test.js
TESTS += test/validation.test.js

test:
	@mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)

build:
	./node_modules/gluejs/bin/gluejs \
		--include ./lib \
		--include ./index.js \
		--include ./node_modules/microee \
		--include ./node_modules/miniq \
		--exclude package.json \
		--replace backbone=window.Backbone \
		--replace minilog=window.Minilog \
		--global mg \
		--main index.js \
		--out dist/mg.js

build-min:
	./node_modules/gluejs/bin/gluejs \
		--include ./lib \
		--include ./index.js \
		--include ./node_modules/microee \
		--include ./node_modules/miniq \
		--exclude package.json \
		--replace backbone=window.Backbone \
		--replace minilog=window.Minilog \
		--command 'uglifyjs --no-copyright' \
		--global mg \
		--main index.js \
		--out dist/mg.js

build-debug:
	./node_modules/gluejs/bin/gluejs \
		--include ./lib \
		--include ./index.js \
		--include ./node_modules/microee \
		--include ./node_modules/miniq \
		--exclude package.json \
		--replace backbone=window.Backbone \
		--replace minilog=window.Minilog \
		--global mg \
		--main index.js \
		--source-url \
		--out dist/mg.js

lint:
	jshint .
	gjslint --nojsdoc --jslint_error=all --exclude_directories=node_modules,dist -r .

style:
	jshint index.js server.js lib

.PHONY: test build build-debug style
