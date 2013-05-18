//define caller
function caller(cb) {
  cb('called back');
}

//define callback
function callback(str){
  setTimeout(function(){
       console.log(str);
  },0);
}

caller(callback);

for ( var i=0; i<10; i++ ) {
  var randomNumber = Math.random();
  var sqrtRandomNumber = Math.sqrt(randomNumber);
  console.log('SQRT('+randomNumber+') = '+sqrtRandomNumber);
}
