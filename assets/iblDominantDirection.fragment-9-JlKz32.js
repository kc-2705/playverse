import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";import{r as i,t as a}from"./helperFunctions-BeRWwcCB.js";import{n as o,t as s}from"./pbrBRDFFunctions-BuVH_Hou.js";import{i as c,n as l,r as u,t as d}from"./hdrFilteringFunctions-J-Sj81Gl.js";var f=t({iblDominantDirectionPixelShader:()=>g}),p,m,h,g;function _(){return(_=e((()=>{n(),i(),c(),s(),l(),p=`iblDominantDirectionPixelShader`,m=`precision highp sampler2D;precision highp samplerCube;
#include<helperFunctions>
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
varying vec2 vUV;uniform sampler2D icdfSampler;void main(void) {vec3 lightDir=vec3(0.0,0.0,0.0);for(uint i=0u; i<NUM_SAMPLES; ++i)
{vec2 Xi=hammersley(i,NUM_SAMPLES);vec2 T;T.x=texture2D(icdfSampler,vec2(Xi.x,0.0)).x;T.y=texture2D(icdfSampler,vec2(T.x,Xi.y)).y;vec3 Ls=uv_to_normal(vec2(1.0-fract(T.x+0.25),T.y));lightDir+=Ls;}
lightDir/=float(NUM_SAMPLES);gl_FragColor=vec4(lightDir,1.0);}`,r.ShadersStore[p]||(r.ShadersStore[p]=m),h=[a,u,o,d];for(let e of h)r.IncludesShadersStore[e.name]||(r.IncludesShadersStore[e.name]=e.shader);g={name:p,shader:m}})))()}export{_ as n,f as t};