import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";var i=t({volumetricLightScatteringPassPixelShader:()=>s}),a,o,s;function c(){return(c=e((()=>{n(),a=`volumetricLightScatteringPassPixelShader`,o=`#if defined(ALPHATEST) || defined(NEED_UV)
varying vec2 vUV;
#endif
#if defined(ALPHATEST)
uniform sampler2D diffuseSampler;
#endif
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void)
{
#if defined(ALPHATEST)
vec4 diffuseColor=texture2D(diffuseSampler,vUV);if (diffuseColor.a<0.4)
discard;
#endif
gl_FragColor=vec4(0.0,0.0,0.0,1.0);}
`,r.ShadersStore[a]||(r.ShadersStore[a]=o),s={name:a,shader:o}})))()}export{i as n,c as t};