import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-cxMmLBH9.js";import{r as o,t as s}from"./bonesVertex-vjEnuHsI.js";import{r as c,t as l}from"./clipPlaneVertex-Hysqcn6F.js";import{r as u,t as d}from"./clipPlaneVertexDeclaration-KK36gU-5.js";import{i as f,n as p,r as m,t as h}from"./bakedVertexAnimation-_IIoJTDH.js";import{n as g,t as _}from"./instancesDeclaration-CLw6rlk2.js";import{n as v,t as y}from"./fogVertexDeclaration-CMBvpa_G.js";import{n as b,t as x}from"./instancesVertex-CYxWxKwi.js";import{n as S,t as C}from"./fogVertex-NIR3wmul.js";import{n as w,t as T}from"./vertexColorMixing-BXhn6fuK.js";var E=t({colorVertexShader:()=>A}),D,O,k,A;function j(){return(j=e((()=>{n(),i(),f(),u(),v(),_(),x(),o(),p(),c(),S(),T(),D=`colorVertexShader`,O=`attribute vec3 position;
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<clipPlaneVertexDeclaration>
#include<fogVertexDeclaration>
#ifdef FOG
uniform mat4 view;
#endif
#include<instancesDeclaration>
uniform mat4 viewProjection;
#ifdef MULTIVIEW
uniform mat4 viewProjectionR;
#endif
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
varying vec4 vColor;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
vec4 colorUpdated=color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(position,1.0);
#ifdef MULTIVIEW
if (gl_ViewID_OVR==0u) {gl_Position=viewProjection*worldPos;} else {gl_Position=viewProjectionR*worldPos;}
#else
gl_Position=viewProjection*worldPos;
#endif
#include<clipPlaneVertex>
#include<fogVertex>
#include<vertexColorMixing>
#define CUSTOM_VERTEX_MAIN_END
}`,r.ShadersStore[D]||(r.ShadersStore[D]=O),k=[a,m,d,y,g,b,s,h,l,C,w];for(let e of k)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);A={name:D,shader:O}})))()}export{j as n,E as t};