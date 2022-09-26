#!/bin/bash -e

navbar_folder()
{
	local shpath="$1"
	local folder="$2"
	local indent="$3"
	# begin list item
	if [ -z "$indent" ]
	then printf "<div id=\"navbar\">\n"
	else printf "$indent-   "
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
	# check if there is a cutom sort order for folders
	if [ -f "./sort.txt" ]
	then children="$( cat sort.txt | xargs )"
	fi
	# check if is folder (node) or file (leaf)
	if [ -z "$indent" ]
	then printf "## "
	else
		if $has_children
		then printf "[▶]{.treeview_node} "
		else printf "[•]{.treeview_leaf} "
		fi
	fi
	# check if icon should be added
	if   [ -f "./icon.svg" ] ; then printf "![]($path/$folder/icon.svg){.icon .svg} "
	elif [ -f "./icon.png" ] ; then printf "![]($path/$folder/icon.png){.icon .png} "
	fi
	# write the main text hyperlink
	local title="$( awk '/^# / { print substr($0, 3); exit; }' ./index.md )"
	printf "[$title]($path/$folder/index.html)\n"
	local nested=""
	if [ -z "$indent" ]
	then printf "\n"
	else nested=" nested"
	fi
	# recurse into subfolders
	if $has_children
	then
		printf "$indent<ul class=\"treeview$nested\">\n"
		for f in $children
		do
			navbar_folder "$shpath/$folder" "$f" "	$indent"
			children="$children $f"
		done
		#printf "$indent</ul>\n"
	fi
	)
	# end list item
	if [ -z "$indent" ]
	then printf "</div>\n"
	fi
}



navbar_folder . pages "" > ./templates/navbar.md
