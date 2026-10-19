import {test,expect} from '@playwright/test';
import type {Locator,Page} from '@playwright/test';
import {TOOLS,DEVANAGARI,VIEWPORTS,start,exportDoc,toolRail,toolButton,panel,openTool} from './helpers';

// D76 M2 "professional editor shell" acceptance tests, written from docs/specs/phase1-quality.md only.
test.use({actionTimeout:15000});

const INTERACTIVE='a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=radio],[role=tab],[role=switch],[role=checkbox],[role=menuitem],[role=combobox],[tabindex]:not([tabindex="-1"])';
type Rect={x:number;y:number;width:number;height:number};
const overlapArea=(a:Rect,b:Rect)=>{const w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),h=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);return w>0.01&&h>0.01?w*h:0;};

/** Visible interactive elements inside a container, in DOM order, with their accessible-name text and box. */
async function interactive(container:Locator){
  return container.evaluate((root,selector)=>{
    const name=(el:Element)=>{const by=el.getAttribute('aria-labelledby');if(by)return by.split(/\s+/).map(id=>document.getElementById(id)?.textContent??'').join(' ').trim();return (el.getAttribute('aria-label')??(el as HTMLElement).innerText??el.getAttribute('title')??'').trim();};
    const all=[...root.querySelectorAll(selector)].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});});
    return all.map((el,index)=>{const r=el.getBoundingClientRect();return {index,name:name(el),tag:el.tagName,box:{x:r.x,y:r.y,width:r.width,height:r.height},contains:all.map((other,j)=>other!==el&&el.contains(other)?j:-1).filter(j=>j>=0)};});
  },INTERACTIVE);
}

// ---- S1 canvas first ------------------------------------------------------------------------------------------
for(const [label,viewport,share] of [['desktop 1280x800',VIEWPORTS.desktop,0.6],['phone 360x800',VIEWPORTS.phone360,0.5],['phone 412x915',VIEWPORTS.phone412,0.5]] as const){
  test(`S1 the drawing area is visible without scrolling and covers at least ${share*100}% of the ${label} viewport`,async({page})=>{
    // S1: editor-views visible without scrolling; >= 60% (desktop) / >= 50% (phones) of the viewport area.
    await page.setViewportSize(viewport);
    await start(page);
    const views=page.getByTestId('editor-views');
    await expect(views).toBeVisible();
    expect(await page.evaluate(()=>[window.scrollX,window.scrollY])).toEqual([0,0]);
    const box=(await views.boundingBox())!;
    test.info().annotations.push({type:'S1-box',description:JSON.stringify({viewport,box})});
    expect(box.x).toBeGreaterThanOrEqual(-0.5);expect(box.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+0.5);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+0.5);
    expect(box.width*box.height/(viewport.width*viewport.height)).toBeGreaterThanOrEqual(share);
  });
}

// ---- S2 top bar -----------------------------------------------------------------------------------------------
for(const [label,viewport] of [['desktop 1280x800',VIEWPORTS.desktop],['phone 360x800',VIEWPORTS.phone360],['phone 412x915',VIEWPORTS.phone412]] as const){
  test(`S2 the top bar holds the app mark, project name, Drawing view switch, Undo, Redo and Share/Export (${label})`,async({page})=>{
    // S2: banner contents.
    await page.setViewportSize(viewport);
    await start(page);
    const doc=await exportDoc(page);
    await page.keyboard.press('Escape');
    const banner=page.getByRole('banner');
    await expect(banner).toHaveCount(1);
    await expect(banner).toBeVisible();
    const mark=await banner.evaluate(el=>/GharPlan/i.test((el as HTMLElement).innerText)||!!el.querySelector('[aria-label*="GharPlan" i],img[alt*="GharPlan" i],svg[aria-label*="GharPlan" i],title'));
    expect(mark,'app mark in the top bar').toBe(true);
    await expect(banner).toContainText(doc.name);
    const group=banner.getByRole('group',{name:'Drawing view',exact:true});
    await expect(group).toBeVisible();
    const choice=(name:RegExp)=>group.getByRole('button',{name}).or(group.getByRole('radio',{name})).or(group.getByRole('tab',{name}));
    await expect(choice(/^2D( plan)?$/i)).toBeVisible();
    await expect(choice(/^3D( view)?$/i)).toBeVisible();
    if(viewport.width>=1280)await expect(choice(/^2D\s*\+\s*3D/i)).toBeVisible();
    await expect(banner.getByRole('button',{name:'Undo',exact:true})).toBeVisible();
    await expect(banner.getByRole('button',{name:'Redo',exact:true})).toBeVisible();
    const share=/^(Share|Export)\b/i;
    await expect(banner.getByRole('button',{name:share}).or(banner.getByRole('link',{name:share})).or(banner.getByRole('menuitem',{name:share})).first()).toBeVisible();
  });
}

