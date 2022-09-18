
// navigation treeview logic
function logic_treeview()
{
	var pathname = window.location.pathname;
	console.log("checking pathname:", pathname);
	$("ul.treeview").find("a").each(function(index, element)
	{
		console.log("against:", element.pathname);
		if (element.pathname === pathname)
		{
			console.log("found match!");
			$(element).addClass("current");
			return;
		}
	});
	$("span.treeview_toggle").on("click", function(event)
	{
		this.parentElement.querySelector(".nested").classList.toggle("active");
		this.classList.toggle("treeview_toggle_open");
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
