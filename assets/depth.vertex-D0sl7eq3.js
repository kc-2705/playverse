import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./bonesDeclaration-TqvgsU8t.js";import{r as o,t as s}from"./bonesVertex-DVotvUyh.js";import{r as c,t as l}from"./clipPlaneVertex-v1O2sQw5.js";import{r as u,t as d}from"./clipPlaneVertexDeclaration-NXnFqfHO.js";import{n as f,t as p}from"./morphTargetsVertex-Brtektuz.js";import{n as m,t as h}from"./morphTargetsVertexDeclaration-DHyvdSxG.js";import{n as g,t as _}from"./morphTargetsVertexGlobal-BI0A4h7X.js";import{n as v,t as y}from"./morphTargetsVertexGlobalDeclaration-CkAlOikl.js";import{n as b,t as x}from"./bakedVertexAnimationDeclaration-BMEkGIVV.js";import{n as S,t as C}from"./instancesDeclaration-vGKlSBoZ.js";import{n as w,t as T}from"./instancesVertex-BZTMjpAZ.js";import{n as E,t as D}from"./bakedVertexAnimation-J6h0fkQm.js";var O=t({depthVertexShaderWGSL:()=>M}),k,A,j,M;function N(){return(N=e((()=>{n(),i(),b(),y(),h(),u(),C(),_(),p(),T(),o(),E(),c(),k=`depthVertexShader`,A=`attribute position: vec3f;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<clipPlaneVertexDeclaration>
#include<instancesDeclaration>
uniform viewProjection: mat4x4f;uniform depthValues: vec2f;
#if defined(ALPHATEST) || defined(NEED_UV)
varying vUV: vec2f;uniform diffuseMatrix: mat4x4f;
#ifdef UV1
attribute uv: vec2f;
#endif
#ifdef UV2
attribute uv2: vec2f;
#endif
#endif
#ifdef STORE_CAMERASPACE_Z
uniform view: mat4x4f;varying vViewPos: vec4f;
#endif
varying vDepthMetric: f32;
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {var positionUpdated: vec3f=vertexInputs.position;
#ifdef UV1
var uvUpdated: vec2f=vertexInputs.uv;
#endif
#ifdef UV2
var uv2Updated: vec2f=vertexInputs.uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
var worldPos: vec4f=finalWorld* vec4f(positionUpdated,1.0);
#include<clipPlaneVertex>
vertexOutputs.position=uniforms.viewProjection*worldPos;
#ifdef STORE_CAMERASPACE_Z
vertexOutputs.vViewPos=uniforms.view*worldPos;
#else
#ifdef USE_REVERSE_DEPTHBUFFER
vertexOutputs.vDepthMetric=((-vertexOutputs.position.z+uniforms.depthValues.x)/(uniforms.depthValues.y));
#else
vertexOutputs.vDepthMetric=((vertexOutputs.position.z+uniforms.depthValues.x)/(uniforms.depthValues.y));
#endif
#endif
#if defined(ALPHATEST) || defined(BASIC_RENDER)
#ifdef UV1
vertexOutputs.vUV= (uniforms.diffuseMatrix* vec4f(uvUpdated,1.0,0.0)).xy;
#endif
#ifdef UV2
vertexOutputs.vUV= (uniforms.diffuseMatrix* vec4f(uv2Updated,1.0,0.0)).xy;
#endif
#endif
}
`,r.ShadersStoreWGSL[k]||(r.ShadersStoreWGSL[k]=A),j=[a,x,v,m,d,S,g,f,w,s,D,l];for(let e of j)r.IncludesShadersStoreWGSL[e.name]||(r.IncludesShadersStoreWGSL[e.name]=e.shader);M={name:k,shader:A}})))()}export{N as n,O as t};