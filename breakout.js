const canvas = document.getElementById("gamecanvas");
const context = canvas.getContext("2d");

// keyboard events
var keys = [];
document.body.addEventListener("keydown", function (e) {
    keys[e.keyCode] = true;
});
document.body.addEventListener("keyup", function (e) {
    keys[e.keyCode] = false;
});

// touchscreen events
var touch = "";
document.addEventListener("touchstart", touchStartHandler);
document.addEventListener("touchend", touchEndHandler);
function touchStartHandler(e) {
    if(e.touches) {
        if (e.touches[0].pageX < canvas.offsetLeft + canvas.width/2) {
            touch = "left";
        } else {
            touch = "right";
        }
        e.preventDefault();
    }
}
function touchEndHandler(e) {
    if(e.touches) {
        touch = "";
        e.preventDefault();
    }
}

function sound(src) {
    this.sound = document.createElement("audio");
    this.sound.src = src;
    this.sound.setAttribute("preload", "auto");
    this.sound.setAttribute("controls", "none");
    this.sound.style.display = "none";
    document.body.appendChild(this.sound);
    this.play = function(){
        this.sound.play();
    }
    this.stop = function(){
        this.sound.pause();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;

        this.sound = {};
        this.initializeSounds();
        
        this.startAttractMode();

        this.accumulator = 0;
        this.step = 1/360;
        let lastTime = null;
        this._frameCallback = (timestamp) => {
            if (lastTime !== null) {
                this.accumulator += (timestamp - lastTime) / 1000;
                while (this.accumulator >= this.step) {
                    this.processInput();
                    this.simulate(this.step);
                    this.accumulator -= this.step;
                }
                this.render();
            }
            lastTime = timestamp;
            requestAnimationFrame(this._frameCallback);
        };
        requestAnimationFrame(this._frameCallback);
    }

    startAttractMode() {
        this.attractMode = true;
        this.score = 0;
        this.multiplier = 1;
        this.lives = 1;
        this.level = Math.floor(Math.random() * 3) + 1;

        this.ball = new Ball();
        this.player = new Player();
        this.blocks = generateLevel(this.level);
    }

    startGame() {
        this.attractMode = false;
        this.score = 0;
        this.multiplier = 1;
        this.lives = 3;
        this.level = 1;

        this.ball = new Ball();
        this.player = new Player();
        this.blocks = generateLevel(this.level);
    }

    initializeSounds() {
        this.sound["PlayerHit"] = new sound("sounds/playerhit.wav");
        this.sound["BlockHit"] = new sound("sounds/blockhit.mp3");
        this.sound["WallHit"] = new sound("sounds/wallhit.wav");
        this.sound["LifeLost"] = new sound("sounds/lifelost.mp3");
    }

    processInput() {
        if ((keys[37] || touch == "left") && !this.attractMode) {
            this.player.moveLeft();
        }
        if ((keys[39] || touch == "right") && !this.attractMode) {
            this.player.moveRight();
        }
        if ((keys[13] || touch != "") && this.attractMode) {
            this.startGame();
            this.ball = new Ball();
            this.player = new Player();
        }
        if (keys[27] && !this.attractMode) {
            this.startAttractMode();
        }
    }
    
    simulate(deltaTime) {
        this.player.update(deltaTime);

        if (this.ball.pos.y-this.ball.height/2 > this.canvas.height) {
            // player missed the ball
            this.sound["LifeLost"].play();
            this.ball = new Ball();
            this.player = new Player();
            this.multiplier = 1;
            if (--this.lives == 0) this.startAttractMode(); // fix me
        } else if (this.ball.pos.y-this.ball.height/2 <= 0) {
            // ball touched ceiling
            this.sound["WallHit"].play();
            this.ball.velocity.y = -this.ball.velocity.y;
        } else if (this.ball.pos.x-this.ball.width/2 <= 0 || this.ball.pos.x+this.ball.width/2 >= this.canvas.width) {
            // ball touched left or right wall
            this.sound["WallHit"].play();
            this.ball.velocity.x = -this.ball.velocity.x;
        }
        this.ball.pos.x += this.ball.velocity.x * deltaTime;
        this.ball.pos.y += this.ball.velocity.y * deltaTime;

        // detect ball collision with player
        if (this.ball.collisionDetection(this.player)) {
            this.sound["PlayerHit"].play();
            if (this.ball.collisionSide(this.player) == "top/bottom") {
                this.ball.velocity.x = ((this.ball.pos.x+this.ball.width/2) - (this.player.pos.x+this.player.width/2)) * 6;
                this.ball.velocity.y = -this.ball.velocity.y;
            } else {
                this.ball.velocity.x *= -1; 
            }
            this.multiplier = 1;
        }

        // detect ball collision with blocks
        this.blocks.forEach((block)=> {
            if (this.ball.collisionDetection(block)) {
                this.sound["BlockHit"].play();
                this.score += this.multiplier++;
                
                var health = block.damage();
                if (health <= 0) {
                    var i = this.blocks.indexOf(block);
                    this.blocks.splice(i, 1);
                }

                var side = this.ball.collisionSide(block);
                if (side == "top/bottom") {
                    this.ball.velocity.y = -this.ball.velocity.y;
                } else {
                    this.ball.velocity.x = -this.ball.velocity.x;
                }
            }
        });

        // check if level cleared
        if (this.blocks.length == 0) {
            if (this.attractMode) {
                // restart attract mode
                this.startAttractMode();
            } else {
                // move to next level
                this.blocks = generateLevel(++this.level);
                this.ball = new Ball();
                this.player = new Player();
            }
        }

        // AI
        if (this.attractMode) {
            if (this.ball.pos.y > this.canvas.height*0.3 && this.ball.pos.y < this.canvas.height*0.9) {
                if ((this.player.pos.x + this.player.width/2) - (this.ball.pos.x + this.ball.width/2) < 50) {
                    this.player.moveRight();
                } else if ((this.player.pos.x + this.player.width/2) - (this.ball.pos.x + this.ball.width/2) > -50) {
                    this.player.moveLeft();
                }
            }
        }
    }

    render() {
        // draw background
        context.fillStyle = "#272822";
        context.fillRect(0, 0, canvas.width, canvas.height);

        // draw objects
        this.ball.draw();
        this.player.draw();
        this.blocks.forEach(function(block) {
            block.draw();
        });

        // draw text
        if (this.attractMode) {
            context.fillStyle = "rgba(0, 0, 0, 0.75)";
            context.fillRect(canvas.width/2-140, canvas.height*3/4-20, 280, 28);
            context.fillStyle = "white";
            context.font = "20px Georgia";
            context.textAlign = "center";
            context.fillText("Press <enter> to start playing", canvas.width / 2, canvas.height * 3/4);
        } else {
            context.fillStyle = "rgba(255, 255, 255, 0.75)";
            context.font = "20px Georgia";
            context.textAlign = "left";
            context.fillText("Score: " + this.score, 10, 20);
            context.textAlign = "center";
            context.fillText("Level: " + this.level, canvas.width/2, 20);
            context.textAlign = "right";
            context.fillText("Lives: " + this.lives, canvas.width-10, 20);
            context.globalAlpha = 1;
        }
    }
}

