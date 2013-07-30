TESTS += test/fetch.test.js
TESTS += test/notify_local.test.js

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
		--replace backbone=window.Backbone \
		--replace minilog=window.Minilog \
		--global mmm \
		--main index.js \
		--out dist/mmm.js

case:

	./node_modules/gluejs/bin/gluejs \
		--basepath ./ \
		--include ./lib \
		--include ./index.js \
		--include ./node_modules/microee \
		--include ./node_modules/assert \
		--exclude /tests/ \
		--verbose \
		--replace backbone=window.Backbone \
		--replace minilog=window.Minilog \
		--global mmm \
		--main lib/case.js \
		--out dist/case.js

# disabled:
#		--source-url \
#		--nocommand 'uglifyjs --no-copyright' \

.PHONY: test build case
