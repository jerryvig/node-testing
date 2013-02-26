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
      callback();
  }, function(){
     rows.push( row );
  });
}

function getYahoo(ticker,callback) {
 var prefix = 'http://ichart.finance.yahoo.com/table.csv?s=';
 var suffix = '&a='+today.getMonth()+'&b='+today.getDate()+'&c='+(today.getFullYear()-1)+'&d='+today.getMonth()+'&e='+today.getDate()+'&f='+today.getFullYear()+'&g=v&ignore=.csv';
 
 http.get(prefix+ticker+suffix,function(resp){
   var respBody = '';
   resp.on('data',function(chunk){
      respBody += chunk;
   });
   resp.on('end',function(){
      pushRows(ticker,respBody.toString());
      callback();
   });
 }).on('error',function(e){
   console.log('ERROR = '+e.message);
 });
}

// var tickers = new Array('rem','kbwd','hyld','dwx','jnk','hyg','amj','amlp','pcef','pgf','pgx','pff');
var tickers = ['nly','agnc','hts','ivr','cim','bpt','kmp'];

//This just gives you the values sorted by the gross value of the dividend, and not by the dividend yield.
async.forEach( tickers, getYahoo, function(){
    rows.sort( function(a,b){ return b.ttmd - a.ttmd; } );
    console.log( rows );
});

