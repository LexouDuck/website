#!/bin/bash -e

files="./templates.md `find ./pages -name '*.md' `"

for file in $files
do
	temp="`echo "$file" | sed 's/\.md/.tmp/g' `"
	html="`echo "$file" | sed 's/\.md/.html/g' `"
	echo "Building $html..."
	pandoc --from markdown $file --to html -o $temp
	cat ./frame.html | awk -v filepath="$temp" '
	{
		if (/%%%/)
		{
			while (getline line < filepath)
			{ print line; }
		}
		else { print; }
	}' > $html
done
