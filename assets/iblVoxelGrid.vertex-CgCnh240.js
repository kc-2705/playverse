import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-cxMmLBH9.js";import{r as o,t as s}from"./bonesVertex-vjEnuHsI.js";import{n as c,t as l}from"./morphTargetsVertex-B6MxgioZ.js";import{n as u,t as d}from"./morphTargetsVertexDeclaration-Dlce-FDS.js";import{n as f,t as p}from"./morphTargetsVertexGlobal-Bpb-UIHA.js";import{n as m,t as h}from"./morphTargetsVertexGlobalDeclaration-Bb8IQANp.js";import{i as g,n as _,r as v,t as y}from"./bakedVertexAnimation-_IIoJTDH.js";import{n as b,t as x}from"./instancesDeclaration-CLw6rlk2.js";import{n as S,t as C}from"./instancesVertex-CYxWxKwi.js";var w=t({iblVoxelGridVertexShader:()=>O}),T,E,D,O;function k(){return(k=e((()=>{n(),i(),g(),x(),h(),d(),p(),l(),C(),o(),_(),T=`iblVoxelGridVertexShader`,E=`attribute vec3 position;varying vec3 vNormalizedPosition;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
uniform mat4 invWorldScale;uniform mat4 viewMatrix;void main(void) {vec3 positionUpdated=position;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);gl_Position=viewMatrix*invWorldScale*worldPos;vNormalizedPosition.xyz=gl_Position.xyz*0.5+0.5;
#ifdef IS_NDC_HALF_ZRANGE
gl_Position.z=gl_Position.z*0.5+0.5;
#endif
}`,r.ShadersStore[T]||(r.ShadersStore[T]=E),D=[a,v,b,m,u,f,c,S,s,y];for(let e of D)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);O={name:T,shader:E}})))()}export{k as n,w as t};