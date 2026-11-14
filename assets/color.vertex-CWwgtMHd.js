import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-TqvgsU8t.js";import{r as o,t as s}from"./bonesVertex-DVotvUyh.js";import{r as c,t as l}from"./clipPlaneVertex-v1O2sQw5.js";import{r as u,t as d}from"./clipPlaneVertexDeclaration-NXnFqfHO.js";import{n as f,t as p}from"./bakedVertexAnimationDeclaration-BMEkGIVV.js";import{n as m,t as h}from"./instancesDeclaration-vGKlSBoZ.js";import{n as g,t as _}from"./fogVertexDeclaration-S_4d6fs3.js";import{n as v,t as y}from"./instancesVertex-BZTMjpAZ.js";import{n as b,t as x}from"./bakedVertexAnimation-J6h0fkQm.js";import{n as S,t as C}from"./fogVertex-Bx47j0U-.js";import{n as w,t as T}from"./vertexColorMixing-F6qxt_iS.js";var E=t({colorVertexShaderWGSL:()=>A}),D,O,k,A;function j(){return(j=e((()=>{n(),i(),f(),u(),g(),h(),y(),o(),b(),c(),S(),T(),D=`colorVertexShader`,O=`attribute position: vec3f;
#ifdef VERTEXCOLOR
attribute color: vec4f;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<clipPlaneVertexDeclaration>
#include<fogVertexDeclaration>
#ifdef FOG
uniform view: mat4x4f;
#endif
#include<instancesDeclaration>
uniform viewProjection: mat4x4f;
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
varying vColor: vec4f;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
var colorUpdated: vec4f=vertexInputs.color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
var worldPos: vec4f=finalWorld* vec4f(vertexInputs.position,1.0);vertexOutputs.position=uniforms.viewProjection*worldPos;
#include<clipPlaneVertex>
#include<fogVertex>
#include<vertexColorMixing>
#define CUSTOM_VERTEX_MAIN_END
}`,r.ShadersStoreWGSL[D]||(r.ShadersStoreWGSL[D]=O),k=[a,p,d,_,m,v,s,x,l,C,w];for(let e of k)r.IncludesShadersStoreWGSL[e.name]||(r.IncludesShadersStoreWGSL[e.name]=e.shader);A={name:D,shader:O}})))()}export{j as n,E as t};