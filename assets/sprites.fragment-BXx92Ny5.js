import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./fogFragmentDeclaration-krS58JuY.js";import{n as o,t as s}from"./logDepthFragment-BL7_3Fsu.js";import{n as c,t as l}from"./fogFragment-CIDs8RoG.js";import{r as u,t as d}from"./helperFunctions-B--49pPZ.js";import{n as f,t as p}from"./logDepthDeclaration-BdjilbSr.js";import{n as m,t as h}from"./objectIdFunctions-ChM7u7hc.js";import{i as g,n as _,r as v,t as y}from"./meshBlendTagFragmentOutput-BZMP8Kfe.js";import{n as b,t as x}from"./geometryRenderingFragment-Dq4qIsPq.js";var S,C,w;function T(){return(T=e((()=>{n(),S=`imageProcessingCompatibility`,C=`#ifdef IMAGEPROCESSINGPOSTPROCESS
fragmentOutputs.color=vec4f(pow(fragmentOutputs.color.rgb, vec3f(2.2)),fragmentOutputs.color.a);
#endif
`,r.IncludesShadersStoreWGSL[S]||(r.IncludesShadersStoreWGSL[S]=C),w={name:S,shader:C}})))()}var E=t({spritesPixelShaderWGSL:()=>A}),D,O,k,A;function j(){return(j=e((()=>{n(),h(),v(),i(),p(),u(),s(),c(),T(),y(),b(),D=`spritesPixelShader`,O=`uniform alphaTest: i32;
#include<prePassDeclaration>[SCENE_MRT_COUNT]
varying vColor: vec4f;
#ifdef PREPASS
uniform geometryZeroAlphaDiscard: f32;
#ifdef PREPASS_POSITION
varying vPositionW: vec3f;
#endif
#ifdef PREPASS_NORMAL
varying vNormalV: vec3f;
#endif
#ifdef PREPASS_WORLD_NORMAL
varying vNormalW: vec3f;
#endif
#endif
varying vUV: vec2f;var diffuseSamplerSampler: sampler;var diffuseSampler: texture_2d<f32>;
#include<fogFragmentDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
#ifdef PIXEL_PERFECT
fn uvPixelPerfect(uv: vec2f)->vec2f {var res: vec2f= vec2f(textureDimensions(diffuseSampler,0));var uvTemp=uv*res;var seam: vec2f=floor(uvTemp+0.5);uvTemp=seam+clamp((uvTemp-seam)/fwidth(uvTemp),vec2f(-0.5),vec2f(0.5));return uvTemp/res;}
#endif
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#ifdef PIXEL_PERFECT
var uv: vec2f=uvPixelPerfect(input.vUV);
#else
var uv: vec2f=input.vUV;
#endif
var color: vec4f=textureSample(diffuseSampler,diffuseSamplerSampler,uv);var fAlphaTest: f32= f32(uniforms.alphaTest);if (fAlphaTest != 0.)
{if (color.a<0.95) {discard;}}
color*=input.vColor;
#ifdef PREPASS
#if defined(PREPASS_ALBEDO) || defined(PREPASS_ALBEDO_SQRT)
var geometryAlbedo: vec3f=toLinearSpaceVec3(color.rgb);
#endif
if (fAlphaTest==0.0 && color.a==0.0 && uniforms.geometryZeroAlphaDiscard>0.0) {discard;}
#endif
#include<logDepthFragment>
#include<fogFragment>
#ifdef PREPASS
#include<imageProcessingCompatibility>(fragmentOutputs.color,color)
var geometryColor: vec4f=color;
#ifdef PREPASS_POSITION
var geometryPositionW: vec3f=input.vPositionW;
#endif
#ifdef PREPASS_LOCAL_POSITION
var geometryPositionL: vec3f=input.vPosition;
#endif
#ifdef PREPASS_DEPTH
var geometryViewDepth: f32=input.vViewPos.z;
#endif
#ifdef PREPASS_NORMALIZED_VIEW_DEPTH
var geometryNormalizedViewDepth: f32=input.vNormViewDepth;
#endif
#ifdef PREPASS_NORMAL
var geometryNormalV: vec3f=input.vNormalV;
#endif
#ifdef PREPASS_WORLD_NORMAL
var geometryNormalW: vec3f=input.vNormalW;
#endif
#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)
var geometryCurrentPosition: vec4f=input.vCurrentPosition;var geometryPreviousPosition: vec4f=input.vPreviousPosition;
#endif
#include<geometryRenderingFragment>
#else
fragmentOutputs.color=color;
#include<imageProcessingCompatibility>
#endif
#define CUSTOM_FRAGMENT_MAIN_END
}`,r.ShadersStoreWGSL[D]||(r.ShadersStoreWGSL[D]=O),k=[m,g,a,f,d,o,l,w,_,x];for(let e of k)r.IncludesShadersStoreWGSL[e.name]||(r.IncludesShadersStoreWGSL[e.name]=e.shader);A={name:D,shader:O}})))()}export{E as n,T as r,j as t};