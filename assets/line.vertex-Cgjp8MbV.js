import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./clipPlaneVertex-Hysqcn6F.js";import{r as o,t as s}from"./clipPlaneVertexDeclaration-KK36gU-5.js";import{n as c,t as l}from"./logDepthDeclaration-CpkC1eSa.js";import{n as u,t as d}from"./sceneUboDeclaration-DU1fF3Tm.js";import{n as f,t as p}from"./instancesDeclaration-CLw6rlk2.js";import{n as m,t as h}from"./instancesVertex-CYxWxKwi.js";import{n as g,t as _}from"./logDepthVertex-Dj5RKYRb.js";import{n as v,t as y}from"./meshUboDeclaration-wG0jzJ-5.js";var b,x,S;function C(){return(C=e((()=>{n(),b=`lineVertexDeclaration`,x=`uniform mat4 viewProjection;
#define ADDITIONAL_VERTEX_DECLARATION
`,r.IncludesShadersStore[b]||(r.IncludesShadersStore[b]=x),S={name:b,shader:x}})))()}var w,T,E;function D(){return(D=e((()=>{n(),d(),y(),w=`lineUboDeclaration`,T=`layout(std140,column_major) uniform;
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
`,r.IncludesShadersStore[w]||(r.IncludesShadersStore[w]=T),E={name:w,shader:T}})))()}var O=t({lineVertexShader:()=>M}),k,A,j,M;function N(){return(N=e((()=>{n(),C(),d(),y(),D(),p(),o(),l(),h(),i(),_(),k=`lineVertexShader`,A=`#include<__decl__lineVertex>
#include<instancesDeclaration>
#include<clipPlaneVertexDeclaration>
attribute vec3 position;attribute vec4 normal;uniform float width;uniform float aspectRatio;
#include<logDepthDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#include<instancesVertex>
mat4 worldViewProjection=viewProjection*finalWorld;vec4 viewPosition=worldViewProjection*vec4(position,1.0);vec4 viewPositionNext=worldViewProjection*vec4(normal.xyz,1.0);vec2 currentScreen=viewPosition.xy/viewPosition.w;vec2 nextScreen=viewPositionNext.xy/viewPositionNext.w;currentScreen.x*=aspectRatio;nextScreen.x*=aspectRatio;vec2 dir=normalize(nextScreen-currentScreen);vec2 normalDir=vec2(-dir.y,dir.x);normalDir*=width/2.0;normalDir.x/=aspectRatio;vec4 offset=vec4(normalDir*normal.w,0.0,0.0);gl_Position=viewPosition+offset;
#if defined(CLIPPLANE) || defined(CLIPPLANE2) || defined(CLIPPLANE3) || defined(CLIPPLANE4) || defined(CLIPPLANE5) || defined(CLIPPLANE6)
vec4 worldPos=finalWorld*vec4(position,1.0);
#include<clipPlaneVertex>
#endif
#include<logDepthVertex>
#define CUSTOM_VERTEX_MAIN_END
}`,r.ShadersStore[k]||(r.ShadersStore[k]=A),j=[S,u,v,E,f,s,c,m,a,g];for(let e of j)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);M={name:k,shader:A}})))()}export{O as n,N as t};