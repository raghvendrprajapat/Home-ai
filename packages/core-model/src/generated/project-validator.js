// Generated from docs/examples/project.schema.json. Run pnpm schema:generate; do not edit.
import dependency_0_module from "ajv/dist/runtime/ucs2length.js";
const dependency_0 = typeof dependency_0_module === "function" ? { default: dependency_0_module } : dependency_0_module;
import dependency_1_module from "ajv-formats/dist/formats.js";
const dependency_1 = typeof dependency_1_module === "function" ? { default: dependency_1_module } : dependency_1_module;
"use strict";
export const validate = validate20;
export default validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://example.invalid/gharplan/project.schema.json","title":"GharPlan project document","type":"object","additionalProperties":false,"required":["schemaVersion","id","name","units","createdAt","updatedAt","revision","floors","junctions","walls","openings","rooms","furniture","materials","lights","cameras"],"$defs":{"id":{"type":"string","pattern":"^[A-Za-z0-9_-]{2,40}$"},"mm":{"type":"integer","minimum":-1000000,"maximum":1000000},"posMm":{"type":"integer","minimum":1,"maximum":1000000},"vec2":{"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"$ref":"#/$defs/mm"},"y":{"$ref":"#/$defs/mm"}}}},"properties":{"schemaVersion":{"const":1},"id":{"$ref":"#/$defs/id"},"name":{"type":"string","minLength":1,"maxLength":120},"units":{"enum":["metric","imperial"]},"createdAt":{"type":"string","format":"date-time"},"updatedAt":{"type":"string","format":"date-time"},"revision":{"type":"integer","minimum":0},"floors":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["id","name","level","elevation","defaultWallHeight"],"properties":{"id":{"$ref":"#/$defs/id"},"name":{"type":"string"},"level":{"type":"integer"},"elevation":{"$ref":"#/$defs/mm"},"defaultWallHeight":{"$ref":"#/$defs/posMm"}}}},"junctions":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","floorId","x","y"],"properties":{"id":{"$ref":"#/$defs/id"},"floorId":{"$ref":"#/$defs/id"},"x":{"$ref":"#/$defs/mm"},"y":{"$ref":"#/$defs/mm"}}}},"walls":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","floorId","a","b","thickness","height","leftMaterial","rightMaterial","rev"],"properties":{"id":{"$ref":"#/$defs/id"},"floorId":{"$ref":"#/$defs/id"},"a":{"$ref":"#/$defs/id"},"b":{"$ref":"#/$defs/id"},"thickness":{"type":"integer","minimum":50,"maximum":1000},"height":{"type":"integer","minimum":1000,"maximum":6000},"leftMaterial":{"$ref":"#/$defs/id"},"rightMaterial":{"$ref":"#/$defs/id"},"rev":{"type":"integer","minimum":0}}}},"openings":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","wallId","kind","assetId","offset","width","height","sill","flipX","flipY","rev"],"properties":{"id":{"$ref":"#/$defs/id"},"wallId":{"$ref":"#/$defs/id"},"kind":{"enum":["door","window","opening"]},"assetId":{"$ref":"#/$defs/id"},"offset":{"$ref":"#/$defs/posMm"},"width":{"$ref":"#/$defs/posMm"},"height":{"$ref":"#/$defs/posMm"},"sill":{"type":"integer","minimum":0,"maximum":6000},"flipX":{"type":"boolean"},"flipY":{"type":"boolean"},"rev":{"type":"integer","minimum":0}}}},"rooms":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","floorId","boundary","name","type","ceilingHeight","floorMaterial","rev"],"properties":{"id":{"$ref":"#/$defs/id"},"floorId":{"$ref":"#/$defs/id"},"boundary":{"type":"array","minItems":3,"items":{"$ref":"#/$defs/id"}},"name":{"type":"string","maxLength":60},"type":{"enum":["living","bedroom","kitchen","bathroom","dining","pooja","balcony","utility","hall","study","other"]},"ceilingHeight":{"type":"integer","minimum":1800,"maximum":6000},"floorMaterial":{"$ref":"#/$defs/id"},"rev":{"type":"integer","minimum":0}}}},"furniture":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","floorId","assetId","assetVersion","position","elevation","rotationDeg","size","materialOverrides","rev"],"properties":{"id":{"$ref":"#/$defs/id"},"floorId":{"$ref":"#/$defs/id"},"assetId":{"$ref":"#/$defs/id"},"assetVersion":{"type":"integer","minimum":1},"position":{"$ref":"#/$defs/vec2"},"elevation":{"type":"integer","minimum":0,"maximum":6000},"rotationDeg":{"type":"number","minimum":0,"exclusiveMaximum":360},"size":{"type":"object","additionalProperties":false,"required":["w","d","h"],"properties":{"w":{"$ref":"#/$defs/posMm"},"d":{"$ref":"#/$defs/posMm"},"h":{"$ref":"#/$defs/posMm"}}},"materialOverrides":{"type":"object","additionalProperties":{"$ref":"#/$defs/id"}},"groupId":{"$ref":"#/$defs/id"},"rev":{"type":"integer","minimum":0}}}},"materials":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","name","baseColor","roughness","metalness"],"properties":{"id":{"$ref":"#/$defs/id"},"name":{"type":"string"},"baseColor":{"type":"string","pattern":"^#[0-9a-fA-F]{6}$"},"textureAssetId":{"$ref":"#/$defs/id"},"uvScaleMm":{"$ref":"#/$defs/posMm"},"roughness":{"type":"number","minimum":0,"maximum":1},"metalness":{"type":"number","minimum":0,"maximum":1}}}},"cameras":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","name","mode","position","target"],"properties":{"id":{"$ref":"#/$defs/id"},"name":{"type":"string"},"mode":{"enum":["orbit","walk"]},"position":{"type":"array","items":{"$ref":"#/$defs/mm"},"minItems":3,"maxItems":3},"target":{"type":"array","items":{"$ref":"#/$defs/mm"},"minItems":3,"maxItems":3}}}},"lights":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","floorId","kind","position","height","lumens","colorTempK","castsShadow","rev"],"properties":{"id":{"$ref":"#/$defs/id"},"floorId":{"$ref":"#/$defs/id"},"kind":{"enum":["point","spot","strip","ambient"]},"position":{"$ref":"#/$defs/vec2"},"height":{"type":"integer","minimum":0,"maximum":6000},"lumens":{"type":"integer","minimum":0,"maximum":20000},"colorTempK":{"type":"integer","minimum":1800,"maximum":8000},"castsShadow":{"type":"boolean"},"fixtureAssetId":{"$ref":"#/$defs/id"},"rev":{"type":"integer","minimum":0}}}},"stairs":{"type":"array","maxItems":50,"items":{"type":"object","additionalProperties":false,"required":["id","floorId","position","rotationDeg","width","length","height","steps","material","rev"],"properties":{"id":{"$ref":"#/$defs/id"},"floorId":{"$ref":"#/$defs/id"},"position":{"$ref":"#/$defs/vec2"},"rotationDeg":{"enum":[0,90,180,270]},"width":{"type":"integer","minimum":600,"maximum":2000},"length":{"type":"integer","minimum":1000,"maximum":8000},"height":{"type":"integer","minimum":500,"maximum":6000},"steps":{"type":"integer","minimum":2,"maximum":30},"material":{"$ref":"#/$defs/id"},"rev":{"type":"integer","minimum":0}}}},"roofs":{"type":"array","maxItems":6,"items":{"type":"object","additionalProperties":false,"required":["id","floorId","kind","pitchDeg","overhang","ridgeAxis","material","rev"],"properties":{"id":{"$ref":"#/$defs/id"},"floorId":{"$ref":"#/$defs/id"},"kind":{"enum":["flat","gable"]},"pitchDeg":{"type":"integer","minimum":5,"maximum":60},"overhang":{"type":"integer","minimum":0,"maximum":1000},"ridgeAxis":{"enum":["x","y"]},"material":{"$ref":"#/$defs/id"},"rev":{"type":"integer","minimum":0}}}}}};
const schema32 = {"type":"string","pattern":"^[A-Za-z0-9_-]{2,40}$"};
const schema34 = {"type":"integer","minimum":-1000000,"maximum":1000000};
const schema35 = {"type":"integer","minimum":1,"maximum":1000000};
const func1 = Object.prototype.hasOwnProperty;
const func2 = dependency_0.default;
const pattern4 = new RegExp("^[A-Za-z0-9_-]{2,40}$", "u");
const pattern27 = new RegExp("^#[0-9a-fA-F]{6}$", "u");
const formats0 = dependency_1.fullFormats["date-time"];
const schema59 = {"type":"object","additionalProperties":false,"required":["x","y"],"properties":{"x":{"$ref":"#/$defs/mm"},"y":{"$ref":"#/$defs/mm"}}};

