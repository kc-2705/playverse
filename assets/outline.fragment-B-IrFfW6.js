import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./clipPlaneFragment-BZpa518R.js";import{r as o,t as s}from"./clipPlaneFragmentDeclaration-Ktf6PkiS.js";import{n as c,t as l}from"./logDepthFragment-C0tdsToH.js";import{n as u,t as d}from"./logDepthDeclaration-CpkC1eSa.js";var f=t({outlinePixelShader:()=>g}),p,m,h,g;function _(){return(_=e((()=>{n(),o(),d(),i(),l(),p=`outlinePixelShader`,m=`#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
uniform vec4 color;
#ifdef ALPHATEST
varying vec2 vUV;uniform sampler2D diffuseSampler;
#endif
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#ifdef ALPHATEST
if (texture2D(diffuseSampler,vUV).a<0.4)
discard;
#endif
#include<logDepthFragment>
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`,r.ShadersStore[p]||(r.ShadersStore[p]=m),h=[s,u,a,c];for(let e of h)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);g={name:p,shader:m}})))()}export{f as n,_ as t};