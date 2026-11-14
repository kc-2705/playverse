import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{n as t,t as n}from"./shaderStore-Ctc--YQD.js";import{r,t as i}from"./bonesDeclaration-TqvgsU8t.js";import{r as a,t as o}from"./bonesVertex-DVotvUyh.js";import{r as s,t as c}from"./clipPlaneVertex-v1O2sQw5.js";import{r as l,t as u}from"./clipPlaneVertexDeclaration-NXnFqfHO.js";import{n as d,t as f}from"./morphTargetsVertex-Brtektuz.js";import{n as p,t as m}from"./morphTargetsVertexDeclaration-DHyvdSxG.js";import{n as h,t as g}from"./morphTargetsVertexGlobal-BI0A4h7X.js";import{n as _,t as v}from"./morphTargetsVertexGlobalDeclaration-CkAlOikl.js";import{n as y,t as b}from"./bakedVertexAnimationDeclaration-BMEkGIVV.js";import{n as x,t as S}from"./instancesDeclaration-vGKlSBoZ.js";import{n as C,t as w}from"./instancesVertex-BZTMjpAZ.js";import{n as T,t as E}from"./bakedVertexAnimation-J6h0fkQm.js";var D,O,k,A;function j(){return(j=e((()=>{t(),r(),y(),v(),m(),l(),S(),g(),f(),w(),a(),T(),s(),D=`selectionVertexShader`,O=`attribute position: vec3f;
#ifdef INSTANCES
attribute instanceSelectionId: f32;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<clipPlaneVertexDeclaration>
#include<instancesDeclaration>
uniform viewProjection: mat4x4f;
#ifdef STORE_CAMERASPACE_Z
uniform view: mat4x4f;
#else
uniform depthValues: vec2f;
#endif
#ifdef INSTANCES
flat varying vSelectionId: f32;
#endif
#ifdef STORE_CAMERASPACE_Z
varying vViewPosZ: f32;
#else
varying vDepthMetric: f32;
#endif
#ifdef ALPHATEST
varying vUV: vec2f;uniform diffuseMatrix: mat4x4f; 
#ifdef UV1
attribute uv: vec2f;
#endif
#ifdef UV2
attribute uv2: vec2f;
#endif
#endif
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input: VertexInputs)->FragmentInputs {
#define CUSTOM_VERTEX_MAIN_BEGIN
var positionUpdated: vec3f=vertexInputs.position;
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
var worldPos: vec4f=finalWorld*vec4f(positionUpdated,1.0);vertexOutputs.position=uniforms.viewProjection*worldPos;
#ifdef ALPHATEST
#ifdef UV1
vertexOutputs.vUV=(uniforms.diffuseMatrix*vec4f(uvUpdated,1.0,0.0)).xy;
#endif
#ifdef UV2
vertexOutputs.vUV=(uniforms.diffuseMatrix*vec4f(uv2Updated,1.0,0.0)).xy;
#endif
#endif
#ifdef STORE_CAMERASPACE_Z
vertexOutputs.vViewPosZ=(uniforms.view*worldPos).z;
#else
#ifdef USE_REVERSE_DEPTHBUFFER
vertexOutputs.vDepthMetric=((-vertexOutputs.position.z+uniforms.depthValues.x)/(uniforms.depthValues.y));
#else
vertexOutputs.vDepthMetric=((vertexOutputs.position.z+uniforms.depthValues.x)/(uniforms.depthValues.y));
#endif
#endif
#ifdef INSTANCES
vertexOutputs.vSelectionId=vertexInputs.instanceSelectionId;
#endif
#include<clipPlaneVertex>
#define CUSTOM_VERTEX_MAIN_END
}
`,n.ShadersStoreWGSL[D]||(n.ShadersStoreWGSL[D]=O),k=[i,b,_,p,u,x,h,d,C,o,E,c];for(let e of k)n.IncludesShadersStoreWGSL[e.name]||(n.IncludesShadersStoreWGSL[e.name]=e.shader);A={name:D,shader:O}})))()}j();export{A as selectionVertexShaderWGSL};