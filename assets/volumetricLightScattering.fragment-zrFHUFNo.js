import{n as e,r as t}from"./rolldown-runtime-sJBDdmOt.js";import{n,t as r}from"./shaderStore-Ctc--YQD.js";var i=t({volumetricLightScatteringPixelShaderWGSL:()=>s}),a,o,s;function c(){return(c=e((()=>{n(),a=`volumetricLightScatteringPixelShader`,o=`varying vUV: vec2f;var textureSamplerSampler: sampler;var textureSampler: texture_2d<f32>;var lightScatteringSamplerSampler: sampler;var lightScatteringSampler: texture_2d<f32>;uniform decay: f32;uniform exposure: f32;uniform weight: f32;uniform density: f32;uniform meshPositionOnScreen: vec2f;
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
var tc: vec2f=input.vUV;var deltaTexCoord: vec2f=tc-uniforms.meshPositionOnScreen;deltaTexCoord*=1.0/f32(NUM_SAMPLES)*uniforms.density;var illuminationDecay: f32=1.0;var color: vec4f=textureSample(lightScatteringSampler,lightScatteringSamplerSampler,tc)*0.4;for (var i: i32=0; i<NUM_SAMPLES; i++) {tc-=deltaTexCoord;var dataSample: vec4f=textureSample(lightScatteringSampler,lightScatteringSamplerSampler,tc)*0.4;dataSample*=illuminationDecay*uniforms.weight;color+=dataSample;illuminationDecay*=uniforms.decay;}
let realColor: vec4f=textureSample(textureSampler,textureSamplerSampler,input.vUV);fragmentOutputs.color=vec4f(color.rgb*uniforms.exposure,realColor.a)+realColor*(1.5-0.4);
#define CUSTOM_FRAGMENT_MAIN_END
}
`,r.ShadersStoreWGSL[a]||(r.ShadersStoreWGSL[a]=o),s={name:a,shader:o}})))()}export{i as n,c as t};