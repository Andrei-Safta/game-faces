import { GameFaces } from "./game-faces.js";
import { GameFacesData } from "./portrait-manager.js";

const FRENZY_LABEL = "frenzy";
const PREVIOUS_FRENZY_EXPRESSION_FLAG = "previous-frenzy-expression-index";

function getFrenzyActiveChange(changed) {
	return foundry.utils.getProperty(changed, "system.frenzyActive");
}

function findFrenzyExpressionIndex(portraitData) {
	return portraitData.labels.findIndex(
		(label) => String(label).trim().toLowerCase() === FRENZY_LABEL
	);
}

export function initWod5eFrenzyIntegration() {
	if (game.system.id !== "wod5e") return;

	Hooks.on("updateActor", async (actor, changed) => {
		if (!game.user.isGM) return;

		const frenzyActive = getFrenzyActiveChange(changed);

		if (typeof frenzyActive !== "boolean") return;

		const portraitData = GameFacesData.getPortraitsForActor(actor.id);
		if (!portraitData?.portraits?.length) return;

		const frenzyIndex = findFrenzyExpressionIndex(portraitData);
		if (frenzyIndex === -1) return;

		if (frenzyActive) {
			if (portraitData.activeIndex === frenzyIndex) return;

			await actor.setFlag(
				GameFaces.ID,
				PREVIOUS_FRENZY_EXPRESSION_FLAG,
				portraitData.activeIndex
			);

			await GameFacesData.setActivePortrait(actor.id, frenzyIndex);
			window.PortraitDisplay?.render?.();

			return;
		}

		const previousIndex = actor.getFlag(
			GameFaces.ID,
			PREVIOUS_FRENZY_EXPRESSION_FLAG
		);

		const restoreIndex =
			Number.isInteger(previousIndex) &&
			previousIndex >= 0 &&
			previousIndex < portraitData.portraits.length
				? previousIndex
				: 0;

		await GameFacesData.setActivePortrait(actor.id, restoreIndex);
		await actor.unsetFlag(GameFaces.ID, PREVIOUS_FRENZY_EXPRESSION_FLAG);

		window.PortraitDisplay?.render?.();
	});
}