
$(document).ready(function()
{
	// navigation treeview logic
	$(".treeview_toggle").on("click", "span", function()
	{
		console.log("clicked treeview_toggle: ", this);
		$(this).parentElement.querySelector(".nested").classList.toggle("active");
		$(this).classList.toggle("treeview_toggle_open");
	});

	// image gallery viewer logic
	$(".gallery_arrows").on("click", "span", function()
	{
		$(".gallery img").removeClass("opaque");
		$(".gallery_arrows span").removeClass("selected");
		$(".gallery p.caption").animate({right:"-1000px"});
		
		
		let newImage = $(this).index();
		$(".gallery img").eq(newImage).addClass("opaque");
		$(".gallery p").eq(newImage).addClass("caption");
		$(".gallery p").eq(newImage).animate({right:"-120px"});
		$(this).addClass("selected");
	});
	if ($(".gallery p.caption").css("right") == "-1000px")
	{
		$(".gallery p").removeClass("caption");
	}
});
