import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{n as i,t as a}from"./boundingBoxRendererUboDeclaration-CbKEnz4W.js";var o,s,c;function l(){return(l=e((()=>{n(),o=`boundingBoxRendererVertexDeclaration`,s=`uniform mat4 world;uniform mat4 viewProjection;
#ifdef MULTIVIEW
uniform mat4 viewProjectionR;
#endif
`,r.IncludesShadersStore[o]||(r.IncludesShadersStore[o]=s),c={name:o,shader:s}})))()}var u=t({boundingBoxRendererVertexShader:()=>m}),d,f,p,m;function h(){return(h=e((()=>{n(),l(),i(),d=`boundingBoxRendererVertexShader`,f=`attribute vec3 position;
#include<__decl__boundingBoxRendererVertex>
#ifdef INSTANCES
attribute vec4 world0;attribute vec4 world1;attribute vec4 world2;attribute vec4 world3;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef INSTANCES
mat4 finalWorld=mat4(world0,world1,world2,world3);vec4 worldPos=finalWorld*vec4(position,1.0);
#else
vec4 worldPos=world*vec4(position,1.0);
#endif
#ifdef MULTIVIEW
if (gl_ViewID_OVR==0u) {gl_Position=viewProjection*worldPos;} else {gl_Position=viewProjectionR*worldPos;}
#else
gl_Position=viewProjection*worldPos;
#endif
#define CUSTOM_VERTEX_MAIN_END
}
`,r.ShadersStore[d]||(r.ShadersStore[d]=f),p=[c,a];for(let e of p)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);m={name:d,shader:f}})))()}export{h as n,u as t};