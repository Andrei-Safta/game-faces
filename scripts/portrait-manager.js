import { GameFaces } from "./game-faces.js";

/**
 * Portrait data for a character
 * @typedef {Object} PortraitData
 * @property {string[]} portraits - Array of portrait image paths
 * @property {string[]} labels - Array of emotion labels for each portrait
 * @property {number} activeIndex - Index of currently active portrait
 * @property {boolean[]} shadowEnabled - Whether each portrait has a colored shadow
 * @property {string[]} shadowColors - Hex color for each portrait shadow
 */

class GameFacesData {
	static isValidHexColor(value) {
		return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
	}

	static normalizePortraitData(data) {
		const portraits = Array.isArray(data?.portraits) ? data.portraits : [];
		const labels = Array.isArray(data?.labels) ? data.labels : [];
		const shadowEnabled = Array.isArray(data?.shadowEnabled)
			? data.shadowEnabled
			: [];
		const shadowColors = Array.isArray(data?.shadowColors)
			? data.shadowColors
			: [];
		
		const discordUserId =
        	typeof data?.discordUserId === "string"
        		? data.discordUserId.trim()
        		: "";
        
		let activeIndex = Number.isInteger(data?.activeIndex)
			? data.activeIndex
			: 0;

		if (portraits.length === 0) {
			activeIndex = 0;
		} else {
			activeIndex = Math.clamp(activeIndex, 0, portraits.length - 1);
		}

		return {
			portraits,
			labels: portraits.map((_, index) => labels[index] ?? "Untitled"),
			activeIndex,
			shadowEnabled: portraits.map((_, index) => !!shadowEnabled[index]),
			shadowColors: portraits.map((_, index) => {
				const color = shadowColors[index];
				return this.isValidHexColor(color) ? color.trim() : "#000000";
			}),
			discordUserId,
		};
	}

	static getPortraitsForActor(actorID) {
		const data = game.actors
			.get(actorID)
			?.getFlag(GameFaces.ID, GameFaces.FLAGS.PORTRAITS);
		return this.normalizePortraitData(data);
	}

	static updatePortraits(actorId, portraitData) {
		const actor = game.actors.get(actorId);
		if (!actor) {
			console.warn(`Game Faces | Actor with ID ${actorId} not found`);
			return null;
		}
		return actor.setFlag(
			GameFaces.ID,
			GameFaces.FLAGS.PORTRAITS,
			this.normalizePortraitData(portraitData)
		);
	}

	static addPortrait(actorId, portraitPath, label = "Untitled") {
		const currentData = this.getPortraitsForActor(actorId);
		if (currentData.portraits.includes(portraitPath)) {
			console.warn(`Game Faces | Portrait already exists: ${portraitPath}`);
			return null;
		}
		currentData.portraits.push(portraitPath);
		currentData.labels.push(label);

		currentData.shadowEnabled.push(false);
		currentData.shadowColors.push("#000000");

		return this.updatePortraits(actorId, currentData);
	}

	static setActivePortrait(actorId, index) {
		const currentData = this.getPortraitsForActor(actorId);
		if (
			!currentData ||
			index < 0 ||
			index >= currentData.portraits.length
		) {
			console.warn(`Invalid portrait index: ${index}`);
			return null;
		}
		currentData.activeIndex = index;
		return this.updatePortraits(actorId, currentData);
	}
}

export { GameFacesData };
