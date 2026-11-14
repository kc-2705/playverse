import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-cxMmLBH9.js";import{r as o,t as s}from"./bonesVertex-vjEnuHsI.js";import{n as c,t as l}from"./morphTargetsVertex-B6MxgioZ.js";import{n as u,t as d}from"./morphTargetsVertexDeclaration-Dlce-FDS.js";import{n as f,t as p}from"./morphTargetsVertexGlobal-Bpb-UIHA.js";import{n as m,t as h}from"./morphTargetsVertexGlobalDeclaration-Bb8IQANp.js";import{i as g,n as _,r as v,t as y}from"./bakedVertexAnimation-_IIoJTDH.js";import{n as b,t as x}from"./instancesDeclaration-CLw6rlk2.js";import{n as S,t as C}from"./instancesVertex-CYxWxKwi.js";var w=t({volumetricLightScatteringPassVertexShader:()=>O}),T,E,D,O;function k(){return(k=e((()=>{n(),i(),g(),h(),d(),x(),p(),l(),C(),o(),_(),T=`volumetricLightScatteringPassVertexShader`,E=`attribute vec3 position;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<instancesDeclaration>
uniform mat4 viewProjection;uniform vec2 depthValues;
#if defined(ALPHATEST) || defined(NEED_UV)
varying vec2 vUV;uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void)
{vec3 positionUpdated=position;
#if (defined(ALPHATEST) || defined(NEED_UV)) && defined(UV1)
vec2 uvUpdated=uv;
#endif
#if (defined(ALPHATEST) || defined(NEED_UV)) && defined(UV2)
vec2 uv2Updated=uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
gl_Position=viewProjection*finalWorld*vec4(positionUpdated,1.0);
#if defined(ALPHATEST) || defined(BASIC_RENDER)
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
}
`,r.ShadersStore[T]||(r.ShadersStore[T]=E),D=[a,v,m,u,b,f,c,S,s,y];for(let e of D)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);O={name:T,shader:E}})))()}export{w as n,k as t};