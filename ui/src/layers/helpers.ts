import EarthquakeVisualizer from '../earthquakeVisualization/earthquakeVisualizer.js';
import IonResource from 'cesium/Source/Core/IonResource';
import GeoJsonDataSource from 'cesium/Source/DataSources/GeoJsonDataSource';
import Cesium3DTileset from 'cesium/Source/Scene/Cesium3DTileset';
import Cesium3DTileStyle from 'cesium/Source/Scene/Cesium3DTileStyle';
import {getSwisstopoImagery} from '../swisstopoImagery.js';
import {LayerType} from '../constants';
import Cartographic from 'cesium/Source/Core/Cartographic';
import {isLabelOutlineEnabled} from '../permalink';
import LabelStyle from 'cesium/Source/Scene/LabelStyle';
import Rectangle from 'cesium/Source/Core/Rectangle';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid';
import Matrix3 from 'cesium/Source/Core/Matrix3';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cesium3DTileColorBlendMode from 'cesium/Source/Scene/Cesium3DTileColorBlendMode';
import AmazonS3Resource from '../AmazonS3Resource.js';
import type Viewer from 'cesium/Source/Widgets/Viewer/Viewer';
import type {Config} from './ngm-layers-item.js';
import {Cesium3DTilesVoxelProvider, Color, CustomShader, TextureUniform, UniformType, VoxelPrimitive} from 'cesium';

export function createEarthquakeFromConfig(viewer: Viewer, config: Config) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer, config);
  if (config.visible) {
    earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = visible => earthquakeVisualizer.setVisible(visible);
  config.setOpacity = (opacity: number) => earthquakeVisualizer.setOpacity(opacity);
  return earthquakeVisualizer;
}

export function createIonGeoJSONFromConfig(viewer: Viewer, config) {
  return IonResource.fromAssetId(config.assetId)
    .then(resource => GeoJsonDataSource.load(resource))
    .then(dataSource => {
      viewer.dataSources.add(dataSource);
      dataSource.show = !!config.visible;
      config.setVisibility = visible => dataSource.show = !!visible;
      return dataSource;
    });
}


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

