#!/bin/make

# Files

#! The list of markdown files which make up the contents of the website
CONTENTS = \
	$(wildcard ./pages/*.md) \
	$(wildcard ./pages/*/*.md) \
	$(wildcard ./pages/*/*/*.md) \
	$(wildcard ./pages/*/*/*/*.md) \

CONTENTS_HTML = $(CONTENTS:%.md=%.html)

#! The list of source markdown files which become HTML template components
TEMPLATES = \
	./templates/head.md \
	./templates/header.md \
	./templates/footer.md \
	./templates/navbar.md \

TEMPLATES_HTML = $(TEMPLATES:%.md=%.html)

#! The file which contains the generic HTML template code which reoccurs throughout the website
HTML_FINAL = ./templates.html

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
build: $(HTML_FINAL) $(CONTENTS_HTML)
	@echo "Successfully generated all HTML files."

#! This rule deletes all generated files
.PHONY:\
clean
clean:
	@rm $(CONTENTS_HTML) $(TEMPLATES_HTML)

#! This rule makes sure all prerequisite dev tools are installed
.PHONY:\
setup
setup:
	@$(PYTHON3) --version
	@$(PANDOC) --version
	@$(SCSS) --version



#! This rule creates the final templates.html file
$(HTML_FINAL): $(TEMPLATES_HTML)
	@echo "Building $@"
	@echo "" > $(HTML_FINAL)
	@for file in $(TEMPLATES_HTML) ; do \
		printf "\n\n\n" >> $(HTML_FINAL) ; \
		cat  "$${file}" >> $(HTML_FINAL) ; \
	done

#! This rule automatically generates the website navigation menu, by looking through the ./pages folders
./templates/navbar.md: ./navbar.sh
	@echo "Generating navigation bar..."
	@./navbar.sh

#! This rule automatically generates a template .html file from its corresponding .md file
./templates/%.html: ./templates/%.md
	@echo "Building template: $@"
	@# convert the markdown source to html (with pipe table syntax extension)
	@$(PANDOC) --from markdown+pipe_tables $< --to html -o $@
	@# post-processing to fix the navbar html since it has a peculiar <ul> list
	@if [ "$(basename $(notdir $@))" = "navbar" ] ;\
	then awk '{ gsub(/<ul>/, ""); if (length($0)) { print; } }' $@ > $@.tmp && mv $@.tmp $@ ;\
	fi

#! This rule automatically generates an .html file from its corresponding .md file
./pages/%.html: ./pages/%.md $(HTML_FRAME)
	@echo "Building content: $@"
	@# fetch any external README.md files referenced, for webpage content
	@awk -v filepath="$@" -v currentdir="` dirname "$@" `" '\
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
		if ($$1 == "%%%")\
		{\
			if ($$2 == "folder")\
			{\
				split(command("ls -F " currentdir " | grep \"/$$\""), folders, "\n");\
				for (f in folders)\
				{\
					print "cat " currentdir "/" folders[f] "index.md" > "/dev/stderr";\
					print "";\
					print "---------";\
					print "";\
					content = command("cat " currentdir "/" folders[f] "index.md");\
					print substr(content, 1, index(content, "\n\n---"));\
					print "[Read more...](" currentdir "/" folders[f] "index.html" ")";\
				}\
			}\
			else if ($$2 ~ /https:(.*)/)\
			{\
				print command("curl " $$2);\
			}\
		}\
		else { print; }\
	}' $< \
	> $<.tmp
	@# convert the markdown source to html (with pipe table syntax extension)
	@$(PANDOC) --from markdown+pipe_tables $<.tmp --to html -o $@.tmp
	@# insert the generated HTML into the <body> of a copy of the frame.html file
	@awk -v filepath="$@.tmp" '\
	{\
		if ($$1 == "%%%")\
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
