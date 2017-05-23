var ACCEL = 50;
var X_MOVEMENT = 0.6;
var Y_INST_VELOCITY = -70;
var CANVAS_WIDTH = 160;
var CANVAS_HEIGHT = 240;
var DEFAULT_SPRITE_WIDTH = 30;
var DEFAULT_SPRITE_HEIGHT = 20;
var PLAY_SPRITE_SIZE = 40;
var FIELD_HEIGHT = 170;
var FIELD_WIDTH = 160;

var MODULE_COLLISION_MAP = {
	"player1": {
		"height": 20,
		"width": 30,
		"p1": {
			"x": 30,
			"y": 0
		},
		"p2": {
			"x": 30,
			"y": 20
		}
	},
	"player2": {
		"height": 28,
		"width": 34,
		"p1": {
			"x": 33,
			"y": 13
		},
		"p2": {
			"x": 24,
			"y": 27
		}
	}, 
	"player3": {
		"height": 34,
		"width": 30,
		"p1": {
			"x": 29,
			"y": 23
		},
		"p2": {
			"x": 14,
			"y": 32
		}
	},
	"player4": {
		"height": 30,
		"width": 20,
		"p1": {
			"x": 20,
			"y": 0
		},
		"p2": {
			"x": 20,
			"y": 30
		}
	}
};

var score;
var lastEventY;
var lastEventTime;
var gameStartTime;
var appStartTime;
var x;
var y;
var aY;
var moduleSpriteIndex;

var onStartScreen = true;
var onPlayScreen = false;
var onGameOverScreen = false;

var pendingMouseEvent = false;
var lastMouseEventDown = false;

function queueJump(){
	lastEventTime = new Date();
	lastEventY = y;
}

function step(){
	//(1) Handle any new input
	if(pendingMouseEvent){
		console.log("Processing pending mouse event...");
		
		if(lastMouseEventDown){ //Pending event is a MOUSE_DOWN
			if(onPlayScreen){
				queueJump();
			}
		} else { //Pending event is a MOUSE_UP
			if(onStartScreen || onGameOverScreen){ //Restart the game
				console.log("Starting game...");
				startGame();
			} 
		}
		pendingMouseEvent = false;
	}
	
	//(2) If we're in play mode, update internal game state
	if(onPlayScreen){
		//(1) Move player
		var deltaT = (new Date() - lastEventTime) / 1000;
		
		x += X_MOVEMENT;
		var accelCmp = (ACCEL * (deltaT * deltaT));
		y = lastEventY + (Y_INST_VELOCITY * deltaT) + accelCmp;
		console.log("inst. accel " + accelCmp);
		
		//Realtime bitmap rotation is for chumps
		if(accelCmp < 70){
			moduleSpriteIndex = 1;
		} else if (accelCmp < 150){
			moduleSpriteIndex = 2;
		} else if (accelCmp < 250){
			moduleSpriteIndex = 3;
		} else {
			moduleSpriteIndex = 4;
		}
		
		console.log("@" + deltaT + ": " + x + ", " + y);
		
		//(2) Calculate collisions using expected module sprite
		
		//(3) If we just got through a pipe, update score
	}
	
	
	//(3) Update the screen
	render();
}

function render(){
	if(onStartScreen){
		canvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		canvasCtx.drawImage(assetMap["background"], 0, 0);
		canvasCtx.drawImage(assetMap["title"], 0, 0);
		
		//Pulsing play button
		var playScaleFactor = Math.sin((new Date() - appStartTime) / 200);
		
		//Scales from 30-50px
		var outWidth = PLAY_SPRITE_SIZE + (playScaleFactor * 10);
		var outHeight = PLAY_SPRITE_SIZE + (playScaleFactor * 10); 
		canvasCtx.drawImage(assetMap["play"], (CANVAS_WIDTH / 2) - (outWidth / 2), (CANVAS_HEIGHT / 2) - (outHeight / 2), outWidth, outHeight);
	}
	
	if(onPlayScreen){
		canvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		
		//(1) Draw background
		canvasCtx.drawImage(assetMap["background"], 0, 0);
		
		//(2) Draw moving tiles
		
		//(3) Draw "pipes"
		
		//(4) Draw player
		var moduleInfo = MODULE_COLLISION_MAP["player" + moduleSpriteIndex];
		var moduleSprite = assetMap["player" + moduleSpriteIndex];
		canvasCtx.drawImage(moduleSprite, (CANVAS_WIDTH / 4) - (moduleInfo.width / 2), y);
		
		//(5) Draw scoreboard
		
		//(6) Draw score
	}
	
	if(onGameOverScreen){
		//TODO
	}
}

function startGame(){
	score = 0;
	moduleSpriteIndex = 1;
	lastEventTime = new Date();
	gameStartTime = new Date();
	aY = ACCEL;
	x = (FIELD_WIDTH / 2) - (DEFAULT_SPRITE_WIDTH / 2);
	y = (FIELD_HEIGHT /2 ) - (DEFAULT_SPRITE_HEIGHT / 2); 
	lastEventY = y;
	
	onStartScreen = false;
	onPlayScreen = true;
	onGameOverScreen = false;
}

var canvas;
var canvasCtx;
var assetList = [ "title", "background", "play", "player1", "player2", "player3", "player4" ];
var assetMap = {}; //String -> element

function loadAssets(){
	canvas = $("#cv").get(0);
	canvasCtx = canvas.getContext("2d");
	for(var i = 0; i < assetList.length; i++){
		var el = $("#asset_" + assetList[i]).get(0);
		if(el !== undefined){
			assetMap[assetList[i]] = el;
		} else {
			console.log("WARN: Failed to get asset " + assetList[i] + "!");
		}
	}
}

$(document).ready(function(){
	console.log("onReady!");
	
	appStartTime = new Date();
	loadAssets();
	
	setInterval(step, 1000 / 60);
	canvas.onmousedown = function(){
		pendingMouseEvent = true;
		lastMouseEventDown = true;
		console.log("onMouseDown");
	};
	canvas.onmouseup = function(){
		pendingMouseEvent = true;
		lastMouseEventDown = false;
		console.log("onMouseUp");
	};
});