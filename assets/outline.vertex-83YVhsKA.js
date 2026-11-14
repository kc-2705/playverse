import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-cxMmLBH9.js";import{r as o,t as s}from"./bonesVertex-vjEnuHsI.js";import{r as c,t as l}from"./clipPlaneVertex-Hysqcn6F.js";import{r as u,t as d}from"./clipPlaneVertexDeclaration-KK36gU-5.js";import{n as f,t as p}from"./logDepthDeclaration-CpkC1eSa.js";import{n as m,t as h}from"./morphTargetsVertex-B6MxgioZ.js";import{n as g,t as _}from"./morphTargetsVertexDeclaration-Dlce-FDS.js";import{n as v,t as y}from"./morphTargetsVertexGlobal-Bpb-UIHA.js";import{n as b,t as x}from"./morphTargetsVertexGlobalDeclaration-Bb8IQANp.js";import{i as S,n as C,r as w,t as T}from"./bakedVertexAnimation-_IIoJTDH.js";import{n as E,t as D}from"./instancesDeclaration-CLw6rlk2.js";import{n as O,t as k}from"./instancesVertex-CYxWxKwi.js";import{n as A,t as j}from"./logDepthVertex-Dj5RKYRb.js";var M=t({outlineVertexShader:()=>I}),N,P,F,I;function L(){return(L=e((()=>{n(),i(),S(),x(),_(),u(),D(),p(),y(),h(),k(),o(),C(),c(),j(),N=`outlineVertexShader`,P=`attribute vec3 position;attribute vec3 normal;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<clipPlaneVertexDeclaration>
uniform float offset;
#include<instancesDeclaration>
uniform mat4 viewProjection;
#ifdef ALPHATEST
varying vec2 vUV;uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#include<logDepthDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
void main(void)
{vec3 positionUpdated=position;vec3 normalUpdated=normal;
#ifdef UV1
vec2 uvUpdated=uv;
#endif
#ifdef UV2
vec2 uv2Updated=uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
vec3 offsetPosition=positionUpdated+(normalUpdated*offset);
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(offsetPosition,1.0);gl_Position=viewProjection*worldPos;
#ifdef ALPHATEST
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
}
`,r.ShadersStore[N]||(r.ShadersStore[N]=P),F=[a,w,b,g,d,E,f,v,m,O,s,T,l,A];for(let e of F)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);I={name:N,shader:P}})))()}export{M as n,L as t};