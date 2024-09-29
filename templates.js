$(document).ready(function()
{
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
