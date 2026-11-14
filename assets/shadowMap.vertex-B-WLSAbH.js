import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-cxMmLBH9.js";import{r as o,t as s}from"./bonesVertex-vjEnuHsI.js";import{r as c,t as l}from"./clipPlaneVertex-Hysqcn6F.js";import{r as u,t as d}from"./clipPlaneVertexDeclaration-KK36gU-5.js";import{r as f,t as ee}from"./helperFunctions-BeRWwcCB.js";import{n as te,t as p}from"./morphTargetsVertex-B6MxgioZ.js";import{n as m,t as h}from"./morphTargetsVertexDeclaration-Dlce-FDS.js";import{n as g,t as _}from"./morphTargetsVertexGlobal-Bpb-UIHA.js";import{n as v,t as y}from"./morphTargetsVertexGlobalDeclaration-Bb8IQANp.js";import{n as b,t as x}from"./shadowMapVertexMetric-DzT46JUw.js";import{n as S,t as C}from"./sceneUboDeclaration-DU1fF3Tm.js";import{i as w,n as ne,r as re,t as ie}from"./bakedVertexAnimation-_IIoJTDH.js";import{n as T,t as E}from"./instancesVertex-CYxWxKwi.js";import{n as D,t as O}from"./meshUboDeclaration-wG0jzJ-5.js";import{n as k,t as A}from"./sceneVertexDeclaration-BTXvk16t.js";import{n as j,t as M}from"./meshVertexDeclaration-BYDErqUk.js";var N,P,F;function I(){return(I=e((()=>{n(),A(),M(),N=`shadowMapVertexDeclaration`,P=`#include<sceneVertexDeclaration>
#include<meshVertexDeclaration>
`,r.IncludesShadersStore[N]||(r.IncludesShadersStore[N]=P),F={name:N,shader:P}})))()}var L,R,z;function B(){return(B=e((()=>{n(),C(),O(),L=`shadowMapUboDeclaration`,R=`layout(std140,column_major) uniform;
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
`,r.IncludesShadersStore[L]||(r.IncludesShadersStore[L]=R),z={name:L,shader:R}})))()}var V,H,U;function W(){return(W=e((()=>{n(),V=`shadowMapVertexExtraDeclaration`,H=`#if SM_NORMALBIAS==1
uniform vec3 lightDataSM;
#endif
uniform vec3 biasAndScaleSM;uniform vec2 depthValuesSM;varying float vDepthMetricSM;
#if SM_USEDISTANCE==1
varying vec3 vPositionWSM;
#endif
#if defined(SM_DEPTHCLAMP) && SM_DEPTHCLAMP==1
varying float zSM;
#endif
`,r.IncludesShadersStore[V]||(r.IncludesShadersStore[V]=H),U={name:V,shader:H}})))()}var G,K,q;function J(){return(J=e((()=>{n(),G=`shadowMapVertexNormalBias`,K=`#if SM_NORMALBIAS==1
#if SM_DIRECTIONINLIGHTDATA==1
vec3 worldLightDirSM=normalize(-lightDataSM.xyz);
#else
vec3 directionToLightSM=lightDataSM.xyz-worldPos.xyz;vec3 worldLightDirSM=normalize(directionToLightSM);
#endif
float ndlSM=dot(vNormalW,worldLightDirSM);float sinNLSM=sqrt(1.0-ndlSM*ndlSM);float normalBiasSM=biasAndScaleSM.y*sinNLSM;worldPos.xyz-=vNormalW*normalBiasSM;
#endif
`,r.IncludesShadersStore[G]||(r.IncludesShadersStore[G]=K),q={name:G,shader:K}})))()}var ae=t({shadowMapVertexShader:()=>Q}),Y,X,Z,Q;function $(){return($=e((()=>{n(),i(),w(),y(),h(),f(),A(),M(),I(),C(),O(),B(),W(),u(),_(),p(),E(),o(),ne(),J(),x(),c(),Y=`shadowMapVertexShader`,X=`attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#ifdef INSTANCES
attribute vec4 world0;attribute vec4 world1;attribute vec4 world2;attribute vec4 world3;
#endif
#include<helperFunctions>
#include<__decl__shadowMapVertex>
#ifdef ALPHATEXTURE
varying vec2 vUV;uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#include<shadowMapVertexExtraDeclaration>
#include<clipPlaneVertexDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
void main(void)
{vec3 positionUpdated=position;
#ifdef UV1
vec2 uvUpdated=uv;
#endif
#ifdef UV2
vec2 uv2Updated=uv2;
#endif
#ifdef NORMAL
vec3 normalUpdated=normal;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);
#ifdef NORMAL
mat3 normWorldSM=mat3(finalWorld);
#if defined(INSTANCES) && defined(THIN_INSTANCES)
vec3 vNormalW=normalUpdated/vec3(dot(normWorldSM[0],normWorldSM[0]),dot(normWorldSM[1],normWorldSM[1]),dot(normWorldSM[2],normWorldSM[2]));vNormalW=normalize(normWorldSM*vNormalW);
#else
#ifdef NONUNIFORMSCALING
normWorldSM=transposeMat3(inverseMat3(normWorldSM));
#endif
vec3 vNormalW=normalize(normWorldSM*normalUpdated);
#endif
#endif
#include<shadowMapVertexNormalBias>
gl_Position=viewProjection*worldPos;
#include<shadowMapVertexMetric>
#ifdef ALPHATEXTURE
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
#include<clipPlaneVertex>
}`,r.ShadersStore[Y]||(r.ShadersStore[Y]=X),Z=[a,re,v,m,ee,k,j,F,S,D,z,U,d,g,te,T,s,ie,q,b,l];for(let e of Z)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);Q={name:Y,shader:X}})))()}export{ae as n,$ as t};