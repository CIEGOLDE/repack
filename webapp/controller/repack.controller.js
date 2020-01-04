sap.ui.define([
	"./BaseController",
	"./designMode",
	"./messages",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/m/Token",
	"sap/m/MessageToast",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox"
], function (BaseController,designMode,messages,JSONModel,Filter,Token,MessageToast,FilterOperator,MessageBox) {
	"use strict";
	
	return BaseController.extend("cie.repack.controller.repack", {
		onInit: function () {
			this._JSONModel = this.getModel();	
			this._ResourceBundle = this.getModel("i18n").getResourceBundle();				
			this.initSerialData();
			this.getCurrentUser();	
			this.initPostingDate();	  			
		},
		initSerialData: function(){
			this._JSONModel.setProperty("/serialNumSet",[]);
			this._JSONModel.setProperty("/serialNumList",[]);
			this._JSONModel.setProperty("/batchList",[]);
		},
		// After Rendering
		onAfterRendering: function () {
			jQuery.sap.delayedCall(100, this, function () {
				this.getView().byId("serialNo").getFocusDomRef().focus();
			});
		},		
		// Init Fetch Posting Date Logic
		initPostingDate: function(Plant){
			var that = this;
			var sUrl = "/YY1_BO_CLOSINGPERIOD";
			var oDataUrl = "/destinations/S4HANACLOUD_BASIC/YY1_BO_CLOSINGPERIOD_CDS";
			var ODataModel = new sap.ui.model.odata.ODataModel(oDataUrl);
			var today = new Date();
		    var year = today.getFullYear();
			var month = today.getMonth()+1;
				today = that.formatter.date(today);			
			var aFilters = [
					new Filter({
						path:"ClosingYear",//Closing Year
						operator: FilterOperator.EQ,
						value1: year
					}),
					new Filter({
						path:"ClosingMonth",//Closing Month
						operator: FilterOperator.EQ,
						value1: month					
					}),
					new Filter({
						path:"Plant",//Plant
						operator: FilterOperator.EQ,
						value1: Plant					
					})						
				];					
			var mParameters = {
				filters: aFilters,
				success : function( oData , response )
				{    
					that.setBusy( false ); 					
					var Arry = oData.results;
					if(Arry.length>0){
						var currentDate = that.formatter.date(new Date())+" "+"00:00:00";							
						var ClosingDate = Arry[0].ClosingDate;
						    ClosingDate = ClosingDate.replace("T"," ");
						var dateDiff = that.getDateDiff(currentDate,ClosingDate,"day"); 
						// 配置的过账日期在未来,则过账日期为今天
						if(dateDiff>=0){
							that._JSONModel.setProperty("/postingDate",today);
						}else{
						// Configure Date In Past,Posting Using Next Month FirstDay
							var nextFirstDay = that.nextMonthFirstDay();
							that._JSONModel.setProperty("/postingDate",nextFirstDay);							
						}
						// No Configure Date，Using today as posting Date
					}else{
						that._JSONModel.setProperty("/postingDate",today);						
					}
				}.bind( that ),
				error : function( oError )
				{
					that.setBusy( false ); 							
					messages.showODataErrorText( oError );
				}.bind( that )
			};
			ODataModel.read( sUrl , mParameters );
		},						
		getCurrentUser: function(){
			// Get Current User
			var userModel = new JSONModel();
			userModel.loadData("/services/userapi/currentUser", null, false);
			this.setModel(userModel, "userapi");
			var userSet = this.getModel("userapi").oData;
			if(userSet){
				this.initUserInfo(userSet.name);
			}
		},
		
		// Get ZPLPRINTER Configure
		getNetWorkPrintConfigure: function(LoginName,AppID){
			var that = this;
			var jsonModel = new JSONModel();
			var jUrl = "/destinations/S4HANACLOUD_BASIC/YY1_ZPLPRINT_CONFIGURE_CDS/YY1_ZPLPRINT_CONFIGURE";
			var query = "$filter=(LoginName eq '"+LoginName+"' and AppID eq '"+AppID+"')";
			jsonModel.attachRequestCompleted(function(){
				var Arry = this.getProperty("/d/results");
				if(Arry.length>0){
					that._JSONModel.setProperty("/ServiceName",Arry[0].ServiceName);
				}
			});
			jsonModel.loadData(jUrl,query,true);			
		},
		// Init User association Information
		initUserInfo: function(name){
			// debugger
			var that = this;
			var jsonModel = new JSONModel();
			var jUrl = "/destinations/S4HANACLOUD_BASIC/YY1_WORKPERSONVH_CDS/YY1_WORKPERSONVH";
			var query = "$filter=EmployeeExtID eq ('"+name+"')";
			jsonModel.attachRequestCompleted(function(){
				var Arry = this.getProperty("/d/results");
				var Plant = Arry[0].Plant_01;
				var EmployeeExtID = Arry[0].EmployeeExtID;
				that._JSONModel.setProperty("/userInfoSet", Arry);
				that.getNetWorkPrintConfigure(EmployeeExtID,"repack");
				that.initPostingDate(Plant);				
			});
			jsonModel.loadData(jUrl,query,true);
		},		
		// Change Serial
		onChangeSerial: function(){
			var that = this;				
			var serialNo = that.byId("serialNo").getValue();
			that._JSONModel.setProperty("/repackSet/message","");				
			if(!that.checkData()){
				that._JSONModel.setProperty("/repackSet/serialNo","");
				return;	
			}
			that.setBusy(true);		
			var promise = new Promise(function (resolve, reject) {
				that.getSerialNumber(that,serialNo).then(function (batchArry) {
					if(batchArry.length>0){
						// Check Material Number same
						that.checkMaterial(that,batchArry).then(function (result) {
							that.getView().byId("serialNo").getFocusDomRef().focus();							
							if(result){
								that.processSerialBatch(that,serialNo,batchArry);
							}else{
								var messagetText = that._ResourceBundle.getText("errorMsg");								
								that._JSONModel.setProperty("/repackSet/serialNo","");									
								// that._JSONModel.setProperty("/repackSet/message",messagetText);	
								messages.showError(messagetText);
							}
							that.setBusy(false);								
						   });
					}else{
						that.setBusy(false);			
						that._JSONModel.setProperty("/repackSet/serialNo","");							
						var messagetText = that._ResourceBundle.getText("errMsg1",serialNo);
						// that._JSONModel.setProperty("/repackSet/message",messagetText);	
						messages.showError(messagetText);						
					}
				}).catch(function (oError) {
					that.setBusy(false);		
					that._JSONModel.setProperty("/repackSet/serialNo","");						
					messages.showODataErrorText(oError);
					// that._JSONModel.setProperty("/repackSet/message",oError);
				});
			});
			return promise;			
		},
		// Check Material Number
		checkMaterial: function(oController,BatchArry){
			var that = this;
			var serialNumSet  = that._JSONModel.getProperty("/serialNumSet");
			var result = true;
			var promise = new Promise(function (resolve, reject) {	
				for(var i=0;i<BatchArry.length;i++){
					for(var k=0;k<serialNumSet.length;k++){
						if(BatchArry[i].Material!==serialNumSet[k].Material){
							result = false;
						}
					}
				}
				resolve(result);
			});
			return promise;				
		},
		// Process Serial And Batch Data
		processSerialBatch: function(oController,serialNo,BatchArry){
			var that = this;
			var serialNumList = that._JSONModel.getProperty("/serialNumList");
			var serialNumSet  = that._JSONModel.getProperty("/serialNumSet");
			var repackSet = that._JSONModel.getProperty("/repackSet");
			for(var i=0;i<BatchArry.length;i++){
				var serialNum = {
					SerialNumber: BatchArry[i].SerialNumber,
					Plant: BatchArry[i].UniqueItemIdentifierRespPla,
					Material: BatchArry[i].Material,
					Batch: BatchArry[i].Batch
				};
				serialNumSet.push(serialNum);
				
			}
			serialNumList.push(serialNo);
			repackSet.boxNum = parseInt(serialNumList.length); 
			repackSet.serialNo = "";
			that._JSONModel.setProperty("/serialNumList",serialNumList);
			that._JSONModel.setProperty("/serialNumSet",serialNumSet);
			that._JSONModel.setProperty("/repackSet",repackSet);
		},
		// Get Serail Number
		getSerialNumber: function(oController,serialNo){
			var that = this;
			var sUrl = "/YY1_Batch_and_Serial";			
			var oFilter1 = new Filter("SerialNumber", FilterOperator.EQ, serialNo);
			var aFilters = [oFilter1];	
			var promise = new Promise(function (resolve, reject) {				
			var mParameters = {
				filters: aFilters,				
				success: function (oData, response) {
					that.setBusy(false);					
					var Arry = oData.results;
					resolve(Arry);
				}.bind(that),
				error: function (oError) {
					that.setBusy(false);
					messages.showODataErrorText(oError);
					reject(oError);						
				}.bind(that)
			};			
			that.getModel("batchSerial").read(sUrl,mParameters);	
			});
			return promise;					
		},		
		// Check Serial Number
		checkSerialNumber: function(oController,Arry){
			var oDataUrl = "/destinations/S4HANACLOUD_BASIC/API_PRODUCT_SRV";	
			var ODataModel = new sap.ui.model.odata.ODataModel(oDataUrl);	
			var sUrl = "/A_ProductPlant";	
			var promise = new Promise(function (resolve, reject) {	
			var oFilter1 = new Filter("Product",FilterOperator.EQ, Arry[0].Material);
			var oFilter2 = new Filter("Plant", FilterOperator.EQ, Arry[0].UniqueItemIdentifierRespPla);			
			var aFilters = [oFilter1,oFilter2];	
			var mParameters = {
				filters: aFilters,					
				success: function (oData, response) {
					oController.setBusy(false);
					var productArr = oData.results;
					if(productArr[0].SerialNumberProfile){
						resolve(true);
					}else{
						resolve(false);
					}
				}.bind(oController),
				error: function (oError) {
					oController.setBusy(false);
					reject(oError);
				}.bind(oController)
			};
				ODataModel.read(sUrl, mParameters);		
			});
			return promise;						
		},
		// Check Data
		checkData: function(){
			var that = this;
			var serialNo = that.byId("serialNo").getValue();
			var serialNumList  = that._JSONModel.getProperty("/serialNumList");	
			var messagetText = "";
			if(!serialNo){
				messagetText = that._ResourceBundle.getText("errMsg2");
				// that._JSONModel.setProperty("/repackSet/message",messagetText);					
				MessageToast.show(messagetText);				
				return false;				
			}			
			if(serialNo.length<4){
				that._JSONModel.setProperty("/repackSet/serialNo","");				
				return false;
			}
			if(serialNumList.length>0){
				for(var i=0;i<serialNumList.length;i++){
					if(serialNo===serialNumList[i]){
						that._JSONModel.setProperty("/repackSet/serialNo","");			
						messagetText = that._ResourceBundle.getText("errMsg7");
						// that._JSONModel.setProperty("/repackSet/message",messagetText);	
						messages.showError(messagetText);
						return false;							
					}
				}
			}
			return true;
		},
		handleClear: function(){
			var that = this;
			that._JSONModel.setProperty("/serialNumList",[]);
			that._JSONModel.setProperty("/serialNumSet",[]);
			that._JSONModel.setProperty("/repackSet",{});			
		},
		// Handle Repack 
		handleRepack: function(){
			var that = this;
			var serialNumSet = that._JSONModel.getProperty("/serialNumSet");	
			var serialNumList = that._JSONModel.getProperty("/serialNumList");	
			var aFilters = [];
			var batchList=[];			
			if(serialNumSet.length>0){
				for(var i=0;i<serialNumSet.length;i++){
					aFilters.push(new Filter('Batch',FilterOperator.EQ, serialNumSet[i].Batch));
					batchList.push(serialNumSet[i].Batch);					
				}
			}
			// Unique
			aFilters = that.unique(aFilters);
			batchList = that.unique(batchList);
			var promise = new Promise(function (resolve, reject) {	
				// Get Batch Master
				that.setBusy(true);					
				that.getBatchMaster(that,aFilters).then(function (batchRecordArry) {	
					if(batchRecordArry.length>0){
			          // Get Batch StorageLocation
						that.getBatchStock(that,aFilters).then(function (stockArry) {
							var count=0;
							for(var k=0;k<batchList.length;k++){
								for(var m=0;m<stockArry.length;m++){
									if(batchList[k]===stockArry[m].Batch){
										count++;
									}
								}
							}			
							if(count>=stockArry.length){
								var repackSet = that._JSONModel.getProperty("/repackSet");	
								that._JSONModel.setProperty("/stockArry",stockArry);
								if(repackSet.Batch){
									that.navTo("newLabel");								
								}else{
									// Process Batch Information
									that.processBatchInformation(that,batchRecordArry,stockArry).then(function (averageDay) {
										// Create Batch
										var plant = stockArry[0].Plant;
										that.createBatch(that,batchRecordArry,averageDay,plant).then(function (newBatchNo) {	
											if(newBatchNo){
												that._JSONModel.setProperty("/repackSet/Batch",newBatchNo);
												var	messagetText = that._ResourceBundle.getText("successMsg",newBatchNo);
												messages.showText(messagetText);						
												that.navTo("newLabel");
											}
										}).catch(function (oError) {
											that.setBusy(false);		
											var messageText = $(oError.response.body).find('message').first().text();							
											messages.showError(messageText);		
										});								
									});										
								}								
							}else{
								messages.showError(that._ResourceBundle.getText("errMsg34"));												
							}
						}).catch(function (oError) {
							that.setBusy(false);		
							var messageText = $(oError.response.body).find('message').first().text();							
							messages.showError(messageText);
						});								
					}
				}).catch(function (oError) {
					that.setBusy(false);					
					var messageText = $(oError.response.body).find('message').first().text();							
					messages.showError(messageText);	
					// that._JSONModel.setProperty("/repackSet/message",messageText);						
					that.clearCache();					
				});								
			});
			return promise;						
		},
		getBatchStock: function(oController,aFilters){
			var that = this;
			var sUrl = "/A_MatlStkInAcctMod";
			var oDataUrl = "/destinations/S4HANACLOUD_BASIC/API_MATERIAL_STOCK_SRV";
			var ODataModel = new sap.ui.model.odata.ODataModel(oDataUrl);				
			var promise = new Promise(function (resolve, reject) {
				var mParameters = {
					filters: aFilters,
					success : function( oData , response )
					{    
						that.setBusy( false ); 					
						var Arry = oData.results;
						var MaterialStock=[];						
						if(Arry.length>0){
							for(var i=0;i<Arry.length;i++){
								if(parseInt(Arry[i].MatlWrhsStkQtyInMatlBaseUnit)>0){
									MaterialStock.push(Arry[i]);
								}
							}							
						}
						resolve(MaterialStock);							
					}.bind( that ),
					error : function( oError )
					{
						that.setBusy( false ); 							
						reject(oError);
					}.bind( that )
				};
				ODataModel.read( sUrl , mParameters );					
			});
			return promise;					
		},
		// Create Batch
		createBatch: function(oController,batchRecordArry,averageDay,plant){
			// var splitSet = oController._JSONModel.getProperty("/splitSet");			
			var currentDate = oController.getNowFormatDate("T");	
			var toBatchPlantItemSet = [{
					Material: batchRecordArry[0].Material,
					Plant: plant					
				}];
			var ShelfLifeExpirationDate = currentDate;				
			var ManufactureDate = averageDay;  
			var promise = new Promise(function (resolve, reject) {
			    var oRequest = {
			    	Material: batchRecordArry[0].Material,
			    	ShelfLifeExpirationDate: ShelfLifeExpirationDate,
			    	ManufactureDate: ManufactureDate,
			    	to_BatchPlant: toBatchPlantItemSet
			    };						
			    var mParameter = {
					success: function (oData, response) {
						var NewBatch = oData.Batch;
						if(NewBatch){
							resolve(NewBatch);
						}
					}.bind(oController),
					error: function (oError) {
						oController.setBusy( false ); 					
						reject(oError);
					}.bind(oController)			    	
			    };
				oController.getModel("batchRecord").create("/Batch", oRequest, mParameter);		
			});
			return promise;							
		},
		// Process Batch Information 
		processBatchInformation: function(oController,BatchArry,batchStockArr){
			var that = this;
			var serialNumSet  = that._JSONModel.getProperty("/serialNumSet");	
			var batchList = that._JSONModel.getProperty("/batchList");
			var today = new Date();
			    today = that.formatter.date(today);
			var day = 0;
			var count = BatchArry.length;
			for(var k=0; k<batchStockArr.length;k++){
				for(var m=0;m<serialNumSet.length;m++){
					if(batchStockArr[k].Batch===serialNumSet[m].Batch){
						serialNumSet[m].StorageLocation = batchStockArr[k].StorageLocation;									
					}
				}
				batchList.push(batchStockArr[k].Batch);
				batchList = that.unique(batchList);
			}			
			that._JSONModel.setProperty("/serialNumSet",serialNumSet);
			that._JSONModel.setProperty("/batchList",batchList);			
			var promise = new Promise(function (resolve, reject) {					
				for(var i=0;i<BatchArry.length;i++){
					var batchDate = that.formatter.date(BatchArry[i].ManufactureDate);
					var diff = that.getDateDiff(today,batchDate,"day");
					day = Number(day)+Number(diff);
				}
				var average = Math.round(day/count);
				var averageDay = that.addDate(today,average);
					averageDay = averageDay+"T"+"00:00:00";
					resolve(averageDay);
			});
			return promise;							
			
		},
		// Get Batch Master
		getBatchMaster: function(oController,aFilters){
			var sUrl = "/Batch";
			var promise = new Promise(function (resolve, reject) {			
			var mParameters = {
				filters: aFilters,					
				success : function( oData , response )
				{    
					if(oData.results){
						var Arry = oData.results;
						resolve(Arry);
					}
				}.bind( oController ),
				error : function( oError )
				{
					reject(oError);
				}.bind( oController )
			};
				oController.getModel("batchRecord").read(sUrl, mParameters);	
			});
			return promise;						
		}
	});
});