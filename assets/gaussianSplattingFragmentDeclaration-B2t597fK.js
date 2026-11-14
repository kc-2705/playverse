import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{t as i}from"./logDepthFragment-C0tdsToH.js";import{n as a}from"./fogFragment-B_oHyHeE.js";var o=t({gaussianSplattingFragmentDeclaration:()=>l}),s,c,l;function u(){return(u=e((()=>{n(),i(),a(),s=`gaussianSplattingFragmentDeclaration`,c=`vec4 gaussianColor(vec4 inColor)
{float A=-dot(vPosition,vPosition);if (A<-4.0) discard;float B=exp(A)*inColor.a;
#include<logDepthFragment>
vec3 color=inColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
return vec4(color,B);}
`,r.IncludesShadersStore[s]||(r.IncludesShadersStore[s]=c),l={name:s,shader:c}})))()}export{o as n,u as r,l as t};