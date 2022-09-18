#!/bin/bash -e

files="./templates.md `find ./pages -name '*.md' `"

echo "Cleaning generated files..."
for file in $files
do
	temp="`echo "$file" | sed 's/\.md/.tmp/g' `"
	html="`echo "$file" | sed 's/\.md/.html/g' `"
	rm -f $temp
	rm -f $html
done