class Rectangle {
    constructor(x, y, width, height, color="#FFF") {
        this.pos = { x: x, y: y};
        this.width = width;
        this.height = height;
        this.color = color;
    }

    get left() {
        return this.pos.x;
    }

    set left(x) {
        this.pos.x = x;
    }

    get right() {
        return this.pos.x + this.width;
    }

    set right(x) {
        this.pos.x = x - this.width;
    }

    get top() {
        return this.pos.y;
    }
    
    set top(y) {
            this.pos.y = y;
    }

    get bottom() {
        return this.pos.y + this.height;
    }
    
    set bottom(y) {
            this.pos.y = y - this.height;
    }

    collisionDetection(object) {
        if (this.left < object.right &&
            this.right > object.left &&
            this.top < object.bottom &&
            this.bottom > object.top) {
            return true;
        }
        return false;
    }

    // returns whether object was hit from top/bottom or left/right
    collisionSide(object) {
        const intersectionVertical = this.height + object.height - Math.abs(this.top-object.top) - Math.abs(this.bottom-object.bottom);
        const intersectionHorizontal = this.width + object.width - Math.abs(this.left-object.left) - Math.abs(this.right-object.right);

        if (intersectionVertical <= intersectionHorizontal) {
            return "top/bottom";
        } else {
            return "left/right";
        }
        return "";
    }

