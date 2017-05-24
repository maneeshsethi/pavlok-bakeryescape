var pavlok = {};
pavlok.generic = function(route, percent, msg){
	//Fetch auth code
	var authCode = pavCtx.code;
	var intensity = Math.floor(percent * 2.55);
	if(intensity > 255) intensity = 255;
	if(intensity < 0) intensity = 1;
	
	$.ajax({
		"url": "https://pavlok-mvp.herokuapp.com/api/v1/stimuli/" + 
			route + "/" + intensity + "?access_token=" + authCode +
			"&reason=" + msg,
		"method": "POST"
	})
	.done(function(message){
		console.log("sent stimuli: " + message);
	})
	.fail(function(xhr, status, error){	
		console.log("failed to send stimuli!");
	});
};
pavlok.beep = function(percent, msg){
	pavlok.generic("beep", percent, msg);
};
pavlok.zap = function(percent, msg){
	pavlok.generic("zap", percent, msg);
};
pavlok.vibrate = function(percent, msg){
	pavlok.generic("vibration", percent, msg);
};