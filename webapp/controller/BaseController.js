/* =========================================================== */
/* 公用控制器（基础函数功能实现包）                            */
/* =========================================================== */
sap.ui.define(["sap/ui/core/mvc/Controller", 
	           "sap/ui/core/UIComponent", 
	           "sap/ui/core/routing/History", 
	           "cie/repack/model/formatter",
	           "./messages"	           
], function(Controller, UIComponent, History, formatter,messages) {
	//---JS 严格模式
	"use strict";
	
	return Controller.extend("cie.repack.controller.BaseController", {
        
		//---格式
		formatter : formatter,
		
		//---获取EventBus
		getEventBus : function() {
			return this.getOwnerComponent().getEventBus();
		},
		
		//---获取Router(路由实例)
		getRouter : function() {
			return UIComponent.getRouterFor(this);
		},
		
		//---获取RouterId(路由Id)
		getRouterID : function() {
			var oHC = this.getRouter().oHashChanger;
			if (oHC.privgetCurrentShellHash) {
				var sHash = oHC.privgetCurrentShellHash().hash;
				var s = oHC.privstripLeadingHash(sHash).split("-")[0];
				s = s && s === "Shell-home" ? null : s;
				return s;
			}
		},
		
		//---跳转
		navTo : function(sName) {
			return sName == null ? null : this.getRouter().navTo(sName);
		},
		
		//---获取模型
		getModel : function(sName) {
			return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
		},

		// 获取OData元数据
		getODataMetadata : function(sName) {
			if (sName == "") {
				return null;
			}
			var oMetaData = this.getModel().getProperty("/ODataMetadata");
			return oMetaData[sName];
		},

		//---获取OData服务EntityType
		getEntityTypeByName : function(sODataName, sEntityTypeName) {
			if (!this.getODataMetadata(sODataName)) {
				return null;
			}
			return this.getODataMetadata(sODataName)._getEntityTypeByName(sEntityTypeName);
		},

		//---设置模型
		setModel : function(oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		//---获取资源包
		getResourceBundle : function() {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		//---设置busy状态
		setBusy : function(b) {
			this.getModel().setProperty("/appProperties/busy", b);
		},

		//---设置bcode的值(同步方式)
		setbcode : function(v) {
			this.getModel().setProperty("/appProperties/bcode", v, false);
		},

		//---获取bcode的值
		getbcode : function(v) {
			return this.getModel().getProperty("/appProperties/bcode");
		},

		//---设置fcode的值(同步方式)
		setfcode : function(v) {
			this.getModel().setProperty("/appProperties/fcode", v, false);
		},

		//---是否是E类型消息
		isError : function(oContext) {
			var iCounterE = oContext.getModel().getProperty("/messages/counterE");
			return iCounterE > 0 ? true : false;
		},

		//---页面左上角message按钮弹框
		openMessagePopover : function(oContext) {
			if (oContext._MessageButton && this.isError(oContext)) {
				oContext._MessageButton.firePress();
			}
		},

		//---返回消息处理
		updateObligatory : function() {
			var oObligatory = {};
			var aReturn = this.getModel().getProperty("/returns");
			for (var i = 0; i < aReturn.length; i++) {
				if (aReturn[i].MessageV1 != "" && aReturn[i].Type == "E") {

					var oR = {
						Id : aReturn[i].Id,
						LogMsgNo : aReturn[i].LogMsgNo,
						LogNo : aReturn[i].LogNo,
						Message : aReturn[i].Message,
						MessageV1 : aReturn[i].MessageV1,
						MessageV2 : aReturn[i].MessageV2,
						MessageV3 : aReturn[i].MessageV3,
						MessageV4 : aReturn[i].MessageV4,
						Number : aReturn[i].Number,
						Row : aReturn[i].Row,
						System : aReturn[i].System };

					if (aReturn[i].MessageV2 != "") {
						if (!oObligatory[aReturn[i].MessageV1]) {
							oObligatory[aReturn[i].MessageV1] = {};
						}
						oObligatory[aReturn[i].MessageV1][aReturn[i].MessageV2] = oR;
					}

					if (aReturn[i].MessageV2 == "") {
						oObligatory[aReturn[i].MessageV1] = oR;
					}

				}
			}
			this.getModel().setProperty("/verReturn", oObligatory, false);

		},

		//---清除组件上必输错误状态标记
		clearInputRequiredErrorStatus : function(oEvent) {
			var sRootPath = "/verReturn";
			var sPath = oEvent.getSource().getBinding("valueState").sPath;
			if (sPath == "") {
				var aBindings = oEvent.getSource().getBinding("valueState").aBindings;
				sPath = aBindings[0].sPath + "/" + aBindings[1].oValue;
			}
			var oVerReturn = this._JSONModel.getProperty(sRootPath);
			sPath = sPath.replace(sRootPath + "/", "");
			var aKey = sPath.split("/", 2);
			if (aKey.length == 1) {
				delete oVerReturn[aKey[0]];
			}
			if (aKey.length == 2) {
				delete oVerReturn[aKey[0]][aKey[1]];
				// 表格中错误状态无法自动置空，需强制清理
				oEvent.getSource().setValueState("None");
			}
			this._JSONModel.setProperty(sRootPath, oVerReturn, false);
		},

		//---获取页面的聚合内容
		getPage : function() {
			var oView = this.getView();
			if (oView.getMetadata()._sClassName != "sap.ui.core.mvc.XMLView") {
				return null;
			}
			if (!oView.getContent() || oView.getContent().length == 0) {
				return null;
			}
			if (oView.getContent()[0].getMetadata()._sClassName != "sap.m.Page") {
				return null;
			}
			return oView.getContent()[0];
		},

		//---生成32位随机数
		createGUID : function() {
			var g = "";
			var i = 32;
			while (i--) {
				g += Math.floor(Math.random() * 16.0).toString(16);
			}
			return g;
		},

		//---重写克隆方法
		clone : function(obj, sub) {
			var o;
			if (obj.constructor == Object) {
				o = new obj.constructor();
			}
			else {
				o = new obj.constructor(obj.valueOf());
			}
			for ( var key in obj) {
				if (o[key] != obj[key]) {
					if (typeof (obj[key]) == 'object') {
						o[key] = this.clone(obj[key]);
					}
					else {
						o[key] = obj[key];
					}
				}
			}
			o.toString = obj.toString;
			o.valueOf = obj.valueOf;
			return o;
		},
        
        unique: function(arr){
        	var array = arr;
        	var len = array.length;
        	array.sort();
        	function loop(index){
        		if(index >=1){
        			if(array[index]===array[index-1]){
        				array.splice(index,1);
        			}
        			loop(index-1);
        		}
        	}
        	loop(len-1);
        	return array;
        },
        clearObject: function(obj){
        	var object = {};
        	return object;
        },
		//---返回事件
		onNavBack : function() {
			if (History.getInstance().getPreviousHash() !== undefined) {
				history.go(-1);
			}
			else {
				this.getRouter().navTo("", {}, true);
			}
		},
		getDateDiff: function(startTime, endTime, diffType) {
		    //将xxxx-xx-xx的时间格式，转换为 xxxx/xx/xx的格式 
		    startTime = startTime.replace(/\-/g, "/");
		    endTime = endTime.replace(/\-/g, "/");
		    //将计算间隔类性字符转换为小写
		    diffType = diffType.toLowerCase();
		    var sTime =new Date(startTime); //开始时间
		    var eTime =new Date(endTime); //结束时间
		    //作为除数的数字
		    var timeType =1;
		    switch (diffType) {
		        case"second":
		            timeType =1000;
		        break;
		        case"minute":
		            timeType =1000*60;
		        break;
		        case"hour":
		            timeType =1000*3600;
		        break;
		        case"day":
		            timeType =1000*3600*24;
		        break;
		        default:
		        break;
		    }
		    return parseInt((eTime.getTime() - sTime.getTime()) / parseInt(timeType));
		},
		getJugeDate: function(malDate,selDate){
		    malDate = malDate.replace(/\-/g, "/");
		    selDate = selDate.replace(/\-/g, "/");	
		    var sTime =new Date(malDate); //开始时间
		    var eTime =new Date(selDate); //结束时间		    
		    if(sTime.getTime() > eTime.getTime()){
				return true;
		    } else {
				return false;
		    }
		    
		},
		getNowFormatDate:	function(val) {
			    var date = new Date();
			    var seperator1 = "-";
			    var seperator2 = ":";
			    var month = date.getMonth() + 1;
			    var strDate = date.getDate();
			    var hours = date.getHours();
			    var minutes = date.getMinutes();
			    var seconds = date.getSeconds();
				month = (month < 10 ? "0" + month : month);
				strDate  = (strDate < 10 ? "0" + strDate : strDate);	
				hours  = (hours < 10 ? "0" + hours : hours);
				minutes  = (minutes < 10 ? "0" + minutes : minutes);
				seconds  = (seconds < 10 ? "0" + seconds : seconds);				
			    var currentdate = date.getFullYear() + seperator1 + month + seperator1 + strDate
			            + val + hours + seperator2 + minutes
			            + seperator2 + seconds;
			    return currentdate;
			},
		time: function(){
		    var date = new Date();
		    var hours = date.getHours();
		    var minutes = date.getMinutes();
		    var seconds = date.getSeconds();
			hours  = (hours < 10 ? "0" + hours : hours);
			minutes  = (minutes < 10 ? "0" + minutes : minutes);
			seconds  = (seconds < 10 ? "0" + seconds : seconds);	
			var time = "PT"+hours+"H"+minutes+"M"+seconds+"S";
			return time;
		},
		dateTostr: function(datetime){
			var year = datetime.getFullYear();
			var month = datetime.getMonth()+1;//js从0开始取 
			var date = datetime.getDate(); 
			var hour = datetime.getHours(); 
			var minutes = datetime.getMinutes(); 
			var second = datetime.getSeconds();
			month = (month < 10 ? "0" + month : month);
			date  = (date < 10 ? "0" + date : date);
			hour  = (hour < 10 ? "0" + hour : hour);	
			minutes  = (minutes < 10 ? "0" + minutes : minutes);			
			second  = (second < 10 ? "0" + second : second);					
			var time = year+"-"+month+"-"+date+"T"+hour+":"+minutes+":"+second; //2009-06-12T17:18:05
			return time;
		},
		// Print Date Format: dd/MM/yyyy hh:mm:ss
		printDate: function(val){
		    var date = new Date();
		    var seperator1 = "/";
		    var seperator2 = ":";
		    var month = date.getMonth() + 1;
		    var strDate = date.getDate();
		    var hours = date.getHours();
		    var minutes = date.getMinutes();
		    var seconds = date.getSeconds();
			month = (month < 10 ? "0" + month : month);
			strDate  = (strDate < 10 ? "0" + strDate : strDate);	
			hours  = (hours < 10 ? "0" + hours : hours);
			minutes  = (minutes < 10 ? "0" + minutes : minutes);
			seconds  = (seconds < 10 ? "0" + seconds : seconds);				
		    var currentdate = month+seperator1+strDate+seperator1+date.getFullYear()+ 
		                      val + hours + seperator2 + minutes + seperator2 + seconds;
		    return currentdate;			
		},
		printBoxDate: function(val){
		    var date = new Date();
		    var seperator1 = "/";
		    var seperator2 = ":";
		    var month = date.getMonth() + 1;
		    var strDate = date.getDate();
		    var hours = date.getHours();
		    var minutes = date.getMinutes();
			month = (month < 10 ? "0" + month : month);
			strDate  = (strDate < 10 ? "0" + strDate : strDate);	
			hours  = (hours < 10 ? "0" + hours : hours);
			minutes  = (minutes < 10 ? "0" + minutes : minutes);
		    var currentdate = month+seperator1+strDate+seperator1+date.getFullYear()+ 
		                      val + hours + seperator2 + minutes;
		    return currentdate;			
		},			
	    addDate: function (date,days){ 
	       var newDate=new Date(date); 
	       newDate.setDate(newDate.getDate()+days); 
	       var month=newDate.getMonth()+1; 
	       var day=newDate.getDate();
	       return newDate.getFullYear()+'-'+( month < 10 ? ( '0' + month ) : month )+'-'+( day < 10 ? ( '0' + day ) : day); 
	     }, 		
		// Get UUID
		getuuid: function (len, radix) {
			var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
			var uuid = [],
				i;
			radix = radix || chars.length;

			if (len) {
				// Compact form
				for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
			} else {
				// rfc4122, version 4 form
				var r;

				// rfc4122 requires these characters
				uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
				uuid[14] = '4';

				// Fill in random data.  At i==19 set the high bits of clock sequence as
				// per rfc4122, sec. 4.1.5
				for (i = 0; i < 36; i++) {
					if (!uuid[i]) {
						r = 0 | Math.random() * 16;
						uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
					}
				}
			}

			return uuid.join('');
		},	
		getMonthDay : function(date,n){
			var date = new Date(date);
			var month,day;
			date.setDate(date.getDate() + n);
			month = date.getMonth() + 1;
			day = date.getDate();
			var s = month + "/" + day;
			// var s = day;
			return s;
		},
		
		getBeforeDate : function(n){
			var date = new Date();
			var year,month,day;
			date.setDate(date.getDate() + n);
			year = date.getFullYear();
			month = date.getMonth() + 1;
			day = date.getDate();
			var s = year + '-' + ( month < 10 ? ( '0' + month ) : month ) + '-' + ( day < 10 ? ( '0' + day ) : day) ;
			return s;
		},
		
		getWeekDay : function (day){
			var weekDay = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
			var myDate = new Date(Date.parse(day));
			var week = weekDay[myDate.getDay()];
			return week;
		},
		
		getDate : function(n){
			var date = new Date();
			var year,month,day;
			date.setDate(date.getDate() + n);
			year = date.getFullYear();
			month = date.getMonth() + 1;
			day = date.getDate();
			var s = String(year) + ( month < 10 ? ( '0' + month ) : month ) + ( day < 10 ? ( '0' + day ) : day) ;
			return s;
		},		
	});
});