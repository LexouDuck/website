#!/bin/make

# Files

#! The list of markdown files which make up the contents of the website
SRCS = ./templates.md \
	$(wildcard ./pages/*.md) \
	$(wildcard ./pages/*/*.md) \
	$(wildcard ./pages/*/*/*.md) \
	$(wildcard ./pages/*/*/*/*.md) \
#! The list of generated html files, from SRCS markdown files
HTML = $(SRCS:%.md=%.html)
#! The file which contains the generic HTML code which is present on all pages
HTML_FRAME = ./frame.html

# Tools

#! The tool used to convert markdown to HTML
PANDOC = pandoc
#! The tool used to host a local test server
PYTHON3 = python3



#! This rule runs a test server and opens the browser to the right URL
.PHONY:\
start
start: build
	@open http://localhost:8000/pages/index.html
	@python3 -m http.server

#! This rule builds the HTML code for the website
.PHONY:\
build
build: $(HTML)
	@echo "Successfully generated all HTML files."

#! This rule deletes all generated files
.PHONY:\
clean
clean:
	@rm $(HTML)

#! This rule makes sure all prerequisite dev tools are installed
.PHONY:\
setup
setup:
	@$(PYTHON3) --version
	@$(PANDOC) --version



#! This rule automatically generates an .html file from its corresponding .md file
%.html : %.md $(HTML_FRAME)
	@echo "Building $@..."
	@$(PANDOC) --from markdown $< --to html -o $@.tmp
	@cat $(HTML_FRAME) | awk -v filepath="$@.tmp" '\
	{\
		if (/%%%/)\
		{\
			while (getline line < filepath)\
			{ print line; }\
		}\
		else { print; }\
	}' > $@
	@rm $@.tmp
