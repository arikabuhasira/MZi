/// <reference path="mzi.ts" />
/// <reference path="jquery.d.ts" />


$(document).ready(() => main());

var mesh: mzi.Mesh;

function main() {

	var $d=$(document);
	var w=$d.width(),h=$d.height();

    var $body = $("body");
    mesh = new mzi.Mesh( new Rectangle(0,0,800, 600));

	//mesh.splitChildAt(new mzi.Point(200, 10), false);
	//mesh.splitChildAt(new mzi.Point(10, 200), true);
	//mesh.splitChildAt(new mzi.Point(10, 400), true);

	/*

	mesh.splitChildAt(new mzi.Point(10, 400), true);

	mesh.splitChildAt(new mzi.Point(400, 10), false);

	mesh.splitChildAt(new mzi.Point(10, 100), true);
	mesh.splitChildAt(new mzi.Point(10, 200), true);

	mesh.splitChildAt(new mzi.Point(410, 100), true);

	mesh.splitChildAt(new mzi.Point(10, 500), true);
	mesh.splitChildAt(new mzi.Point(400, 550), false);



	var from = mesh.getSplitLine(false, new mzi.Point(400, 110), 'top');
	var to = mesh.getSplitLine(false, new mzi.Point(400, 110), 'bottom');
	console.log('from='+from+', to='+to);

	var from = mesh.getSplitLine(false, new mzi.Point(400, 10), 'top');
	var to = mesh.getSplitLine(false, new mzi.Point(400, 10), 'bottom');
	console.log('from='+from+', to='+to);
*/

	/*
    var p1 = new mzi.MziPanel();
    p1.bound = new mzi.Rectangle(100, 50, 500, 300);
    mesh.add(p1);

    var p2 = new mzi.MziPanel();
    p2.bound = new mzi.Rectangle(30, 750, 400, 400);
    mesh.add(p2);
	*/
}
