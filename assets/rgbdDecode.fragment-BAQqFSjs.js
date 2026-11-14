import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./helperFunctions-BeRWwcCB.js";var o=t({rgbdDecodePixelShader:()=>u}),s,c,l,u;function d(){return(d=e((()=>{n(),i(),s=`rgbdDecodePixelShader`,c=`varying vec2 vUV;uniform sampler2D textureSampler;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=vec4(fromRGBD(texture2D(textureSampler,vUV)),1.0);}`,r.ShadersStore[s]||(r.ShadersStore[s]=c),l=[a];for(let e of l)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);u={name:s,shader:c}})))()}export{o as n,d as t};