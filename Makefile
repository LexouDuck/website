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

#! The tool used to convert .scss to .css
SCSS = sass
#! The tool used to convert .md to .html
PANDOC = pandoc
#! The tool used to host a local test server
PYTHON3 = python3



#! This rule runs a test server and opens the browser to the right URL
.PHONY:\
start
start: build
	@open http://localhost:4000/pages/index.html
	@python3 -m http.server 4000

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
	@$(SCSS) --version



#! This rule automatically generates an .html file from its corresponding .md file
%.html : %.md $(HTML_FRAME)
	@echo "Building $@..."
	@# fetch any external README.md files referenced, for webpage content
	@awk '\
	function command(cmd)\
	{\
		stdout = "";\
		stdout_line = "";\
		while (( cmd | getline stdout_line ) > 0)\
		{\
			if (length(stdout) == 0)\
			{ stdout = stdout_line; }\
			else\
			{ stdout = stdout "\n" stdout_line; }\
		}\
		close(cmd);\
		return (stdout);\
	}\
	\
	{\
		if (/^https:(.*)\/README\.md/)\
		{ print command("curl " $$0); }\
		else\
		{ print; }\
	}' $< \
	> $<.tmp
	@# convert the markdown source to html (with pipe table syntax extension)
	@$(PANDOC) --from markdown+pipe_tables $<.tmp --to html -o $@.tmp
	@# insert the generated HTML into the <body> of a copy of the frame.html file
	@awk -v filepath="$@.tmp" '\
	{\
		if (/%%%/)\
		{\
			while (getline line < filepath)\
			{\
				print line;\
			}\
		}\
		else { print; }\
	}' $(HTML_FRAME) \
	> $@
	@rm $<.tmp
	@rm $@.tmp
