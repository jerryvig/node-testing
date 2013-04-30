/** 
 * Copyright 2013 MktNeutral.com. All Rights Reserved
*/

/**
 * @fileoverview A utility to collect Yahoo! stock and ETF dividends data from Yahoo!
 * @author       Jerry Vigil
 *
 */

//Requires will go here.
var async = require('async');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var fs = require('fs');

//XMLHttpRequest objects
var xhr = new XMLHttpRequest();
var xhrII = new XMLHttpRequest();

//namespace declarations.
var mktneutral = {};

/**
 * Create a new GetYahooDividends object.
 *
 * @constructor
 * 
 */
mktneutral.GetYahooDividends = function() {
	this.today = new Date();
	this.oneYearAgo = new Date();
	this.oneYearAgo.setFullYear(this.today.getFullYear()-1);
	this.oneYearAgoISO = this.oneYearAgo.toISOString().substr(0,10);
};

/**
 * Takes the body of the HTTP response for a ticker symbol and creates row objects to hold those data.
 * 
 * @param ticker   The ticker symbol for the rows to be added.
 * @param respBody  The text of the HTTP response body to be split into rows.
 * 
 */
mktneutral.GetYahooDividends.prototype.pushRows = function(ticker,respBody) {
  var self = this;
  var lines =  respBody.split('\n');
  var row = new Object();
  row.ticker = ticker;
  row.ttmd = 0.0;
  
  async.each(lines.slice(1,lines.length-1), function(line,callback){
      var vals = line.split(',');
      if ( vals[0] > self.oneYearAgoISO ) {
          row.ttmd += (vals[1]*1.0);
      }
  }, function(err){
  	 console.log('ERROR = '+err);
  });
  
  return row;
};

/**
 * Gets the Yahoo historical data for the ticker symbol specified by ticker.
 * 
 * @param ticker  The ticker symbol for which to request the Yahoo historical data.
 * @param callback  The callback function to call when finished at the end of this function.
 * 
 */
mktneutral.GetYahooDividends.prototype.getYahooHistory = function(ticker,callback) {
 var self = this;
 var prefix = 'http://ichart.finance.yahoo.com/table.csv?s=';
 var suffix = '&a='+this.today.getMonth()+'&b='+this.today.getDate()+'&c='+(this.today.getFullYear()-1) +
  				'&d='+this.today.getMonth()+'&e='+this.today.getDate()+'&f='+this.today.getFullYear()+
  				'&g=v&ignore=.csv';
 
 xhrII.onreadystatechange = function(){
	 if (xhrII.readyState==4){
		 if (xhrII.status==200){
			 var row = self.pushRows(ticker,xhrII.responseText.toString());
			 callback(null,row);
		 }
		 else {
			 console.log('Error processing ticker'+ticker);
			 callback(null,null);
		 }
	 }
 };
 
 xhrII.open('GET',prefix+ticker+suffix,true);
 xhrII.send();	
};

/**
 * Gets the Yahoo last quote data for the ticker symbol specified by ticker.
 * 
 * @param ticker  The ticker symbol for which to request the Yahoo last quote data.
 * @param callback  The callback function to call when finished at the end of this function.
 * 
 */
mktneutral.GetYahooDividends.prototype.getYahooLast = function(ticker,callback){
	var prefix = 'http://download.finance.yahoo.com/d/quotes.csv?s=';
	var suffix = '&f=sl1'
	console.log( "Ticker = " + ticker );
	
	xhr.onreadystatechange = function(){
		if ( xhr.readyState==4 ){
			if ( xhr.status==200 ){
				var cols = xhr.responseText.split(',');
				callback(null,cols[1].trim());
			}
			else {
				console.log('Error processing ticker'+ticker);
				callback(null,0.0);
			}
		}
	};
	
	xhr.open('GET',prefix+ticker+suffix,true);
	xhr.send();	
};

