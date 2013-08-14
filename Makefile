TESTS += test/*.test.js

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

build-debug:
	./node_modules/gluejs/bin/gluejs \
		--include ./lib \
		--include ./index.js \
		--include ./node_modules/microee \
		--replace backbone=window.Backbone \
		--replace minilog=window.Minilog \
		--global mmm \
		--main index.js \
		--source-url \
		--out dist/mmm.js

style:
	jshint index.js server.js lib

.PHONY: test build build-debug style
