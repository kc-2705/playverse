import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{n as t,t as n}from"./shaderStore-Ctc--YQD.js";import{r,t as i}from"./clipPlaneFragment-aNhWZXg9.js";import{r as a,t as o}from"./clipPlaneFragmentDeclaration-BXbhO4MQ.js";import{r as s,t as c}from"./fogFragmentDeclaration-krS58JuY.js";import{n as l,t as u}from"./logDepthFragment-BL7_3Fsu.js";import{n as d,t as f}from"./fogFragment-CIDs8RoG.js";import{r as p,t as m}from"./helperFunctions-B--49pPZ.js";import{r as h,t as g}from"./imageProcessingDeclaration-DImfk5V_.js";import{r as _,t as v}from"./imageProcessingFunctions-CXMvOzba.js";import{n as y,t as b}from"./logDepthDeclaration-BdjilbSr.js";import{n as x,t as S}from"./objectIdFunctions-ChM7u7hc.js";import{i as C,n as w,r as T,t as E}from"./meshBlendTagFragmentOutput-BZMP8Kfe.js";import{n as D,t as O}from"./geometryRenderingFragment-Dq4qIsPq.js";var k,A,j,M;function N(){return(N=e((()=>{t(),S(),T(),a(),h(),b(),p(),_(),s(),r(),u(),d(),E(),D(),k=`gpuRenderParticlesPixelShader`,A=`var diffuseSamplerSampler: sampler;var diffuseSampler: texture_2d<f32>;varying vUV: vec2f;varying vColor: vec4f;
#ifdef PREPASS
uniform geometryZeroAlphaDiscard: f32;
#ifdef PREPASS_POSITION
varying vGeometryPositionW: vec3f;
#endif
#ifdef PREPASS_WORLD_NORMAL
varying vGeometryNormalW: vec3f;
#endif
#ifdef PREPASS_NORMAL
varying vGeometryNormalV: vec3f;
#endif
#endif
#define PREPASS_VELOCITY_ZERO
#include<prePassDeclaration>[SCENE_MRT_COUNT]
#include<clipPlaneFragmentDeclaration>
#include<imageProcessingDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#include<fogFragmentDeclaration>
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#include<clipPlaneFragment>
let textureColor: vec4f=textureSample(diffuseSampler,diffuseSamplerSampler,input.vUV);var baseColor: vec4f=textureColor*input.vColor;
#ifdef PREPASS
let geometryAlbedo: vec3f=toLinearSpaceVec3(baseColor.rgb);
#endif
#ifdef BLENDMULTIPLYMODE
let alpha: f32=input.vColor.a*textureColor.a;baseColor=vec4f(baseColor.rgb*alpha+vec3f(1.0)*(1.0-alpha),baseColor.a);
#endif
#include<logDepthFragment>
#include<fogFragment>(color,baseColor)
#ifdef IMAGEPROCESSINGPOSTPROCESS
baseColor=vec4f(toLinearSpaceVec3(baseColor.rgb),baseColor.a);
#else
#ifdef IMAGEPROCESSING
baseColor=vec4f(toLinearSpaceVec3(baseColor.rgb),baseColor.a);baseColor=applyImageProcessing(baseColor);
#endif
#endif
#ifdef PREPASS
let geometryColor: vec4f=baseColor;if (geometryColor.a<=0.0 && uniforms.geometryZeroAlphaDiscard>0.0) {discard;}
#ifdef PREPASS_POSITION
let geometryPositionW: vec3f=input.vGeometryPositionW;
#endif
#ifdef PREPASS_LOCAL_POSITION
let geometryPositionL: vec3f=input.vPosition;
#endif
#ifdef PREPASS_DEPTH
let geometryViewDepth: f32=input.vViewPos.z;
#endif
#ifdef PREPASS_NORMALIZED_VIEW_DEPTH
let geometryNormalizedViewDepth: f32=input.vNormViewDepth;
#endif
#ifdef PREPASS_NORMAL
let geometryNormalV: vec3f=normalize(input.vGeometryNormalV);
#endif
#ifdef PREPASS_WORLD_NORMAL
let geometryNormalW: vec3f=normalize(input.vGeometryNormalW);
#endif
#include<geometryRenderingFragment>
#else
fragmentOutputs.color=baseColor;
#endif
}
`,n.ShadersStoreWGSL[k]||(n.ShadersStoreWGSL[k]=A),j=[x,C,o,g,y,m,v,c,i,l,f,w,O];for(let e of j)n.IncludesShadersStoreWGSL[e.name]||(n.IncludesShadersStoreWGSL[e.name]=e.shader);M={name:k,shader:A}})))()}N();export{M as gpuRenderParticlesPixelShaderWGSL};