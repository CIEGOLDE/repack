/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"cie/repack/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});