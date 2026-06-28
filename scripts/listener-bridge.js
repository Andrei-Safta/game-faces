const MODULE_ID = "game-faces";
const PORTRAITS_FLAG = "portraits";

const SETTINGS = {
	LISTENER_ENABLED: "listener-enabled",
	LISTENER_URL: "listener-url",
	LISTENER_TOKEN: "listener-token",
};

const SOCKET_EVENT = `module.${MODULE_ID}`;

let initialized = false;
let bridgeSocket = null;
let reconnectTimer = null;
let speakingUsers = new Set();

function normalizeDiscordUserId(value) {
	return String(value ?? "").trim();
}

function getActorDiscordUserId(actor) {
	const data = actor.getFlag(MODULE_ID, PORTRAITS_FLAG);
	return normalizeDiscordUserId(data?.discordUserId);
}

function getSetting(settingName, fallback = null) {
	try {
		return game.settings.get(MODULE_ID, settingName);
	} catch {
		return fallback;
	}
}

function setActorSpeakingVisual(actor, speaking) {
	const container = document.getElementById(`gf-container-${actor.id}`);
	if (!container) return;

	container.classList.toggle("gf-speaking", !!speaking);
}

export function refreshSpeakingHighlights() {
	for (const actor of game.actors.contents) {
		const discordUserId = getActorDiscordUserId(actor);

		const shouldGlow =
			discordUserId &&
			speakingUsers.has(discordUserId);

		setActorSpeakingVisual(actor, shouldGlow);
	}
}

function applySpeakingState(discordUserId, speaking) {
	const id = normalizeDiscordUserId(discordUserId);
	if (!id) return;

	if (speaking) {
		speakingUsers.add(id);
	} else {
		speakingUsers.delete(id);
	}

	refreshSpeakingHighlights();
}

function applySpeakingSnapshot(userIds) {
	speakingUsers = new Set(
		(userIds ?? [])
			.map(normalizeDiscordUserId)
			.filter(Boolean)
	);

	refreshSpeakingHighlights();
}

function relayToFoundryClients(payload) {
	game.socket.emit(SOCKET_EVENT, payload);
}

function handleFoundrySocketMessage(payload) {
	if (!payload || typeof payload !== "object") return;

	if (payload.type === "listener-speaking") {
		applySpeakingState(payload.discordUserId, payload.speaking);
		return;
	}

	if (payload.type === "listener-snapshot") {
		applySpeakingSnapshot(payload.speakingUsers);
		return;
	}
}

function buildBridgeUrl() {
	const rawUrl = getSetting(
		SETTINGS.LISTENER_URL,
		"ws://localhost:3001"
	);

	const token = getSetting(
		SETTINGS.LISTENER_TOKEN,
		""
	);

	try {
		const url = new URL(rawUrl);

		if (token) {
			url.searchParams.set("token", token);
		}

		return url.toString();
	} catch (error) {
		console.error("Game Faces | Invalid Listener bridge URL", error);
		ui.notifications.error("Game Faces: invalid Listener bridge URL.");
		return null;
	}
}

function clearReconnectTimer() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
}

function scheduleReconnect() {
	if (!game.user.isGM) return;
	if (!getSetting(SETTINGS.LISTENER_ENABLED, false)) return;

	clearReconnectTimer();

	reconnectTimer = setTimeout(() => {
		connectListenerBridge();
	}, 5000);
}

export function disconnectListenerBridge() {
	clearReconnectTimer();

	if (bridgeSocket) {
		bridgeSocket.onopen = null;
		bridgeSocket.onmessage = null;
		bridgeSocket.onerror = null;
		bridgeSocket.onclose = null;

		if (
			bridgeSocket.readyState === WebSocket.OPEN ||
			bridgeSocket.readyState === WebSocket.CONNECTING
		) {
			bridgeSocket.close();
		}
	}

	bridgeSocket = null;
}

export function connectListenerBridge() {
	if (!game.user.isGM) return;

	const enabled = getSetting(SETTINGS.LISTENER_ENABLED, false);
	if (!enabled) return;

	if (
		bridgeSocket &&
		(
			bridgeSocket.readyState === WebSocket.OPEN ||
			bridgeSocket.readyState === WebSocket.CONNECTING
		)
	) {
		return;
	}

	const bridgeUrl = buildBridgeUrl();
	if (!bridgeUrl) return;

	console.log(`Game Faces | Connecting to The Listener at ${bridgeUrl}`);

	bridgeSocket = new WebSocket(bridgeUrl);

	bridgeSocket.addEventListener("open", () => {
		console.log("Game Faces | Connected to The Listener.");
	});

	bridgeSocket.addEventListener("message", (event) => {
		let payload;

		try {
			payload = JSON.parse(event.data);
		} catch (error) {
			console.warn("Game Faces | Listener sent invalid JSON:", event.data);
			return;
		}

		if (payload.type === "speaking") {
			const relayed = {
				type: "listener-speaking",
				discordUserId: normalizeDiscordUserId(payload.discordUserId),
				speaking: !!payload.speaking,
			};

			// Apply locally because the emitting client may not receive its own socket broadcast.
			applySpeakingState(relayed.discordUserId, relayed.speaking);

			// Relay to the player clients through Foundry.
			relayToFoundryClients(relayed);
			return;
		}

		if (payload.type === "snapshot") {
			const speakingUserIds = (payload.speakingUsers ?? [])
				.map(normalizeDiscordUserId)
				.filter(Boolean);

			applySpeakingSnapshot(speakingUserIds);

			relayToFoundryClients({
				type: "listener-snapshot",
				speakingUsers: speakingUserIds,
			});
		}
	});

	bridgeSocket.addEventListener("close", () => {
		console.warn("Game Faces | Disconnected from The Listener.");
		bridgeSocket = null;
		scheduleReconnect();
	});

	bridgeSocket.addEventListener("error", (error) => {
		console.warn("Game Faces | Listener bridge WebSocket error:", error);
	});
}

export function reconnectListenerBridge() {
	disconnectListenerBridge();
	connectListenerBridge();
}

export function initListenerBridge() {
	if (initialized) return;
	initialized = true;

	game.socket.on(SOCKET_EVENT, handleFoundrySocketMessage);

	window.GameFacesListenerBridge = {
		connect: connectListenerBridge,
		disconnect: disconnectListenerBridge,
		reconnect: reconnectListenerBridge,
		refreshSpeakingHighlights,
	};

	if (game.user.isGM) {
		connectListenerBridge();
	}
}