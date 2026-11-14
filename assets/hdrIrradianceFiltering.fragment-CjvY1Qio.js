import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./helperFunctions-BeRWwcCB.js";import{n as o,t as s}from"./pbrBRDFFunctions-BuVH_Hou.js";import{i as c,n as l,r as u,t as d}from"./hdrFilteringFunctions-J-Sj81Gl.js";var f=t({hdrIrradianceFilteringPixelShader:()=>g}),p,m,h,g;function _(){return(_=e((()=>{n(),i(),c(),s(),l(),p=`hdrIrradianceFilteringPixelShader`,m=`#include<helperFunctions>
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
uniform samplerCube inputTexture;
#ifdef IBL_CDF_FILTERING
uniform sampler2D icdfTexture;
#endif
uniform vec2 vFilteringInfo;uniform float hdrScale;varying vec3 direction;void main() {vec3 color=irradiance(inputTexture,direction,vFilteringInfo,0.0,vec3(1.0),direction
#ifdef IBL_CDF_FILTERING
,icdfTexture
#endif
);gl_FragColor=vec4(color*hdrScale,1.0);}`,r.ShadersStore[p]||(r.ShadersStore[p]=m),h=[a,u,o,d];for(let e of h)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);g={name:p,shader:m}})))()}export{_ as n,f as t};