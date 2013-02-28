var http = require('http');
var events = require('events');
var async = require('async');
var fs = require('fs');

var today = new Date();
var oneYearAgo = new Date();
oneYearAgo.setFullYear(today.getFullYear()-1);
var oneYearAgoISO = oneYearAgo.toISOString().substr(0,10);

function pushRows(ticker,respBody) {
  var lines =  respBody.split('\n');
  var row = new Object();
  row.ticker = ticker;
  row.ttmd = 0.0;
  
  async.each(lines.slice(1,lines.length-1), function(line,callback){
      var vals = line.split(',');
      if ( vals[0] > oneYearAgoISO ) {
          row.ttmd += (vals[1]*1.0);
      }
  }, function(err){
  	 console.log('ERROR = '+err);
  });
  
  return row;
}

function getYahooHistory(ticker,callback) {
 var prefix = 'http://ichart.finance.yahoo.com/table.csv?s=';
 var suffix = '&a='+today.getMonth()+'&b='+today.getDate()+'&c='+(today.getFullYear()-1)+'&d='+today.getMonth()+'&e='+today.getDate()+'&f='+today.getFullYear()+'&g=v&ignore=.csv';
 
 http.get(prefix+ticker+suffix,function(resp){
   var respBody = '';
   resp.on('data',function(chunk){
      respBody += chunk;
   });
   resp.on('end',function(){
      var row = pushRows(ticker,respBody.toString());
      callback(null,row);
   });
 }).on('error',function(e){
   console.log('ERROR HISTORY = '+e.message);
 });
}

function getYahooLast(ticker,callback){
	var prefix = 'http://download.finance.yahoo.com/d/quotes.csv?s=';
	var suffix = '&f=sl1'
	console.log( "Ticker = " + ticker );
		
	http.get(prefix+ticker+suffix,function(resp){
		var respBody = '';
		resp.on('data',function(chunk){
		      respBody += chunk;
		});
		resp.on('end',function(){
		  var cols = respBody.split(',');
		  callback(null,cols[1].trim());
		});
	}).on('error',function(e){
		console.log('ERROR LAST = '+e.message);
	});		
}

function getYahoos(ticker,cb){ 
	async.parallel([function(callback){ 
						var results = getYahooHistory(ticker,callback);
				    },
				    function(callback){ 
				    	var results = getYahooLast(ticker,callback);
				    }],
					function(err,results) {
						var record = new Object();
						record.ticker = results[0].ticker;
						record.ttmd = results[0].ttmd;
						record.last = results[1];
						record.yield = results[0].ttmd/results[1]; 
						
						console.log( record );
					});
	cb();
}

function main() {
	fs.readFile('./tickerList.json','utf8',function(err,data){
		var tickerList = JSON.parse(data);
		async.each( tickerList.tickers, getYahoos, function(){});
	});
}

main();
