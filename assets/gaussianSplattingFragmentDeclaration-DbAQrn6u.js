import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{t as i}from"./logDepthFragment-BL7_3Fsu.js";import{n as a}from"./fogFragment-CIDs8RoG.js";var o=t({gaussianSplattingFragmentDeclarationWGSL:()=>l}),s,c,l;function u(){return(u=e((()=>{n(),i(),a(),s=`gaussianSplattingFragmentDeclaration`,c=`fn gaussianColor(inColor: vec4f,inPosition: vec2f)->vec4f
{var A : f32=-dot(inPosition,inPosition);if (A>-4.0)
{var B: f32=exp(A)*inColor.a;
#include<logDepthFragment>
var color: vec3f=inColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
return vec4f(color,B);} else {return vec4f(0.0);}}
`,r.IncludesShadersStoreWGSL[s]||(r.IncludesShadersStoreWGSL[s]=c),l={name:s,shader:c}})))()}export{o as n,u as r,l as t};