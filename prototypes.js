var assert = require('assert');

var Button = function(label) {
   this.label = label;
}

Button.prototype.printLabel = function() {
   console.log( this.label );
}

var CircularButton = function(radius,label) {
   this.radius = radius;
   Button.call(this,label);
}
CircularButton.prototype = new Button();

var RectangularButton = function(width,height,label){
    this.height = height;
    this.width = width;
    Button.call(this,label);
}
RectangularButton.prototype = new Button();

var plainButton = new Button('Plain Button');
console.log(plainButton.label);

var circleButton = new CircularButton(50,'Circle Button');
console.log( circleButton.label );
console.log( circleButton.radius );

var rectButton = new RectangularButton(700,500,'Big Rect Button');
console.log( rectButton.width + ", " + rectButton.height );
console.log( rectButton.label );

assert( circleButton instanceof Button, 'failed assert' );