function validate21(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate21.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.x === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.y === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
for(const key0 in data){
if(!((key0 === "x") || (key0 === "y"))){
const err2 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
}
if(data.x !== undefined){
let data0 = data.x;
if(!(((typeof data0 == "number") && (!(data0 % 1) && !isNaN(data0))) && (isFinite(data0)))){
const err3 = {instancePath:instancePath+"/x",schemaPath:"#/$defs/mm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if((typeof data0 == "number") && (isFinite(data0))){
if(data0 > 1000000 || isNaN(data0)){
const err4 = {instancePath:instancePath+"/x",schemaPath:"#/$defs/mm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
if(data0 < -1000000 || isNaN(data0)){
const err5 = {instancePath:instancePath+"/x",schemaPath:"#/$defs/mm/minimum",keyword:"minimum",params:{comparison: ">=", limit: -1000000},message:"must be >= -1000000"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
}
}
if(data.y !== undefined){
let data1 = data.y;
if(!(((typeof data1 == "number") && (!(data1 % 1) && !isNaN(data1))) && (isFinite(data1)))){
const err6 = {instancePath:instancePath+"/y",schemaPath:"#/$defs/mm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
if((typeof data1 == "number") && (isFinite(data1))){
if(data1 > 1000000 || isNaN(data1)){
const err7 = {instancePath:instancePath+"/y",schemaPath:"#/$defs/mm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
if(data1 < -1000000 || isNaN(data1)){
const err8 = {instancePath:instancePath+"/y",schemaPath:"#/$defs/mm/minimum",keyword:"minimum",params:{comparison: ">=", limit: -1000000},message:"must be >= -1000000"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
}
}
}
else {
const err9 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
validate21.errors = vErrors;
return errors === 0;
}
validate21.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};


function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="https://example.invalid/gharplan/project.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate20.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.schemaVersion === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "schemaVersion"},message:"must have required property '"+"schemaVersion"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.id === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
if(data.name === undefined){
const err2 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
if(data.units === undefined){
const err3 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "units"},message:"must have required property '"+"units"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(data.createdAt === undefined){
const err4 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "createdAt"},message:"must have required property '"+"createdAt"+"'"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
if(data.updatedAt === undefined){
const err5 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "updatedAt"},message:"must have required property '"+"updatedAt"+"'"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
if(data.revision === undefined){
const err6 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "revision"},message:"must have required property '"+"revision"+"'"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
if(data.floors === undefined){
const err7 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "floors"},message:"must have required property '"+"floors"+"'"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
if(data.junctions === undefined){
const err8 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "junctions"},message:"must have required property '"+"junctions"+"'"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
if(data.walls === undefined){
const err9 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "walls"},message:"must have required property '"+"walls"+"'"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
if(data.openings === undefined){
const err10 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "openings"},message:"must have required property '"+"openings"+"'"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
if(data.rooms === undefined){
const err11 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "rooms"},message:"must have required property '"+"rooms"+"'"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
if(data.furniture === undefined){
const err12 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "furniture"},message:"must have required property '"+"furniture"+"'"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
if(data.materials === undefined){
const err13 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "materials"},message:"must have required property '"+"materials"+"'"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
if(data.lights === undefined){
const err14 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "lights"},message:"must have required property '"+"lights"+"'"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
if(data.cameras === undefined){
const err15 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "cameras"},message:"must have required property '"+"cameras"+"'"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
for(const key0 in data){
if(!(func1.call(schema31.properties, key0))){
const err16 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
if(data.schemaVersion !== undefined){
if(1 !== data.schemaVersion){
const err17 = {instancePath:instancePath+"/schemaVersion",schemaPath:"#/properties/schemaVersion/const",keyword:"const",params:{allowedValue: 1},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
if(data.id !== undefined){
let data1 = data.id;
if(typeof data1 === "string"){
if(!pattern4.test(data1)){
const err18 = {instancePath:instancePath+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
}
else {
const err19 = {instancePath:instancePath+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
}
if(data.name !== undefined){
let data2 = data.name;
if(typeof data2 === "string"){
if(func2(data2) > 120){
const err20 = {instancePath:instancePath+"/name",schemaPath:"#/properties/name/maxLength",keyword:"maxLength",params:{limit: 120},message:"must NOT have more than 120 characters"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
if(func2(data2) < 1){
const err21 = {instancePath:instancePath+"/name",schemaPath:"#/properties/name/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
else {
const err22 = {instancePath:instancePath+"/name",schemaPath:"#/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
}
if(data.units !== undefined){
let data3 = data.units;
if(!((data3 === "metric") || (data3 === "imperial"))){
const err23 = {instancePath:instancePath+"/units",schemaPath:"#/properties/units/enum",keyword:"enum",params:{allowedValues: schema31.properties.units.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
}
if(data.createdAt !== undefined){
let data4 = data.createdAt;
if(typeof data4 === "string"){
if(!(formats0.validate(data4))){
const err24 = {instancePath:instancePath+"/createdAt",schemaPath:"#/properties/createdAt/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
else {
const err25 = {instancePath:instancePath+"/createdAt",schemaPath:"#/properties/createdAt/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
}
if(data.updatedAt !== undefined){
let data5 = data.updatedAt;
if(typeof data5 === "string"){
if(!(formats0.validate(data5))){
const err26 = {instancePath:instancePath+"/updatedAt",schemaPath:"#/properties/updatedAt/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
}
else {
const err27 = {instancePath:instancePath+"/updatedAt",schemaPath:"#/properties/updatedAt/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
}
if(data.revision !== undefined){
let data6 = data.revision;
if(!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))){
const err28 = {instancePath:instancePath+"/revision",schemaPath:"#/properties/revision/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
if((typeof data6 == "number") && (isFinite(data6))){
if(data6 < 0 || isNaN(data6)){
const err29 = {instancePath:instancePath+"/revision",schemaPath:"#/properties/revision/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err29];
}
else {
vErrors.push(err29);
}
errors++;
}
}
}
if(data.floors !== undefined){
let data7 = data.floors;
if(Array.isArray(data7)){
if(data7.length < 1){
const err30 = {instancePath:instancePath+"/floors",schemaPath:"#/properties/floors/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err30];
}
else {
vErrors.push(err30);
}
errors++;
}
const len0 = data7.length;
for(let i0=0; i0<len0; i0++){
let data8 = data7[i0];
if(data8 && typeof data8 == "object" && !Array.isArray(data8)){
if(data8.id === undefined){
const err31 = {instancePath:instancePath+"/floors/" + i0,schemaPath:"#/properties/floors/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err31];
}
else {
vErrors.push(err31);
}
errors++;
}
if(data8.name === undefined){
const err32 = {instancePath:instancePath+"/floors/" + i0,schemaPath:"#/properties/floors/items/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err32];
}
else {
vErrors.push(err32);
}
errors++;
}
if(data8.level === undefined){
const err33 = {instancePath:instancePath+"/floors/" + i0,schemaPath:"#/properties/floors/items/required",keyword:"required",params:{missingProperty: "level"},message:"must have required property '"+"level"+"'"};
if(vErrors === null){
vErrors = [err33];
}
else {
vErrors.push(err33);
}
errors++;
}
if(data8.elevation === undefined){
const err34 = {instancePath:instancePath+"/floors/" + i0,schemaPath:"#/properties/floors/items/required",keyword:"required",params:{missingProperty: "elevation"},message:"must have required property '"+"elevation"+"'"};
if(vErrors === null){
vErrors = [err34];
}
else {
vErrors.push(err34);
}
errors++;
}
if(data8.defaultWallHeight === undefined){
const err35 = {instancePath:instancePath+"/floors/" + i0,schemaPath:"#/properties/floors/items/required",keyword:"required",params:{missingProperty: "defaultWallHeight"},message:"must have required property '"+"defaultWallHeight"+"'"};
if(vErrors === null){
vErrors = [err35];
}
else {
vErrors.push(err35);
}
errors++;
}
for(const key1 in data8){
if(!(((((key1 === "id") || (key1 === "name")) || (key1 === "level")) || (key1 === "elevation")) || (key1 === "defaultWallHeight"))){
const err36 = {instancePath:instancePath+"/floors/" + i0,schemaPath:"#/properties/floors/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err36];
}
else {
vErrors.push(err36);
}
errors++;
}
}
if(data8.id !== undefined){
let data9 = data8.id;
if(typeof data9 === "string"){
if(!pattern4.test(data9)){
const err37 = {instancePath:instancePath+"/floors/" + i0+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err37];
}
else {
vErrors.push(err37);
}
errors++;
}
}
else {
const err38 = {instancePath:instancePath+"/floors/" + i0+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err38];
}
else {
vErrors.push(err38);
}
errors++;
}
}
if(data8.name !== undefined){
if(typeof data8.name !== "string"){
const err39 = {instancePath:instancePath+"/floors/" + i0+"/name",schemaPath:"#/properties/floors/items/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err39];
}
else {
vErrors.push(err39);
}
errors++;
}
}
if(data8.level !== undefined){
let data11 = data8.level;
if(!(((typeof data11 == "number") && (!(data11 % 1) && !isNaN(data11))) && (isFinite(data11)))){
const err40 = {instancePath:instancePath+"/floors/" + i0+"/level",schemaPath:"#/properties/floors/items/properties/level/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err40];
}
else {
vErrors.push(err40);
}
errors++;
}
}
if(data8.elevation !== undefined){
let data12 = data8.elevation;
if(!(((typeof data12 == "number") && (!(data12 % 1) && !isNaN(data12))) && (isFinite(data12)))){
const err41 = {instancePath:instancePath+"/floors/" + i0+"/elevation",schemaPath:"#/$defs/mm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err41];
}
else {
vErrors.push(err41);
}
errors++;
}
if((typeof data12 == "number") && (isFinite(data12))){
if(data12 > 1000000 || isNaN(data12)){
const err42 = {instancePath:instancePath+"/floors/" + i0+"/elevation",schemaPath:"#/$defs/mm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err42];
}
else {
vErrors.push(err42);
}
errors++;
}
if(data12 < -1000000 || isNaN(data12)){
const err43 = {instancePath:instancePath+"/floors/" + i0+"/elevation",schemaPath:"#/$defs/mm/minimum",keyword:"minimum",params:{comparison: ">=", limit: -1000000},message:"must be >= -1000000"};
if(vErrors === null){
vErrors = [err43];
}
else {
vErrors.push(err43);
}
errors++;
}
}
}
if(data8.defaultWallHeight !== undefined){
let data13 = data8.defaultWallHeight;
if(!(((typeof data13 == "number") && (!(data13 % 1) && !isNaN(data13))) && (isFinite(data13)))){
const err44 = {instancePath:instancePath+"/floors/" + i0+"/defaultWallHeight",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err44];
}
else {
vErrors.push(err44);
}
errors++;
}
if((typeof data13 == "number") && (isFinite(data13))){
if(data13 > 1000000 || isNaN(data13)){
const err45 = {instancePath:instancePath+"/floors/" + i0+"/defaultWallHeight",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err45];
}
else {
vErrors.push(err45);
}
errors++;
}
if(data13 < 1 || isNaN(data13)){
const err46 = {instancePath:instancePath+"/floors/" + i0+"/defaultWallHeight",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err46];
}
else {
vErrors.push(err46);
}
errors++;
}
}
}
}
else {
const err47 = {instancePath:instancePath+"/floors/" + i0,schemaPath:"#/properties/floors/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err47];
}
else {
vErrors.push(err47);
}
errors++;
}
}
}
else {
const err48 = {instancePath:instancePath+"/floors",schemaPath:"#/properties/floors/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err48];
}
else {
vErrors.push(err48);
}
errors++;
}
}
if(data.junctions !== undefined){
let data14 = data.junctions;
if(Array.isArray(data14)){
const len1 = data14.length;
for(let i1=0; i1<len1; i1++){
let data15 = data14[i1];
if(data15 && typeof data15 == "object" && !Array.isArray(data15)){
if(data15.id === undefined){
const err49 = {instancePath:instancePath+"/junctions/" + i1,schemaPath:"#/properties/junctions/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err49];
}
else {
vErrors.push(err49);
}
errors++;
}
if(data15.floorId === undefined){
const err50 = {instancePath:instancePath+"/junctions/" + i1,schemaPath:"#/properties/junctions/items/required",keyword:"required",params:{missingProperty: "floorId"},message:"must have required property '"+"floorId"+"'"};
if(vErrors === null){
vErrors = [err50];
}
else {
vErrors.push(err50);
}
errors++;
}
if(data15.x === undefined){
const err51 = {instancePath:instancePath+"/junctions/" + i1,schemaPath:"#/properties/junctions/items/required",keyword:"required",params:{missingProperty: "x"},message:"must have required property '"+"x"+"'"};
if(vErrors === null){
vErrors = [err51];
}
else {
vErrors.push(err51);
}
errors++;
}
if(data15.y === undefined){
const err52 = {instancePath:instancePath+"/junctions/" + i1,schemaPath:"#/properties/junctions/items/required",keyword:"required",params:{missingProperty: "y"},message:"must have required property '"+"y"+"'"};
if(vErrors === null){
vErrors = [err52];
}
else {
vErrors.push(err52);
}
errors++;
}
for(const key2 in data15){
if(!((((key2 === "id") || (key2 === "floorId")) || (key2 === "x")) || (key2 === "y"))){
const err53 = {instancePath:instancePath+"/junctions/" + i1,schemaPath:"#/properties/junctions/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err53];
}
else {
vErrors.push(err53);
}
errors++;
}
}
if(data15.id !== undefined){
let data16 = data15.id;
if(typeof data16 === "string"){
if(!pattern4.test(data16)){
const err54 = {instancePath:instancePath+"/junctions/" + i1+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err54];
}
else {
vErrors.push(err54);
}
errors++;
}
}
else {
const err55 = {instancePath:instancePath+"/junctions/" + i1+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err55];
}
else {
vErrors.push(err55);
}
errors++;
}
}
if(data15.floorId !== undefined){
let data17 = data15.floorId;
if(typeof data17 === "string"){
if(!pattern4.test(data17)){
const err56 = {instancePath:instancePath+"/junctions/" + i1+"/floorId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err56];
}
else {
vErrors.push(err56);
}
errors++;
}
}
else {
const err57 = {instancePath:instancePath+"/junctions/" + i1+"/floorId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err57];
}
else {
vErrors.push(err57);
}
errors++;
}
}
if(data15.x !== undefined){
let data18 = data15.x;
if(!(((typeof data18 == "number") && (!(data18 % 1) && !isNaN(data18))) && (isFinite(data18)))){
const err58 = {instancePath:instancePath+"/junctions/" + i1+"/x",schemaPath:"#/$defs/mm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err58];
}
else {
vErrors.push(err58);
}
errors++;
}
if((typeof data18 == "number") && (isFinite(data18))){
if(data18 > 1000000 || isNaN(data18)){
const err59 = {instancePath:instancePath+"/junctions/" + i1+"/x",schemaPath:"#/$defs/mm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err59];
}
else {
vErrors.push(err59);
}
errors++;
}
if(data18 < -1000000 || isNaN(data18)){
const err60 = {instancePath:instancePath+"/junctions/" + i1+"/x",schemaPath:"#/$defs/mm/minimum",keyword:"minimum",params:{comparison: ">=", limit: -1000000},message:"must be >= -1000000"};
if(vErrors === null){
vErrors = [err60];
}
else {
vErrors.push(err60);
}
errors++;
}
}
}
if(data15.y !== undefined){
let data19 = data15.y;
if(!(((typeof data19 == "number") && (!(data19 % 1) && !isNaN(data19))) && (isFinite(data19)))){
const err61 = {instancePath:instancePath+"/junctions/" + i1+"/y",schemaPath:"#/$defs/mm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err61];
}
else {
vErrors.push(err61);
}
errors++;
}
if((typeof data19 == "number") && (isFinite(data19))){
if(data19 > 1000000 || isNaN(data19)){
const err62 = {instancePath:instancePath+"/junctions/" + i1+"/y",schemaPath:"#/$defs/mm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err62];
}
else {
vErrors.push(err62);
}
errors++;
}
if(data19 < -1000000 || isNaN(data19)){
const err63 = {instancePath:instancePath+"/junctions/" + i1+"/y",schemaPath:"#/$defs/mm/minimum",keyword:"minimum",params:{comparison: ">=", limit: -1000000},message:"must be >= -1000000"};
if(vErrors === null){
vErrors = [err63];
}
else {
vErrors.push(err63);
}
errors++;
}
}
}
}
else {
const err64 = {instancePath:instancePath+"/junctions/" + i1,schemaPath:"#/properties/junctions/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err64];
}
else {
vErrors.push(err64);
}
errors++;
}
}
}
else {
const err65 = {instancePath:instancePath+"/junctions",schemaPath:"#/properties/junctions/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err65];
}
else {
vErrors.push(err65);
}
errors++;
}
}
if(data.walls !== undefined){
let data20 = data.walls;
if(Array.isArray(data20)){
const len2 = data20.length;
for(let i2=0; i2<len2; i2++){
let data21 = data20[i2];
if(data21 && typeof data21 == "object" && !Array.isArray(data21)){
if(data21.id === undefined){
const err66 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err66];
}
else {
vErrors.push(err66);
}
errors++;
}
if(data21.floorId === undefined){
const err67 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "floorId"},message:"must have required property '"+"floorId"+"'"};
if(vErrors === null){
vErrors = [err67];
}
else {
vErrors.push(err67);
}
errors++;
}
if(data21.a === undefined){
const err68 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "a"},message:"must have required property '"+"a"+"'"};
if(vErrors === null){
vErrors = [err68];
}
else {
vErrors.push(err68);
}
errors++;
}
if(data21.b === undefined){
const err69 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "b"},message:"must have required property '"+"b"+"'"};
if(vErrors === null){
vErrors = [err69];
}
else {
vErrors.push(err69);
}
errors++;
}
if(data21.thickness === undefined){
const err70 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "thickness"},message:"must have required property '"+"thickness"+"'"};
if(vErrors === null){
vErrors = [err70];
}
else {
vErrors.push(err70);
}
errors++;
}
if(data21.height === undefined){
const err71 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "height"},message:"must have required property '"+"height"+"'"};
if(vErrors === null){
vErrors = [err71];
}
else {
vErrors.push(err71);
}
errors++;
}
if(data21.leftMaterial === undefined){
const err72 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "leftMaterial"},message:"must have required property '"+"leftMaterial"+"'"};
if(vErrors === null){
vErrors = [err72];
}
else {
vErrors.push(err72);
}
errors++;
}
if(data21.rightMaterial === undefined){
const err73 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "rightMaterial"},message:"must have required property '"+"rightMaterial"+"'"};
if(vErrors === null){
vErrors = [err73];
}
else {
vErrors.push(err73);
}
errors++;
}
if(data21.rev === undefined){
const err74 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/required",keyword:"required",params:{missingProperty: "rev"},message:"must have required property '"+"rev"+"'"};
if(vErrors === null){
vErrors = [err74];
}
else {
vErrors.push(err74);
}
errors++;
}
for(const key3 in data21){
if(!(func1.call(schema31.properties.walls.items.properties, key3))){
const err75 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err75];
}
else {
vErrors.push(err75);
}
errors++;
}
}
if(data21.id !== undefined){
let data22 = data21.id;
if(typeof data22 === "string"){
if(!pattern4.test(data22)){
const err76 = {instancePath:instancePath+"/walls/" + i2+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err76];
}
else {
vErrors.push(err76);
}
errors++;
}
}
else {
const err77 = {instancePath:instancePath+"/walls/" + i2+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err77];
}
else {
vErrors.push(err77);
}
errors++;
}
}
if(data21.floorId !== undefined){
let data23 = data21.floorId;
if(typeof data23 === "string"){
if(!pattern4.test(data23)){
const err78 = {instancePath:instancePath+"/walls/" + i2+"/floorId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err78];
}
else {
vErrors.push(err78);
}
errors++;
}
}
else {
const err79 = {instancePath:instancePath+"/walls/" + i2+"/floorId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err79];
}
else {
vErrors.push(err79);
}
errors++;
}
}
if(data21.a !== undefined){
let data24 = data21.a;
if(typeof data24 === "string"){
if(!pattern4.test(data24)){
const err80 = {instancePath:instancePath+"/walls/" + i2+"/a",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err80];
}
else {
vErrors.push(err80);
}
errors++;
}
}
else {
const err81 = {instancePath:instancePath+"/walls/" + i2+"/a",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err81];
}
else {
vErrors.push(err81);
}
errors++;
}
}
if(data21.b !== undefined){
let data25 = data21.b;
if(typeof data25 === "string"){
if(!pattern4.test(data25)){
const err82 = {instancePath:instancePath+"/walls/" + i2+"/b",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err82];
}
else {
vErrors.push(err82);
}
errors++;
}
}
else {
const err83 = {instancePath:instancePath+"/walls/" + i2+"/b",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err83];
}
else {
vErrors.push(err83);
}
errors++;
}
}
if(data21.thickness !== undefined){
let data26 = data21.thickness;
if(!(((typeof data26 == "number") && (!(data26 % 1) && !isNaN(data26))) && (isFinite(data26)))){
const err84 = {instancePath:instancePath+"/walls/" + i2+"/thickness",schemaPath:"#/properties/walls/items/properties/thickness/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err84];
}
else {
vErrors.push(err84);
}
errors++;
}
if((typeof data26 == "number") && (isFinite(data26))){
if(data26 > 1000 || isNaN(data26)){
const err85 = {instancePath:instancePath+"/walls/" + i2+"/thickness",schemaPath:"#/properties/walls/items/properties/thickness/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000},message:"must be <= 1000"};
if(vErrors === null){
vErrors = [err85];
}
else {
vErrors.push(err85);
}
errors++;
}
if(data26 < 50 || isNaN(data26)){
const err86 = {instancePath:instancePath+"/walls/" + i2+"/thickness",schemaPath:"#/properties/walls/items/properties/thickness/minimum",keyword:"minimum",params:{comparison: ">=", limit: 50},message:"must be >= 50"};
if(vErrors === null){
vErrors = [err86];
}
else {
vErrors.push(err86);
}
errors++;
}
}
}
if(data21.height !== undefined){
let data27 = data21.height;
if(!(((typeof data27 == "number") && (!(data27 % 1) && !isNaN(data27))) && (isFinite(data27)))){
const err87 = {instancePath:instancePath+"/walls/" + i2+"/height",schemaPath:"#/properties/walls/items/properties/height/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err87];
}
else {
vErrors.push(err87);
}
errors++;
}
if((typeof data27 == "number") && (isFinite(data27))){
if(data27 > 6000 || isNaN(data27)){
const err88 = {instancePath:instancePath+"/walls/" + i2+"/height",schemaPath:"#/properties/walls/items/properties/height/maximum",keyword:"maximum",params:{comparison: "<=", limit: 6000},message:"must be <= 6000"};
if(vErrors === null){
vErrors = [err88];
}
else {
vErrors.push(err88);
}
errors++;
}
if(data27 < 1000 || isNaN(data27)){
const err89 = {instancePath:instancePath+"/walls/" + i2+"/height",schemaPath:"#/properties/walls/items/properties/height/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1000},message:"must be >= 1000"};
if(vErrors === null){
vErrors = [err89];
}
else {
vErrors.push(err89);
}
errors++;
}
}
}
if(data21.leftMaterial !== undefined){
let data28 = data21.leftMaterial;
if(typeof data28 === "string"){
if(!pattern4.test(data28)){
const err90 = {instancePath:instancePath+"/walls/" + i2+"/leftMaterial",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err90];
}
else {
vErrors.push(err90);
}
errors++;
}
}
else {
const err91 = {instancePath:instancePath+"/walls/" + i2+"/leftMaterial",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err91];
}
else {
vErrors.push(err91);
}
errors++;
}
}
if(data21.rightMaterial !== undefined){
let data29 = data21.rightMaterial;
if(typeof data29 === "string"){
if(!pattern4.test(data29)){
const err92 = {instancePath:instancePath+"/walls/" + i2+"/rightMaterial",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err92];
}
else {
vErrors.push(err92);
}
errors++;
}
}
else {
const err93 = {instancePath:instancePath+"/walls/" + i2+"/rightMaterial",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err93];
}
else {
vErrors.push(err93);
}
errors++;
}
}
if(data21.rev !== undefined){
let data30 = data21.rev;
if(!(((typeof data30 == "number") && (!(data30 % 1) && !isNaN(data30))) && (isFinite(data30)))){
const err94 = {instancePath:instancePath+"/walls/" + i2+"/rev",schemaPath:"#/properties/walls/items/properties/rev/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err94];
}
else {
vErrors.push(err94);
}
errors++;
}
if((typeof data30 == "number") && (isFinite(data30))){
if(data30 < 0 || isNaN(data30)){
const err95 = {instancePath:instancePath+"/walls/" + i2+"/rev",schemaPath:"#/properties/walls/items/properties/rev/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err95];
}
else {
vErrors.push(err95);
}
errors++;
}
}
}
}
else {
const err96 = {instancePath:instancePath+"/walls/" + i2,schemaPath:"#/properties/walls/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err96];
}
else {
vErrors.push(err96);
}
errors++;
}
}
}
else {
const err97 = {instancePath:instancePath+"/walls",schemaPath:"#/properties/walls/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err97];
}
else {
vErrors.push(err97);
}
errors++;
}
}
if(data.openings !== undefined){
let data31 = data.openings;
if(Array.isArray(data31)){
const len3 = data31.length;
for(let i3=0; i3<len3; i3++){
let data32 = data31[i3];
if(data32 && typeof data32 == "object" && !Array.isArray(data32)){
if(data32.id === undefined){
const err98 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err98];
}
else {
vErrors.push(err98);
}
errors++;
}
if(data32.wallId === undefined){
const err99 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "wallId"},message:"must have required property '"+"wallId"+"'"};
if(vErrors === null){
vErrors = [err99];
}
else {
vErrors.push(err99);
}
errors++;
}
if(data32.kind === undefined){
const err100 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err100];
}
else {
vErrors.push(err100);
}
errors++;
}
if(data32.assetId === undefined){
const err101 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "assetId"},message:"must have required property '"+"assetId"+"'"};
if(vErrors === null){
vErrors = [err101];
}
else {
vErrors.push(err101);
}
errors++;
}
if(data32.offset === undefined){
const err102 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "offset"},message:"must have required property '"+"offset"+"'"};
if(vErrors === null){
vErrors = [err102];
}
else {
vErrors.push(err102);
}
errors++;
}
if(data32.width === undefined){
const err103 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "width"},message:"must have required property '"+"width"+"'"};
if(vErrors === null){
vErrors = [err103];
}
else {
vErrors.push(err103);
}
errors++;
}
if(data32.height === undefined){
const err104 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "height"},message:"must have required property '"+"height"+"'"};
if(vErrors === null){
vErrors = [err104];
}
else {
vErrors.push(err104);
}
errors++;
}
if(data32.sill === undefined){
const err105 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "sill"},message:"must have required property '"+"sill"+"'"};
if(vErrors === null){
vErrors = [err105];
}
else {
vErrors.push(err105);
}
errors++;
}
if(data32.flipX === undefined){
const err106 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "flipX"},message:"must have required property '"+"flipX"+"'"};
if(vErrors === null){
vErrors = [err106];
}
else {
vErrors.push(err106);
}
errors++;
}
if(data32.flipY === undefined){
const err107 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "flipY"},message:"must have required property '"+"flipY"+"'"};
if(vErrors === null){
vErrors = [err107];
}
else {
vErrors.push(err107);
}
errors++;
}
if(data32.rev === undefined){
const err108 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/required",keyword:"required",params:{missingProperty: "rev"},message:"must have required property '"+"rev"+"'"};
if(vErrors === null){
vErrors = [err108];
}
else {
vErrors.push(err108);
}
errors++;
}
for(const key4 in data32){
if(!(func1.call(schema31.properties.openings.items.properties, key4))){
const err109 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err109];
}
else {
vErrors.push(err109);
}
errors++;
}
}
if(data32.id !== undefined){
let data33 = data32.id;
if(typeof data33 === "string"){
if(!pattern4.test(data33)){
const err110 = {instancePath:instancePath+"/openings/" + i3+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err110];
}
else {
vErrors.push(err110);
}
errors++;
}
}
else {
const err111 = {instancePath:instancePath+"/openings/" + i3+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err111];
}
else {
vErrors.push(err111);
}
errors++;
}
}
if(data32.wallId !== undefined){
let data34 = data32.wallId;
if(typeof data34 === "string"){
if(!pattern4.test(data34)){
const err112 = {instancePath:instancePath+"/openings/" + i3+"/wallId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err112];
}
else {
vErrors.push(err112);
}
errors++;
}
}
else {
const err113 = {instancePath:instancePath+"/openings/" + i3+"/wallId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err113];
}
else {
vErrors.push(err113);
}
errors++;
}
}
if(data32.kind !== undefined){
let data35 = data32.kind;
if(!(((data35 === "door") || (data35 === "window")) || (data35 === "opening"))){
const err114 = {instancePath:instancePath+"/openings/" + i3+"/kind",schemaPath:"#/properties/openings/items/properties/kind/enum",keyword:"enum",params:{allowedValues: schema31.properties.openings.items.properties.kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err114];
}
else {
vErrors.push(err114);
}
errors++;
}
}
if(data32.assetId !== undefined){
let data36 = data32.assetId;
if(typeof data36 === "string"){
if(!pattern4.test(data36)){
const err115 = {instancePath:instancePath+"/openings/" + i3+"/assetId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err115];
}
else {
vErrors.push(err115);
}
errors++;
}
}
else {
const err116 = {instancePath:instancePath+"/openings/" + i3+"/assetId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err116];
}
else {
vErrors.push(err116);
}
errors++;
}
}
if(data32.offset !== undefined){
let data37 = data32.offset;
if(!(((typeof data37 == "number") && (!(data37 % 1) && !isNaN(data37))) && (isFinite(data37)))){
const err117 = {instancePath:instancePath+"/openings/" + i3+"/offset",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err117];
}
else {
vErrors.push(err117);
}
errors++;
}
if((typeof data37 == "number") && (isFinite(data37))){
if(data37 > 1000000 || isNaN(data37)){
const err118 = {instancePath:instancePath+"/openings/" + i3+"/offset",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err118];
}
else {
vErrors.push(err118);
}
errors++;
}
if(data37 < 1 || isNaN(data37)){
const err119 = {instancePath:instancePath+"/openings/" + i3+"/offset",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err119];
}
else {
vErrors.push(err119);
}
errors++;
}
}
}
if(data32.width !== undefined){
let data38 = data32.width;
if(!(((typeof data38 == "number") && (!(data38 % 1) && !isNaN(data38))) && (isFinite(data38)))){
const err120 = {instancePath:instancePath+"/openings/" + i3+"/width",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err120];
}
else {
vErrors.push(err120);
}
errors++;
}
if((typeof data38 == "number") && (isFinite(data38))){
if(data38 > 1000000 || isNaN(data38)){
const err121 = {instancePath:instancePath+"/openings/" + i3+"/width",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err121];
}
else {
vErrors.push(err121);
}
errors++;
}
if(data38 < 1 || isNaN(data38)){
const err122 = {instancePath:instancePath+"/openings/" + i3+"/width",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err122];
}
else {
vErrors.push(err122);
}
errors++;
}
}
}
if(data32.height !== undefined){
let data39 = data32.height;
if(!(((typeof data39 == "number") && (!(data39 % 1) && !isNaN(data39))) && (isFinite(data39)))){
const err123 = {instancePath:instancePath+"/openings/" + i3+"/height",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err123];
}
else {
vErrors.push(err123);
}
errors++;
}
if((typeof data39 == "number") && (isFinite(data39))){
if(data39 > 1000000 || isNaN(data39)){
const err124 = {instancePath:instancePath+"/openings/" + i3+"/height",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err124];
}
else {
vErrors.push(err124);
}
errors++;
}
if(data39 < 1 || isNaN(data39)){
const err125 = {instancePath:instancePath+"/openings/" + i3+"/height",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err125];
}
else {
vErrors.push(err125);
}
errors++;
}
}
}
if(data32.sill !== undefined){
let data40 = data32.sill;
if(!(((typeof data40 == "number") && (!(data40 % 1) && !isNaN(data40))) && (isFinite(data40)))){
const err126 = {instancePath:instancePath+"/openings/" + i3+"/sill",schemaPath:"#/properties/openings/items/properties/sill/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err126];
}
else {
vErrors.push(err126);
}
errors++;
}
if((typeof data40 == "number") && (isFinite(data40))){
if(data40 > 6000 || isNaN(data40)){
const err127 = {instancePath:instancePath+"/openings/" + i3+"/sill",schemaPath:"#/properties/openings/items/properties/sill/maximum",keyword:"maximum",params:{comparison: "<=", limit: 6000},message:"must be <= 6000"};
if(vErrors === null){
vErrors = [err127];
}
else {
vErrors.push(err127);
}
errors++;
}
if(data40 < 0 || isNaN(data40)){
const err128 = {instancePath:instancePath+"/openings/" + i3+"/sill",schemaPath:"#/properties/openings/items/properties/sill/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err128];
}
else {
vErrors.push(err128);
}
errors++;
}
}
}
if(data32.flipX !== undefined){
if(typeof data32.flipX !== "boolean"){
const err129 = {instancePath:instancePath+"/openings/" + i3+"/flipX",schemaPath:"#/properties/openings/items/properties/flipX/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err129];
}
else {
vErrors.push(err129);
}
errors++;
}
}
if(data32.flipY !== undefined){
if(typeof data32.flipY !== "boolean"){
const err130 = {instancePath:instancePath+"/openings/" + i3+"/flipY",schemaPath:"#/properties/openings/items/properties/flipY/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err130];
}
else {
vErrors.push(err130);
}
errors++;
}
}
if(data32.rev !== undefined){
let data43 = data32.rev;
if(!(((typeof data43 == "number") && (!(data43 % 1) && !isNaN(data43))) && (isFinite(data43)))){
const err131 = {instancePath:instancePath+"/openings/" + i3+"/rev",schemaPath:"#/properties/openings/items/properties/rev/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err131];
}
else {
vErrors.push(err131);
}
errors++;
}
if((typeof data43 == "number") && (isFinite(data43))){
if(data43 < 0 || isNaN(data43)){
const err132 = {instancePath:instancePath+"/openings/" + i3+"/rev",schemaPath:"#/properties/openings/items/properties/rev/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err132];
}
else {
vErrors.push(err132);
}
errors++;
}
}
}
}
else {
const err133 = {instancePath:instancePath+"/openings/" + i3,schemaPath:"#/properties/openings/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err133];
}
else {
vErrors.push(err133);
}
errors++;
}
}
}
else {
const err134 = {instancePath:instancePath+"/openings",schemaPath:"#/properties/openings/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err134];
}
else {
vErrors.push(err134);
}
errors++;
}
}
if(data.rooms !== undefined){
let data44 = data.rooms;
if(Array.isArray(data44)){
const len4 = data44.length;
for(let i4=0; i4<len4; i4++){
let data45 = data44[i4];
if(data45 && typeof data45 == "object" && !Array.isArray(data45)){
if(data45.id === undefined){
const err135 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err135];
}
else {
vErrors.push(err135);
}
errors++;
}
if(data45.floorId === undefined){
const err136 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "floorId"},message:"must have required property '"+"floorId"+"'"};
if(vErrors === null){
vErrors = [err136];
}
else {
vErrors.push(err136);
}
errors++;
}
if(data45.boundary === undefined){
const err137 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "boundary"},message:"must have required property '"+"boundary"+"'"};
if(vErrors === null){
vErrors = [err137];
}
else {
vErrors.push(err137);
}
errors++;
}
if(data45.name === undefined){
const err138 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err138];
}
else {
vErrors.push(err138);
}
errors++;
}
if(data45.type === undefined){
const err139 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "type"},message:"must have required property '"+"type"+"'"};
if(vErrors === null){
vErrors = [err139];
}
else {
vErrors.push(err139);
}
errors++;
}
if(data45.ceilingHeight === undefined){
const err140 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "ceilingHeight"},message:"must have required property '"+"ceilingHeight"+"'"};
if(vErrors === null){
vErrors = [err140];
}
else {
vErrors.push(err140);
}
errors++;
}
if(data45.floorMaterial === undefined){
const err141 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "floorMaterial"},message:"must have required property '"+"floorMaterial"+"'"};
if(vErrors === null){
vErrors = [err141];
}
else {
vErrors.push(err141);
}
errors++;
}
if(data45.rev === undefined){
const err142 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/required",keyword:"required",params:{missingProperty: "rev"},message:"must have required property '"+"rev"+"'"};
if(vErrors === null){
vErrors = [err142];
}
else {
vErrors.push(err142);
}
errors++;
}
for(const key5 in data45){
if(!((((((((key5 === "id") || (key5 === "floorId")) || (key5 === "boundary")) || (key5 === "name")) || (key5 === "type")) || (key5 === "ceilingHeight")) || (key5 === "floorMaterial")) || (key5 === "rev"))){
const err143 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key5},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err143];
}
else {
vErrors.push(err143);
}
errors++;
}
}
if(data45.id !== undefined){
let data46 = data45.id;
if(typeof data46 === "string"){
if(!pattern4.test(data46)){
const err144 = {instancePath:instancePath+"/rooms/" + i4+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err144];
}
else {
vErrors.push(err144);
}
errors++;
}
}
else {
const err145 = {instancePath:instancePath+"/rooms/" + i4+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err145];
}
else {
vErrors.push(err145);
}
errors++;
}
}
if(data45.floorId !== undefined){
let data47 = data45.floorId;
if(typeof data47 === "string"){
if(!pattern4.test(data47)){
const err146 = {instancePath:instancePath+"/rooms/" + i4+"/floorId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err146];
}
else {
vErrors.push(err146);
}
errors++;
}
}
else {
const err147 = {instancePath:instancePath+"/rooms/" + i4+"/floorId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err147];
}
else {
vErrors.push(err147);
}
errors++;
}
}
if(data45.boundary !== undefined){
let data48 = data45.boundary;
if(Array.isArray(data48)){
if(data48.length < 3){
const err148 = {instancePath:instancePath+"/rooms/" + i4+"/boundary",schemaPath:"#/properties/rooms/items/properties/boundary/minItems",keyword:"minItems",params:{limit: 3},message:"must NOT have fewer than 3 items"};
if(vErrors === null){
vErrors = [err148];
}
else {
vErrors.push(err148);
}
errors++;
}
const len5 = data48.length;
for(let i5=0; i5<len5; i5++){
let data49 = data48[i5];
if(typeof data49 === "string"){
if(!pattern4.test(data49)){
const err149 = {instancePath:instancePath+"/rooms/" + i4+"/boundary/" + i5,schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err149];
}
else {
vErrors.push(err149);
}
errors++;
}
}
else {
const err150 = {instancePath:instancePath+"/rooms/" + i4+"/boundary/" + i5,schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err150];
}
else {
vErrors.push(err150);
}
errors++;
}
}
}
else {
const err151 = {instancePath:instancePath+"/rooms/" + i4+"/boundary",schemaPath:"#/properties/rooms/items/properties/boundary/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err151];
}
else {
vErrors.push(err151);
}
errors++;
}
}
if(data45.name !== undefined){
let data50 = data45.name;
if(typeof data50 === "string"){
if(func2(data50) > 60){
const err152 = {instancePath:instancePath+"/rooms/" + i4+"/name",schemaPath:"#/properties/rooms/items/properties/name/maxLength",keyword:"maxLength",params:{limit: 60},message:"must NOT have more than 60 characters"};
if(vErrors === null){
vErrors = [err152];
}
else {
vErrors.push(err152);
}
errors++;
}
}
else {
const err153 = {instancePath:instancePath+"/rooms/" + i4+"/name",schemaPath:"#/properties/rooms/items/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err153];
}
else {
vErrors.push(err153);
}
errors++;
}
}
if(data45.type !== undefined){
let data51 = data45.type;
if(!(((((((((((data51 === "living") || (data51 === "bedroom")) || (data51 === "kitchen")) || (data51 === "bathroom")) || (data51 === "dining")) || (data51 === "pooja")) || (data51 === "balcony")) || (data51 === "utility")) || (data51 === "hall")) || (data51 === "study")) || (data51 === "other"))){
const err154 = {instancePath:instancePath+"/rooms/" + i4+"/type",schemaPath:"#/properties/rooms/items/properties/type/enum",keyword:"enum",params:{allowedValues: schema31.properties.rooms.items.properties.type.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err154];
}
else {
vErrors.push(err154);
}
errors++;
}
}
if(data45.ceilingHeight !== undefined){
let data52 = data45.ceilingHeight;
if(!(((typeof data52 == "number") && (!(data52 % 1) && !isNaN(data52))) && (isFinite(data52)))){
const err155 = {instancePath:instancePath+"/rooms/" + i4+"/ceilingHeight",schemaPath:"#/properties/rooms/items/properties/ceilingHeight/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err155];
}
else {
vErrors.push(err155);
}
errors++;
}
if((typeof data52 == "number") && (isFinite(data52))){
if(data52 > 6000 || isNaN(data52)){
const err156 = {instancePath:instancePath+"/rooms/" + i4+"/ceilingHeight",schemaPath:"#/properties/rooms/items/properties/ceilingHeight/maximum",keyword:"maximum",params:{comparison: "<=", limit: 6000},message:"must be <= 6000"};
if(vErrors === null){
vErrors = [err156];
}
else {
vErrors.push(err156);
}
errors++;
}
if(data52 < 1800 || isNaN(data52)){
const err157 = {instancePath:instancePath+"/rooms/" + i4+"/ceilingHeight",schemaPath:"#/properties/rooms/items/properties/ceilingHeight/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1800},message:"must be >= 1800"};
if(vErrors === null){
vErrors = [err157];
}
else {
vErrors.push(err157);
}
errors++;
}
}
}
if(data45.floorMaterial !== undefined){
let data53 = data45.floorMaterial;
if(typeof data53 === "string"){
if(!pattern4.test(data53)){
const err158 = {instancePath:instancePath+"/rooms/" + i4+"/floorMaterial",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err158];
}
else {
vErrors.push(err158);
}
errors++;
}
}
else {
const err159 = {instancePath:instancePath+"/rooms/" + i4+"/floorMaterial",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err159];
}
else {
vErrors.push(err159);
}
errors++;
}
}
if(data45.rev !== undefined){
let data54 = data45.rev;
if(!(((typeof data54 == "number") && (!(data54 % 1) && !isNaN(data54))) && (isFinite(data54)))){
const err160 = {instancePath:instancePath+"/rooms/" + i4+"/rev",schemaPath:"#/properties/rooms/items/properties/rev/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err160];
}
else {
vErrors.push(err160);
}
errors++;
}
if((typeof data54 == "number") && (isFinite(data54))){
if(data54 < 0 || isNaN(data54)){
const err161 = {instancePath:instancePath+"/rooms/" + i4+"/rev",schemaPath:"#/properties/rooms/items/properties/rev/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err161];
}
else {
vErrors.push(err161);
}
errors++;
}
}
}
}
else {
const err162 = {instancePath:instancePath+"/rooms/" + i4,schemaPath:"#/properties/rooms/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err162];
}
else {
vErrors.push(err162);
}
errors++;
}
}
}
else {
const err163 = {instancePath:instancePath+"/rooms",schemaPath:"#/properties/rooms/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err163];
}
else {
vErrors.push(err163);
}
errors++;
}
}
if(data.furniture !== undefined){
let data55 = data.furniture;
if(Array.isArray(data55)){
const len6 = data55.length;
for(let i6=0; i6<len6; i6++){
let data56 = data55[i6];
if(data56 && typeof data56 == "object" && !Array.isArray(data56)){
if(data56.id === undefined){
const err164 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err164];
}
else {
vErrors.push(err164);
}
errors++;
}
if(data56.floorId === undefined){
const err165 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "floorId"},message:"must have required property '"+"floorId"+"'"};
if(vErrors === null){
vErrors = [err165];
}
else {
vErrors.push(err165);
}
errors++;
}
if(data56.assetId === undefined){
const err166 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "assetId"},message:"must have required property '"+"assetId"+"'"};
if(vErrors === null){
vErrors = [err166];
}
else {
vErrors.push(err166);
}
errors++;
}
if(data56.assetVersion === undefined){
const err167 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "assetVersion"},message:"must have required property '"+"assetVersion"+"'"};
if(vErrors === null){
vErrors = [err167];
}
else {
vErrors.push(err167);
}
errors++;
}
if(data56.position === undefined){
const err168 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "position"},message:"must have required property '"+"position"+"'"};
if(vErrors === null){
vErrors = [err168];
}
else {
vErrors.push(err168);
}
errors++;
}
if(data56.elevation === undefined){
const err169 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "elevation"},message:"must have required property '"+"elevation"+"'"};
if(vErrors === null){
vErrors = [err169];
}
else {
vErrors.push(err169);
}
errors++;
}
if(data56.rotationDeg === undefined){
const err170 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "rotationDeg"},message:"must have required property '"+"rotationDeg"+"'"};
if(vErrors === null){
vErrors = [err170];
}
else {
vErrors.push(err170);
}
errors++;
}
if(data56.size === undefined){
const err171 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "size"},message:"must have required property '"+"size"+"'"};
if(vErrors === null){
vErrors = [err171];
}
else {
vErrors.push(err171);
}
errors++;
}
if(data56.materialOverrides === undefined){
const err172 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "materialOverrides"},message:"must have required property '"+"materialOverrides"+"'"};
if(vErrors === null){
vErrors = [err172];
}
else {
vErrors.push(err172);
}
errors++;
}
if(data56.rev === undefined){
const err173 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/required",keyword:"required",params:{missingProperty: "rev"},message:"must have required property '"+"rev"+"'"};
if(vErrors === null){
vErrors = [err173];
}
else {
vErrors.push(err173);
}
errors++;
}
for(const key6 in data56){
if(!(func1.call(schema31.properties.furniture.items.properties, key6))){
const err174 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key6},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err174];
}
else {
vErrors.push(err174);
}
errors++;
}
}
if(data56.id !== undefined){
let data57 = data56.id;
if(typeof data57 === "string"){
if(!pattern4.test(data57)){
const err175 = {instancePath:instancePath+"/furniture/" + i6+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err175];
}
else {
vErrors.push(err175);
}
errors++;
}
}
else {
const err176 = {instancePath:instancePath+"/furniture/" + i6+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err176];
}
else {
vErrors.push(err176);
}
errors++;
}
}
if(data56.floorId !== undefined){
let data58 = data56.floorId;
if(typeof data58 === "string"){
if(!pattern4.test(data58)){
const err177 = {instancePath:instancePath+"/furniture/" + i6+"/floorId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err177];
}
else {
vErrors.push(err177);
}
errors++;
}
}
else {
const err178 = {instancePath:instancePath+"/furniture/" + i6+"/floorId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err178];
}
else {
vErrors.push(err178);
}
errors++;
}
}
if(data56.assetId !== undefined){
let data59 = data56.assetId;
if(typeof data59 === "string"){
if(!pattern4.test(data59)){
const err179 = {instancePath:instancePath+"/furniture/" + i6+"/assetId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err179];
}
else {
vErrors.push(err179);
}
errors++;
}
}
else {
const err180 = {instancePath:instancePath+"/furniture/" + i6+"/assetId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err180];
}
else {
vErrors.push(err180);
}
errors++;
}
}
if(data56.assetVersion !== undefined){
let data60 = data56.assetVersion;
if(!(((typeof data60 == "number") && (!(data60 % 1) && !isNaN(data60))) && (isFinite(data60)))){
const err181 = {instancePath:instancePath+"/furniture/" + i6+"/assetVersion",schemaPath:"#/properties/furniture/items/properties/assetVersion/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err181];
}
else {
vErrors.push(err181);
}
errors++;
}
if((typeof data60 == "number") && (isFinite(data60))){
if(data60 < 1 || isNaN(data60)){
const err182 = {instancePath:instancePath+"/furniture/" + i6+"/assetVersion",schemaPath:"#/properties/furniture/items/properties/assetVersion/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err182];
}
else {
vErrors.push(err182);
}
errors++;
}
}
}
if(data56.position !== undefined){
if(!(validate21(data56.position, {instancePath:instancePath+"/furniture/" + i6+"/position",parentData:data56,parentDataProperty:"position",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
errors = vErrors.length;
}
}
if(data56.elevation !== undefined){
let data62 = data56.elevation;
if(!(((typeof data62 == "number") && (!(data62 % 1) && !isNaN(data62))) && (isFinite(data62)))){
const err183 = {instancePath:instancePath+"/furniture/" + i6+"/elevation",schemaPath:"#/properties/furniture/items/properties/elevation/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err183];
}
else {
vErrors.push(err183);
}
errors++;
}
if((typeof data62 == "number") && (isFinite(data62))){
if(data62 > 6000 || isNaN(data62)){
const err184 = {instancePath:instancePath+"/furniture/" + i6+"/elevation",schemaPath:"#/properties/furniture/items/properties/elevation/maximum",keyword:"maximum",params:{comparison: "<=", limit: 6000},message:"must be <= 6000"};
if(vErrors === null){
vErrors = [err184];
}
else {
vErrors.push(err184);
}
errors++;
}
if(data62 < 0 || isNaN(data62)){
const err185 = {instancePath:instancePath+"/furniture/" + i6+"/elevation",schemaPath:"#/properties/furniture/items/properties/elevation/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err185];
}
else {
vErrors.push(err185);
}
errors++;
}
}
}
if(data56.rotationDeg !== undefined){
let data63 = data56.rotationDeg;
if((typeof data63 == "number") && (isFinite(data63))){
if(data63 < 0 || isNaN(data63)){
const err186 = {instancePath:instancePath+"/furniture/" + i6+"/rotationDeg",schemaPath:"#/properties/furniture/items/properties/rotationDeg/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err186];
}
else {
vErrors.push(err186);
}
errors++;
}
if(data63 >= 360 || isNaN(data63)){
const err187 = {instancePath:instancePath+"/furniture/" + i6+"/rotationDeg",schemaPath:"#/properties/furniture/items/properties/rotationDeg/exclusiveMaximum",keyword:"exclusiveMaximum",params:{comparison: "<", limit: 360},message:"must be < 360"};
if(vErrors === null){
vErrors = [err187];
}
else {
vErrors.push(err187);
}
errors++;
}
}
else {
const err188 = {instancePath:instancePath+"/furniture/" + i6+"/rotationDeg",schemaPath:"#/properties/furniture/items/properties/rotationDeg/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err188];
}
else {
vErrors.push(err188);
}
errors++;
}
}
if(data56.size !== undefined){
let data64 = data56.size;
if(data64 && typeof data64 == "object" && !Array.isArray(data64)){
if(data64.w === undefined){
const err189 = {instancePath:instancePath+"/furniture/" + i6+"/size",schemaPath:"#/properties/furniture/items/properties/size/required",keyword:"required",params:{missingProperty: "w"},message:"must have required property '"+"w"+"'"};
if(vErrors === null){
vErrors = [err189];
}
else {
vErrors.push(err189);
}
errors++;
}
if(data64.d === undefined){
const err190 = {instancePath:instancePath+"/furniture/" + i6+"/size",schemaPath:"#/properties/furniture/items/properties/size/required",keyword:"required",params:{missingProperty: "d"},message:"must have required property '"+"d"+"'"};
if(vErrors === null){
vErrors = [err190];
}
else {
vErrors.push(err190);
}
errors++;
}
if(data64.h === undefined){
const err191 = {instancePath:instancePath+"/furniture/" + i6+"/size",schemaPath:"#/properties/furniture/items/properties/size/required",keyword:"required",params:{missingProperty: "h"},message:"must have required property '"+"h"+"'"};
if(vErrors === null){
vErrors = [err191];
}
else {
vErrors.push(err191);
}
errors++;
}
for(const key7 in data64){
if(!(((key7 === "w") || (key7 === "d")) || (key7 === "h"))){
const err192 = {instancePath:instancePath+"/furniture/" + i6+"/size",schemaPath:"#/properties/furniture/items/properties/size/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key7},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err192];
}
else {
vErrors.push(err192);
}
errors++;
}
}
if(data64.w !== undefined){
let data65 = data64.w;
if(!(((typeof data65 == "number") && (!(data65 % 1) && !isNaN(data65))) && (isFinite(data65)))){
const err193 = {instancePath:instancePath+"/furniture/" + i6+"/size/w",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err193];
}
else {
vErrors.push(err193);
}
errors++;
}
if((typeof data65 == "number") && (isFinite(data65))){
if(data65 > 1000000 || isNaN(data65)){
const err194 = {instancePath:instancePath+"/furniture/" + i6+"/size/w",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err194];
}
else {
vErrors.push(err194);
}
errors++;
}
if(data65 < 1 || isNaN(data65)){
const err195 = {instancePath:instancePath+"/furniture/" + i6+"/size/w",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err195];
}
else {
vErrors.push(err195);
}
errors++;
}
}
}
if(data64.d !== undefined){
let data66 = data64.d;
if(!(((typeof data66 == "number") && (!(data66 % 1) && !isNaN(data66))) && (isFinite(data66)))){
const err196 = {instancePath:instancePath+"/furniture/" + i6+"/size/d",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err196];
}
else {
vErrors.push(err196);
}
errors++;
}
if((typeof data66 == "number") && (isFinite(data66))){
if(data66 > 1000000 || isNaN(data66)){
const err197 = {instancePath:instancePath+"/furniture/" + i6+"/size/d",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err197];
}
else {
vErrors.push(err197);
}
errors++;
}
if(data66 < 1 || isNaN(data66)){
const err198 = {instancePath:instancePath+"/furniture/" + i6+"/size/d",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err198];
}
else {
vErrors.push(err198);
}
errors++;
}
}
}
if(data64.h !== undefined){
let data67 = data64.h;
if(!(((typeof data67 == "number") && (!(data67 % 1) && !isNaN(data67))) && (isFinite(data67)))){
const err199 = {instancePath:instancePath+"/furniture/" + i6+"/size/h",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err199];
}
else {
vErrors.push(err199);
}
errors++;
}
if((typeof data67 == "number") && (isFinite(data67))){
if(data67 > 1000000 || isNaN(data67)){
const err200 = {instancePath:instancePath+"/furniture/" + i6+"/size/h",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err200];
}
else {
vErrors.push(err200);
}
errors++;
}
if(data67 < 1 || isNaN(data67)){
const err201 = {instancePath:instancePath+"/furniture/" + i6+"/size/h",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err201];
}
else {
vErrors.push(err201);
}
errors++;
}
}
}
}
else {
const err202 = {instancePath:instancePath+"/furniture/" + i6+"/size",schemaPath:"#/properties/furniture/items/properties/size/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err202];
}
else {
vErrors.push(err202);
}
errors++;
}
}
if(data56.materialOverrides !== undefined){
let data68 = data56.materialOverrides;
if(data68 && typeof data68 == "object" && !Array.isArray(data68)){
for(const key8 in data68){
let data69 = data68[key8];
if(typeof data69 === "string"){
if(!pattern4.test(data69)){
const err203 = {instancePath:instancePath+"/furniture/" + i6+"/materialOverrides/" + key8.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err203];
}
else {
vErrors.push(err203);
}
errors++;
}
}
else {
const err204 = {instancePath:instancePath+"/furniture/" + i6+"/materialOverrides/" + key8.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err204];
}
else {
vErrors.push(err204);
}
errors++;
}
}
}
else {
const err205 = {instancePath:instancePath+"/furniture/" + i6+"/materialOverrides",schemaPath:"#/properties/furniture/items/properties/materialOverrides/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err205];
}
else {
vErrors.push(err205);
}
errors++;
}
}
if(data56.groupId !== undefined){
let data70 = data56.groupId;
if(typeof data70 === "string"){
if(!pattern4.test(data70)){
const err206 = {instancePath:instancePath+"/furniture/" + i6+"/groupId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err206];
}
else {
vErrors.push(err206);
}
errors++;
}
}
else {
const err207 = {instancePath:instancePath+"/furniture/" + i6+"/groupId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err207];
}
else {
vErrors.push(err207);
}
errors++;
}
}
if(data56.rev !== undefined){
let data71 = data56.rev;
if(!(((typeof data71 == "number") && (!(data71 % 1) && !isNaN(data71))) && (isFinite(data71)))){
const err208 = {instancePath:instancePath+"/furniture/" + i6+"/rev",schemaPath:"#/properties/furniture/items/properties/rev/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err208];
}
else {
vErrors.push(err208);
}
errors++;
}
if((typeof data71 == "number") && (isFinite(data71))){
if(data71 < 0 || isNaN(data71)){
const err209 = {instancePath:instancePath+"/furniture/" + i6+"/rev",schemaPath:"#/properties/furniture/items/properties/rev/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err209];
}
else {
vErrors.push(err209);
}
errors++;
}
}
}
}
else {
const err210 = {instancePath:instancePath+"/furniture/" + i6,schemaPath:"#/properties/furniture/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err210];
}
else {
vErrors.push(err210);
}
errors++;
}
}
}
else {
const err211 = {instancePath:instancePath+"/furniture",schemaPath:"#/properties/furniture/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err211];
}
else {
vErrors.push(err211);
}
errors++;
}
}
if(data.materials !== undefined){
let data72 = data.materials;
if(Array.isArray(data72)){
const len7 = data72.length;
for(let i7=0; i7<len7; i7++){
let data73 = data72[i7];
if(data73 && typeof data73 == "object" && !Array.isArray(data73)){
if(data73.id === undefined){
const err212 = {instancePath:instancePath+"/materials/" + i7,schemaPath:"#/properties/materials/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err212];
}
else {
vErrors.push(err212);
}
errors++;
}
if(data73.name === undefined){
const err213 = {instancePath:instancePath+"/materials/" + i7,schemaPath:"#/properties/materials/items/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err213];
}
else {
vErrors.push(err213);
}
errors++;
}
if(data73.baseColor === undefined){
const err214 = {instancePath:instancePath+"/materials/" + i7,schemaPath:"#/properties/materials/items/required",keyword:"required",params:{missingProperty: "baseColor"},message:"must have required property '"+"baseColor"+"'"};
if(vErrors === null){
vErrors = [err214];
}
else {
vErrors.push(err214);
}
errors++;
}
if(data73.roughness === undefined){
const err215 = {instancePath:instancePath+"/materials/" + i7,schemaPath:"#/properties/materials/items/required",keyword:"required",params:{missingProperty: "roughness"},message:"must have required property '"+"roughness"+"'"};
if(vErrors === null){
vErrors = [err215];
}
else {
vErrors.push(err215);
}
errors++;
}
if(data73.metalness === undefined){
const err216 = {instancePath:instancePath+"/materials/" + i7,schemaPath:"#/properties/materials/items/required",keyword:"required",params:{missingProperty: "metalness"},message:"must have required property '"+"metalness"+"'"};
if(vErrors === null){
vErrors = [err216];
}
else {
vErrors.push(err216);
}
errors++;
}
for(const key9 in data73){
if(!(((((((key9 === "id") || (key9 === "name")) || (key9 === "baseColor")) || (key9 === "textureAssetId")) || (key9 === "uvScaleMm")) || (key9 === "roughness")) || (key9 === "metalness"))){
const err217 = {instancePath:instancePath+"/materials/" + i7,schemaPath:"#/properties/materials/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key9},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err217];
}
else {
vErrors.push(err217);
}
errors++;
}
}
if(data73.id !== undefined){
let data74 = data73.id;
if(typeof data74 === "string"){
if(!pattern4.test(data74)){
const err218 = {instancePath:instancePath+"/materials/" + i7+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err218];
}
else {
vErrors.push(err218);
}
errors++;
}
}
else {
const err219 = {instancePath:instancePath+"/materials/" + i7+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err219];
}
else {
vErrors.push(err219);
}
errors++;
}
}
if(data73.name !== undefined){
if(typeof data73.name !== "string"){
const err220 = {instancePath:instancePath+"/materials/" + i7+"/name",schemaPath:"#/properties/materials/items/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err220];
}
else {
vErrors.push(err220);
}
errors++;
}
}
if(data73.baseColor !== undefined){
let data76 = data73.baseColor;
if(typeof data76 === "string"){
if(!pattern27.test(data76)){
const err221 = {instancePath:instancePath+"/materials/" + i7+"/baseColor",schemaPath:"#/properties/materials/items/properties/baseColor/pattern",keyword:"pattern",params:{pattern: "^#[0-9a-fA-F]{6}$"},message:"must match pattern \""+"^#[0-9a-fA-F]{6}$"+"\""};
if(vErrors === null){
vErrors = [err221];
}
else {
vErrors.push(err221);
}
errors++;
}
}
else {
const err222 = {instancePath:instancePath+"/materials/" + i7+"/baseColor",schemaPath:"#/properties/materials/items/properties/baseColor/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err222];
}
else {
vErrors.push(err222);
}
errors++;
}
}
if(data73.textureAssetId !== undefined){
let data77 = data73.textureAssetId;
if(typeof data77 === "string"){
if(!pattern4.test(data77)){
const err223 = {instancePath:instancePath+"/materials/" + i7+"/textureAssetId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err223];
}
else {
vErrors.push(err223);
}
errors++;
}
}
else {
const err224 = {instancePath:instancePath+"/materials/" + i7+"/textureAssetId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err224];
}
else {
vErrors.push(err224);
}
errors++;
}
}
if(data73.uvScaleMm !== undefined){
let data78 = data73.uvScaleMm;
if(!(((typeof data78 == "number") && (!(data78 % 1) && !isNaN(data78))) && (isFinite(data78)))){
const err225 = {instancePath:instancePath+"/materials/" + i7+"/uvScaleMm",schemaPath:"#/$defs/posMm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err225];
}
else {
vErrors.push(err225);
}
errors++;
}
if((typeof data78 == "number") && (isFinite(data78))){
if(data78 > 1000000 || isNaN(data78)){
const err226 = {instancePath:instancePath+"/materials/" + i7+"/uvScaleMm",schemaPath:"#/$defs/posMm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err226];
}
else {
vErrors.push(err226);
}
errors++;
}
if(data78 < 1 || isNaN(data78)){
const err227 = {instancePath:instancePath+"/materials/" + i7+"/uvScaleMm",schemaPath:"#/$defs/posMm/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"};
if(vErrors === null){
vErrors = [err227];
}
else {
vErrors.push(err227);
}
errors++;
}
}
}
if(data73.roughness !== undefined){
let data79 = data73.roughness;
if((typeof data79 == "number") && (isFinite(data79))){
if(data79 > 1 || isNaN(data79)){
const err228 = {instancePath:instancePath+"/materials/" + i7+"/roughness",schemaPath:"#/properties/materials/items/properties/roughness/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err228];
}
else {
vErrors.push(err228);
}
errors++;
}
if(data79 < 0 || isNaN(data79)){
const err229 = {instancePath:instancePath+"/materials/" + i7+"/roughness",schemaPath:"#/properties/materials/items/properties/roughness/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err229];
}
else {
vErrors.push(err229);
}
errors++;
}
}
else {
const err230 = {instancePath:instancePath+"/materials/" + i7+"/roughness",schemaPath:"#/properties/materials/items/properties/roughness/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err230];
}
else {
vErrors.push(err230);
}
errors++;
}
}
if(data73.metalness !== undefined){
let data80 = data73.metalness;
if((typeof data80 == "number") && (isFinite(data80))){
if(data80 > 1 || isNaN(data80)){
const err231 = {instancePath:instancePath+"/materials/" + i7+"/metalness",schemaPath:"#/properties/materials/items/properties/metalness/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"};
if(vErrors === null){
vErrors = [err231];
}
else {
vErrors.push(err231);
}
errors++;
}
if(data80 < 0 || isNaN(data80)){
const err232 = {instancePath:instancePath+"/materials/" + i7+"/metalness",schemaPath:"#/properties/materials/items/properties/metalness/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err232];
}
else {
vErrors.push(err232);
}
errors++;
}
}
else {
const err233 = {instancePath:instancePath+"/materials/" + i7+"/metalness",schemaPath:"#/properties/materials/items/properties/metalness/type",keyword:"type",params:{type: "number"},message:"must be number"};
if(vErrors === null){
vErrors = [err233];
}
else {
vErrors.push(err233);
}
errors++;
}
}
}
else {
const err234 = {instancePath:instancePath+"/materials/" + i7,schemaPath:"#/properties/materials/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err234];
}
else {
vErrors.push(err234);
}
errors++;
}
}
}
else {
const err235 = {instancePath:instancePath+"/materials",schemaPath:"#/properties/materials/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err235];
}
else {
vErrors.push(err235);
}
errors++;
}
}
if(data.cameras !== undefined){
let data81 = data.cameras;
if(Array.isArray(data81)){
const len8 = data81.length;
for(let i8=0; i8<len8; i8++){
let data82 = data81[i8];
if(data82 && typeof data82 == "object" && !Array.isArray(data82)){
if(data82.id === undefined){
const err236 = {instancePath:instancePath+"/cameras/" + i8,schemaPath:"#/properties/cameras/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err236];
}
else {
vErrors.push(err236);
}
errors++;
}
if(data82.name === undefined){
const err237 = {instancePath:instancePath+"/cameras/" + i8,schemaPath:"#/properties/cameras/items/required",keyword:"required",params:{missingProperty: "name"},message:"must have required property '"+"name"+"'"};
if(vErrors === null){
vErrors = [err237];
}
else {
vErrors.push(err237);
}
errors++;
}
if(data82.mode === undefined){
const err238 = {instancePath:instancePath+"/cameras/" + i8,schemaPath:"#/properties/cameras/items/required",keyword:"required",params:{missingProperty: "mode"},message:"must have required property '"+"mode"+"'"};
if(vErrors === null){
vErrors = [err238];
}
else {
vErrors.push(err238);
}
errors++;
}
if(data82.position === undefined){
const err239 = {instancePath:instancePath+"/cameras/" + i8,schemaPath:"#/properties/cameras/items/required",keyword:"required",params:{missingProperty: "position"},message:"must have required property '"+"position"+"'"};
if(vErrors === null){
vErrors = [err239];
}
else {
vErrors.push(err239);
}
errors++;
}
if(data82.target === undefined){
const err240 = {instancePath:instancePath+"/cameras/" + i8,schemaPath:"#/properties/cameras/items/required",keyword:"required",params:{missingProperty: "target"},message:"must have required property '"+"target"+"'"};
if(vErrors === null){
vErrors = [err240];
}
else {
vErrors.push(err240);
}
errors++;
}
for(const key10 in data82){
if(!(((((key10 === "id") || (key10 === "name")) || (key10 === "mode")) || (key10 === "position")) || (key10 === "target"))){
const err241 = {instancePath:instancePath+"/cameras/" + i8,schemaPath:"#/properties/cameras/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key10},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err241];
}
else {
vErrors.push(err241);
}
errors++;
}
}
if(data82.id !== undefined){
let data83 = data82.id;
if(typeof data83 === "string"){
if(!pattern4.test(data83)){
const err242 = {instancePath:instancePath+"/cameras/" + i8+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err242];
}
else {
vErrors.push(err242);
}
errors++;
}
}
else {
const err243 = {instancePath:instancePath+"/cameras/" + i8+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err243];
}
else {
vErrors.push(err243);
}
errors++;
}
}
if(data82.name !== undefined){
if(typeof data82.name !== "string"){
const err244 = {instancePath:instancePath+"/cameras/" + i8+"/name",schemaPath:"#/properties/cameras/items/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err244];
}
else {
vErrors.push(err244);
}
errors++;
}
}
if(data82.mode !== undefined){
let data85 = data82.mode;
if(!((data85 === "orbit") || (data85 === "walk"))){
const err245 = {instancePath:instancePath+"/cameras/" + i8+"/mode",schemaPath:"#/properties/cameras/items/properties/mode/enum",keyword:"enum",params:{allowedValues: schema31.properties.cameras.items.properties.mode.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err245];
}
else {
vErrors.push(err245);
}
errors++;
}
}
if(data82.position !== undefined){
let data86 = data82.position;
if(Array.isArray(data86)){
if(data86.length > 3){
const err246 = {instancePath:instancePath+"/cameras/" + i8+"/position",schemaPath:"#/properties/cameras/items/properties/position/maxItems",keyword:"maxItems",params:{limit: 3},message:"must NOT have more than 3 items"};
if(vErrors === null){
vErrors = [err246];
}
else {
vErrors.push(err246);
}
errors++;
}
if(data86.length < 3){
const err247 = {instancePath:instancePath+"/cameras/" + i8+"/position",schemaPath:"#/properties/cameras/items/properties/position/minItems",keyword:"minItems",params:{limit: 3},message:"must NOT have fewer than 3 items"};
if(vErrors === null){
vErrors = [err247];
}
else {
vErrors.push(err247);
}
errors++;
}
const len9 = data86.length;
for(let i9=0; i9<len9; i9++){
let data87 = data86[i9];
if(!(((typeof data87 == "number") && (!(data87 % 1) && !isNaN(data87))) && (isFinite(data87)))){
const err248 = {instancePath:instancePath+"/cameras/" + i8+"/position/" + i9,schemaPath:"#/$defs/mm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err248];
}
else {
vErrors.push(err248);
}
errors++;
}
if((typeof data87 == "number") && (isFinite(data87))){
if(data87 > 1000000 || isNaN(data87)){
const err249 = {instancePath:instancePath+"/cameras/" + i8+"/position/" + i9,schemaPath:"#/$defs/mm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err249];
}
else {
vErrors.push(err249);
}
errors++;
}
if(data87 < -1000000 || isNaN(data87)){
const err250 = {instancePath:instancePath+"/cameras/" + i8+"/position/" + i9,schemaPath:"#/$defs/mm/minimum",keyword:"minimum",params:{comparison: ">=", limit: -1000000},message:"must be >= -1000000"};
if(vErrors === null){
vErrors = [err250];
}
else {
vErrors.push(err250);
}
errors++;
}
}
}
}
else {
const err251 = {instancePath:instancePath+"/cameras/" + i8+"/position",schemaPath:"#/properties/cameras/items/properties/position/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err251];
}
else {
vErrors.push(err251);
}
errors++;
}
}
if(data82.target !== undefined){
let data88 = data82.target;
if(Array.isArray(data88)){
if(data88.length > 3){
const err252 = {instancePath:instancePath+"/cameras/" + i8+"/target",schemaPath:"#/properties/cameras/items/properties/target/maxItems",keyword:"maxItems",params:{limit: 3},message:"must NOT have more than 3 items"};
if(vErrors === null){
vErrors = [err252];
}
else {
vErrors.push(err252);
}
errors++;
}
if(data88.length < 3){
const err253 = {instancePath:instancePath+"/cameras/" + i8+"/target",schemaPath:"#/properties/cameras/items/properties/target/minItems",keyword:"minItems",params:{limit: 3},message:"must NOT have fewer than 3 items"};
if(vErrors === null){
vErrors = [err253];
}
else {
vErrors.push(err253);
}
errors++;
}
const len10 = data88.length;
for(let i10=0; i10<len10; i10++){
let data89 = data88[i10];
if(!(((typeof data89 == "number") && (!(data89 % 1) && !isNaN(data89))) && (isFinite(data89)))){
const err254 = {instancePath:instancePath+"/cameras/" + i8+"/target/" + i10,schemaPath:"#/$defs/mm/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err254];
}
else {
vErrors.push(err254);
}
errors++;
}
if((typeof data89 == "number") && (isFinite(data89))){
if(data89 > 1000000 || isNaN(data89)){
const err255 = {instancePath:instancePath+"/cameras/" + i8+"/target/" + i10,schemaPath:"#/$defs/mm/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000000},message:"must be <= 1000000"};
if(vErrors === null){
vErrors = [err255];
}
else {
vErrors.push(err255);
}
errors++;
}
if(data89 < -1000000 || isNaN(data89)){
const err256 = {instancePath:instancePath+"/cameras/" + i8+"/target/" + i10,schemaPath:"#/$defs/mm/minimum",keyword:"minimum",params:{comparison: ">=", limit: -1000000},message:"must be >= -1000000"};
if(vErrors === null){
vErrors = [err256];
}
else {
vErrors.push(err256);
}
errors++;
}
}
}
}
else {
const err257 = {instancePath:instancePath+"/cameras/" + i8+"/target",schemaPath:"#/properties/cameras/items/properties/target/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err257];
}
else {
vErrors.push(err257);
}
errors++;
}
}
}
else {
const err258 = {instancePath:instancePath+"/cameras/" + i8,schemaPath:"#/properties/cameras/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err258];
}
else {
vErrors.push(err258);
}
errors++;
}
}
}
else {
const err259 = {instancePath:instancePath+"/cameras",schemaPath:"#/properties/cameras/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err259];
}
else {
vErrors.push(err259);
}
errors++;
}
}
if(data.lights !== undefined){
let data90 = data.lights;
if(Array.isArray(data90)){
const len11 = data90.length;
for(let i11=0; i11<len11; i11++){
let data91 = data90[i11];
if(data91 && typeof data91 == "object" && !Array.isArray(data91)){
if(data91.id === undefined){
const err260 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err260];
}
else {
vErrors.push(err260);
}
errors++;
}
if(data91.floorId === undefined){
const err261 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "floorId"},message:"must have required property '"+"floorId"+"'"};
if(vErrors === null){
vErrors = [err261];
}
else {
vErrors.push(err261);
}
errors++;
}
if(data91.kind === undefined){
const err262 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err262];
}
else {
vErrors.push(err262);
}
errors++;
}
if(data91.position === undefined){
const err263 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "position"},message:"must have required property '"+"position"+"'"};
if(vErrors === null){
vErrors = [err263];
}
else {
vErrors.push(err263);
}
errors++;
}
if(data91.height === undefined){
const err264 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "height"},message:"must have required property '"+"height"+"'"};
if(vErrors === null){
vErrors = [err264];
}
else {
vErrors.push(err264);
}
errors++;
}
if(data91.lumens === undefined){
const err265 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "lumens"},message:"must have required property '"+"lumens"+"'"};
if(vErrors === null){
vErrors = [err265];
}
else {
vErrors.push(err265);
}
errors++;
}
if(data91.colorTempK === undefined){
const err266 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "colorTempK"},message:"must have required property '"+"colorTempK"+"'"};
if(vErrors === null){
vErrors = [err266];
}
else {
vErrors.push(err266);
}
errors++;
}
if(data91.castsShadow === undefined){
const err267 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "castsShadow"},message:"must have required property '"+"castsShadow"+"'"};
if(vErrors === null){
vErrors = [err267];
}
else {
vErrors.push(err267);
}
errors++;
}
if(data91.rev === undefined){
const err268 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/required",keyword:"required",params:{missingProperty: "rev"},message:"must have required property '"+"rev"+"'"};
if(vErrors === null){
vErrors = [err268];
}
else {
vErrors.push(err268);
}
errors++;
}
for(const key11 in data91){
if(!(func1.call(schema31.properties.lights.items.properties, key11))){
const err269 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key11},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err269];
}
else {
vErrors.push(err269);
}
errors++;
}
}
if(data91.id !== undefined){
let data92 = data91.id;
if(typeof data92 === "string"){
if(!pattern4.test(data92)){
const err270 = {instancePath:instancePath+"/lights/" + i11+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err270];
}
else {
vErrors.push(err270);
}
errors++;
}
}
else {
const err271 = {instancePath:instancePath+"/lights/" + i11+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err271];
}
else {
vErrors.push(err271);
}
errors++;
}
}
if(data91.floorId !== undefined){
let data93 = data91.floorId;
if(typeof data93 === "string"){
if(!pattern4.test(data93)){
const err272 = {instancePath:instancePath+"/lights/" + i11+"/floorId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err272];
}
else {
vErrors.push(err272);
}
errors++;
}
}
else {
const err273 = {instancePath:instancePath+"/lights/" + i11+"/floorId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err273];
}
else {
vErrors.push(err273);
}
errors++;
}
}
if(data91.kind !== undefined){
let data94 = data91.kind;
if(!((((data94 === "point") || (data94 === "spot")) || (data94 === "strip")) || (data94 === "ambient"))){
const err274 = {instancePath:instancePath+"/lights/" + i11+"/kind",schemaPath:"#/properties/lights/items/properties/kind/enum",keyword:"enum",params:{allowedValues: schema31.properties.lights.items.properties.kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err274];
}
else {
vErrors.push(err274);
}
errors++;
}
}
if(data91.position !== undefined){
if(!(validate21(data91.position, {instancePath:instancePath+"/lights/" + i11+"/position",parentData:data91,parentDataProperty:"position",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
errors = vErrors.length;
}
}
if(data91.height !== undefined){
let data96 = data91.height;
if(!(((typeof data96 == "number") && (!(data96 % 1) && !isNaN(data96))) && (isFinite(data96)))){
const err275 = {instancePath:instancePath+"/lights/" + i11+"/height",schemaPath:"#/properties/lights/items/properties/height/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err275];
}
else {
vErrors.push(err275);
}
errors++;
}
if((typeof data96 == "number") && (isFinite(data96))){
if(data96 > 6000 || isNaN(data96)){
const err276 = {instancePath:instancePath+"/lights/" + i11+"/height",schemaPath:"#/properties/lights/items/properties/height/maximum",keyword:"maximum",params:{comparison: "<=", limit: 6000},message:"must be <= 6000"};
if(vErrors === null){
vErrors = [err276];
}
else {
vErrors.push(err276);
}
errors++;
}
if(data96 < 0 || isNaN(data96)){
const err277 = {instancePath:instancePath+"/lights/" + i11+"/height",schemaPath:"#/properties/lights/items/properties/height/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err277];
}
else {
vErrors.push(err277);
}
errors++;
}
}
}
if(data91.lumens !== undefined){
let data97 = data91.lumens;
if(!(((typeof data97 == "number") && (!(data97 % 1) && !isNaN(data97))) && (isFinite(data97)))){
const err278 = {instancePath:instancePath+"/lights/" + i11+"/lumens",schemaPath:"#/properties/lights/items/properties/lumens/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err278];
}
else {
vErrors.push(err278);
}
errors++;
}
if((typeof data97 == "number") && (isFinite(data97))){
if(data97 > 20000 || isNaN(data97)){
const err279 = {instancePath:instancePath+"/lights/" + i11+"/lumens",schemaPath:"#/properties/lights/items/properties/lumens/maximum",keyword:"maximum",params:{comparison: "<=", limit: 20000},message:"must be <= 20000"};
if(vErrors === null){
vErrors = [err279];
}
else {
vErrors.push(err279);
}
errors++;
}
if(data97 < 0 || isNaN(data97)){
const err280 = {instancePath:instancePath+"/lights/" + i11+"/lumens",schemaPath:"#/properties/lights/items/properties/lumens/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err280];
}
else {
vErrors.push(err280);
}
errors++;
}
}
}
if(data91.colorTempK !== undefined){
let data98 = data91.colorTempK;
if(!(((typeof data98 == "number") && (!(data98 % 1) && !isNaN(data98))) && (isFinite(data98)))){
const err281 = {instancePath:instancePath+"/lights/" + i11+"/colorTempK",schemaPath:"#/properties/lights/items/properties/colorTempK/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err281];
}
else {
vErrors.push(err281);
}
errors++;
}
if((typeof data98 == "number") && (isFinite(data98))){
if(data98 > 8000 || isNaN(data98)){
const err282 = {instancePath:instancePath+"/lights/" + i11+"/colorTempK",schemaPath:"#/properties/lights/items/properties/colorTempK/maximum",keyword:"maximum",params:{comparison: "<=", limit: 8000},message:"must be <= 8000"};
if(vErrors === null){
vErrors = [err282];
}
else {
vErrors.push(err282);
}
errors++;
}
if(data98 < 1800 || isNaN(data98)){
const err283 = {instancePath:instancePath+"/lights/" + i11+"/colorTempK",schemaPath:"#/properties/lights/items/properties/colorTempK/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1800},message:"must be >= 1800"};
if(vErrors === null){
vErrors = [err283];
}
else {
vErrors.push(err283);
}
errors++;
}
}
}
if(data91.castsShadow !== undefined){
if(typeof data91.castsShadow !== "boolean"){
const err284 = {instancePath:instancePath+"/lights/" + i11+"/castsShadow",schemaPath:"#/properties/lights/items/properties/castsShadow/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"};
if(vErrors === null){
vErrors = [err284];
}
else {
vErrors.push(err284);
}
errors++;
}
}
if(data91.fixtureAssetId !== undefined){
let data100 = data91.fixtureAssetId;
if(typeof data100 === "string"){
if(!pattern4.test(data100)){
const err285 = {instancePath:instancePath+"/lights/" + i11+"/fixtureAssetId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err285];
}
else {
vErrors.push(err285);
}
errors++;
}
}
else {
const err286 = {instancePath:instancePath+"/lights/" + i11+"/fixtureAssetId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err286];
}
else {
vErrors.push(err286);
}
errors++;
}
}
if(data91.rev !== undefined){
let data101 = data91.rev;
if(!(((typeof data101 == "number") && (!(data101 % 1) && !isNaN(data101))) && (isFinite(data101)))){
const err287 = {instancePath:instancePath+"/lights/" + i11+"/rev",schemaPath:"#/properties/lights/items/properties/rev/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err287];
}
else {
vErrors.push(err287);
}
errors++;
}
if((typeof data101 == "number") && (isFinite(data101))){
if(data101 < 0 || isNaN(data101)){
const err288 = {instancePath:instancePath+"/lights/" + i11+"/rev",schemaPath:"#/properties/lights/items/properties/rev/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err288];
}
else {
vErrors.push(err288);
}
errors++;
}
}
}
}
else {
const err289 = {instancePath:instancePath+"/lights/" + i11,schemaPath:"#/properties/lights/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err289];
}
else {
vErrors.push(err289);
}
errors++;
}
}
}
else {
const err290 = {instancePath:instancePath+"/lights",schemaPath:"#/properties/lights/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err290];
}
else {
vErrors.push(err290);
}
errors++;
}
}
if(data.stairs !== undefined){
let data102 = data.stairs;
if(Array.isArray(data102)){
if(data102.length > 50){
const err291 = {instancePath:instancePath+"/stairs",schemaPath:"#/properties/stairs/maxItems",keyword:"maxItems",params:{limit: 50},message:"must NOT have more than 50 items"};
if(vErrors === null){
vErrors = [err291];
}
else {
vErrors.push(err291);
}
errors++;
}
const len12 = data102.length;
for(let i12=0; i12<len12; i12++){
let data103 = data102[i12];
if(data103 && typeof data103 == "object" && !Array.isArray(data103)){
if(data103.id === undefined){
const err292 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err292];
}
else {
vErrors.push(err292);
}
errors++;
}
if(data103.floorId === undefined){
const err293 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "floorId"},message:"must have required property '"+"floorId"+"'"};
if(vErrors === null){
vErrors = [err293];
}
else {
vErrors.push(err293);
}
errors++;
}
if(data103.position === undefined){
const err294 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "position"},message:"must have required property '"+"position"+"'"};
if(vErrors === null){
vErrors = [err294];
}
else {
vErrors.push(err294);
}
errors++;
}
if(data103.rotationDeg === undefined){
const err295 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "rotationDeg"},message:"must have required property '"+"rotationDeg"+"'"};
if(vErrors === null){
vErrors = [err295];
}
else {
vErrors.push(err295);
}
errors++;
}
if(data103.width === undefined){
const err296 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "width"},message:"must have required property '"+"width"+"'"};
if(vErrors === null){
vErrors = [err296];
}
else {
vErrors.push(err296);
}
errors++;
}
if(data103.length === undefined){
const err297 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "length"},message:"must have required property '"+"length"+"'"};
if(vErrors === null){
vErrors = [err297];
}
else {
vErrors.push(err297);
}
errors++;
}
if(data103.height === undefined){
const err298 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "height"},message:"must have required property '"+"height"+"'"};
if(vErrors === null){
vErrors = [err298];
}
else {
vErrors.push(err298);
}
errors++;
}
if(data103.steps === undefined){
const err299 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "steps"},message:"must have required property '"+"steps"+"'"};
if(vErrors === null){
vErrors = [err299];
}
else {
vErrors.push(err299);
}
errors++;
}
if(data103.material === undefined){
const err300 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "material"},message:"must have required property '"+"material"+"'"};
if(vErrors === null){
vErrors = [err300];
}
else {
vErrors.push(err300);
}
errors++;
}
if(data103.rev === undefined){
const err301 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/required",keyword:"required",params:{missingProperty: "rev"},message:"must have required property '"+"rev"+"'"};
if(vErrors === null){
vErrors = [err301];
}
else {
vErrors.push(err301);
}
errors++;
}
for(const key12 in data103){
if(!(func1.call(schema31.properties.stairs.items.properties, key12))){
const err302 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key12},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err302];
}
else {
vErrors.push(err302);
}
errors++;
}
}
if(data103.id !== undefined){
let data104 = data103.id;
if(typeof data104 === "string"){
if(!pattern4.test(data104)){
const err303 = {instancePath:instancePath+"/stairs/" + i12+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err303];
}
else {
vErrors.push(err303);
}
errors++;
}
}
else {
const err304 = {instancePath:instancePath+"/stairs/" + i12+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err304];
}
else {
vErrors.push(err304);
}
errors++;
}
}
if(data103.floorId !== undefined){
let data105 = data103.floorId;
if(typeof data105 === "string"){
if(!pattern4.test(data105)){
const err305 = {instancePath:instancePath+"/stairs/" + i12+"/floorId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err305];
}
else {
vErrors.push(err305);
}
errors++;
}
}
else {
const err306 = {instancePath:instancePath+"/stairs/" + i12+"/floorId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err306];
}
else {
vErrors.push(err306);
}
errors++;
}
}
if(data103.position !== undefined){
if(!(validate21(data103.position, {instancePath:instancePath+"/stairs/" + i12+"/position",parentData:data103,parentDataProperty:"position",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
errors = vErrors.length;
}
}
if(data103.rotationDeg !== undefined){
let data107 = data103.rotationDeg;
if(!((((data107 === 0) || (data107 === 90)) || (data107 === 180)) || (data107 === 270))){
const err307 = {instancePath:instancePath+"/stairs/" + i12+"/rotationDeg",schemaPath:"#/properties/stairs/items/properties/rotationDeg/enum",keyword:"enum",params:{allowedValues: schema31.properties.stairs.items.properties.rotationDeg.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err307];
}
else {
vErrors.push(err307);
}
errors++;
}
}
if(data103.width !== undefined){
let data108 = data103.width;
if(!(((typeof data108 == "number") && (!(data108 % 1) && !isNaN(data108))) && (isFinite(data108)))){
const err308 = {instancePath:instancePath+"/stairs/" + i12+"/width",schemaPath:"#/properties/stairs/items/properties/width/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err308];
}
else {
vErrors.push(err308);
}
errors++;
}
if((typeof data108 == "number") && (isFinite(data108))){
if(data108 > 2000 || isNaN(data108)){
const err309 = {instancePath:instancePath+"/stairs/" + i12+"/width",schemaPath:"#/properties/stairs/items/properties/width/maximum",keyword:"maximum",params:{comparison: "<=", limit: 2000},message:"must be <= 2000"};
if(vErrors === null){
vErrors = [err309];
}
else {
vErrors.push(err309);
}
errors++;
}
if(data108 < 600 || isNaN(data108)){
const err310 = {instancePath:instancePath+"/stairs/" + i12+"/width",schemaPath:"#/properties/stairs/items/properties/width/minimum",keyword:"minimum",params:{comparison: ">=", limit: 600},message:"must be >= 600"};
if(vErrors === null){
vErrors = [err310];
}
else {
vErrors.push(err310);
}
errors++;
}
}
}
if(data103.length !== undefined){
let data109 = data103.length;
if(!(((typeof data109 == "number") && (!(data109 % 1) && !isNaN(data109))) && (isFinite(data109)))){
const err311 = {instancePath:instancePath+"/stairs/" + i12+"/length",schemaPath:"#/properties/stairs/items/properties/length/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err311];
}
else {
vErrors.push(err311);
}
errors++;
}
if((typeof data109 == "number") && (isFinite(data109))){
if(data109 > 8000 || isNaN(data109)){
const err312 = {instancePath:instancePath+"/stairs/" + i12+"/length",schemaPath:"#/properties/stairs/items/properties/length/maximum",keyword:"maximum",params:{comparison: "<=", limit: 8000},message:"must be <= 8000"};
if(vErrors === null){
vErrors = [err312];
}
else {
vErrors.push(err312);
}
errors++;
}
if(data109 < 1000 || isNaN(data109)){
const err313 = {instancePath:instancePath+"/stairs/" + i12+"/length",schemaPath:"#/properties/stairs/items/properties/length/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1000},message:"must be >= 1000"};
if(vErrors === null){
vErrors = [err313];
}
else {
vErrors.push(err313);
}
errors++;
}
}
}
if(data103.height !== undefined){
let data110 = data103.height;
if(!(((typeof data110 == "number") && (!(data110 % 1) && !isNaN(data110))) && (isFinite(data110)))){
const err314 = {instancePath:instancePath+"/stairs/" + i12+"/height",schemaPath:"#/properties/stairs/items/properties/height/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err314];
}
else {
vErrors.push(err314);
}
errors++;
}
if((typeof data110 == "number") && (isFinite(data110))){
if(data110 > 6000 || isNaN(data110)){
const err315 = {instancePath:instancePath+"/stairs/" + i12+"/height",schemaPath:"#/properties/stairs/items/properties/height/maximum",keyword:"maximum",params:{comparison: "<=", limit: 6000},message:"must be <= 6000"};
if(vErrors === null){
vErrors = [err315];
}
else {
vErrors.push(err315);
}
errors++;
}
if(data110 < 500 || isNaN(data110)){
const err316 = {instancePath:instancePath+"/stairs/" + i12+"/height",schemaPath:"#/properties/stairs/items/properties/height/minimum",keyword:"minimum",params:{comparison: ">=", limit: 500},message:"must be >= 500"};
if(vErrors === null){
vErrors = [err316];
}
else {
vErrors.push(err316);
}
errors++;
}
}
}
if(data103.steps !== undefined){
let data111 = data103.steps;
if(!(((typeof data111 == "number") && (!(data111 % 1) && !isNaN(data111))) && (isFinite(data111)))){
const err317 = {instancePath:instancePath+"/stairs/" + i12+"/steps",schemaPath:"#/properties/stairs/items/properties/steps/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err317];
}
else {
vErrors.push(err317);
}
errors++;
}
if((typeof data111 == "number") && (isFinite(data111))){
if(data111 > 30 || isNaN(data111)){
const err318 = {instancePath:instancePath+"/stairs/" + i12+"/steps",schemaPath:"#/properties/stairs/items/properties/steps/maximum",keyword:"maximum",params:{comparison: "<=", limit: 30},message:"must be <= 30"};
if(vErrors === null){
vErrors = [err318];
}
else {
vErrors.push(err318);
}
errors++;
}
if(data111 < 2 || isNaN(data111)){
const err319 = {instancePath:instancePath+"/stairs/" + i12+"/steps",schemaPath:"#/properties/stairs/items/properties/steps/minimum",keyword:"minimum",params:{comparison: ">=", limit: 2},message:"must be >= 2"};
if(vErrors === null){
vErrors = [err319];
}
else {
vErrors.push(err319);
}
errors++;
}
}
}
if(data103.material !== undefined){
let data112 = data103.material;
if(typeof data112 === "string"){
if(!pattern4.test(data112)){
const err320 = {instancePath:instancePath+"/stairs/" + i12+"/material",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err320];
}
else {
vErrors.push(err320);
}
errors++;
}
}
else {
const err321 = {instancePath:instancePath+"/stairs/" + i12+"/material",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err321];
}
else {
vErrors.push(err321);
}
errors++;
}
}
if(data103.rev !== undefined){
let data113 = data103.rev;
if(!(((typeof data113 == "number") && (!(data113 % 1) && !isNaN(data113))) && (isFinite(data113)))){
const err322 = {instancePath:instancePath+"/stairs/" + i12+"/rev",schemaPath:"#/properties/stairs/items/properties/rev/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err322];
}
else {
vErrors.push(err322);
}
errors++;
}
if((typeof data113 == "number") && (isFinite(data113))){
if(data113 < 0 || isNaN(data113)){
const err323 = {instancePath:instancePath+"/stairs/" + i12+"/rev",schemaPath:"#/properties/stairs/items/properties/rev/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err323];
}
else {
vErrors.push(err323);
}
errors++;
}
}
}
}
else {
const err324 = {instancePath:instancePath+"/stairs/" + i12,schemaPath:"#/properties/stairs/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err324];
}
else {
vErrors.push(err324);
}
errors++;
}
}
}
else {
const err325 = {instancePath:instancePath+"/stairs",schemaPath:"#/properties/stairs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err325];
}
else {
vErrors.push(err325);
}
errors++;
}
}
if(data.roofs !== undefined){
let data114 = data.roofs;
if(Array.isArray(data114)){
if(data114.length > 6){
const err326 = {instancePath:instancePath+"/roofs",schemaPath:"#/properties/roofs/maxItems",keyword:"maxItems",params:{limit: 6},message:"must NOT have more than 6 items"};
if(vErrors === null){
vErrors = [err326];
}
else {
vErrors.push(err326);
}
errors++;
}
const len13 = data114.length;
for(let i13=0; i13<len13; i13++){
let data115 = data114[i13];
if(data115 && typeof data115 == "object" && !Array.isArray(data115)){
if(data115.id === undefined){
const err327 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "id"},message:"must have required property '"+"id"+"'"};
if(vErrors === null){
vErrors = [err327];
}
else {
vErrors.push(err327);
}
errors++;
}
if(data115.floorId === undefined){
const err328 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "floorId"},message:"must have required property '"+"floorId"+"'"};
if(vErrors === null){
vErrors = [err328];
}
else {
vErrors.push(err328);
}
errors++;
}
if(data115.kind === undefined){
const err329 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "kind"},message:"must have required property '"+"kind"+"'"};
if(vErrors === null){
vErrors = [err329];
}
else {
vErrors.push(err329);
}
errors++;
}
if(data115.pitchDeg === undefined){
const err330 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "pitchDeg"},message:"must have required property '"+"pitchDeg"+"'"};
if(vErrors === null){
vErrors = [err330];
}
else {
vErrors.push(err330);
}
errors++;
}
if(data115.overhang === undefined){
const err331 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "overhang"},message:"must have required property '"+"overhang"+"'"};
if(vErrors === null){
vErrors = [err331];
}
else {
vErrors.push(err331);
}
errors++;
}
if(data115.ridgeAxis === undefined){
const err332 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "ridgeAxis"},message:"must have required property '"+"ridgeAxis"+"'"};
if(vErrors === null){
vErrors = [err332];
}
else {
vErrors.push(err332);
}
errors++;
}
if(data115.material === undefined){
const err333 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "material"},message:"must have required property '"+"material"+"'"};
if(vErrors === null){
vErrors = [err333];
}
else {
vErrors.push(err333);
}
errors++;
}
if(data115.rev === undefined){
const err334 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/required",keyword:"required",params:{missingProperty: "rev"},message:"must have required property '"+"rev"+"'"};
if(vErrors === null){
vErrors = [err334];
}
else {
vErrors.push(err334);
}
errors++;
}
for(const key13 in data115){
if(!((((((((key13 === "id") || (key13 === "floorId")) || (key13 === "kind")) || (key13 === "pitchDeg")) || (key13 === "overhang")) || (key13 === "ridgeAxis")) || (key13 === "material")) || (key13 === "rev"))){
const err335 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key13},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err335];
}
else {
vErrors.push(err335);
}
errors++;
}
}
if(data115.id !== undefined){
let data116 = data115.id;
if(typeof data116 === "string"){
if(!pattern4.test(data116)){
const err336 = {instancePath:instancePath+"/roofs/" + i13+"/id",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err336];
}
else {
vErrors.push(err336);
}
errors++;
}
}
else {
const err337 = {instancePath:instancePath+"/roofs/" + i13+"/id",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err337];
}
else {
vErrors.push(err337);
}
errors++;
}
}
if(data115.floorId !== undefined){
let data117 = data115.floorId;
if(typeof data117 === "string"){
if(!pattern4.test(data117)){
const err338 = {instancePath:instancePath+"/roofs/" + i13+"/floorId",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err338];
}
else {
vErrors.push(err338);
}
errors++;
}
}
else {
const err339 = {instancePath:instancePath+"/roofs/" + i13+"/floorId",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err339];
}
else {
vErrors.push(err339);
}
errors++;
}
}
if(data115.kind !== undefined){
let data118 = data115.kind;
if(!((data118 === "flat") || (data118 === "gable"))){
const err340 = {instancePath:instancePath+"/roofs/" + i13+"/kind",schemaPath:"#/properties/roofs/items/properties/kind/enum",keyword:"enum",params:{allowedValues: schema31.properties.roofs.items.properties.kind.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err340];
}
else {
vErrors.push(err340);
}
errors++;
}
}
if(data115.pitchDeg !== undefined){
let data119 = data115.pitchDeg;
if(!(((typeof data119 == "number") && (!(data119 % 1) && !isNaN(data119))) && (isFinite(data119)))){
const err341 = {instancePath:instancePath+"/roofs/" + i13+"/pitchDeg",schemaPath:"#/properties/roofs/items/properties/pitchDeg/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err341];
}
else {
vErrors.push(err341);
}
errors++;
}
if((typeof data119 == "number") && (isFinite(data119))){
if(data119 > 60 || isNaN(data119)){
const err342 = {instancePath:instancePath+"/roofs/" + i13+"/pitchDeg",schemaPath:"#/properties/roofs/items/properties/pitchDeg/maximum",keyword:"maximum",params:{comparison: "<=", limit: 60},message:"must be <= 60"};
if(vErrors === null){
vErrors = [err342];
}
else {
vErrors.push(err342);
}
errors++;
}
if(data119 < 5 || isNaN(data119)){
const err343 = {instancePath:instancePath+"/roofs/" + i13+"/pitchDeg",schemaPath:"#/properties/roofs/items/properties/pitchDeg/minimum",keyword:"minimum",params:{comparison: ">=", limit: 5},message:"must be >= 5"};
if(vErrors === null){
vErrors = [err343];
}
else {
vErrors.push(err343);
}
errors++;
}
}
}
if(data115.overhang !== undefined){
let data120 = data115.overhang;
if(!(((typeof data120 == "number") && (!(data120 % 1) && !isNaN(data120))) && (isFinite(data120)))){
const err344 = {instancePath:instancePath+"/roofs/" + i13+"/overhang",schemaPath:"#/properties/roofs/items/properties/overhang/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err344];
}
else {
vErrors.push(err344);
}
errors++;
}
if((typeof data120 == "number") && (isFinite(data120))){
if(data120 > 1000 || isNaN(data120)){
const err345 = {instancePath:instancePath+"/roofs/" + i13+"/overhang",schemaPath:"#/properties/roofs/items/properties/overhang/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1000},message:"must be <= 1000"};
if(vErrors === null){
vErrors = [err345];
}
else {
vErrors.push(err345);
}
errors++;
}
if(data120 < 0 || isNaN(data120)){
const err346 = {instancePath:instancePath+"/roofs/" + i13+"/overhang",schemaPath:"#/properties/roofs/items/properties/overhang/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err346];
}
else {
vErrors.push(err346);
}
errors++;
}
}
}
if(data115.ridgeAxis !== undefined){
let data121 = data115.ridgeAxis;
if(!((data121 === "x") || (data121 === "y"))){
const err347 = {instancePath:instancePath+"/roofs/" + i13+"/ridgeAxis",schemaPath:"#/properties/roofs/items/properties/ridgeAxis/enum",keyword:"enum",params:{allowedValues: schema31.properties.roofs.items.properties.ridgeAxis.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err347];
}
else {
vErrors.push(err347);
}
errors++;
}
}
if(data115.material !== undefined){
let data122 = data115.material;
if(typeof data122 === "string"){
if(!pattern4.test(data122)){
const err348 = {instancePath:instancePath+"/roofs/" + i13+"/material",schemaPath:"#/$defs/id/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9_-]{2,40}$"},message:"must match pattern \""+"^[A-Za-z0-9_-]{2,40}$"+"\""};
if(vErrors === null){
vErrors = [err348];
}
else {
vErrors.push(err348);
}
errors++;
}
}
else {
const err349 = {instancePath:instancePath+"/roofs/" + i13+"/material",schemaPath:"#/$defs/id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err349];
}
else {
vErrors.push(err349);
}
errors++;
}
}
if(data115.rev !== undefined){
let data123 = data115.rev;
if(!(((typeof data123 == "number") && (!(data123 % 1) && !isNaN(data123))) && (isFinite(data123)))){
const err350 = {instancePath:instancePath+"/roofs/" + i13+"/rev",schemaPath:"#/properties/roofs/items/properties/rev/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err350];
}
else {
vErrors.push(err350);
}
errors++;
}
if((typeof data123 == "number") && (isFinite(data123))){
if(data123 < 0 || isNaN(data123)){
const err351 = {instancePath:instancePath+"/roofs/" + i13+"/rev",schemaPath:"#/properties/roofs/items/properties/rev/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err351];
}
else {
vErrors.push(err351);
}
errors++;
}
}
}
}
else {
const err352 = {instancePath:instancePath+"/roofs/" + i13,schemaPath:"#/properties/roofs/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err352];
}
else {
vErrors.push(err352);
}
errors++;
}
}
}
else {
const err353 = {instancePath:instancePath+"/roofs",schemaPath:"#/properties/roofs/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err353];
}
else {
vErrors.push(err353);
}
errors++;
}
}
}
else {
const err354 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err354];
}
else {
vErrors.push(err354);
}
errors++;
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};
