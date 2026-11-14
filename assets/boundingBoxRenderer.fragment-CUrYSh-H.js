import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{n as i,t as a}from"./boundingBoxRendererUboDeclaration-CbKEnz4W.js";var o,s,c;function l(){return(l=e((()=>{n(),o=`boundingBoxRendererFragmentDeclaration`,s=`uniform vec4 color;
`,r.IncludesShadersStore[o]||(r.IncludesShadersStore[o]=s),c={name:o,shader:s}})))()}var u=t({boundingBoxRendererPixelShader:()=>m}),d,f,p,m;function h(){return(h=e((()=>{n(),l(),i(),d=`boundingBoxRendererPixelShader`,f=`#include<__decl__boundingBoxRendererFragment>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`,r.ShadersStore[d]||(r.ShadersStore[d]=f),p=[c,a];for(let e of p)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);m={name:d,shader:f}})))()}export{h as n,u as t};