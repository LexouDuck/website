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