    draw() {
        context.save();

        context.shadowBlur = 10;
        context.shadowColor = "black";
        context.fillStyle = this.color;
        context.fillRect(this.pos.x, this.pos.y, this.width, this.height);

        context.strokeStyle = "black";
        context.lineWidth = 1;
        context.strokeRect(this.pos.x+0.5, this.pos.y+0.5, this.width-1, this.height-1);

        context.restore();
    }
}

class Player extends Rectangle {
    constructor() {
        const width = 120;
        const height = 16;
        super(canvas.width / 2 - width/2, canvas.height - 32, width, height, "#F92672");
        this.velocity = 0;
        this.speed = 50;
        this.friction = 0.9;
    }

    moveLeft() {
        this.velocity -= this.speed;
    }

    moveRight() {
        this.velocity += this.speed;
    }

    update(deltaTime) {
        this.pos.x += this.velocity * deltaTime;
        this.velocity *= this.friction;

        if (this.pos.x+this.width/2 < 0) {
            this.pos.x = -this.width/2;
            this.velocity = 0;
        } else if (this.pos.x+this.width/2 > canvas.width) {
            this.pos.x = canvas.width-this.width/2;
            this.velocity = 0;
        }
    }
}

class Ball extends Rectangle {
    constructor() {
        const size = 12;
        super(canvas.width/2, canvas.height-64, size, size, "#F8F8F2");
        this.speed = -300;
        this.velocity = {x: (Math.random() + 0.5) * Math.pow(-1, Math.floor(Math.random() * 2)) * 60,
                         y: this.speed};
    }
}

class Block extends Rectangle {
    constructor(x, y, width, height, color="#FFE792", health=1) {
        super(x, y, width, height, color);
        this.health = health;
    }

    damage(d=1) {
        this.health -= d;
        return this.health;
    }

    draw() {
        super.draw();
        if (this.health > 1) {
            context.strokeStyle = "darkgray";
            context.lineWidth = 1;
            context.strokeRect(this.pos.x+2.5, this.pos.y+2.5, this.width-5, this.height-5);
        }
    }
}

function generateLevel(level) {
    const blocks = [];
    const colors = ["#F92672", "#66D9EF", "#A6E22E", "#FD971F", "#AE81FF", "#FFE792", "#FFE792"];
    if (level == 1) {
        for (row = 0; row < 7; row++) {
            for (col = 0; col < 8; col++) {
                blocks.push(new Block(2+col*60, 60+row*20, 58, 16, colors[row]));
            }
        }
    } else if (level == 2) {
        for (row = 0; row < 3; row++) {
            for (col = 1; col < 7; col++) {
                blocks.push(new Block(2+col*60, 60+row*20, 58, 16, colors[row]));
            }
        }

        for (row = 0; row < 4; row++) {
            for (col = 0; col < 8; col++) {
                if (col == 2 || col == 5) continue;
                blocks.push(new Block(2+col*60, 160+row*20, 58, 16, colors[row]));
            }
        }

        for (col = 0; col < 8; col++) {
            blocks.push(new Block(2+col*60, 160+row*20, 58, 16, "grey", 2));
        }
    } else if (level == 3) {
        blocks.push(new Block(60, 60, 16, 196, "grey", 2));
        blocks.push(new Block(canvas.width-76, 60, 16, 196, "grey", 2));

        for (row = 0; row < 3; row++) {
            for (col = 0; col < 6; col++) {
                blocks.push(new Block(80+col*54, 60+row*20, 50, 16, colors[row]));
            }
        }
        for (row = 0; row < 4; row++) {
            blocks.push(new Block(80, 120+row*20, 50, 16, colors[2]));
            blocks.push(new Block(canvas.width-130, 120+row*20, 50, 16, colors[2]));
        }

        for (col = 0; col < 2; col++) {
            blocks.push(new Block(134+col*108, 120, 104, 76, colors[5]));
        }

        for (row = 0; row < 3; row++) {
            for (col = 0; col < 6; col++) {
                blocks.push(new Block(80+col*54, 200+row*20, 50, 16, colors[2-row]));
            }
        }

        for (col = 0; col < 6; col++) {
            blocks.push(new Block(80+col*54, 200+row*20, 50, 16, "grey", 2));
        }
    } else {
        // simple random level
        for (row = 0; row < 7; row++) {
            for (col = 0; col < 8; col++) {
                if (Math.random() >= 0.5) continue;
                blocks.push(new Block(2+col*60, 60+row*20, 58, 16, colors[row]));
            }
        }
    }
    return blocks;
}

var game = new Game(canvas);
