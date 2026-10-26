#!/bin/bash -e
#
# Generates ./templates/navbar.md, the website's navigation menu, by looking through the ./pages folders.
#
# - Every folder which contains an `index.md` file is a page: its title is the first `# ` heading of that file.
# - Sub-folders which do not contain an `index.md` (e.g. folders of images/audio files) are ignored.
# - A page is displayed with an icon if its folder contains an `icon.svg` or `icon.png` file.
# - The order of sub-pages is given by an optional `sort.txt` file in the parent folder, with one folder per line:
#	pages listed there come first, in that order; any other sub-pages come after, alphabetically.
#	A line may also give a label to show in the navbar instead of the page title, after the folder name:
#	table_axioms	Table of Axioms and Systems
#

# always run from the repository root, with a deterministic sort order
cd "$(dirname "$0")"
export LC_ALL=C

ROOT="pages"
OUTPUT="./templates/navbar.md"
SITENAME="LEXOU DUCK"



#! Prints the navbar label of the page in the given folder: either the label given
#! for it in its parent folder's sort.txt, or else the first `# ` heading of its index.md
page_title()
{
	local dir="$1"
	local label=""
	if [ -f "$(dirname "$dir")/sort.txt" ]
	then
		label="$(awk -v name="$(basename "$dir")" '$1 == name { sub(/^[ \t]*[^ \t]+[ \t]*/, ""); print; exit; }' "$(dirname "$dir")/sort.txt")"
	fi
	if [ -z "$label" ]
	then label="$(awk '/^# / { print substr($0, 3); exit; }' "$dir/index.md")"
	fi
	echo "$label"
}

#! Prints the icon markdown for the page in the given folder (empty if there is no icon)
page_icon()
{
	if   [ -f "$1/icon.svg" ] ; then printf ' ![](/%s/icon.svg){.icon .svg}' "$1"
	elif [ -f "$1/icon.png" ] ; then printf ' ![](/%s/icon.png){.icon .png}' "$1"
	fi
}

#! Prints the names of the sub-pages of the given folder, one per line, in display order
page_children()
{
	local dir="$1"
	local name
	local listed=" "
	# first, the pages listed in sort.txt (if any), in that order
	if [ -f "$dir/sort.txt" ]
	then
		for name in $(awk '{ print $1 }' "$dir/sort.txt")
		do
			if [ -f "$dir/$name/index.md" ]
			then
				echo "$name"
				listed="$listed$name "
			fi
		done
	fi
	# then, any other sub-pages, alphabetically
	for name in "$dir"/*/
	do
		name="$(basename "$name")"
		if [ -f "$dir/$name/index.md" ]
		then
			case "$listed" in
				*" $name "*) ;;
				*) echo "$name" ;;
			esac
		fi
	done
}

#! Prints the navbar list item for the page in the given folder, and (recursively) its sub-pages
navbar_item()
{
	local dir="$1"
	local indent="$2"
	local children="$(page_children "$dir")"
	local marker
	local child
	# top-level items are separated by an empty line
	if [ -z "$indent" ]
	then echo ""
	fi
	# check if is folder (node) or page (leaf)
	if [ -n "$children" ]
	then marker="[▶]{.treeview_node}"
	else marker="[•]{.treeview_leaf}"
	fi
	printf '%s-   %s%s [%s](/%s/index.html)\n' \
		"$indent" "$marker" "$(page_icon "$dir")" "$(page_title "$dir")" "$dir"
	# recurse into sub-pages
	if [ -n "$children" ]
	then
		printf '%s<ul class="treeview nested">\n' "$indent"
		for child in $children
		do
			navbar_item "$dir/$child" "	$indent"
		done
	fi
}



{
	echo '<div id="navbar">'
	echo '<input class="side-menu" type="checkbox" id="side-menu" />'
	echo '<label class="menu-icon" for="side-menu"><img src="/assets/icon_menu.svg" class="icon" ></img></label>'
	echo '<h2 id="lexou-duck"> ![](/'"$ROOT"'/logo.png){.icon .png} ['"$SITENAME"'](/'"$ROOT"'/index.html) </h2>'
	echo '<nav>'
	echo '<ul class="treeview">'
	for child in $(page_children "$ROOT")
	do
		navbar_item "$ROOT/$child" ""
	done
	echo ''
	echo '</nav>'
	echo ''
	echo '</div>'
} > "$OUTPUT"
