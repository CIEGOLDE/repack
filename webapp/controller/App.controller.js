/* =========================================================== */
/* App MVC中 control 实现（App 控制器实现）                    */
/* =========================================================== */
sap.ui.define(["./BaseController",
	"./designMode",
	"sap/ui/model/json/JSONModel"
], function (BaseController, designMode, JSONModel) {
	"use strict";
	return BaseController.extend("cie.repack.controller.App", {
		onInit: function () {
			this.getView().addStyleClass(designMode.getCompactCozyClass());
		}
	});
});