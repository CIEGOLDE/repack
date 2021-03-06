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

	return BaseController.extend("cie.repack.controller.newLabel", {
		// init 
		onInit: function () {
			this._JSONModel = this.getModel();	
			this._ResourceBundle = this.getModel("i18n").getResourceBundle();	
			this._lang = sap.ui.getCore().getConfiguration().getLanguage();	
		    this._JSONModel.setProperty("/LogInLangu",this._lang);	
			this._JSONModel.setProperty("/repackSet/message","");			    
		},
		// After Rendering
		onAfterRendering: function() {
			jQuery.sap.delayedCall(100, this, function () {
				this.getView().byId("desLocation").getFocusDomRef().focus();
			});	
		},
		// Change Location
		onChangeLocation: function(){
			var that = this;
			var desLocation = that.byId("desLocation").getValue();
			if(!desLocation){
				MessageToast.show("Please input destination Location！");
				return;				
			}			
			that.setBusy( true ); 				
			var sUrl = "/YY1_Storage_location";
			var oDataUrl = "/destinations/S4HANACLOUD_BASIC/YY1_STORAGE_LOCATION_CDS";
			var ODataModel = new sap.ui.model.odata.ODataModel(oDataUrl);				
			var filterParameter = "?$filter=(StorageLocation eq '"+desLocation+ "')" 
			                    + " or "+"(StorageLocationName eq '"+desLocation+"')";	
			    sUrl = sUrl + filterParameter;			                    
			var mParameters = {
				success : function( oData , response )
				{    
					that.setBusy( false ); 					
					var Arry = oData.results;
					if(Arry.length>0){
						var repackSet = that._JSONModel.getProperty("/repackSet");
						repackSet.StorageLocationName = Arry[0].StorageLocationName;
						repackSet.destinationLocation = Arry[0].StorageLocation;      
						that._JSONModel.setProperty("/repackSet",repackSet);
						
					}else{
						that._JSONModel.setProperty("/repackSet/destinationLocation","");	
						that._JSONModel.setProperty("/repackSet/StorageLocationName","");
						var messageText = that._ResourceBundle.getText("errMsg4",desLocation);
						MessageToast.show(messageText);						
						return;
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
		
		// Handle Post 
		handlePost: function(){
			var that = this;
			var batchList = that._JSONModel.getProperty("/batchList");	
			var repackSet = that._JSONModel.getProperty("/repackSet");
			for(var y=batchList.length-1;y>=0;y--){
				var promise = new Promise(function (resolve, reject) {
					// Call Soap Process Material Document
					that.mergeBatch(that,batchList[y])
					.then(function (results) {
						if(results){
							batchList.splice(y,1);							
						}
						if(batchList.length===0){
							that.printSplitBarcode(that,repackSet.Batch);									
						}
					}).catch(function (oError) {
						that.setBusy(false);							
						messages.showODataErrorText(oError);
						reject(oError);
					});					
					return promise;							
				});
			}
		},
		// Clear Cache
		clearCache: function(){
			var that = this;
			that._JSONModel.setProperty("/serialNumSet",[]);
			that._JSONModel.setProperty("/serialNumList",[]);
			that._JSONModel.setProperty("/batchList",[]);
			that._JSONModel.setProperty("/repackSet",{});
			that.onBack();
		},
		// Split Batch Number
		mergeBatch: function(oController,batch){
			var that = this;
			var messagetText = "";
			that.setBusy(true);		
			var promise = new Promise(function (resolve, reject) {
				that.getSerialNumber(that,batch)
				.then(function (SNumberList) {
				// Call Soap Process Material Document
				var NewBatchNo = that._JSONModel.getProperty("/repackSet/Batch");
				that.callSoapProcessMatDocument(that,SNumberList,batch,NewBatchNo)
				.then(function (status) {
					that.setBusy(false);		
					if(status==="success"){
						// MessageToast.show("Created successfully");
						messagetText = that._ResourceBundle.getText("successMsg1");
						that._JSONModel.setProperty("/repackSet/message",messagetText);							
						resolve(true);
					}else{
						// MessageToast.show("Created failure,Please Check data");	
						messagetText = that._ResourceBundle.getText("errMsg5");
						that._JSONModel.setProperty("/repackSet/message",messagetText);							
						resolve(false);						
					}
				});	
				})
				// Catch Error
				.catch(function (oError) {
					that.setBusy(false);							
					messages.showODataErrorText(oError);
					reject(oError);
				});					
			});
			return promise;					
		},
		// Get Serial Number
		getSerialNumber: function(oController,batchNo){
			var that = this;
			var serialNumSet  = that._JSONModel.getProperty("/serialNumSet");	
			var SNumberList = [];
			var promise = new Promise(function (resolve, reject) {				
			for(var i=0;i<serialNumSet.length;i++){
				if(serialNumSet[i].Batch===batchNo){
					var splitSet = {
						SerialNumber: serialNumSet[i].SerialNumber,
						Batch: batchNo,
						Material: serialNumSet[i].Material,
						Plant: serialNumSet[i].Plant,
						StorageLocation: serialNumSet[i].StorageLocation
					};
					SNumberList.push(splitSet);
				}
			}
				resolve(SNumberList);
			});
			return promise;				
		},
		// printSplit Barcode
		printSplitBarcode: function(oController,Batch){
			var that = this;
			var serialNumSet = that._JSONModel.getProperty("/serialNumSet");
			var repackSet = that._JSONModel.getProperty("/repackSet");			
			var Quantity = serialNumSet.length;
            var product = serialNumSet[0].Material;
			var promise = new Promise(function (resolve, reject) {	
				// Fetch Material Description
				that.getProductDescription(product).then(function (description) {
					if(description){
						repackSet.productDescription = description;   
						that._JSONModel.setProperty("/repackSet",repackSet);
						// Print Box Label
						that.printBoxLabel(that,Quantity,Batch,product,description);
					}
					that.setBusy(false);							
				}).catch(function (oError) {
					that.setBusy(false);	
					messages.showODataErrorText(oError);
					that.clearCache();
					// that.onNavBack();						
				});		
			});
			return promise;					
		},
		printBoxLabel: function(oController,Quantity,Batch,Material,description){
			var that = this;
			var ServiceName = that._JSONMoel.getProperty("/ServiceName");
				ServiceName = ServiceName?ServiceName:"78440BDE715FB0DC";//获取配置打印机信息，如无取默认值
			var url = "https://ciedev.erik.top:8443/api/Service/"+ServiceName+"/Print";			
			var printArr = [],printBox = [];
			var currentDate = that.printBoxDate(" ");       
			var Bin = "OK";
			printArr.push({
				Name: "Material",
				Value: Material
			});
			printArr.push({
				Name: "MaterialDesc",
				Value: description
			});
			printArr.push({
				Name: "Batch",
				Value: Batch
			});
			printArr.push({
				Name: "Bin",
				Value: Bin
			});
			printArr.push({
				Name: "Quantity",
				Value: Quantity
			});
			printArr.push({
				Name: "DateTime",
				Value: currentDate
			});
			printBox.push(printArr);
			var request = JSON.stringify( printBox );			
		    that.callZPLService(url,request);			
		},
		// Get Product Description
		getProductDescription: function (obj) {
			var that = this;
			var object = obj;
			var sLanguage = that._JSONModel.getProperty("/LogInLangu");
			var oDataUrl = "/destinations/S4HANACLOUD_BASIC/API_PRODUCT_SRV";
			var ODataModel = new sap.ui.model.odata.ODataModel(oDataUrl);
			var oFilter = new sap.ui.model.Filter("Language",FilterOperator.EQ, sLanguage);
			var aFilters = [oFilter];
			var sUrl = "/A_Product('" + object + "')/to_Description";
			var promise = new Promise(function (resolve, reject) {
			var mParameters = {
				filters: aFilters,
				success: function (oData, response) {
					that.setBusy(false);
					var productDescription="";
					if (oData.results.length>0) {
						productDescription = oData.results[0].ProductDescription;
					}
					resolve(productDescription);
				}.bind(that),
				error: function (oError) {
					that.setBusy(false);
					reject(oError);
				}.bind(that)
			};
				ODataModel.read(sUrl, mParameters);
			});
			return promise;					
		},
		// Call ZPL Service
		callZPLService: function(oUrl,oRequest){
			var response = "";
			var messagetText = "";
			var that = this;
			var aData = $.ajax({
				url: oUrl,
				type: "POST",
				data: oRequest,
				dataType: "json",
				contentType: "application/json;charset=\"utf-8\"",
				Accept: "application/json",
				success: function (data, textStatus, jqXHR) {
					response = data;
				},
				error: function (xhr, status) {
					messagetText = that._ResourceBundle.getText("errMsg6");						
					// messages.showText(messagetText);
					that._JSONModel.setProperty("/repackSet/message",messagetText);						
				},
				complete: function (xhr, status) {
					that.clearCache();
					if(status==="success"){
						messagetText = that._ResourceBundle.getText("successMsg2");
						// messages.showText(messagetText);		
						that._JSONModel.setProperty("/repackSet/message",messagetText);							
					}else{
						messagetText = that._ResourceBundle.getText("errMsg6");						
						// messages.showText(messagetText);				
						that._JSONModel.setProperty("/repackSet/message",messagetText);							
					}
					// that.onBack();							
				}
	
			});						
		},			
		// Call Soap API
		callSoapProcessMatDocument: function(oController,SNumberList,batch,newBatchNo){
			var that = this;			
			var repackSet = that._JSONModel.getProperty("/repackSet");
			var Quantity = 	SNumberList.length;
			var destinationLocation = repackSet.destinationLocation?repackSet.destinationLocation:SNumberList[0].StorageLocation;
			// Posting Data Logic And User Name
			var postingDate = oController._JSONModel.getProperty("/postingDate");
		    var today = postingDate?postingDate:oController.formatter.date(new Date());
			// User Information
			var userInfoSet = oController._JSONModel.getProperty("/userInfoSet");
			if(userInfoSet.length>0){
				var userName = userInfoSet[0].PersonFullName?userInfoSet[0].PersonFullName:"";
			}					
			var creationDate = that.getNowFormatDate("T")+"Z" ;                        
			var SNdata = "";
			for (var i = 0; i < SNumberList.length; i++) {
				SNdata = SNdata + '<SerialNumbers>' + SNumberList[i].SerialNumber+ '</SerialNumbers>';
			}
			var promise = new Promise(function (resolve, reject) {				
			var request =
				'<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:glob="http://sap.com/xi/APPL/Global2">' +
				'<soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">' +
				"<wsa:MessageID>" + "uuid:" + that.getuuid() + "</wsa:MessageID>" +
				'</soap:Header>' +
				'<soap:Body>' +
				'<glob:MaterialDocumentCreateRequest_Async>' +
				'<MessageHeader>' +
				'<CreationDateTime>'+creationDate+'</CreationDateTime>' +
				'<SenderBusinessSystemID>SCP</SenderBusinessSystemID>' +
				'</MessageHeader>' +
				'<MaterialDocument>' +
				'<GoodsMovementCode>4</GoodsMovementCode>' +
				'<PostingDate>' + today + '</PostingDate>' +
				'<DocumentDate>' + today + '</DocumentDate>' +
	    		'<Description>'+userName+'</Description>' +					
				'<MaterialDocumentItem>' +
				'<GoodsMovementType>311</GoodsMovementType>' +
				'<MaterialDocumentLine>1</MaterialDocumentLine>' +
				'<ParentMaterialDocumentLine>0</ParentMaterialDocumentLine>' +
				'<Material>' + SNumberList[0].Material + '</Material>' +
				'<Batch>' + batch + '</Batch>' +			
				'<IssgOrRcvgBatch>' + newBatchNo + '</IssgOrRcvgBatch>' +						
				'<Plant>' + SNumberList[0].Plant + '</Plant>' +
				'<StorageLocation>' + SNumberList[0].StorageLocation + '</StorageLocation>' +					
				'<QuantityInEntryUnit unitCode="PCE">' + Quantity + '</QuantityInEntryUnit>' +
				'<IssuingOrReceivingStorageLoc>'+destinationLocation+'</IssuingOrReceivingStorageLoc>' +                        
				SNdata +
				'</MaterialDocumentItem>' +
				'</MaterialDocument>' +
				'</glob:MaterialDocumentCreateRequest_Async>' +
				'</soap:Body>' +
				'</soap:Envelope>';
			var response = "";
			$.ajax({
				url: "/destinations/CIE_BASIC_SOAP/sap/bc/srt/scs_ext/sap/materialdocumentcreaterequest1?sap-client=100",
				type: "POST",
				data: request,
				dataType: "xml",
				contentType: "application/soap+xml;charset=\"utf-8\"",
				success: function (data, textStatus, jqXHR) {
					response = data;
				},
				error: function (xhr, status) {
					reject(status);
				},
				complete: function (xhr, status) {
					resolve(status);
				}
				});		
			});
			return promise;							
		},
		// Back
		onBack: function(){
			this.onNavBack();	
		}

	});

});