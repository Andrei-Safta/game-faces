import { GameFacesData } from "./portrait-manager.js";
import { updatePortraitStyles } from "./game-faces.js";

class PortraitDisplay {
	constructor() {
		this.bar = null;
	}

	createBar() {
		const bar = document.createElement("div");
		bar.id = "gf-bar";
		bar.classList.add("gf-bar");

		document.body.appendChild(bar);
		this.bar = bar;
	}

	createContainer(actorId) {
		const container = document.createElement("div");
		container.id = `gf-container-${actorId}`;
		container.classList.add("gf-container");
		return container;
	}

	createPortraitImage(actor) {
		const data = GameFacesData.getPortraitsForActor(actor.id);
		if (data.portraits.length === 0) {
			console.warn(`Game Faces | No portraits for ${actor.id}`);
			return null;
		}
		const img = document.createElement("img");
		img.src = data.portraits[data.activeIndex];
		img.alt = actor.name;
		img.classList.add("gf-img");
		img.dataset.actorId = actor.id;
		this.applyExpressionShadow(img, data, data.activeIndex);

		return img;
	}

    applyExpressionShadow(img, data, index) {
    	const enabled = !!data.shadowEnabled?.[index];
    	const color = data.shadowColors?.[index] ?? "#000000";
    
    	if (enabled) {
    		img.style.boxShadow = `
    			0 0 0 3px ${color},
    			0 0 12px 4px ${color}
    		`;
    	} else {
    		img.style.boxShadow = "none";
    	}
    }

    createPortraitLabel(actor) {
    	const label = document.createElement("div");
    	label.classList.add("gf-label");
    	label.textContent = actor.name;
    	label.dataset.actorId = actor.id;
    
    	if (game.user.isGM || actor.isOwner) {
    		label.classList.add("gf-label-clickable");
    		label.title = `Open ${actor.name} Char Sheet`;
    	}
    
    	return label;
    }

