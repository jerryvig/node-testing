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
var sqlite3 = require('sqlite3').verbose();

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
				//self.getYahoos(tickerList.tickers[i],outputJSONRecordsFile,function(){
			        self.getYahooMainPage(tickerList.tickers[i],outputJSONRecordsFile,function(){
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
 * Method to sort the dividends yield records in a JSON file. Takes a json file as input and outputs another 
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

/**
 * Method to filter and print the sorted records that you are interested in.
 * 
 * @param  jsonSortedRecords  Input file containing the dividend records in JSON format.
 * 
 */
mktneutral.GetYahooDividends.prototype.printSortedRecords = function(jsonSortedRecords) {
	fs.readFile(jsonSortedRecords,'utf8',function(err,data){
		var records = JSON.parse(data);
		async.each(records,function(rec){
			if ( rec.yield >= 0.06 && rec.yield <= 0.23 ) {
				console.log(rec.ticker + ', ' + rec.yield);
			}
		},function(err){
			console.log('There was an error.');
		});
	});
};

/**
 * Method to get the Yahoo! profile page data for a ticker symbol.
 * Refer to examples at http://finance.yahoo.com/q/pr?s=AAPL+Profile
 *
 */
mktneutral.GetYahooDividends.prototype.getYahooProfile = function(ticker,jsonRecordsFile,callback) {
    var prefix = 'http://finance.yahoo.com/q/pr?s=';
    var suffix = '+Profile'
    console.log( "Ticker = " + ticker );

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
	if ( xhr.readyState==4 ){
	    if ( xhr.status==200 ){
		responseText = xhr.responseText.replace(/<(?:.|\n)*?>/gm, '');

		var membershipIdx = responseText.indexOf('Index Membership:');
		var sectorIdx = responseText.indexOf('Sector:');
                var industryIdx = responseText.indexOf('Industry:');
                var fteIdx = responseText.indexOf('Full Time Employees:');
		var businessSummaryIdx = responseText.indexOf('Business Summary'); 

		var record = new Object();
                record.ticker = ticker;
		record.indexMembership = (responseText.substr(membershipIdx,(sectorIdx-membershipIdx))).split(':')[1];
	        record.sector = (responseText.substr(sectorIdx,(industryIdx-sectorIdx))).split(':')[1];
                record.industry = (responseText.substr(industryIdx,(fteIdx-industryIdx))).split(':')[1];
	        record.fte = (responseText.substr(fteIdx,(businessSummaryIdx-fteIdx))).split(':')[1];
                  
                console.log( JSON.stringify(record) );

                fs.appendFile(jsonRecordsFile,JSON.stringify(record),callback);
	    }
	    else {
		console.log('Error processing ticker'+ticker);
		callback();
	   }
	 }
    };

    xhr.open('GET',prefix+ticker+suffix,true);
    xhr.send();	
};

/**
 * Method to get the Yahoo! main page data for a ticker symbol.
 * Refer to examples at http://m.yahoo.com/w/legobpengine/finance/details/?.sy=aapl
 *
 */
mktneutral.GetYahooDividends.prototype.getYahooMainPage = function(ticker,jsonRecordsFile,callback) {
    var prefix = 'http://m.yahoo.com/w/legobpengine/finance/details/?.sy=';
    console.log( "Ticker = " + ticker );

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
	if ( xhr.readyState==4 ){
	    if ( xhr.status==200 ){
		var responseText = xhr.responseText.replace(/<(?:.|\n)*?>/gm, '');

		var marketsClosedIdx = responseText.indexOf('Markets closed');
                var marketCapIdx = responseText.indexOf('Market Cap:');
                var peIdx = responseText.indexOf('P/E (ttm):');
                var epsIdx = responseText.indexOf('EPS (ttm):');
		var oneDayIdx = responseText.indexOf('1 Day');

		var tickerAndName = '';
                if ( marketsClosedIdx > 0 ) {
                    tickerAndName = responseText.substr(marketsClosedIdx+14,50);
		    tickerAndName = tickerAndName.substr(0,tickerAndName.indexOf('('));
		    tickerAndName = tickerAndName.replace(ticker,'');
                }

		var marketCap = '';
                if ( marketCapIdx > 0 && peIdx > 0 ) {
                    marketCap = responseText.substr(marketCapIdx+11,(peIdx-(marketCapIdx+11)));
		    marketCap = marketCap.trim().replace('(','').replace(')','');
                }

		var peRatio = '';
                if ( peIdx > 0 && epsIdx > 0 ) {
                    responseText.substr(peIdx+11,(epsIdx-(peIdx+11)));
		    peRatio = peRatio.trim().replace('(','').replace(')','');
                }           

                var eps = '';
                if ( epsIdx > 0 && oneDayIdx > 0 ) {
		    eps = responseText.substr(epsIdx+11,(oneDayIdx-epsIdx-11));
                    eps = eps.trim().replace(')','').replace('(','');
                }

		var record = new Object();
		record.ticker = ticker;
		record.name = tickerAndName;
		record.marketCap = marketCap;
		record.peRatio = peRatio;
		record.eps = eps;

		console.log( JSON.stringify(record) );
		fs.appendFile(jsonRecordsFile,JSON.stringify(record),callback);
	    }
	    else {
		console.log('Error processing ticker'+ticker);
		callback();
	   }
	 }
    };

    xhr.open('GET',prefix+ticker,true);
    xhr.send();
};

