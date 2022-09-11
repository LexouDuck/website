$(document).ready(function()
{
	$("#template_header").load("_templates.html #header", function()
	{
		var data = { page: current_page };
		var output = Mustache.render($("#header").html(), data);
		$("#template_header").html(output);
	});
	$("#template_navigation").load("_templates.html #navigation", function()
	{
		var data = JSON.parse($("#data").val());
		var output = Mustache.render($("#navigation").html(), data);
		$("#template_navigation").html(output);
	});
	$("#template_footer").load("_templates.html #footer", function()
	{
		var data = JSON.parse($("#data").val());
		var output = Mustache.render($("#footer").html(), data);
		$("#template_footer").html(output);
	});
});

// image viewer
$(document).ready(function()
{
	$("#book_controls").on('click', 'span', function()
	{
		$("#book img").removeClass("opaque");
		$("#book_controls span").removeClass("selected");
		$("#book p.caption").animate({right:"-1000px"});
		
		
		var newImage = $(this).index();
		$("#book img").eq(newImage).addClass("opaque");
		$("#book p").eq(newImage).addClass("caption");
		$("#book p").eq(newImage).animate({right:"-120px"});
		$(this).addClass("selected");
	});
	if ($("#book p.caption").css("right") == "-1000px")
	{
		$("#book p").removeClass("caption");
	}
});
