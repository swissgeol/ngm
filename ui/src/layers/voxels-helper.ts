import {CustomShader, TextureUniform, UniformType} from 'cesium';
import type {VoxelColors} from '../layertree';

type ColorRamp = {
  image: Uint8Array,
  width: number,
  height: number,
}

function createCustomShader(property: string, colorRamp: ColorRamp, min: number, max: number, noData: number): CustomShader {
  return new CustomShader({
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
      {
        float value = fsInput.metadata.${property};
        if (value == u_noData) {
          // FIXME: strange display of no data
          //discard;
        } else if (value >= u_min && value <= u_max) {
          float lerp = (value - u_min) / (u_max - u_min);
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
      u_min: {
        type: UniformType.FLOAT,
        value: min,
      },
      u_max: {
        type: UniformType.FLOAT,
        value: max,
      },
      u_noData: {
        type: UniformType.FLOAT,
        value: noData,
      },
    },
});
}

function createColorRamp(colors: string[]): ColorRamp {
  const ramp = document.createElement('canvas');
  ramp.width = 128;
  ramp.height = 1;
  const ctx = ramp.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, ramp.width, 0);

  const length = colors.length;
  const step = 1 / (length - 1);
  for (let i = 0; i < length; i++) {
    const color = colors[i];
    grd.addColorStop(i * step, color !== null ? colors[i] : 'rgba(0, 0, 0, 0)');
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ramp.width, ramp.height);

  const imageData = ctx.getImageData(0, 0, ramp.width, ramp.height);
  return {
    image: new Uint8Array(imageData.data.buffer),
    width: ramp.width,
    height: ramp.height,
  };
}


const shaders: Record<string, CustomShader> = {};
export function getVoxelShader(property: string, colors: VoxelColors): CustomShader {
  let s = shaders[property];
  if (!s) {
    const colorRamp = createColorRamp(colors.colors);
    s = shaders[property] = createCustomShader(property, colorRamp, colors.range[0], colors.range[1], colors.noData);
  }
  return s;
}
