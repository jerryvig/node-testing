var http = require('http');
var events = require('events');
var async = require('async');

var today = new Date();
var oneYearAgo = new Date();
oneYearAgo.setFullYear(today.getFullYear()-1);
var oneYearAgoISO = oneYearAgo.toISOString().substr(0,10);

var rows = new Array();

function pushRows(ticker,respBody) {
  var lines =  respBody.split('\n');

  var row = new Object();
  row.ticker = ticker;
  row.ttmd = 0.0;
  
  async.forEach(lines.slice(1,lines.length-1), function(line,callback){
      var vals = line.split(',');
      if ( vals[0] > oneYearAgoISO ) {
          row.ttmd += (vals[1]*1.0);
      }
  }, function(){
     //rows.push( row );
     return row;
  });
}

var getYahooHistory = function(ticker) {
 var prefix = 'http://ichart.finance.yahoo.com/table.csv?s=';
 var suffix = '&a='+today.getMonth()+'&b='+today.getDate()+'&c='+(today.getFullYear()-1)+'&d='+today.getMonth()+'&e='+today.getDate()+'&f='+today.getFullYear()+'&g=v&ignore=.csv';
 
 http.get(prefix+ticker+suffix,function(resp){
   var respBody = '';
   resp.on('data',function(chunk){
      respBody += chunk;
   });
   resp.on('end',function(){
      var row = pushRows(ticker,respBody.toString());
      return row;
      //callback(ticker,respBody.toString());
   });
 }).on('error',function(e){
   console.log('ERROR HISTORY = '+e.message);
 });
};

var getYahooLast = function(ticker){
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
		  return cols[1];
		});
	}).on('error',function(e){
		console.log('ERROR LAST = '+e.message);
	});	
};

function getYahoos(ticker,callback){ 
	async.parallel([function(callback){ 
						var result = getYahooHistory(ticker);
						callback(null,result);
				    },
				    function(callback){ 
				    	var result = getYahooLast(ticker);
				    	callback(null,result);
				    }],
					function(err,results) {
						console.log('Ticker = '+ticker+' done.');
						console.log(results);
					});
	callback();
}

var tickers = new Array('rem','kbwd','hyld','dwx','jnk','hyg','amj','amlp','pcef','pgf','pgx','pff');
//var tickers = ['nly','agnc','hts','ivr','cim','bpt','kmp','eep'];

//This just gives you the values sorted by the gross value of the dividend, and not by the dividend yield.

async.each( tickers, getYahoos, function(){
    //rows.sort( function(a,b){ return b.ttmd - a.ttmd; } );
    //console.log( rows );
});