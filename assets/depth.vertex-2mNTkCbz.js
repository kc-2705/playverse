import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-cxMmLBH9.js";import{r as o,t as s}from"./bonesVertex-vjEnuHsI.js";import{r as c,t as l}from"./clipPlaneVertex-Hysqcn6F.js";import{r as u,t as d}from"./clipPlaneVertexDeclaration-KK36gU-5.js";import{n as f,t as p}from"./morphTargetsVertex-B6MxgioZ.js";import{n as m,t as h}from"./morphTargetsVertexDeclaration-Dlce-FDS.js";import{n as g,t as _}from"./morphTargetsVertexGlobal-Bpb-UIHA.js";import{n as v,t as y}from"./morphTargetsVertexGlobalDeclaration-Bb8IQANp.js";import{i as b,n as x,r as S,t as C}from"./bakedVertexAnimation-_IIoJTDH.js";import{n as w,t as T}from"./instancesDeclaration-CLw6rlk2.js";import{n as E,t as D}from"./instancesVertex-CYxWxKwi.js";import{n as O,t as k}from"./pointCloudVertex-BGDOVTJ-.js";var A,j,M;function N(){return(N=e((()=>{n(),A=`pointCloudVertexDeclaration`,j=`#ifdef POINTSIZE
uniform float pointSize;
#endif
`,r.IncludesShadersStore[A]||(r.IncludesShadersStore[A]=j),M={name:A,shader:j}})))()}var P=t({depthVertexShader:()=>R}),F,I,L,R;function z(){return(z=e((()=>{n(),i(),b(),y(),h(),u(),T(),N(),_(),p(),D(),o(),x(),c(),k(),F=`depthVertexShader`,I=`attribute vec3 position;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<clipPlaneVertexDeclaration>
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
#ifdef STORE_CAMERASPACE_Z
uniform mat4 view;varying vec4 vViewPos;
#endif
#include<pointCloudVertexDeclaration>
varying float vDepthMetric;
#define CUSTOM_VERTEX_DEFINITIONS
void main(void)
{vec3 positionUpdated=position;
#ifdef UV1
vec2 uvUpdated=uv;
#endif
#ifdef UV2
vec2 uv2Updated=uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);
#include<clipPlaneVertex>
gl_Position=viewProjection*worldPos;
#ifdef STORE_CAMERASPACE_Z
vViewPos=view*worldPos;
#else
#ifdef USE_REVERSE_DEPTHBUFFER
vDepthMetric=((-gl_Position.z+depthValues.x)/(depthValues.y));
#else
vDepthMetric=((gl_Position.z+depthValues.x)/(depthValues.y));
#endif
#endif
#if defined(ALPHATEST) || defined(BASIC_RENDER)
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
#include<pointCloudVertex>
}
`,r.ShadersStore[F]||(r.ShadersStore[F]=I),L=[a,S,v,m,d,w,M,g,f,E,s,C,l,O];for(let e of L)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);R={name:F,shader:I}})))()}export{z as n,P as t};