/**
 * Gets the Yahoo data for a single ticker. Gets the Yahoo! historical data and last quote asynchronously.
 * Combines the results of both requests into a single record object and writes that data to the output file.
 * 
 * @param ticker  The ticker symbol for which to request the Yahoo data.
 * @param outputJSONRecordsFile  Output file to write the dividend yield records to in JSON format.
 * @param cb  The callback function to call when finished at the end of this function.
 * 
 */
mktneutral.GetYahooDividends.prototype.getYahoos = function(ticker,outputJSONRecordsFile,cb){ 
	var self = this;
	async.parallel([function(callback){ 
						var results = self.getYahooHistory(ticker,callback);
				    },
				    function(callback){ 
				    	var results = self.getYahooLast(ticker,callback);
				    }],
					function(err,results) {
						var record = new Object();
						//We need try/catch here because sometimes we get HTTP error responses.
						try {
							record.ticker = results[0].ticker;
							record.ttmd = results[0].ttmd;
							record.last = results[1];
							record.yield = results[0].ttmd/results[1]; 
						
							console.log( record );
							fs.appendFile(outputJSONRecordsFile,(JSON.stringify(record)+','),'utf8',cb);
						}
						catch ( err ) {
							console.log(err.message);
							cb();
						}
	});
};

/**
 * Top level execution loop for the GetYahooDividends routine that loops over the ticker symbols listed in the input json file.
 * Waits SLEEP_BETWEEN_REQUESTS milliseconds using setTimeout()
 * 
 * @param jsonTickerListFile  Input file containing a list of ticker symbols in JSON format.
 * @param outputJSONRecordsFile  Output file to write the dividend yield records to in JSON format.
 * 
 */
mktneutral.GetYahooDividends.prototype.main = function(jsonTickerListFile,outputJSONRecordsFile) {
	var self = this;
	fs.unlink(outputJSONRecordsFile,function(){
	 fs.appendFile(outputJSONRecordsFile,'{"records":[','utf8',function(){
	 	fs.readFile(jsonTickerListFile,'utf8',function(err,data){
		   	var tickerList = JSON.parse(data);
		
			var SLEEP_BETWEEN_REQUESTS = 1000;
			var i=0;
			function doCall(callback){
				console.log('DOING TICKER = '+tickerList.tickers[i]);
				self.getYahoos(tickerList.tickers[i],outputJSONRecordsFile,function(){
					i++;
					if (i<tickerList.tickers.length) {
				    	setTimeout(function(){
                                        doCall(callback);
                                    },SLEEP_BETWEEN_REQUESTS);
					}
			    	else {
			    		setTimeout(callback,SLEEP_BETWEEN_REQUESTS);  
                	}
				});
		}
		
		doCall(function(){
				fs.appendFile(outputJSONRecordsFile,']}','utf8',function(){
	           			console.log('doCall() done');
	            });
        });
	  });
	});
   });
};

/**
 * Function to sort the dividends yield records in a JSON file. Takes a json file as input and outputs another 
 * JSON file with the records sorted by dividend yield.
 * 
 * @param jsonDividendYieldRecords  Input file containing a list of dividend yield records.
 * @param jsonSortedRecords  Output file to write the sorted list of dividend yield records.
 * 
 */
mktneutral.GetYahooDividends.prototype.sortRecords = function(jsonDividendYieldRecords,jsonSortedRecords) {
	fs.readFile(jsonDividendYieldRecords,'utf8',function(err,data){
		var yieldRecords = JSON.parse(data);
		async.sortBy(yieldRecords.records,function(item,callback){
			callback(err,item.yield);
		}, function(err,results){
			fs.appendFile(jsonSortedRecords,JSON.stringify(results),'utf8',function(){
		    	console.log('Wrote sorted dividend yields file.');
		    });	
		});
    });
};

mktneutral.GetYahooDividends.prototype.printSortedRecords = function(jsonSortedRecords) {
	
}

//Main execution code goes here.
var getYahooDividends = new mktneutral.GetYahooDividends();
//getYahooDividends.main('./tickerList.json','./dividendYieldRecords.json');
getYahooDividends.sortRecords('./dividendYieldRecords.json','./sortedYieldRecords.json');
