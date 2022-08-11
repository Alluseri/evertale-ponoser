const WebSocket = require("ws");
const fetch = require("node-fetch");
const zlib = require("zlib");
const uuid = require("uuid");

async function StreamToJSON(fetched) {
	const chunks = [];
	var stream = fetched.body;
	return JSON.parse(await new Promise((resolve, reject) => {
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
	}));
}

async function GzipToJSON(fetched) {
	const chunks = [];
	var stream = fetched.body.pipe(zlib.createGunzip());
	return JSON.parse(await new Promise((resolve, reject) => {
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
	}));
}

async function RegisterAccount(Device, Shard, Language, Region) {
	var details = {
		"platform": "android",
		"device": Device,
		"os": "Android OS 11 / API-30 (RP1A.200720.012/A225FXXU2AUH1)",
		"adid": "unknown",
		"shard": Shard || 1,
		"req": "newuser",
		"lang": Language || "jp",
		"region": Region || "JST",
		"requnique": 1
	};
	return (await GzipToJSON(await fetch("https://apialt.prd.evertaleserver.com/newuser", {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
			'User-Agent': 'UnityPlayer/2021.2.18f1 (UnityWebRequest/1.0, libcurl/7.80.0-DEV)',
			'X-Unity-Version': '2021.2.18f1'
		},
		body: Object.keys(details).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key])).join('&')
	})))["newuser"];
}

async function CreateSession(UserID, CLID, Version, Device, Shard, Language, Region) {
	var details = {
		"platform": "android",
		"device": Device,
		"os": "Android OS 11 / API-30 (RP1A.200720.012/A225FXXU2AUH1)",
		"adid": "unknown",
		"shardpick": Shard || 1,
		"lang": Language || "jp",
		"region": Region || "JST",
		"requnique": 1,
		"uid": UserID,
		"clid": CLID,
		"bundle": "com.zigzagame.evertale",
		"ver": Version, // 2.0.64
		//"vid": "87969fa2d815273f7d93465e86af8e31",
		"req": "login",
		"unique": uuid.v4()
	};
	return await GzipToJSON(await fetch("https://apialt.prd.evertaleserver.com/login", {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
			'User-Agent': 'UnityPlayer/2021.2.18f1 (UnityWebRequest/1.0, libcurl/7.80.0-DEV)',
			'X-Unity-Version': '2021.2.18f1'
		},
		body: Object.keys(details).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key])).join('&')
	}));
}

async function RestoreAccount(Code, Language, Region) {
	var details = {
		"mcode": Code,
		"lang": Language || "jp",
		"region": Region || "JST",
		"requnique": 8,
		"req": "recover",
	};
	return await GzipToJSON(await fetch("https://apialt.prd.evertaleserver.com/recover", {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
			'User-Agent': 'UnityPlayer/2021.2.18f1 (UnityWebRequest/1.0, libcurl/7.80.0-DEV)',
			'X-Unity-Version': '2021.2.18f1'
		},
		body: Object.keys(details).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key])).join('&')
	}));
}

async function UpdateSettings(SessID, Name, Message, Gender, Favorite, BlockQuakes, BlockCrumbs) {
	var details = {
		"args": Buffer.from(JSON.stringify({
			"name": Name,
			"message": Message,
			"favorite": Favorite,
			"blockQuakes": BlockQuakes || false,
			"blockCrumbs": BlockCrumbs || false,
			"gender": Gender
		})).toString('base64'),
		"sesid": SessID,
		"requnique": "1",
		"reqid": 1,
		"req": "usersettings",
	};
	return await GzipToJSON(await fetch("https://apialt.prd.evertaleserver.com/usersettings", {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
			'User-Agent': 'UnityPlayer/2021.2.18f1 (UnityWebRequest/1.0, libcurl/7.80.0-DEV)',
			'X-Unity-Version': '2021.2.18f1'
		},
		body: Object.keys(details).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key])).join('&')
	}));
}

var EvertaleChat = function (SessID, UserID, Language, Callback) {
	this.SendMessage = function (Message) {
		if (WSInst.readyState == WebSocket.CLOSED) throw "Closed...";
		WSInst.send(JSON.stringify({ "type": 2, "content": Message, "sesid": SessID, "requestID": Sequence }));
		Sequence++; // inline doesn't work fsr
	}

	Language = Language || "jp";
	if (!SessID || !UserID) return false;
	var WSInst = new WebSocket("ws://chat.prd.evertaleserver.com");
	var Sequence = 2;
	this.Session = SessID;
	var _p_resolve = null;
	this.Awaitable = new Promise(function (resolve, reject) {
		_p_resolve = resolve;
	});
	WSInst.onerror = function (e) { console.log("[EvertaleChat] Error..."); throw e; }
	WSInst.onclose = function (e) { console.log("[EvertaleChat] Closed..."); }
	WSInst.onmessage = function () {
		if (++Sequence < 4) return;
		console.log("[EvertaleChat] Handshake complete!");
		_p_resolve();
		if (Callback && typeof (Callback) == "function") WSInst.onmessage = function (m) { Callback(m.data); }
		else if (Callback) WSInst.onmessage = function (m) { console.log("[EvertaleChat] Received Message: " + m.data); }
		else WSInst.onmessage = function () { };
	};
	WSInst.onopen = function () {
		console.log("[EvertaleChat] Connected...");
		WSInst.send(JSON.stringify({ "type": 1, "content": "{\"uid\":\"" + UserID + "\",\"channel\":null,\"language\":\"" + Language + "\"}", "sesid": SessID, "requestID": 2 }))
		WSInst.send(JSON.stringify({ "type": 10, "content": "{\"uid\":\"" + UserID + "\",\"channel\":\"Shard-\",\"language\":\"" + Language + "\"}", "sesid": SessID, "requestID": 3 }))
	}
};

