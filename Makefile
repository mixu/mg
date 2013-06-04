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
		--global mmm \
		--main index.js \
		--source-url \
		--nocommand 'uglifyjs --no-copyright' \
		--out dist/mmm.js

.PHONY: test build