	setupContextMenus() {
		const portraits = this.bar.querySelectorAll(".gf-img");

		portraits.forEach((img) => {
			img.addEventListener("click", async (event) => {
				const actorId = img.dataset.actorId;
				const actor = game.actors.get(actorId);

				if (!actor.isOwner) {
					ui.notifications.warn(
						game.i18n.localize("GAMEFACES.NoPermissionExpression")
					);
					return;
				}

				const data = GameFacesData.getPortraitsForActor(actorId);

				const buttons = data.labels.map((label, index) => ({
					action: `emotion${index}`,
					label,
					default: index === data.activeIndex,
					callback: () => {
						GameFacesData.setActivePortrait(actorId, index);
						img.src = data.portraits[index];
						this.applyExpressionShadow(img, data, index);
					},
				}));

				foundry.applications.api.DialogV2.wait({
					window: {
						title: game.i18n.localize("GAMEFACES.WindowTitle"),
					},
					content: `<p>${game.i18n.format(
						"GAMEFACES.SelectExpressionFor",
						{ name: actor.name }
					)}</p>`,
					buttons,
					rejectClose: false,
				});
			});

			img.addEventListener("contextmenu", async (event) => {
				event.preventDefault();
				const actorId = img.dataset.actorId;
				const actor = game.actors.get(actorId);

				if (!actor?.isOwner) {
					ui.notifications.warn(
						game.i18n.localize("GAMEFACES.NoPermissionExpression")
					);
					return;
				}

				const old = document.getElementById("gf-context-overlay");
				if (old) old.remove();

				const overlay = document.createElement("div");
				overlay.id = "gf-context-overlay";
				overlay.className = "gf-context-overlay";

				const title =
					game.i18n.format("GAMEFACES.ConfigurePortraitsFor", {
						name: actor.name,
					}) || "";

				let portraitData = GameFacesData.getPortraitsForActor(actorId);

				const renderDialog = async () => {
					const html =
						await foundry.applications.handlebars.renderTemplate(
							"modules/game-faces/templates/portrait-config.hbs",
							{
								title,
								portraits: portraitData.portraits,
								labels: portraitData.labels,
								activeIndex: portraitData.activeIndex,
								shadowEnabled: portraitData.shadowEnabled,
								shadowColors: portraitData.shadowColors,
								discordUserId: portraitData.discordUserId ?? "",
							}
						);
					overlay.innerHTML = html;
					setupDialogListeners();
				};

				const cleanup = () => {
					overlay.remove();
					document.removeEventListener("keydown", onKeyDown);
				};

				const onKeyDown = (e) => {
					if (e.key === "Escape") cleanup();
				};

				const setupDialogListeners = () => {
					const dialog = overlay.querySelector(".gf-dialog");

                    dialog.addEventListener("change", async (e) => {
                    	const discordIdInput = e.target.closest('input[data-action="discord-user-id"]');
                    	const shadowToggle = e.target.closest('input[data-action="shadow-toggle"]');
                    	const shadowColor = e.target.closest('input[data-action="shadow-color"]');
                    
                    	if (!discordIdInput && !shadowToggle && !shadowColor) return;
                    
                    	const updatedData = {
                    		...portraitData,
                    		shadowEnabled: [...(portraitData.shadowEnabled ?? [])],
                    		shadowColors: [...(portraitData.shadowColors ?? [])],
                    	};
                    
                    	if (discordIdInput) {
                    		updatedData.discordUserId = discordIdInput.value.trim();
                    	}
                    
                    	if (shadowToggle || shadowColor) {
                    		const portraitItem = e.target.closest(".portrait-item");
                    		if (!portraitItem) return;
                    
                    		const index = Array.from(
                    			portraitItem.parentNode.children
                    		).indexOf(portraitItem);
                    
                    		if (shadowToggle) {
                    			updatedData.shadowEnabled[index] = shadowToggle.checked;
                    		}
                    
                    		if (shadowColor) {
                    			const value = shadowColor.value.trim();
                    
                    			if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
                    				ui.notifications.warn("Shadow color must be a hex code like #ff0000.");
                    				shadowColor.value = updatedData.shadowColors[index] ?? "#000000";
                    				return;
                    			}
                    
                    			updatedData.shadowColors[index] = value;
                    		}
                    	}
                    
                    	await GameFacesData.updatePortraits(actorId, updatedData);
                    	portraitData = GameFacesData.getPortraitsForActor(actorId);
                    
                    	// Only rerender the full portrait UI when shadow controls changed.
                    	// The Discord ID field does not need a rerender.
                    	if (shadowToggle || shadowColor) {
                    		await renderDialog();
                    		this.render();
                    		updatePortraitStyles();
                    	}
                    });

					dialog.addEventListener("click", async (e) => {
						e.stopPropagation();
						const btn = e.target.closest("button[data-action]");
						if (!btn) return;
						const action = btn.dataset.action;

						if (action === "add") {
							if (!game.user.isGM) {
								ui.notifications.warn(
									"Only GMs can add portrait files."
								);
								return;
							}

							overlay.style.display = "none";

							Hooks.once("closeApplicationV2", (app) => {
								if (
									app instanceof
									foundry.applications.apps.FilePicker
								) {
									overlay.style.display = "flex";
								}
							});

							const fp = new foundry.applications.apps.FilePicker(
								{
									type: "image",
									callback: async (path) => {
										const filename = path.split("/").pop();
										const label = filename.replace(
											/\.[^/.]+$/,
											""
										);

										await GameFacesData.addPortrait(
											actorId,
											path,
											label
										);

										portraitData =
											GameFacesData.getPortraitsForActor(
												actorId
											);
										await renderDialog();
										this.render();
										updatePortraitStyles();
									},
								}
							);

							fp.browse();
						}

						if (action === "close") {
							cleanup();
						}

						if (action === "browse") {
							if (!game.user.isGM) {
								ui.notifications.warn(
									"Only GMs can change portrait files."
								);
								return;
							}

							const portraitItem = btn.closest(".portrait-item");
							if (!portraitItem) {
								ui.notifications.error(
									"Could not find portrait to edit."
								);
								return;
							}

							const index = Array.from(
								portraitItem.parentNode.children
							).indexOf(portraitItem);
							const currentPath = portraitData.portraits[index];

							overlay.style.display = "none";

							const hookId = Hooks.once(
								"closeApplicationV2",
								(app) => {
									if (
										app instanceof
										foundry.applications.apps.FilePicker
									) {
										overlay.style.display = "flex";
									}
								}
							);

							const fp = new foundry.applications.apps.FilePicker(
								{
									type: "image",
									current: currentPath,
									callback: async (path) => {
										const updatedData = { ...portraitData };
										updatedData.portraits[index] = path;
										await GameFacesData.updatePortraits(
											actorId,
											updatedData
										);
										portraitData = updatedData;
										await renderDialog();
										this.render();
										updatePortraitStyles();
									},
								}
							);

							fp.browse();
						}

						if (action === "config") {
							const portraitItem = btn.closest(".portrait-item");
							const index = Array.from(
								portraitItem.parentNode.children
							).indexOf(portraitItem);
							const currentLabel = portraitData.labels[index];

							overlay.style.zIndex = 0;

							try {
								const newLabel =
									await foundry.applications.api.DialogV2.prompt(
										{
											window: {
												title: game.i18n.format(
													"GAMEFACES.ChangeLabelTitle",
													{ label: currentLabel }
												),
											},
											content: `
                            <div class="form-group">
                                <label>Enter new label for "${currentLabel}":</label>
                                <input name="newLabel" type="text" value="${currentLabel}" autofocus>
                            </div>`,
											ok: {
												label: "Save",
												callback: (
													event,
													button,
													dialog
												) =>
													button.form.elements.newLabel.value.trim(),
											},
										}
									);

								if (newLabel && newLabel !== currentLabel) {
									const updatedData = { ...portraitData };
									updatedData.labels[index] = newLabel;
									await GameFacesData.updatePortraits(
										actorId,
										updatedData
									);
									portraitData = updatedData;
									await renderDialog();
								}
							} catch {
								console.log("Label change cancelled.");
							} finally {
								overlay.style.zIndex = "";
							}
						}

						if (action === "remove") {
							const portraitItem = btn.closest(".portrait-item");
							const index = Array.from(
								portraitItem.parentNode.children
							).indexOf(portraitItem);

							overlay.style.zIndex = 0;

							try {
								const confirmDelete =
									await foundry.applications.api.DialogV2.confirm(
										{
											window: {
												title: game.i18n.localize(
													"GAMEFACES.ConfirmDelete"
												),
											},
											content: `<p>Remove portrait "${portraitData.labels[index]}"?</p>`,
											rejectClose: false,
										}
									);

								if (!confirmDelete) return;

								const updatedData = {
                                	...portraitData,
                                	portraits: [...portraitData.portraits],
                                	labels: [...portraitData.labels],
                                	shadowEnabled: [...(portraitData.shadowEnabled ?? [])],
                                	shadowColors: [...(portraitData.shadowColors ?? [])],
                                };
                                
                                updatedData.portraits.splice(index, 1);
                                updatedData.labels.splice(index, 1);
                                updatedData.shadowEnabled.splice(index, 1);
                                updatedData.shadowColors.splice(index, 1);

								if (
									updatedData.activeIndex >=
									updatedData.portraits.length
								) {
									updatedData.activeIndex = Math.max(
										0,
										updatedData.portraits.length - 1
									);
								} else if (updatedData.activeIndex > index) {
									updatedData.activeIndex--;
								}

								await GameFacesData.updatePortraits(
									actorId,
									updatedData
								);
								portraitData = updatedData;
								await renderDialog();
								this.render();
								updatePortraitStyles();
							} finally {
								overlay.style.zIndex = "";
							}
						}
					});
				};

				await renderDialog();
				document.body.appendChild(overlay);
				document.addEventListener("keydown", onKeyDown);
			});
		});
	}

    setupLabelClicks() {
    	const labels = this.bar.querySelectorAll(".gf-label-clickable");
    
    	labels.forEach((label) => {
    		label.addEventListener("click", (event) => {
    			event.preventDefault();
    			event.stopPropagation();
    
    			const actorId = label.dataset.actorId;
    			const actor = game.actors.get(actorId);
    
    			if (!actor) {
    				ui.notifications.warn("Actor not found.");
    				return;
    			}
    
    			if (!game.user.isGM && !actor.isOwner) {
    				ui.notifications.warn("You do not have permission to open this actor sheet.");
    				return;
    			}
    
    			actor.sheet.render(true, { focus: true });
    		});
    	});
    }

	render() {
		if (!this.bar) {
			console.error("Game Faces | Bar not created yet!");
			return;
		}
		this.bar.innerHTML = "";

		const actors = game.actors.contents;
		const actorsWithPortraits = actors.filter((actor) => {
			const data = GameFacesData.getPortraitsForActor(actor.id);
			return data.portraits.length > 0;
		});

        actorsWithPortraits.forEach((actor) => {
            const container = this.createContainer(actor.id);
            const img = this.createPortraitImage(actor);
            const label = this.createPortraitLabel(actor);
        
            if (img) {
                container.appendChild(img);
                container.appendChild(label);
            }
        
            this.bar.appendChild(container);
        });

		this.setupContextMenus();
		this.setupLabelClicks();

		updatePortraitStyles();
		window.GameFacesListenerBridge?.refreshSpeakingHighlights?.();
	}
}

export { PortraitDisplay };
