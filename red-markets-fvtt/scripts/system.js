const RM = {};
RM.skillGroups = {str:"Strength",spd:"Speed",adp:"Adaptability",int:"Intelligence",cha:"Charm"};
RM.skillShort = {str:"STR",spd:"SPD",adp:"ADP",int:"INT",cha:"CHA"};
RM.physicalSkills = new Set(["unarmed","melee","resistance","shoot","stealth","athletics"]);
RM.oneAndDoneSkills = new Set(["awareness","selfControl","scavenging","drive","criminality","foresight","research","mechanics","firstAid","profession","networking","persuasion","sensitivity","deception","intimidation","leadership"]);
RM.damageDefaults = {
  rightLeg:{label:"Right Leg",range:"1-2",max:5,stun:0,kill:0,status:""},
  leftLeg:{label:"Left Leg",range:"3-4",max:5,stun:0,kill:0,status:""},
  rightArm:{label:"Right Arm",range:"5",max:5,stun:0,kill:0,status:""},
  leftArm:{label:"Left Arm",range:"6",max:5,stun:0,kill:0,status:""},
  torso:{label:"Torso",range:"7-9",max:10,stun:0,kill:0,status:""},
  head:{label:"Head",range:"10",max:5,stun:0,kill:0,status:""}
};

function prop(obj,path,fb){try{return foundry.utils.getProperty(obj,path) ?? fb}catch(e){return fb}}
function mergeDamage(data){return foundry.utils.mergeObject(foundry.utils.deepClone(RM.damageDefaults), data || {}, {inplace:false});}
function hitLocation(red){
  red = Number(red||0);
  if(red<=2) return {key:"rightLeg", label:"Right Leg"};
  if(red<=4) return {key:"leftLeg", label:"Left Leg"};
  if(red===5) return {key:"rightArm", label:"Right Arm"};
  if(red===6) return {key:"leftArm", label:"Left Arm"};
  if(red<=9) return {key:"torso", label:"Torso"};
  return {key:"head", label:"Head"};
}

function applyProfitDiceAppearance(roll){
  // Dice So Nice reads per-die appearance from the DiceTerm options.
  // First d10 = Black, second d10 = Red. These use the built-in custom colours so
  // the behaviour works even if the companion Red Markets DSN colour module is not enabled.
  const blackAppearance = {
    colorset: "custom",
    foreground: "#d8f5e3",
    background: "#050606",
    outline: "#2dff87",
    edge: "#1a2a1f",
    material: "metal",
    font: "Arial Black",
    system: "standard"
  };
  const redAppearance = {
    colorset: "custom",
    foreground: "#fff1e8",
    background: "#8b000d",
    outline: "#ff2a2a",
    edge: "#2a0508",
    material: "metal",
    font: "Arial Black",
    system: "standard"
  };

  const diceTerms = roll?.dice ?? roll?.terms?.filter(t => t?.faces);
  if (!diceTerms?.length) return;
  if (diceTerms[0]) diceTerms[0].options.appearance = blackAppearance;
  if (diceTerms[1]) diceTerms[1].options.appearance = redAppearance;
}

