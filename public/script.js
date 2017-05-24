var ACCEL = 50;
var X_MOVEMENT = 0.85;
var PIPE_HEIGHT_BASE = 65;
var PIPE_HEIGHT_VARIABILITY = 10;
var Y_INST_VELOCITY = -70;
var CANVAS_WIDTH = 160;
var CANVAS_HEIGHT = 240;
var DEFAULT_SPRITE_WIDTH = 30;
var DEFAULT_SPRITE_HEIGHT = 20;
var PLAY_SPRITE_SIZE = 40;
var FIELD_HEIGHT = 170;
var FIELD_WIDTH = 160;
var PIPE_WIDTH = 35;

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
var cPX;
var cPY;
var moduleSpriteIndex;
var pipes;

var onStartScreen = true;
var onPlayScreen = false;
var onGameOverScreen = false;

var pendingMouseEvent = false;
var lastMouseEventDown = false;

function queueJump(){
	lastEventTime = new Date();
	lastEventY = y;
	
	console.log("Queued jump; lastEventY = " + lastEventY);
}

function rand(){
	return (Math.random() - 0.5) * 2;
}

function buildPipe(){
	var center = (FIELD_HEIGHT / 2) + (rand() * 35); //Centered from  50-120 
	var pipeHeight = PIPE_HEIGHT_BASE + (rand() * PIPE_HEIGHT_VARIABILITY); //54-80 pixels of space
		
	//"units" specifies what should be rendered in terms of:
	// {
	//	"sy": pixels to sample vertically from image,
	// 	"y": start y for unit,
	//	"height": height for unit
	// }
	//	everything else about the drawing is obvious
	
	var units = [];
	
	//Top part of pipe; this is actually quite easy
	for(var i = center - (pipeHeight / 2) - 35; i > -35; i -= 35){
		var sy = 35;
		var y = i;
		var height = 35;
		
		units.push({ 
			"sy": sy,
			"y": i,
			"height": height
		});
	}
	
	//Bottom part of pipe; this gets weird when we're drawing the cut-off donut at bottom
	for(var i = center + (pipeHeight / 2); i < 170; i += 35){
		if(i > 135){
			var sy = FIELD_HEIGHT - i;
			var y = i;
			var height = FIELD_HEIGHT - i;
			
			units.push({ 
				"sy": sy,
				"y": i,
				"height": height
			});
		} else {
			var sy = 35;
			var y = i;
			var height = 35;
			
			units.push({ 
				"sy": sy,
				"y": i,
				"height": height
			});
		}
	}
	
	var x = FIELD_WIDTH;
	return {
		"center": center,
		"height": pipeHeight,
		"x": x,
		"asset": "donut_" + (Math.floor(Math.random() * 3) + 1),
		"units": units,
		"scored": false
	};
}

