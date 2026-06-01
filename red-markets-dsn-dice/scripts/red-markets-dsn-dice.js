/*
 * Red Markets Dice for Dice So Nice
 * Adds themed Black and Red d10 options for Red Markets / Profit System rolls.
 *
 * Install as a normal Foundry module and enable alongside Dice So Nice.
 */

const MODULE_ID = "red-markets-dsn-dice";

const warn = (...args) => console.warn(`${MODULE_ID} |`, ...args);
const log = (...args) => console.log(`${MODULE_ID} |`, ...args);

function tryAddColorset(dice3d, data, name) {
  if (!dice3d?.addColorset) {
    warn(`Dice So Nice API not ready; could not add ${name}.`);
    return false;
  }

  try {
    dice3d.addColorset(data, "default");
    log(`Registered colours: ${data.name}`);
    return true;
  } catch (err) {
    warn(`Failed to register colours: ${name}`, err);
    return false;
  }
}

Hooks.once("diceSoNiceReady", (dice3d) => {
  const colorsets = [
    {
      name: "redmarkets_black",
      description: "Red Markets - Black Die",
      category: "Red Markets",
      foreground: "#d8f5e3",
      background: "#050606",
      outline: "#2dff87",
      texture: "none",
      material: "metal",
      font: "Arial Black"
    },
    {
      name: "redmarkets_red",
      description: "Red Markets - Red Die",
      category: "Red Markets",
      foreground: "#fff1e8",
      background: "#8b000d",
      outline: "#ff2a2a",
      texture: "none",
      material: "metal",
      font: "Arial Black"
    },
    {
      name: "redmarkets_bloodledger",
      description: "Red Markets - Blood Ledger",
      category: "Red Markets",
      foreground: "#e9fff2",
      background: "#171a16",
      outline: "#b70015",
      edge: "#7b000b",
      texture: "none",
      material: "metal",
      font: "Arial Black"
    },
    {
      name: "redmarkets_carrion_bounty",
      description: "Red Markets - Carrion Bounty",
      category: "Red Markets",
      foreground: "#101410",
      background: "#b5a14a",
      outline: "#f1d66a",
      edge: "#4a3b12",
      texture: "none",
      material: "metal",
      font: "Arial Black"
    }
  ];

  for (const set of colorsets) tryAddColorset(dice3d, set, set.name);

  // Optional Dice So Nice system presets. These appear in DSN's dice appearance menus.
  // The API name has varied between versions, so this is intentionally defensive.
  if (typeof dice3d.addSystem === "function") {
    try {
      dice3d.addSystem({
        id: "redmarkets_profit",
        name: "Red Markets - Profit System",
        group: "Red Markets",
        dice: {
          d10: {
            colorset: "redmarkets_black"
          }
        }
      }, "default");
      log("Registered Dice So Nice system preset: Red Markets - Profit System");
    } catch (err) {
      warn("Could not register Dice So Nice system preset. Colour sets still registered.", err);
    }
  }
});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showWelcome", {
    name: "Show Welcome Message",
    hint: "Display a small setup note the first time a GM loads the world.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  const dsnActive = game.modules.get("dice-so-nice")?.active;
  if (!dsnActive && game.user?.isGM) {
    ui.notifications.warn("Red Markets Dice: Dice So Nice is not active. Enable Dice So Nice to use the themed dice.");
    return;
  }

  if (!game.user?.isGM || !game.settings.get(MODULE_ID, "showWelcome")) return;

  const content = `
    <div class="rm-dsn-welcome">
      <h2>Red Markets Dice</h2>
      <p>The following Dice So Nice colour sets have been added:</p>
      <ul>
        <li><strong>Red Markets - Black Die</strong></li>
        <li><strong>Red Markets - Red Die</strong></li>
        <li><strong>Red Markets - Blood Ledger</strong></li>
        <li><strong>Red Markets - Carrion Bounty</strong></li>
      </ul>
      <p>To apply them, open <strong>Dice So Nice settings</strong> and choose the Red Markets colour sets for your d10s.</p>
      <p class="rm-dsn-note">For true Black/Red Profit System dice, set one d10 to the Black Die style and one d10 to the Red Die style where your Dice So Nice setup allows separate die appearances.</p>
    </div>
  `;

  new Dialog({
    title: "Red Markets Dice for Dice So Nice",
    content,
    buttons: {
      ok: {
        label: "Got it",
        callback: () => game.settings.set(MODULE_ID, "showWelcome", false)
      }
    },
    default: "ok"
  }).render(true);
});
