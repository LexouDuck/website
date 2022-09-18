$(document).ready(function()
{
	$("#template_head").load("/templates.html #head", function()
	{
		let data = {}; // { page: current_page };
		let template = Mustache.parse($("#head").html())
		let output = Mustache.render(template, data);
		$("#template_head").html(output);
	});
	$("#template_header").load("/templates.html #header", function()
	{
		let data = {}; // { page: current_page };
		let template = Mustache.parse($("#header").html())
		let output = Mustache.render(template, data);
		$("#template_header").html(output);
	});
	$("#template_navbar").load("/templates.html #navbar", function()
	{
		let data = {}; // JSON.parse($("#data").val());
		let template = Mustache.parse($("#navbar").html())
		let output = Mustache.render(template, data);
		$("#template_navbar").html(output);
	});
	$("#template_footer").load("/templates.html #footer", function()
	{
		let data = {}; // JSON.parse($("#data").val());
		let template = Mustache.parse($("#footer").html())
		let output = Mustache.render(template, data);
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
		
		
		let newImage = $(this).index();
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
