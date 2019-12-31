/*global QUnit*/

sap.ui.define([
	"cie/repack/controller/repack.controller"
], function (Controller) {
	"use strict";

	QUnit.module("repack Controller");

	QUnit.test("I should test the repack controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});