for(const [label,viewport] of [['phone 360x800',VIEWPORTS.phone360],['phone 412x915',VIEWPORTS.phone412]] as const){
  test(`S2 on ${label} no two top-bar controls overlap and each is at least 40x40 px`,async({page})=>{
    // S2: phone overlap area = 0 and every interactive element >= 40x40 px.
    await page.setViewportSize(viewport);
    await start(page);
    const banner=page.getByRole('banner');
    await expect(banner).toBeVisible();
    const items=await interactive(banner);
    test.info().annotations.push({type:'S2-controls',description:JSON.stringify(items.map(i=>({name:i.name,box:i.box})))});
    expect(items.length).toBeGreaterThanOrEqual(5);
    const small=items.filter(i=>i.box.width<40-0.01||i.box.height<40-0.01).map(i=>`${i.tag} "${i.name}" ${i.box.width.toFixed(1)}x${i.box.height.toFixed(1)}`);
    expect(small,'controls smaller than 40x40 px').toEqual([]);
    const overlaps:string[]=[];
    for(const a of items)for(const b of items){
      if(b.index<=a.index||a.contains.includes(b.index)||b.contains.includes(a.index))continue;
      const area=overlapArea(a.box,b.box);if(area>0)overlaps.push(`"${a.name}" overlaps "${b.name}" by ${area.toFixed(1)} px²`);
    }
    expect(overlaps).toEqual([]);
  });
}

// ---- S3 tool rail ---------------------------------------------------------------------------------------------
async function visiblePanels(page:Page){const open:string[]=[];for(const tool of TOOLS)if(await panel(page,tool).isVisible())open.push(tool);return open;}

test('S3 desktop: each of the six tools opens its own panel beside the canvas with one tap, one panel at a time',async({page})=>{
  // S3: navigation "Tools"; Draw, Openings, Furniture, Materials, Copilot, Project; region named after the tool.
  await page.setViewportSize(VIEWPORTS.desktop);
  await start(page);
  await expect(toolRail(page)).toBeVisible();
  for(const tool of TOOLS){
    await toolButton(page,tool).click();
    const region=panel(page,tool);
    await expect(region).toBeVisible();
    expect(await visiblePanels(page),`only ${tool} is open`).toEqual([tool]);
    const box=(await region.boundingBox())!,views=(await page.getByTestId('editor-views').boundingBox())!;
    expect(overlapArea(box,views),`${tool} panel sits beside the canvas, not over it`).toBe(0);
  }
});

test('S3 desktop: Escape closes the open panel, and so does its close button',async({page})=>{
  // S3: "Escape or a close button closes it."
  await page.setViewportSize(VIEWPORTS.desktop);
  await start(page);
  for(const tool of TOOLS){
    const region=await openTool(page,tool);
    await page.keyboard.press('Escape');
    await expect(region,`Escape closes ${tool}`).toBeHidden();
    await openTool(page,tool);
    await region.getByRole('button',{name:/close/i}).first().click();
    await expect(region,`close button closes ${tool}`).toBeHidden();
  }
});

for(const [label,viewport] of [['phone 360x800',VIEWPORTS.phone360],['phone 412x915',VIEWPORTS.phone412]] as const){
  test(`S3 ${label}: each tool opens as a bottom sheet, one at a time, and Escape closes it`,async({page})=>{
    // S3: on phones the panel is a bottom sheet.
    await page.setViewportSize(viewport);
    await start(page);
    await expect(toolRail(page)).toBeVisible();
    for(const tool of TOOLS){
      await toolButton(page,tool).click();
      const region=panel(page,tool);
      await expect(region).toBeVisible();
      expect(await visiblePanels(page),`only ${tool} is open`).toEqual([tool]);
      const box=(await region.boundingBox())!;
      expect(box.y+box.height,`${tool} sheet reaches the bottom edge`).toBeGreaterThanOrEqual(viewport.height-2);
      expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+2);
      expect(box.width,`${tool} sheet spans the screen width`).toBeGreaterThanOrEqual(viewport.width*0.9);
      expect(box.y,`${tool} sheet starts below the top of the screen`).toBeGreaterThan(0);
    }
    await page.keyboard.press('Escape');
    expect(await visiblePanels(page)).toEqual([]);
  });
}

