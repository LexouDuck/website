#!/bin/bash -e

navbar_folder()
{
	local shpath="$1"
	local folder="$2"
	local indent="$3"
	if [ -z "$indent" ]
	then printf "<div id=\"navbar\">\n"
	else printf "$indent<li>"
	fi
	(
	local path="$( echo "$shpath" | tr -d "." )"
	local children=""
	local has_children=false
	cd "$folder"
	# check how many subfolders there are
	for f in *
	do
		if [ -d "$f" ]
		then children="$children $f"
		fi
	done
	if ! [ -z "$( echo "$children" | tr -d "[:space:]" )" ]
	then has_children=true
	fi
	# check if is folder (node) or file (leaf)
	if ! [ -z "$indent" ]
	then
		if $has_children
		then printf " <span class=\"treeview_node\">▶</span>"
		else printf " <span class=\"treeview_leaf\">•</span>"
		fi
	fi
	# check if icon should be added
	if   [ -f "./icon.svg" ] ; then printf " <img class=\"icon svg\" src=\"$path/$folder/icon.svg\" />"
	elif [ -f "./icon.png" ] ; then printf " <img class=\"icon png\" src=\"$path/$folder/icon.png\" />"
	fi
	# write the main text hyperlink
	if [ -z "$indent" ]
	then printf "<h2>"
	fi
	local title="$( awk '/^# / { print substr($0, 3); exit; }' ./index.md )"
	printf " <a href=\"$path/$folder/index.html\">$title</a>"
	if [ -z "$indent" ]
	then printf "</h2>"
	fi
	printf "\n"
	# recurse into subfolders
	local nested=""
	if ! [ -z "$indent" ]
	then nested=" nested"
	fi
	if $has_children
	then
		printf "$indent<ul class=\"treeview$nested\">\n"
		for f in $children
		do
			navbar_folder "$shpath/$folder" "$f" "	$indent"
			children="$children $f"
		done
		printf "$indent</ul>\n"
	fi
	)
	if [ -z "$indent" ]
	then printf '</div>\n'
	else printf "$indent</li>\n"
	fi
}

navbar_folder . pages "" > ./templates/navbar.html
