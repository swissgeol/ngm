import {Color, CustomShader, TextureUniform, UniformType} from 'cesium';

function createCustomShader(property, colorRamp) {
  return new CustomShader({
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
      {
        float value = fsInput.metadata.${property};
        float min = fsInput.metadata.statistics.${property}.min;
        float max = fsInput.metadata.statistics.${property}.max;

        // TODO: use noData instead
        if (value >= min && value <= max) {
          float lerp = (value - min) / (max - min);
          material.diffuse = texture2D(u_colorRamp, vec2(lerp, 0.5)).rgb;
          material.alpha = 1.0;
        }
      }`,
    uniforms: {
      u_colorRamp: {
        type: UniformType.SAMPLER_2D,
        value: new TextureUniform({
          typedArray: colorRamp.image,
          width: colorRamp.width,
          height: colorRamp.height,
        }),
      },
    },
});
}

const rampWidth = 128;
const rampHeight = 1;

function createColorRamp(colorsAndStops) {
  const ramp = document.createElement('canvas');
  ramp.width = rampWidth;
  ramp.height = rampHeight;
  const ctx = ramp.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, ramp.width, 0);

  const length = colorsAndStops.length;
  for (let i = 0; i < length; i++) {
    let color;
    let stop;
    const entry = colorsAndStops[i];
    if (entry instanceof Color) {
      stop = i / (length - 1);
      color = entry;
    } else {
      stop = entry.stop;
      color = entry.color;
    }
    const cssColor = color.toCssColorString();
    grd.addColorStop(stop, cssColor);
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ramp.width, ramp.height);

  const imageData = ctx.getImageData(0, 0, ramp.width, ramp.height);
  const array = new Uint8Array(imageData.data.buffer);
  return array;
}

const colorRamp = {
  image: createColorRamp([
    Color.fromCssColorString('rgba(94,58,180,1)'),
    Color.fromCssColorString('rgba(57,159,193,1)'),
    Color.fromCssColorString('rgba(255,172,54,1)'),
    Color.fromCssColorString('rgba(253,29,29,1)'),
  ]),
  width: rampWidth,
  height: rampHeight
};


const shaders: Record<string, CustomShader> = {};
export function getVoxelShader(property: string): CustomShader {
  let s = shaders[property];
  if (!s) {
    s = shaders[property] = createCustomShader(property, colorRamp);
  }
  return s;
}
