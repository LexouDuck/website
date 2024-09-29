#!/bin/awk

{
	if ($1 == "%%%")
	{
		while (getline line < filepath)
		{
			print line;
		}
	}
	else if (/%{(\w+)}%/)
	{
		if (/%{pageclass}%/)	{ gsub(/%{pageclass}%/,   pageclass); }
		if (/%{pagetitle}%/)	{ gsub(/%{pagetitle}%/,   pagetitle); }
		if (/%{pagedescr}%/)	{ gsub(/%{pagedescr}%/,   pagedescr); }
		if (/%{lastupdate}%/)	{ gsub(/%{lastupdate}%/,  lastupdate); }
		print;
	}
	else
	{
		print;
	}
}