export function create3DVoxelsTilesetFromConfig(viewer: Viewer, config: Config, _) {
  const provider = new Cesium3DTilesVoxelProvider({
    url: config.url!,
  });

  const primitive = new VoxelPrimitive({
    /** @ts-ignore */
    provider: provider,
  });

  primitive.nearestSampling = true;
  primitive.stepSize = 0.37;
  primitive.depthTest = false;
  primitive.show = !!config.visible;

  viewer.scene.primitives.add(primitive);

  config.setVisibility = visible => {
    primitive.show = !!visible;
  };


  primitive.readyPromise.then(() => {
    const properties = primitive.provider.names;
    console.log('Voxels3d properties', properties);
    const property = properties[0];
    primitive.customShader = createCustomShader(property, colorRamp);
    viewer.camera.flyToBoundingSphere(primitive.boundingSphere, {
      duration: 0.0,
    });
  });

  return primitive;
}
export function create3DTilesetFromConfig(viewer: Viewer, config: Config, tileLoadCallback) {
  let resource: string | Promise<IonResource> | AmazonS3Resource;
  if (config.aws_s3_bucket && config.aws_s3_key) {
    resource = new AmazonS3Resource({
      bucket: config.aws_s3_bucket,
      url: config.aws_s3_key,
    });
  } else if (config.url) {
    resource = config.url;
  } else {
    resource = IonResource.fromAssetId(config.assetId!);
  }

  const tileset = new Cesium3DTileset({
    url: resource,
    show: !!config.visible,
    backFaceCulling: false,
    maximumScreenSpaceError: tileLoadCallback ? Number.NEGATIVE_INFINITY : 16, // 16 - default value
  });

  if (config.style) {
    if (config.layer === 'ch.swisstopo.swissnames3d.3d') { // for performance testing
      config.style.labelStyle = isLabelOutlineEnabled() ? LabelStyle.FILL_AND_OUTLINE : LabelStyle.FILL;
    }
    tileset.style = new Cesium3DTileStyle(config.style);
  }

  (tileset as any).pickable = config.pickable !== undefined ? config.pickable : false;
  viewer.scene.primitives.add(tileset);

  config.setVisibility = visible => {
    tileset.show = !!visible;
  };

  if (!config.opacityDisabled) {
    config.setOpacity = opacity => {
      const style = config.style;
      if (style && (style.color || style.labelColor)) {
        const {propertyName, colorType, colorValue} = styleColorParser(style);
        const color = `${colorType}(${colorValue}, ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, [propertyName]: color});
      } else {
        const color = `color("white", ${opacity})`;
        tileset.style = new Cesium3DTileStyle({...style, color});
      }
    };
    config.setOpacity(config.opacity ? config.opacity : 1);
  }

  if (tileLoadCallback) {
    const removeTileLoadListener = tileset.tileLoad.addEventListener(tile => tileLoadCallback(tile, removeTileLoadListener));
  }

  tileset.readyPromise.then(() => {
    if (config.propsOrder) {
      tileset.properties.propsOrder = config.propsOrder;
    }
    if (config.heightOffset) {
      const cartographic = Cartographic.fromCartesian(tileset.boundingSphere.center);
      const surface = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
      const offset = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, config.heightOffset);
      const translation = Cartesian3.subtract(offset, surface, new Cartesian3());
      tileset.modelMatrix = Matrix4.fromTranslation(translation);
      viewer.scene.requestRender();
    }
  });
  // for correct highlighting
  tileset.colorBlendMode = Cesium3DTileColorBlendMode.REPLACE;
  return tileset;
}

export function createSwisstopoWMTSImageryLayer(viewer: Viewer, config: Config) {
  let layer = {} as any;
  config.setVisibility = visible => layer.show = !!visible;
  config.setOpacity = opacity => layer.alpha = opacity;
  config.remove = () => viewer.scene.imageryLayers.remove(layer, false);
  config.add = (toIndex) => {
    const layersLength = viewer.scene.imageryLayers.length;
    if (toIndex > 0 && toIndex < layersLength) {
      const imageryIndex = layersLength - toIndex;
      viewer.scene.imageryLayers.add(layer, imageryIndex);
      return;
    }
    viewer.scene.imageryLayers.add(layer);
  };

  return getSwisstopoImagery(config.layer!, config.maximumLevel).then(l => {
    layer = l;
    viewer.scene.imageryLayers.add(layer);
    layer.alpha = config.opacity || 1;
    layer.show = !!config.visible;
    return layer;
  });
}


export function createCesiumObject(viewer: Viewer, config: Config, tileLoadCallback?) {
  const factories = {
    [LayerType.ionGeoJSON]: createIonGeoJSONFromConfig,
    [LayerType.tiles3d]: create3DTilesetFromConfig,
    [LayerType.voxels3dtiles]: create3DVoxelsTilesetFromConfig,
    [LayerType.swisstopoWMTS]: createSwisstopoWMTSImageryLayer,
    [LayerType.earthquakes]: createEarthquakeFromConfig,
  };
  return factories[config.type!](viewer, config, tileLoadCallback);
}

function styleColorParser(style: any) {
  const propertyName = style.color ? 'color' : 'labelColor';
  let colorType = style[propertyName].slice(0, style[propertyName].indexOf('('));
  const lastIndex = colorType === 'rgba' ? style[propertyName].lastIndexOf(',') : style[propertyName].indexOf(')');
  const colorValue = style[propertyName].slice(style[propertyName].indexOf('(') + 1, lastIndex);
  colorType = colorType === 'rgb' ? 'rgba' : colorType;
  return {propertyName, colorType, colorValue};
}


export function getBoxFromRectangle(rectangle: Rectangle, height: number, result: Cartesian3 = new Cartesian3()): Cartesian3 {
  const sw = Cartographic.toCartesian(Rectangle.southwest(rectangle, new Cartographic()));
  const se = Cartographic.toCartesian(Rectangle.southeast(rectangle, new Cartographic()));
  const nw = Cartographic.toCartesian(Rectangle.northwest(rectangle, new Cartographic()));
  result.x = Cartesian3.distance(sw, se); // gets box width
  result.y = Cartesian3.distance(sw, nw); // gets box length
  result.z = height;
  return result;
}

/**
 * Returns rectangle from width height and center point
 */
export function calculateRectangle(width: number, height: number, center: Cartesian3, result: Rectangle = new Rectangle()): Rectangle {
  const w = new Cartesian3(center.x, center.y - width / 2, center.z);
  result.west = Ellipsoid.WGS84.cartesianToCartographic(w).longitude;
  const s = new Cartesian3(center.x + height / 2, center.y, center.z);
  result.south = Ellipsoid.WGS84.cartesianToCartographic(s).latitude;
  const e = new Cartesian3(center.x, center.y + width / 2, center.z);
  result.east = Ellipsoid.WGS84.cartesianToCartographic(e).longitude;
  const n = new Cartesian3(center.x - height / 2, center.y, center.z);
  result.north = Ellipsoid.WGS84.cartesianToCartographic(n).latitude;

  return result;
}

/**
 * Calculates box from bounding volume
 */
export function calculateBox(halfAxes: Matrix3, boundingSphereRadius: number, result: Cartesian3 = new Cartesian3()): Cartesian3 {
  const absMatrix = Matrix3.abs(halfAxes, new Matrix3());
  for (let i = 0; i < 3; i++) {
    const column = Matrix3.getColumn(absMatrix, i, new Cartesian3());
    const row = Matrix3.getRow(absMatrix, i, new Cartesian3());
    result.y = result.y + column.x + row.x;
    result.x = result.x + column.y + row.y;
    result.z = result.z + column.z + row.z;
  }
  // scale according to bounding sphere
  const diagonal = Math.sqrt(result.x * result.x + result.y * result.y);
  const radius = boundingSphereRadius;
  const scale = Math.max(diagonal / (radius * 2), (radius * 2) / diagonal);
  result.x = result.x * scale;
  result.y = result.y * scale;
  result.z = result.z > 60000 ? 60000 : result.z;

  return new Cartesian3(result.x, result.y, result.z);
}
