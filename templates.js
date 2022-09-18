$(document).ready(function()
{
	$("#template_head").load("/templates.html #head", function()
	{
		let template = $("#head").html();
		let output = Mustache.render(template, {});
		$("#template_head").html(output);
	});
	$("#template_header").load("/templates.html #header", function()
	{
		let template = $("#header").html();
		let output = Mustache.render(template, {});
		$("#template_header").html(output);
	});
	$("#template_footer").load("/templates.html #footer", function()
	{
		let template = $("#footer").html();
		let output = Mustache.render(template, {});
		$("#template_footer").html(output);
	});
	$("#template_navbar").load("/templates.html #navbar", function()
	{
		let data = {}; // JSON.parse($("#data").val());
		let template = $("#navbar").html();
		let output = Mustache.render(template, data);
		$("#template_navbar").html(output);

		logic_treeview();
		logic_gallery();
	});
});
