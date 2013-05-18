var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var xhr = new XMLHttpRequest();
xhr.onreadystatechange = function(){
 if ( xhr.readyState == 4 && xhr.status == 200 ) {
    console.log( xhr.responseText );
 }
 else if ( xhr.readyState == 4 && xhr.status == 404 ) {
	console.log('Failed to load the page');
 }
}

console.log('sending the xmlhttprequest');

xhr.open("GET","http://m.bing.com/");
xhr.send();

console.log('sent request and waiting for response.');
