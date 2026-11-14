import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./clipPlaneFragment-aNhWZXg9.js";import{r as o,t as s}from"./clipPlaneFragmentDeclaration-BXbhO4MQ.js";import{n as c,t as l}from"./logDepthFragment-BL7_3Fsu.js";import{n as u,t as d}from"./logDepthDeclaration-BdjilbSr.js";var f=t({linePixelShaderWGSL:()=>g}),p,m,h,g;function _(){return(_=e((()=>{n(),o(),d(),l(),i(),p=`linePixelShader`,m=`#include<clipPlaneFragmentDeclaration>
uniform color: vec4f;
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}`,r.ShadersStoreWGSL[p]||(r.ShadersStoreWGSL[p]=m),h=[s,u,c,a];for(let e of h)r.IncludesShadersStoreWGSL[e.name]||(r.IncludesShadersStoreWGSL[e.name]=e.shader);g={name:p,shader:m}})))()}export{f as n,_ as t};