function getSkillDefaults(key, skill){
  return {
    buyRoll: skill?.buyRoll || (RM.physicalSkills.has(key) ? "rations" : "none"),
    oneAndDone: skill?.oneAndDone ?? RM.oneAndDoneSkills.has(key)
  };
}
async function maybeSpendActorResource(actor, path, amount){
  amount = Number(amount||0); if(!actor || !path || amount<=0) return true;
  const current = Number(prop(actor.system, path, 0));
  if(current < amount){ ui.notifications.warn(`Not enough ${path.split('.').pop()} to spend ${amount}.`); return false; }
  await actor.update({[`system.${path}`]: Math.max(0,current-amount)});
  return true;
}
async function profitRoll({actor, skillKey=null, skillLabel="Check", skillValue=0, chargeBonus=0, note="", oneAndDone=false, damageType="kill", buyRoll="none", resourceSpent=0, item=null, itemChargesSpent=0, applyResourceSpend=true}) {
  if(applyResourceSpend && buyRoll === "rations" && resourceSpent > 0){
    const ok = await maybeSpendActorResource(actor, "resources.rations.value", resourceSpent);
    if(!ok) return;
  }
  if(applyResourceSpend && item && item.system?.charges && itemChargesSpent > 0){
    const max = Number(item.system.charges?.value ?? 0);
    if(max < itemChargesSpent){ ui.notifications.warn(`${item.name} does not have enough charges.`); return; }
    await item.update({"system.charges.value": Math.max(0, max-itemChargesSpent)});
  }

  // One combined roll keeps the chat card clean; the per-die appearance below tells Dice So Nice
  // to render the first d10 as Black and the second d10 as Red.
  const roll = await new Roll("1d10 + 1d10").evaluate({async:true});
  applyProfitDiceAppearance(roll);
  const terms = roll.terms.filter(t => t?.results);
  const black = terms[0]?.results?.[0]?.result ?? 0;
  const red = terms[1]?.results?.[0]?.result ?? 0;
  const modifier = Number(skillValue||0) + Number(chargeBonus||0);
  const blackTotal = black + modifier;
  const success = blackTotal > red;
  const double = black === red;
  const location = hitLocation(red);
  const damage = black;
  const critText = double ? (success ? " — Critical Success" : " — Critical Failure") : "";
  const buyText = buyRoll === "rations" ? `<p><b>Buy-a-roll:</b> ${resourceSpent} ration(s) spent. Extra ration bonus included below.</p>` : "";
  const oneDoneText = oneAndDone ? `<p class="rm-warning"><b>One-and-Done:</b> this check should normally not be retried. Consider Will or succeed-at-cost if appropriate.</p>` : "";
  const damageText = `<p><b>Combat Helper:</b> Natural Black <b>${damage}</b> = damage. Natural Red <b>${red}</b> = ${location.label}. Damage type: ${damageType}.</p>`;
  const content = `<div class="rm-chat-card"><h3>${skillLabel}</h3><div class="rm-roll-grid"><div><b>Black d10</b><span>${black}</span></div><div><b>Skill + Spend</b><span>+${modifier}</span></div><div><b>Black Total</b><span>${blackTotal}</span></div><div><b>Red d10</b><span>${red}</span></div></div><p class="rm-result ${success?"success":"failure"}">${success?"SUCCESS":"FAILURE"}${critText}</p>${buyText}${oneDoneText}${damageText}${note?`<p>${note}</p>`:""}<p class="rm-small">Black Total must be higher than Red. Ties favour the Market.</p></div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({actor}),
    flavor: `<strong>${skillLabel}</strong> — Black vs Red`,
    content,
    rolls: [roll]
  });
}

class RedMarketsTakerSheet extends ActorSheet {
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{classes:["red-markets","sheet","actor","taker"],template:"systems/red-markets-fvtt/templates/actor/taker-sheet.html",width:1080,height:900,tabs:[{navSelector:".sheet-tabs",contentSelector:".sheet-body",initial:"main"}],dragDrop:[{dragSelector:".item",dropSelector:null}]});}
  getData(options){
    const context=super.getData(options); const actor=this.actor; context.system=actor.system; context.items=actor.items;
    context.skillGroups={};
    for(const [key,label] of Object.entries(RM.skillGroups)){
      context.skillGroups[key]={label,short:RM.skillShort[key],potential:actor.system.potentials?.[key]||{value:0},skills:Object.entries(actor.system.skills||{}).filter(([k,s])=>s.potential===key).map(([k,s])=>[k,{...s,...getSkillDefaults(k,s)}])};
    }
    context.gear=actor.items.filter(i=>["gear","weapon","armor","vehicle"].includes(i.type));
    context.weapons=actor.items.filter(i=>i.type==="weapon" && i.system.equipped);
    context.armor=actor.items.filter(i=>i.type==="armor" && i.system.equipped);
    context.people=actor.items.filter(i=>["dependent","reference"].includes(i.type));
    context.dependents=actor.items.filter(i=>i.type==="dependent");
    context.references=actor.items.filter(i=>i.type==="reference");
    context.damageLocations=mergeDamage(actor.system.damage);
    context.gassed = Number(actor.system.resources?.rations?.value ?? 0) <= 0;
    return context;
  }
  activateListeners(html){
    super.activateListeners(html); if(!this.isEditable) return;
    html.find(".skill-roll").click(this._onSkillRoll.bind(this));
    html.find(".item-roll").click(this._onItemRoll.bind(this));
    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".item-delete").click(this._onItemDelete.bind(this));
    html.find(".item-edit").click(ev=>{ev.preventDefault(); const item=this.actor.items.get(ev.currentTarget.closest(".item").dataset.itemId); item?.sheet?.render(true);});
    html.find(".charge-use").click(this._onUseCharge.bind(this));
    html.find(".ration-use").click(this._onUseRation.bind(this));
    html.find(".ration-refresh").click(this._onRefreshRations.bind(this));
    html.find(".will-spend").click(this._onSpendWill.bind(this));
    html.find(".will-refresh").click(this._onRefreshWill.bind(this));
    html.find(".damage-add").click(this._onDamageAdd.bind(this));
    html.find(".damage-clear").click(this._onDamageClear.bind(this));
    html.find(".combat-reset").click(this._onCombatReset.bind(this));
    html.find(".refresh-all").click(this._onRefreshAll.bind(this));
  }
  async _onSkillRoll(event){
    event.preventDefault(); const skillKey=event.currentTarget.dataset.skill; const skill=this.actor.system.skills?.[skillKey]; if(!skill) return;
    const defaults=getSkillDefaults(skillKey,skill); const isPhysical=defaults.buyRoll==="rations";
    const title=skill.spec?`${skill.label} (${skill.spec})`:skill.label;
    const content=`<div class="rm-dialog"><p><b>${title}</b></p>${isPhysical?`<p>This is an exertion check. Spending 1 ration buys the roll; extra rations add +1.</p><label>Rations to spend <input type="number" name="rations" value="1" min="0" style="width:80px"/></label>`:`<p>This is normally a one-and-done/free check unless the Market says gear is required.</p><label>Other bonus/spend <input type="number" name="bonus" value="0" min="0" style="width:80px"/></label>`}<label><input type="checkbox" name="onedone" ${defaults.oneAndDone?"checked":""}/> One-and-Done</label><label>Damage Type <select name="dtype"><option value="kill">Kill</option><option value="stun">Stun</option></select></label></div>`;
    const form=await new Promise(resolve=>new Dialog({title:`${title} Check`,content,buttons:{roll:{label:"Roll Black/Red",callback:html=>resolve({rations:Number(html.find('[name="rations"]').val()??0),bonus:Number(html.find('[name="bonus"]').val()??0),oneAndDone:html.find('[name="onedone"]')[0]?.checked,dtype:String(html.find('[name="dtype"]').val()??"kill")})},cancel:{label:"Cancel",callback:()=>resolve(null)}},default:"roll"}).render(true));
    if(form===null) return;
    const chargeBonus=isPhysical?Math.max(0,form.rations-1):form.bonus;
    await profitRoll({actor:this.actor,skillKey,skillLabel:title,skillValue:skill.value,chargeBonus,buyRoll:isPhysical?"rations":"none",resourceSpent:isPhysical?form.rations:0,oneAndDone:form.oneAndDone,damageType:form.dtype});
  }
  async _onItemRoll(event){
    event.preventDefault(); const item=this.actor.items.get(event.currentTarget.closest(".item").dataset.itemId); if(!item) return;
    const skillKey=item.system.skill||""; const skill=skillKey?this.actor.system.skills?.[skillKey]:null;
    const max=Number(item.system.charges?.value??0);
    const damageType=item.system.damageType || (item.type==="weapon"?"kill":"stun");
    const spend=await new Promise(resolve=>new Dialog({title:`${item.name} Use`,content:`<p>Spend how many charges? First charge buys the roll; extras add +1 if the item allows it.</p><label>Charges <input type="number" name="charges" value="1" min="0" max="${max}" style="width:80px"/></label><label>Other bonus <input type="number" name="bonus" value="0" style="width:80px"/></label>`,buttons:{roll:{label:"Spend & Roll",callback:html=>resolve({charges:Number(html.find('[name="charges"]').val()),bonus:Number(html.find('[name="bonus"]').val())})},rollfree:{label:"Roll Free",callback:()=>resolve({charges:0,bonus:0})},cancel:{label:"Cancel",callback:()=>resolve(null)}},default:"roll"}).render(true));
    if(spend===null) return;
    const bonus=(item.system.bonusPerExtraCharge?Math.max(0,spend.charges-1):0)+Number(spend.bonus||0);
    await profitRoll({actor:this.actor,skillKey,skillLabel:`${item.name}${skill?` / ${skill.label}`:""}`,skillValue:skill?.value??0,chargeBonus:bonus,note:`Charges spent: ${spend.charges}`,oneAndDone:false,damageType,item,itemChargesSpent:spend.charges});
  }
  async _onItemCreate(event){event.preventDefault(); const type=event.currentTarget.dataset.type||"gear"; await Item.create({name:type.charAt(0).toUpperCase()+type.slice(1),type,system:{}},{parent:this.actor});}
  async _onItemDelete(event){event.preventDefault(); await this.actor.items.get(event.currentTarget.closest(".item").dataset.itemId)?.delete();}
  async _onUseCharge(event){event.preventDefault(); const item=this.actor.items.get(event.currentTarget.closest(".item").dataset.itemId); if(!item) return; await item.update({"system.charges.value":Math.max(0,Number(item.system.charges?.value??0)-1)});}
  async _onUseRation(event){event.preventDefault(); await this.actor.update({"system.resources.rations.value":Math.max(0,Number(this.actor.system.resources?.rations?.value??0)-1)});}
  async _onRefreshRations(event){event.preventDefault(); const max=Number(this.actor.system.resources?.rations?.max??10); await this.actor.update({"system.resources.rations.value":max});}
  async _onSpendWill(event){event.preventDefault(); await this.actor.update({"system.resources.will.value":Math.max(0,Number(this.actor.system.resources?.will?.value??0)-1)});}
  async _onRefreshWill(event){event.preventDefault(); const max=Number(this.actor.system.resources?.will?.max??this.actor.system.potentials?.wil?.value??1); await this.actor.update({"system.resources.will.value":max});}
  async _onDamageAdd(event){event.preventDefault(); const loc=event.currentTarget.dataset.location; const kind=event.currentTarget.dataset.kind; const cur=Number(prop(this.actor.system,`damage.${loc}.${kind}`,0)); const max=Number(prop(this.actor.system,`damage.${loc}.max`,RM.damageDefaults[loc]?.max??5)); await this.actor.update({[`system.damage.${loc}.${kind}`]:Math.min(max,cur+1)});}
  async _onDamageClear(event){event.preventDefault(); const loc=event.currentTarget.dataset.location; await this.actor.update({[`system.damage.${loc}.stun`]:0,[`system.damage.${loc}.kill`]:0,[`system.damage.${loc}.status`]:""});}
  async _onCombatReset(event){event.preventDefault(); await this.actor.update({"system.combat.tactic":true,"system.combat.twitch":true,"system.combat.freebie":true});}
  async _onRefreshAll(event){event.preventDefault(); const updates=[]; for(const item of this.actor.items){ if(item.system.charges) updates.push({_id:item.id,"system.charges.value":item.system.charges.max}); } if(updates.length) await this.actor.updateEmbeddedDocuments("Item",updates);}
}

class RedMarketsCrewSheet extends ActorSheet{
  static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{classes:["red-markets","sheet","actor","crew"],template:"systems/red-markets-fvtt/templates/actor/crew-sheet.html",width:940,height:780,tabs:[{navSelector:".sheet-tabs",contentSelector:".sheet-body",initial:"job"}]});}
  getData(options){const c=super.getData(options); c.system=this.actor.system; return c;}
  activateListeners(html){super.activateListeners(html); if(!this.isEditable) return; html.find(".crew-roll").click(async ev=>{const skill=ev.currentTarget.dataset.skill||"Leadership"; await profitRoll({actor:this.actor,skillLabel:`Negotiation: ${skill}`,skillValue:Number(this.actor.system.negotiation?.bonus??0),oneAndDone:true,note:"Use the Sway tracker to resolve price movement."});});}
}
class RedMarketsForceSheet extends ActorSheet{static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{classes:["red-markets","sheet","actor","force"],template:"systems/red-markets-fvtt/templates/actor/marketforce-sheet.html",width:620,height:560});} getData(options){const c=super.getData(options); c.system=this.actor.system; return c;}}
class RedMarketsItemSheet extends ItemSheet{static get defaultOptions(){return foundry.utils.mergeObject(super.defaultOptions,{classes:["red-markets","sheet","item"],template:"systems/red-markets-fvtt/templates/item/item-sheet.html",width:700,height:640});} getData(options){const c=super.getData(options); c.system=this.item.system; return c;}}

Hooks.once("init", async function(){
  console.log("Red Markets Profit System | Initialising");
  Handlebars.registerHelper("eq",(a,b)=>a===b);
  Handlebars.registerHelper("or",(a,b)=>a||b);
  Handlebars.registerHelper("boxes", (max, filled, cls) => { let out=""; for (let i=0;i<Number(max||0);i++) out += `<span class="box ${cls||""} ${i < Number(filled||0) ? "filled" : ""}"></span>`; return new Handlebars.SafeString(out); });
  Handlebars.registerHelper("skillTag", (skill) => { const bits=[]; if(skill?.buyRoll==="rations") bits.push("Ration"); if(skill?.oneAndDone) bits.push("1&D"); return bits.join(" • "); });
  CONFIG.Actor.documentClass=class RedMarketsActor extends Actor{}; CONFIG.Item.documentClass=class RedMarketsItem extends Item{};
  Actors.unregisterSheet("core",ActorSheet); Actors.registerSheet("red-markets-fvtt",RedMarketsTakerSheet,{types:["taker"],makeDefault:true}); Actors.registerSheet("red-markets-fvtt",RedMarketsCrewSheet,{types:["crew"],makeDefault:true}); Actors.registerSheet("red-markets-fvtt",RedMarketsForceSheet,{types:["marketforce"],makeDefault:true});
  Items.unregisterSheet("core",ItemSheet); Items.registerSheet("red-markets-fvtt",RedMarketsItemSheet,{makeDefault:true});
});
Hooks.on("createActor",async actor=>{if(actor.type==="taker"){const wil=Number(actor.system.potentials?.wil?.value??1); await actor.update({"system.resources.will.max":actor.system.resources?.will?.max??wil,"system.resources.will.value":actor.system.resources?.will?.value??wil,"system.damage":mergeDamage(actor.system.damage)});}});
