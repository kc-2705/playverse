import{n as e}from"./rolldown-runtime-sJBDdmOt.js";import{n as t,t as n}from"./shaderStore-Ctc--YQD.js";import{r,t as i}from"./clipPlaneFragment-BZpa518R.js";import{r as a,t as o}from"./clipPlaneFragmentDeclaration-Ktf6PkiS.js";var s,c,l,u;function d(){return(d=e((()=>{t(),a(),r(),s=`selectionPixelShader`,c=`#ifdef INSTANCES
flat varying float vSelectionId;
#else
uniform float selectionId;
#endif
#ifdef STORE_CAMERASPACE_Z
varying float vViewPosZ;
#else
varying float vDepthMetric;
#endif
#ifdef ALPHATEST
varying vec2 vUV;uniform sampler2D diffuseSampler;
#endif
#include<clipPlaneFragmentDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#ifdef ALPHATEST
if (texture2D(diffuseSampler,vUV).a<0.4)
discard;
#endif
#ifdef INSTANCES
float id=vSelectionId;
#else
float id=selectionId;
#endif
#ifdef STORE_CAMERASPACE_Z
gl_FragColor=vec4(id,vViewPosZ,0.0,1.0);
#else
gl_FragColor=vec4(id,vDepthMetric,0.0,1.0);
#endif
#define CUSTOM_FRAGMENT_MAIN_END
}
`,n.ShadersStore[s]||(n.ShadersStore[s]=c),l=[o,i];for(let e of l)n.IncludesShadersStore[e.name]||(n.IncludesShadersStore[e.name]=e.shader);u={name:s,shader:c}})))()}d();export{u as selectionPixelShader};