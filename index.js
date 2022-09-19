
// navigation treeview logic
function logic_treeview()
{
	let pathname = window.location.pathname;
	$("ul.treeview").find("a").each(function(index, element)
	{
		if (element.pathname === pathname)
		{
			$(element).addClass("current");
			let elem = element.parentElement;
			while (elem != null && (
				elem.nodeName === "UL" ||
				elem.nodeName === "LI"))
			{
				if (elem.nodeName === "LI")
				{
					elem.classList.toggle("open");
				}
				elem = elem.parentElement;
			}
			return;
		}
	});
	$("span.treeview_node").on("click", function(event)
	{
		this.parentElement.classList.toggle("open");
	});
}

// image gallery viewer logic
function logic_gallery()
{
	$(".gallery_arrows").on("click", "span", function(event)
	{
		$(".gallery img").removeClass("opaque");
		$(".gallery_arrows span").removeClass("selected");
		$(".gallery p.caption").animate({right:"-1000px"});
		let new_image = $(this).index();
		$(".gallery img").eq(new_image).addClass("opaque");
		$(".gallery p").eq(new_image).addClass("caption");
		$(".gallery p").eq(new_image).animate({right:"-120px"});
		$(this).addClass("selected");
	});
	if ($(".gallery p.caption").css("right") == "-1000px")
	{
		$(".gallery p").removeClass("caption");
	}
}