/**
 * Method to insert the Yahoo profiles data into the sqlite database.
 *
 */
mktneutral.GetYahooDividends.prototype.insertYahooProfiles = function() {
    var db = new sqlite3.Database('YahooDividends.db',function(){
        db.run('DROP TABLE IF EXISTS yahoo_profiles',function(){
	 db.run('CREATE TABLE IF NOT EXISTS yahoo_profiles ( ticker TEXT, index_membership TEXT, sector TEXT, industry TEXT, fte TEXT )',function(){
           fs.readFile('./YahooProfileRecords.json','utf8',function(err,data){
	       var profileRecords = JSON.parse(data);
               console.log( 'RECORDS COUNT = ' + profileRecords.records.length );
               async.each(profileRecords.records,function(rec){
		   db.run('INSERT INTO yahoo_profiles VALUES ( "' + rec.ticker + '", "' + rec.indexMembership + '", "' + rec.sector + '", "' + rec.industry + '", "' + rec.fte + '" )',function(){});
               },function(){
		   db.close();
               });
           });
         });
      });
    });
};

/**
 * Method to insert the Yahoo main page data into the sqlite database.
 *
 */
mktneutral.GetYahooDividends.prototype.insertYahooMainPages = function() {
    var db = new sqlite3.Database('YahooDividends.db',function(){
      db.run('DROP TABLE IF EXISTS yahoo_main_pages',function(){
	  db.run('CREATE TABLE IF NOT EXISTS yahoo_main_pages ( ticker TEXT, name TEXT, market_cap TEXT, pe_ratio TEXT, eps TEXT )',function(){
	      fs.readFile('./YahooMainPageRecords.json','utf8',function(err,data){
                 var mainPageRecords = JSON.parse(data);
                 async.each(mainPageRecords.records,function(rec){
                     db.run('INSERT INTO yahoo_main_pages VALUES ( "' + rec.ticker + '", "' + rec.name + '", "' + rec.marketCap + '", "' + rec.peRatio + '", "' + rec.eps + '" )',function(){});
                     },function(){
	               db.close();
                 });
              });
          });
       });
    });
};

/**
 * Method to insert the sorted dividend yield records.
 *
 */
mktneutral.GetYahooDividends.prototype.insertSortedYieldRecords = function() {
    var db = new sqlite3.Database('YahooDividends.db',function(){
    	db.run('DROP TABLE IF EXISTS sorted_yield_records',function(){
            db.run('CREATE TABLE sorted_yield_records ( ticker TEXT, ttmd REAL, last REAL, yield REAL )',function(){
		fs.readFile('./sortedYieldRecords.json','utf8',function(err,data){
                  var sortedYieldRecords = JSON.parse(data);
                  async.each(sortedYieldRecords.records,function(rec){
	              db.run('INSERT INTO sorted_yield_records VALUES ( "' + rec.ticker + '", "' + rec.ttmd + '", "' + rec.last + '", "' + rec.yield + '" )',function(){});
                    // console.log( rec.ticker );
                  },function(){
	               db.close();
                  });
		 });
            });
    	});
    }); 
};

//Main execution code goes here to instantiate the object and run.
var getYahooDividends = new mktneutral.GetYahooDividends();
//getYahooDividends.main('./tickerList.json','./YahooMainPageRecords.json');
getYahooDividends.insertYahooProfiles();
//getYahooDividends.insertSortedYieldRecords();

//getYahooDividends.sortRecords('./dividendYieldRecords.json','./sortedYieldRecords.json');
//getYahooDividends.printSortedRecords('./sortedYieldRecords.json');
//var tickersArray = new Array('aapl','xom','wmt','msft','csco','cop','cvx','wag','cmcsa','goog','lnkd');
//var tickersArray = new Array('aait');
//async.each(tickersArray,function(ticker){
//   getYahooDividends.getYahooMainPage(ticker,'./YahooMainPageRecords.json',function(){});
//},function(){});