function step(){
	//(1) Handle any new input
	if(pendingMouseEvent){
		console.log("Processing pending mouse event...");
		
		if(lastMouseEventDown){ //Pending event is a MOUSE_DOWN
			console.log("Last event was down");
			if(onPlayScreen){
				queueJump();
			}
		} else { //Pending event is a MOUSE_UP
			console.log("last event was an up");
			if(onStartScreen || onGameOverScreen){ //Restart the game
				if(onGameOverScreen){
					if(pavCtx.code != "none") pavlok.beep(50, "Good luck!");
				}
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
		
		//console.log("@" + deltaT + ": " + x + ", " + y);
	
		//(2) Update pipes
		if(x > 100){ //We don't care about pipes until we're a little in
			if(pipes.length < 2){ //Spawn first two pipes
				var pipe1 = buildPipe();
				var pipe2 = buildPipe();
				
				pipe2.x += (FIELD_WIDTH / 2) + PIPE_WIDTH;
				pipes.push(pipe1);
				pipes.push(pipe2);
			} else { //Update pipes
				for(var i = 0; i < pipes.length; i++){
					pipes[i].x -= X_MOVEMENT; //same plane as module
					
					if(pipes[i].x < -PIPE_WIDTH){ //i.e. offscreen
						pipes.splice(0, 1);
						pipes.push(buildPipe());
						pipes[1].x = FIELD_WIDTH + PIPE_WIDTH;
					}
				}
			}
		}
		
		var moduleInfo = MODULE_COLLISION_MAP["player" + moduleSpriteIndex];
		var cUnits = [];
		
		cUnits.push({
			"x": (CANVAS_WIDTH / 4) - (moduleInfo.width / 2) + moduleInfo.p1.x,
			"y": y + moduleInfo.p1.y
		});
		cUnits.push({
			"x": (CANVAS_WIDTH / 4) - (moduleInfo.width / 2) + moduleInfo.p2.x,
			"y": y + moduleInfo.p2.y
		});
		
		//(3) Calculate collisions using expected module sprite
		for(var i = 0; i < cUnits.length; i++){
			var colPoint = cUnits[i];
		
		
			//(a) Pipe collisions
			for(var j = 0; j < pipes.length; j++){
				var pipe = pipes[j];
				
				var topTop = 0;
				var topBottom = pipe.center - (pipe.height / 2);
				var topLeft = pipe.x;
				var topRight = pipe.x + PIPE_WIDTH;
								
				var bottomTop = pipe.center + (pipe.height / 2);
				var bottomBottom = 170;
								
				if(colPoint.x >= topLeft && colPoint.x <= topRight){
					if(colPoint.y >= topTop && colPoint.y <= topBottom){
						cPX = colPoint.x;
						cPY = colPoint.y;
						endGame();
					} else if(colPoint.y >= bottomTop && colPoint.y <= bottomBottom){ //Bottom pipe
						cPX = colPoint.x;
						cPY = colPoint.y;
						endGame();
					}
				}
			}
			
			//(b) Ground/ceiling collisions
			if(colPoint.y < 0 || colPoint.y > 170){
				cPX = colPoint.x;
				cPY = colPoint.y;
				endGame();
			}
		}
				
		//(4) If we just got through a pipe, update score
		for(var i = 0; i < pipes.length; i++){
			var pipe = pipes[i];
			if(!pipe.scored && (((CANVAS_WIDTH / 4) + moduleInfo.p1.x) > (pipe.x + (PIPE_WIDTH / 2)))){
				score += 1;
				pipe.scored = true;
				
				if(score % 5 == 0){
					if(pavCtx.code != "none") pavlok.vibrate(60, "Keep up the good playing!");
				} else if (score == 1){
					if(pavCtx.code != "none") pavlok.vibrate(60, "Nice start ;)");
				}
			}
		}
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
	
	if(onPlayScreen || onGameOverScreen){
		canvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		
		//(1) Draw background
		canvasCtx.drawImage(assetMap["background"], 0, 0);
		
		//(2) Draw moving tiles, desserts, and case overlay
		var tileAsset = assetMap["tiles"];
		var blockOneX = (x / 1) % 160;
		var blockTwoX = blockOneX + 160;
		blockOneX -= 160;
		blockTwoX -= 160;
		blockOneX = -blockOneX;
		blockTwoX = -blockTwoX;
		canvasCtx.drawImage(tileAsset, Math.floor(blockOneX), 220);
		canvasCtx.drawImage(tileAsset, Math.floor(blockTwoX), 220);
		
		var donutAsset = assetMap["donut_shelf"];
		var cakeAsset = assetMap["cake_shelf"];
		var overlayAsset = assetMap["case_overlay"];
		
		blockOneX = (x / 2) % 160;
		blockTwoX = blockOneX + 160;
		blockOneX -= 160;
		blockTwoX -= 160;
		blockOneX = -blockOneX;
		blockTwoX = -blockTwoX;
		canvasCtx.drawImage(donutAsset, Math.floor(blockOneX), 200);
		canvasCtx.drawImage(donutAsset, Math.floor(blockTwoX), 200);
		
		blockOneX = (x / 3) % 160;
		blockTwoX = blockOneX + 160;
		blockOneX -= 160;
		blockTwoX -= 160;
		blockOneX = -blockOneX;
		blockTwoX = -blockTwoX;
		canvasCtx.drawImage(cakeAsset, Math.floor(blockOneX), 180);
		canvasCtx.drawImage(cakeAsset, Math.floor(blockTwoX), 180);
		
		canvasCtx.drawImage(overlayAsset, 0, 180);
		
		//(3) Draw "pipes" 
		for(var i = 0; i < pipes.length; i++){
			var pipe = pipes[i];
			var units = pipe.units;
			var asset = assetMap[pipe.asset];
						
			for(var j = 0; j < units.length; j++){
				var unit = units[j];
				canvasCtx.drawImage(asset, 0, 0, 35, Math.floor(unit.height), Math.floor(pipe.x), Math.floor(unit.y), PIPE_WIDTH, Math.floor(unit.height));
			}
		}
		
		//(4) Draw player
		if(onPlayScreen){
			var moduleInfo = MODULE_COLLISION_MAP["player" + moduleSpriteIndex];
			var moduleSprite = assetMap["player" + moduleSpriteIndex];
			canvasCtx.drawImage(moduleSprite, Math.floor((CANVAS_WIDTH / 4) - (moduleInfo.width / 2)), Math.floor(y));
		} else { //We're on the "game over screen", so draw a chubby Pavlok instead
			var chubbySprite = assetMap["chubby_pavlok"];
			canvasCtx.drawImage(chubbySprite, Math.floor(cPX - 17), Math.floor(cPY - 23));
		}
		
		//(5) Draw scoreboard
		canvasCtx.drawImage(assetMap["scoreboard"], (FIELD_WIDTH / 2) - 15, 5);
		
		//(6) Draw score
		canvasCtx.fillText(score + "", (FIELD_WIDTH / 2), 28);
	}
	
	if(onGameOverScreen){
		var restartScaleFactor = Math.sin((new Date() - appStartTime) / 200);
		
		//Scales from 30-50px
		var outWidth = PLAY_SPRITE_SIZE + (restartScaleFactor * 10);
		var outHeight = PLAY_SPRITE_SIZE + (restartScaleFactor * 10); 
		canvasCtx.drawImage(assetMap["restart"], (CANVAS_WIDTH / 2) - (outWidth / 2), (CANVAS_HEIGHT / 2) - (outHeight / 2), outWidth, outHeight);
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
	pipes = [];
	
	onStartScreen = false;
	onPlayScreen = true;
	onGameOverScreen = false;
}

function endGame(){
	console.log("Game over!");
	
	if(pavCtx.code != "none") pavlok.zap(35, "Better luck next time!");
	
	onStartScreen = false;
	onPlayScreen = false;
	onGameOverScreen = true;
}

var canvas;
var canvasCtx;
var assetList = [ "title", "scoreboard", "background", "play", "player1", 
				  "player2", "player3", "player4", "donut_1", "donut_2", "donut_3",
				  "restart", "tiles", "donut_shelf", "cake_shelf", "case_overlay",
				  "chubby_pavlok" ];
var assetMap = {}; //String -> element

function loadAssets(){
	canvas = $("#cv").get(0);
	canvasCtx = canvas.getContext("2d");
	canvasCtx.font = "16px Orbitron";
	canvasCtx.fillStyle = "red";
	canvasCtx.textAlign = "center";
	for(var i = 0; i < assetList.length; i++){
		var el = $("#asset_" + assetList[i]).get(0);
		if(el !== undefined){
			assetMap[assetList[i]] = el;
		} else {
			console.log("WARN: Failed to get asset " + assetList[i] + "!");
		}
	}
}

function setupButtons(easy, normal, hard){
	$("#easy-btn" ).prop( "disabled", easy);
	$("#normal-btn" ).prop( "disabled", normal);
	$("#hard-btn" ).prop( "disabled", hard);
	
	if(easy){
		X_MOVEMENT = 0.55;
		PIPE_HEIGHT_BASE = 72;
		PIPE_HEIGHT_VARIABILITY = 6;
	}
	if(normal){
		X_MOVEMENT = 0.90;
		PIPE_HEIGHT_BASE = 67;
		PIPE_HEIGHT_VARIABILITY = 13;
	}
	if(hard){
		X_MOVEMENT = 1.20;
		PIPE_HEIGHT_BASE = 55;
		PIPE_HEIGHT_VARIABILITY = 10;
	}
}

var spaceDown = false;
$(document).ready(function(){
	console.log("onReady!");
	
	appStartTime = new Date();
	loadAssets();
	
	setInterval(step, 1000 / 60);
	
	if ('ontouchstart' in window){
		canvas.ontouchstart = function(){
			pendingMouseEvent = true;
			lastMouseEventDown = true;
			console.log("onPointerDown");
		};
		canvas.ontouchend = function(){
			pendingMouseEvent = true;
			lastMouseEventDown = false;
			console.log("onPointerUp");
		}
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
	} else if (window.PointerEvent) {
		canvas.onpointerdown = function(){
			pendingMouseEvent = true;
			lastMouseEventDown = true;
			console.log("onPointerDown");
		};
		canvas.onpointerup = function(){
			pendingMouseEvent = true;
			lastMouseEventDown = false;
			console.log("onPointerUp");
		}
	} else {
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
	}
	
	
	//Hide/show depending on whether there's valid stuff
	//Could be done in Nunjucks, but I forgot how
	if(pavCtx.code == "none"){
		$("#login").show();
		$("#logged-in").hide();
	} else {
		$("#logged-in").show();
		$("#login").hide();
	}
	
	//Difficulty buttons
	setupButtons(false, true, false);
	$("#easy-btn").click(function(){
		setupButtons(true, false, false);
	});
	$("#normal-btn").click(function(){
		setupButtons(false, true, false);
	});
	$("#hard-btn").click(function(){
		setupButtons(false, false, true);
	});
	
	//Space to jump
	$(document).keydown(function(e){
		if(e.which != 32) return; //space
		e.preventDefault(); //don't scroll/click w/ space
		if(spaceDown) return;

		pendingMouseEvent = true;
		lastMouseEventDown = true;
		spaceDown = true;
		console.log("onSpaceDown");
	});
	$(document).keyup(function(e){
		if(e.which != 32) return;
		e.preventDefault();
		spaceDown = false;
		
		pendingMouseEvent = true;
		lastMouseEventDown = false;
		console.log("onSpaceUp");
	});
});