var EvertaleCrossChat = function (SessID, UserID, Language, Callback) {
	this.SendMessage = function (Message) {
		if (WSInst.readyState == WebSocket.CLOSED) throw "Closed...";
		WSInst.send(JSON.stringify({ "type": 2, "content": Message, "sesid": SessID, "requestID": Sequence }));
		Sequence++; // inline doesn't work fsr
	}

	Language = Language || "jp";
	if (!SessID || !UserID) return false;
	var WSInst = new WebSocket("ws://chat.prd.evertaleserver.com");
	var Sequence = 2;
	this.Session = SessID;
	var _p_resolve = null;
	this.Awaitable = new Promise(function (resolve, reject) {
		_p_resolve = resolve;
	});
	WSInst.onerror = function (e) { console.log("[EvertaleCrossChat] Error..."); throw e; }
	WSInst.onclose = function (e) { console.log("[EvertaleCrossChat] Closed..."); }
	WSInst.onmessage = function () {
		if (++Sequence < 4) return;
		console.log("[EvertaleCrossChat] Handshake complete!");
		_p_resolve();
		if (Callback && typeof (Callback) == "function") WSInst.onmessage = function (m) { Callback(m.data); }
		else if (Callback) WSInst.onmessage = function (m) { console.log("[EvertaleCrossChat] Received Message: " + m.data); }
		else WSInst.onmessage = function () { };
	};
	WSInst.onopen = function () {
		console.log("[EvertaleCrossChat] Connected...");
		WSInst.send(JSON.stringify({ "type": 1, "content": "{\"uid\":\"" + UserID + "\",\"channel\":\"Cluster-\",\"language\":\"" + Language + "\"}", "sesid": SessID, "requestID": 2 }))
		WSInst.send(JSON.stringify({ "type": 10, "content": "{\"uid\":\"" + UserID + "\",\"channel\":\"Cluster-\",\"language\":\"" + Language + "\"}", "sesid": SessID, "requestID": 3 }))
	}
};

(async () => {
	// TODO: Fix tickers length
	var device = "";
	var language = "jp";
	var region = "JST";
	var tickers = {};
	var th = 0;
	var version = "2.0.67";
	var nick = "";
	var descr = "";
	var messages = ["РGR > Evertale"];
	var shards = [1, 2, 8, 9]; //TODO: Parse all shards by server names
	for (var shard_i in shards) {
		var shard = shards[shard_i];
		for (var rep = 0; rep < 6; rep++) {
			try {
				var z = await RegisterAccount(device, shard, language, region);
				if (!z) {
					console.log("IP banned, who cares tho? Accs left: "+(Object.keys(tickers).length / 2));
					return;
				}
				var m = await RestoreAccount(z.rcode, language, region); // for retarded fucks @ evertale: just patch this
				var v = (await CreateSession(z.uid, m.recover.clid, version, device, shard, language, region)).login.sesid;
				await UpdateSettings(v, nick, descr);
				console.log("[WC] Created account at " + shard + "-" + rep + ": " + z.rcode + "; " + z.uid + "; " + m.recover.clid + "; " + v);
				let MyChat = new EvertaleChat(v, z.uid, region);
				await MyChat.Awaitable;
				tickers[shard + "-" + rep + "W"] = setInterval(function (sh, rp, MyChat) {
					try {
						MyChat.SendMessage("U" + th + "U " + messages[th % messages.length]);
						th = Math.floor(Math.random() * 255);
					} catch {
						clearInterval(tickers[sh + "-" + rp + "W"]);
						console.log("[WC] Error, cleared " + sh + "-" + rp + ", accs left: "+(Object.keys(tickers).length / 2));
					}
				}, 200, shard, rep, MyChat);
				console.log("[WC] Chat successful at " + shard + "-" + rep);
				let MyCrossChat = new EvertaleCrossChat(v, z.uid, region);
				await MyCrossChat.Awaitable;
				console.log("[EC] Chat successful at " + shard + "-" + rep);
				tickers[shard + "-" + rep + "C"] = setInterval(function (sh, rp, MyCrossChat) {
					try {
						MyCrossChat.SendMessage("Y" + th + "Y " + messages[th % messages.length]);
						th = Math.floor(Math.random() * 255);
					} catch {
						clearInterval(tickers[sh + "-" + rp + "C"]);
						console.log("[EC] Error, cleared " + sh + "-" + rp + ", accs left: "+(Object.keys(tickers).length / 2));
					}
				}, 200, shard, rep, MyCrossChat);
			} catch (exz) {
				console.log("[WC/CC] Error at " + shard + "-" + rep + ": " + exz);
				return;
			}
		}
	}
})();
