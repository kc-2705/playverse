import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";var i=t({filterPixelShader:()=>s}),a,o,s;function c(){return(c=e((()=>{n(),a=`filterPixelShader`,o=`varying vec2 vUV;uniform sampler2D textureSampler;uniform mat4 kernelMatrix;
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void)
{vec3 baseColor=texture2D(textureSampler,vUV).rgb;vec3 updatedColor=(kernelMatrix*vec4(baseColor,1.0)).rgb;gl_FragColor=vec4(updatedColor,1.0);}`,r.ShadersStore[a]||(r.ShadersStore[a]=o),s={name:a,shader:o}})))()}export{c as n,i as t};