// ---- S5 Hindi -------------------------------------------------------------------------------------------------
type ShellText={banner:{name:string}[];group:string;rail:string[];panels:{name:string;heading:string}[]};
async function shellText(page:Page,rail:Locator,banner:Locator):Promise<ShellText>{
  const group=await banner.locator('[role=group]').evaluateAll(gs=>gs.map(g=>{const by=g.getAttribute('aria-labelledby');return by?by.split(/\s+/).map(id=>document.getElementById(id)?.textContent??'').join(' ').trim():(g.getAttribute('aria-label')??'');}));
  const railItems=await interactive(rail),panels:{name:string;heading:string}[]=[];
  for(let i=0;i<railItems.length;i++){
    await page.keyboard.press('Escape');
    // Mark every named region visible now; the panel the tap opens is the outermost unmarked visible region.
    await page.evaluate(()=>{for(const el of document.querySelectorAll('[data-acceptance-seen]'))el.removeAttribute('data-acceptance-seen');for(const el of document.querySelectorAll('section[aria-label],section[aria-labelledby],[role=region]'))if(el.checkVisibility())el.setAttribute('data-acceptance-seen','');});
    await rail.locator('a[href],button,[role=button],[role=tab],[role=link]').filter({visible:true}).nth(i).click();
    const fresh=()=>page.evaluate(()=>{
      const all=[...document.querySelectorAll('section[aria-label],section[aria-labelledby],[role=region]')].filter(e=>e.checkVisibility()&&!e.hasAttribute('data-acceptance-seen'));
      const outer=all.filter(e=>!all.some(o=>o!==e&&o.contains(e)));
      const nameOf=(el:Element)=>{const by=el.getAttribute('aria-labelledby');return by?by.split(/\s+/).map(id=>document.getElementById(id)?.textContent??'').join(' ').trim():(el.getAttribute('aria-label')??'').trim();};
      return outer.map(el=>({name:nameOf(el),heading:(el.querySelector('h1,h2,h3,h4,h5,h6,[role=heading]')?.textContent??'').trim()}));
    });
    await expect.poll(async()=>(await fresh()).length,{message:`rail item ${i} opens one panel`}).toBe(1);
    panels.push((await fresh())[0]!);
  }
  await page.keyboard.press('Escape');
  return {banner:(await interactive(banner)).map(i=>({name:i.name})),group:group.join(' '),rail:railItems.map(i=>i.name),panels};
}

test('S5 with Hindi chosen, the top bar, the tool rail and the panel titles are in Hindi',async({page,browser})=>{
  // S5: Hindi texts contain Devanagari and differ from the English ones.
  test.setTimeout(90000);
  await page.setViewportSize(VIEWPORTS.desktop);
  await start(page);
  const doc=await exportDoc(page);
  await page.keyboard.press('Escape');
  const english=await shellText(page,toolRail(page),page.getByRole('banner'));
  expect(english.rail.length).toBeGreaterThanOrEqual(6);
  // Sanity: in English the panels found are the six named tool panels.
  expect(english.panels.map(p=>p.name).filter(n=>(TOOLS as readonly string[]).includes(n)).length).toBe(6);

  const context=await browser.newContext({baseURL:test.info().project.use.baseURL!,viewport:VIEWPORTS.desktop,hasTouch:true});
  const hindi=await context.newPage();
  await hindi.goto('/');
  await hindi.getByLabel('Language',{exact:true}).selectOption('hi');
  await hindi.getByRole('button',{name:'स्वागत छोड़ें',exact:true}).click();
  await expect(hindi.getByTestId('editor-views')).toBeVisible();
  const navs=hindi.getByRole('navigation');
  const railIndex=await navs.evaluateAll(list=>list.findIndex(n=>n.querySelectorAll('button,[role=button],[role=tab],a[href]').length>=6));
  expect(railIndex).toBeGreaterThanOrEqual(0);
  const translated=await shellText(hindi,navs.nth(railIndex),hindi.getByRole('banner'));
  await context.close();
  test.info().annotations.push({type:'S5',description:JSON.stringify({english,translated})});

  expect(translated.group).toMatch(DEVANAGARI);
  expect(translated.group).not.toBe(english.group);
  expect(translated.rail.length).toBe(english.rail.length);
  translated.rail.forEach((name,i)=>{expect(name,`rail item ${i}`).toMatch(DEVANAGARI);expect(name).not.toBe(english.rail[i]);});
  expect(translated.banner.length).toBe(english.banner.length);
  english.banner.forEach((item,i)=>{
    const words=item.name.replace(/GharPlan/gi,'').replace(doc.name,'').match(/[A-Za-z]{3,}/g);
    if(!words)return; // brand, project name and "2D"/"3D" are not translated
    expect(translated.banner[i]!.name,`top-bar control "${item.name}"`).toMatch(DEVANAGARI);
  });
  expect(translated.panels.length).toBe(english.panels.length);
  translated.panels.forEach((p,i)=>{
    expect(p.name,`panel ${english.panels[i]!.name} title`).toMatch(DEVANAGARI);
    expect(p.name).not.toBe(english.panels[i]!.name);
    if(english.panels[i]!.heading&&/[A-Za-z]{3,}/.test(english.panels[i]!.heading))expect(p.heading).toMatch(DEVANAGARI);
  });
});

