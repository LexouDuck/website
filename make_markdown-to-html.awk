#!/bin/awk

function command(cmd)
{
	stdout = "";
	stdout_line = "";
	while (( cmd | getline stdout_line ) > 0)
	{
		if (length(stdout) == 0)
		{ stdout = stdout_line; }
		else
		{ stdout = stdout "\n" stdout_line; }
	}
	close(cmd);
	return (stdout);
}

{
	if ($1 == "%%%")
	{
		if ($2 == "folder")
		{
			print "DEBUG[awk]: find " currentdir " -maxdepth 1 -type d " > "/dev/stderr";
			split(command("find " currentdir " -maxdepth 1 -type d "), folders, "\n");
			for (f in folders)
			{
				if (folders[f] == currentdir) { continue; }
				print "DEBUG[awk]: " currentdir " |  cat " folders[f] "/index.md" > "/dev/stderr";
				print "";
				print "---------";
				print "";
				content = command("cat " folders[f] "/index.md");
				print substr(content, 1, index(content, "\n\n---"));
				print "[Read more...](/" folders[f] "/index.html" ")";
			}
		}
		else if ($2 ~ /https:(.*)/)
		{
			urlroot = $2;
			if (/raw\.githubusercontent\.com/)
			{
				github_url = $2;
				gsub(/raw\.githubusercontent\.com/, "github.com", github_url);
				gsub(/\/master\/.*/, "", github_url);
				print "*This page was generated from the readme file of [the github repo](" github_url ").*";
				print "";
				print "";
				print "";
				gsub(/\/master\/.*/, "/master/", urlroot);
			}
			fetched = command("curl " $2);
			gsub(/\]\(/, "](" urlroot, fetched);
			gsub("\\]\\(" urlroot "http", "](http", fetched);
			print fetched;
		}
	}
	else { print; }
}
