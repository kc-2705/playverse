import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./clipPlaneFragment-BZpa518R.js";import{r as o,t as s}from"./clipPlaneFragmentDeclaration-Ktf6PkiS.js";import{r as c,t as l}from"./fogFragmentDeclaration-CHurJcHm.js";import{n as u,t as d}from"./logDepthFragment-C0tdsToH.js";import{n as f,t as p}from"./fogFragment-B_oHyHeE.js";import{r as m,t as h}from"./helperFunctions-BeRWwcCB.js";import{r as g,t as _}from"./imageProcessingDeclaration-BZfxI9wX.js";import{r as v,t as y}from"./imageProcessingFunctions-CWlX8ftC.js";import{n as b,t as x}from"./logDepthDeclaration-CpkC1eSa.js";import{n as S,t as C}from"./objectIdFunctions-BeH921x_.js";import{n as w,t as T}from"./prePassDeclaration-FnicdpYY.js";import{n as E,t as D}from"./geometryRenderingFragment-C5AkKLsS.js";var O=t({particlesPixelShader:()=>M}),k,A,j,M;function N(){return(N=e((()=>{n(),C(),T(),o(),g(),x(),m(),v(),c(),i(),d(),f(),E(),k=`particlesPixelShader`,A=`#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
varying vec2 vUV;varying vec4 vColor;uniform vec4 textureMask;uniform sampler2D diffuseSampler;
#ifdef PREPASS
uniform float geometryZeroAlphaDiscard;
#ifdef PREPASS_POSITION
varying vec3 vGeometryPositionW;
#endif
#ifdef PREPASS_WORLD_NORMAL
varying vec3 vGeometryNormalW;
#endif
#ifdef PREPASS_NORMAL
varying vec3 vGeometryNormalV;
#endif
#endif
#define PREPASS_VELOCITY_ZERO
#include<prePassDeclaration>[SCENE_MRT_COUNT]
#include<clipPlaneFragmentDeclaration>
#include<imageProcessingDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#ifdef RAMPGRADIENT
varying vec4 remapRanges;uniform sampler2D rampSampler;
#endif
#include<fogFragmentDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec4 textureColor=texture2D(diffuseSampler,vUV);vec4 baseColor=(textureColor*textureMask+(vec4(1.,1.,1.,1.)-textureMask))*vColor;
#ifdef PREPASS
vec3 geometryAlbedo=toLinearSpace(baseColor.rgb);
#endif
#ifdef RAMPGRADIENT
float alpha=baseColor.a;float remappedColorIndex=clamp((alpha-remapRanges.x)/remapRanges.y,0.0,1.0);vec4 rampColor=texture2D(rampSampler,vec2(1.0-remappedColorIndex,0.));baseColor.rgb*=rampColor.rgb;float finalAlpha=baseColor.a;baseColor.a=clamp((alpha*rampColor.a-remapRanges.z)/remapRanges.w,0.0,1.0);
#endif
#ifdef BLENDMULTIPLYMODE
float sourceAlpha=vColor.a*textureColor.a;baseColor.rgb=baseColor.rgb*sourceAlpha+vec3(1.0)*(1.0-sourceAlpha);
#endif
#include<logDepthFragment>
#include<fogFragment>(color,baseColor)
#ifdef IMAGEPROCESSINGPOSTPROCESS
baseColor.rgb=toLinearSpace(baseColor.rgb);
#else
#ifdef IMAGEPROCESSING
baseColor.rgb=toLinearSpace(baseColor.rgb);baseColor=applyImageProcessing(baseColor);
#endif
#endif
gl_FragColor=baseColor;
#ifdef PREPASS
vec4 geometryColor=gl_FragColor;if (geometryColor.a<=0.0 && geometryZeroAlphaDiscard>0.0) {discard;}
#ifdef PREPASS_POSITION
vec3 geometryPositionW=vGeometryPositionW;
#endif
#ifdef PREPASS_LOCAL_POSITION
vec3 geometryPositionL=vPosition;
#endif
#ifdef PREPASS_DEPTH
float geometryViewDepth=vViewPos.z;
#endif
#ifdef PREPASS_NORMALIZED_VIEW_DEPTH
float geometryNormalizedViewDepth=vNormViewDepth;
#endif
#ifdef PREPASS_NORMAL
vec3 geometryNormalV=normalize(vGeometryNormalV);
#endif
#ifdef PREPASS_WORLD_NORMAL
vec3 geometryNormalW=normalize(vGeometryNormalW);
#endif
#include<geometryRenderingFragment>
#endif
#define CUSTOM_FRAGMENT_MAIN_END
}`,r.ShadersStore[k]||(r.ShadersStore[k]=A),j=[S,w,s,_,b,h,y,l,a,u,p,D];for(let e of j)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);M={name:k,shader:A}})))()}export{O as n,N as t};