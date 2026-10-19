import type {RoomType} from '@gharplan/core-model';

/**
 * D76 M3 offline Copilot: reads a short request in English, Hinglish or Hindi and names one action the app already
 * knows how to do. It is a keyword reader, not a language model, so anything it is unsure about becomes 'help' and the
 * drawing is left alone. A real model (Gemini, after the owner's cost limit and consent) will return the same Intent.
 */
export type PaintColour='beige'|'white'|'sky_blue'|'grey'|'mint'|'peach';
export type FloorFinish='wood'|'tile'|'marble';
export type Intent=Readonly<
 |{kind:'template';template:'1bhk'|'2bhk'}
 |{kind:'furnish';room:RoomWords}
 |{kind:'paintWalls';colour:PaintColour|null;room:RoomWords}
 |{kind:'floor';finish:FloorFinish|null;room:RoomWords}
 |{kind:'help'}>;
/** The room the person named: a room type, the exact text that matched, or nothing. */
export type RoomWords=Readonly<{type:RoomType;text:string}>|null;

// Devanagari is compared without the nukta dot, so फ़र्श/फर्श and both encodings of ड़ match the same words.
const fold=(text:string)=>text.normalize('NFD').replace(/\u093C/g,'').normalize('NFC');
const R=(pattern:RegExp)=>new RegExp(fold(pattern.source),pattern.flags);
const words=(text:string)=>` ${fold(text.toLowerCase()).replace(/[.,!?;:()"'।]+/g,' ').replace(/\s+/g,' ').trim()} `;
const has=(text:string,patterns:readonly RegExp[])=>patterns.some(p=>p.test(text));

// Latin patterns are matched on whole words; Devanagari ones as plain text (no \b support for it in JS).
const ROOMS:readonly [RoomType,RegExp][]=[
 ['bedroom',R(/ (bed ?rooms?|master ?bedroom|shayan ?kaksh)\b|बेडरूम|सोने का कमरा|शयन कक्ष/)],
 ['living',R(/ (living ?rooms?|living|lounge|drawing ?room|baithak|baithak ?khana)\b|लिविंग|बैठक|ड्रॉइंग रूम/)],
 ['hall',R(/ (hall)\b|हॉल/)],
 ['kitchen',R(/ (kitchen|rasoi|rasoi ?ghar)\b|किचन|रसोई/)],
 ['dining',R(/ (dining ?rooms?|dining|dinning)\b|डाइनिंग|भोजन कक्ष/)],
 ['bathroom',R(/ (bath ?rooms?|bathroom|toilet|washroom|snaanghar)\b|बाथरूम|स्नानघर/)],
 ['study',R(/ (study ?rooms?|study|office)\b|स्टडी/)],
 ['balcony',R(/ (balcony|balconies)\b|बालकनी/)],
 ['pooja',R(/ (pooja ?rooms?|puja ?rooms?|pooja|puja|mandir)\b|पूजा/)],
 ['utility',R(/ (utility|store ?room)\b|यूटिलिटी/)],
];
const COLOURS:readonly [PaintColour,RegExp][]=[
 ['beige',R(/ (beige|baige|bej|cream|off ?white)\b|बेज|क्रीम/)],
 ['sky_blue',R(/ (sky ?blue|light ?blue|blue|neela|nila|aasmani|asmani)\b|नीला|आसमानी/)],
 ['grey',R(/ (grey|gray|light ?grey|light ?gray|slaty|dhusar)\b|ग्रे|स्लेटी/)],
 ['mint',R(/ (mint|green|light ?green|hara|hari|sage)\b|हरा|हरी/)],
 ['peach',R(/ (peach|pink|gulabi|halka ?gulabi)\b|पीच|गुलाबी/)],
 ['white',R(/ (white|safed|sufed|shwet)\b|सफ़ेद|सफेद/)],
];
const FINISHES:readonly [FloorFinish,RegExp][]=[
 ['wood',R(/ (wood|wooden|laminate|lakdi|lakri|lakdi ?ka|parquet|plank)\b|लकड़ी|वुड/)],
 ['marble',R(/ (marble|sangmarmar|marbel)\b|मार्बल|संगमरमर/)],
 ['tile',R(/ (tiles?|vitrified|ceramic)\b|टाइल/)],
];
const FURNISH=[R(/ (furnish|furnished|furniture|arrange|decorate|sajao|saja ?do|sajana|set ?up)\b/),R(/सजा|फ़र्नीचर|फर्नीचर/)];
const WALLS=[R(/ (walls?|deewar|deewaar|diwar|diwaar|deewaron|diwaron|wall ?paint)\b/),R(/दीवार/)];
const PAINT=[R(/ (paint|painted|colou?r|colou?red|rang|rango|rangwa|rangna|repaint)\b/),R(/रंग|पेंट/)];
const FLOOR=[R(/ (floors?|flooring|farsh|farsh ?par|zameen)\b/),R(/फ़र्श|फर्श|फ्लोर/)];
const TEMPLATE=R(/(?:^| )([12]) ?bhk\b|([१२]) ?बीएचके/);

function room(text:string):RoomWords{
 for(const [type,pattern] of ROOMS){const m=pattern.exec(text);if(m)return {type,text:m[0].trim()};}
 return null;
}
const pick=<T extends string>(text:string,list:readonly [T,RegExp][]):T|null=>list.find(([,p])=>p.test(text))?.[0]??null;

export function readIntent(raw:string):Intent{
 const text=words(raw);
 if(text.trim().length===0||text.length>400)return {kind:'help'};
 const bhk=TEMPLATE.exec(text);
 if(bhk){const n=bhk[1]??(bhk[2]==='१'?'1':'2');return {kind:'template',template:n==='1'?'1bhk':'2bhk'};}
 // Paint/floor words win over "furniture": "furniture colour" is not a request we can do, so it stays help below.
 const floorFinish=pick(text,FINISHES),colour=pick(text,COLOURS);
 if(has(text,FLOOR)&&(floorFinish||!has(text,WALLS)))return {kind:'floor',finish:floorFinish,room:room(text)};
 if(floorFinish&&!has(text,WALLS)&&!has(text,FURNISH))return {kind:'floor',finish:floorFinish,room:room(text)};
 if(has(text,WALLS)&&(colour||has(text,PAINT)))return {kind:'paintWalls',colour,room:room(text)};
 if(has(text,FURNISH)&&!colour)return {kind:'furnish',room:room(text)};
 return {kind:'help'};
}
