#!/bin/bash -e

files="`find ./pages -name '*.md' `"

for file in $files
do
	html="`echo "$file" | sed 's/\.md/.html/g' `"
	echo "pandoc --from markdown $file --to html -o $html"
done
