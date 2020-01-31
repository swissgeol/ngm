// @ts-check

import Cesium3DTileStyle from 'cesium/Scene/Cesium3DTileStyle.js';
import Cesium3DTileset from 'cesium/Scene/Cesium3DTileset.js';
import GeoJsonDataSource from 'cesium/DataSources/GeoJsonDataSource.js';
import IonResource from 'cesium/Core/IonResource.js';
import {html, render} from 'lit-html';
import {getSwisstopoImagery} from './swisstopoImagery.js';
import EarthquakeVisualizer from './earthquakeVisualization/earthquakeVisualizer.js';

import i18next from 'i18next';


const swisstopoLabelStyle = {
  labelStyle: 2,
  labelText: '${DISPLAY_TEXT}',
  disableDepthTestDistance: Infinity,
  anchorLineEnabled: true,
  anchorLineColor: "color('white')",
  heightOffset: 200,
  labelColor: {
    conditions: [
      ['${OBJEKTART} === "See"', 'color("blue")'],
      ['true', 'color("black")']
    ]
  },
  labelOutlineColor: 'color("white", 1)',
  labelOutlineWidth: 5,
  font: {
    conditions: [
      ['${OBJEKTART} === "See"', '"bold 32px arial"'],
      ['true', '"32px arial"']
    ]
  },
  scaleByDistance: {
    conditions: [
      ['${LOD} === "7"', 'vec4(1000, 1, 5000, 0.4)'],
      ['${LOD} === "6"', 'vec4(1000, 1, 5000, 0.4)'],
      ['${LOD} === "5"', 'vec4(1000, 1, 8000, 0.4)'],
      ['${LOD} === "4"', 'vec4(1000, 1, 10000, 0.4)'],
      ['${LOD} === "3"', 'vec4(1000, 1, 20000, 0.4)'],
      ['${LOD} === "2"', 'vec4(1000, 1, 30000, 0.4)'],
      ['${LOD} === "1"', 'vec4(1000, 1, 50000, 0.4)'],
      ['${LOD} === "0"', 'vec4(1000, 1, 500000, 0.4)'],
      ['true', 'vec4(1000, 1, 10000, 0.4)']
    ]
  },
  distanceDisplayCondition: {
    'conditions': [
      ['${LOD} === "7"', 'vec2(0, 5000)'],
      ['${LOD} === "6"', 'vec2(0, 5000)'],
      ['${LOD} === "5"', 'vec2(0, 8000)'],
      ['${LOD} === "4"', 'vec2(0, 10000)'],
      ['${LOD} === "3"', 'vec2(0, 20000)'],
      ['${LOD} === "2"', 'vec2(0, 30000)'],
      ['${LOD} === "1"', 'vec2(0, 50000)'],
      ['${LOD} === "0"', 'vec2(0, 500000)'],
    ]
  }
};

const t = a => a;
const layers = [{
  type: '3dtiles',
  url: 'https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json',
  label: t('swissnames_label'),
  style: swisstopoLabelStyle,
  visible: true,
}, {
  type: 'ion3dtiles',
  assetId: 68857,
  label: t('boreholes_label'),
}, {
  type: 'ion3dtiles',
  assetId: 68722,
  label: t('base_mesozoic_label'),
}, {
  type: 'ion3dtiles',
  assetId: 68881,
  label: t('cross_section_label'),
}, {
  type: 'earthquakes',
  label: t('earthquakes_label'),
}
];

//   type: 'ionGeoJSON',
//   assetId: 56810,
//   label: t('tin_of_geological_layer'),
//   visible: false,
//   opacity: 0.8,
// }, {
//   type: 'swisstopoWMTS',
//   label: t('ch.swisstopo.swisstlm3d-wanderwege'),
//   layer: 'ch.swisstopo.swisstlm3d-wanderwege',
//   visible: false,
//   opacity: 0.7,
// }, {
//   type: 'ion3dtiles',
//   assetId: 56812,
//   label: t('tunnel'),
//   visible: false,
//   opacity: 1,


function createEarthquakeFromConfig(viewer, config) {
  const earthquakeVisualizer = new EarthquakeVisualizer(viewer);
  if (config.visible) {
    earthquakeVisualizer.setVisible(true);
  }
  config.setVisibility = visible => earthquakeVisualizer.setVisible(visible);
  return earthquakeVisualizer;
}

function createIonGeoJSONFromConfig(viewer, config) {
  return IonResource.fromAssetId(config.assetId)
    .then(resource => GeoJsonDataSource.load(resource))
    .then(dataSource => {
      viewer.dataSources.add(dataSource);
      dataSource.show = !!config.visible;
      config.setVisibility = visible => dataSource.show = !!visible;
      return dataSource;
    });
}

function createIon3DTilesetFromConfig(viewer, config) {
  const primitive = viewer.scene.primitives.add(
    new Cesium3DTileset({
      show: !!config.visible,
      url: IonResource.fromAssetId(config.assetId)
    })
  );
  config.setVisibility = visible => primitive.show = !!visible;
  return primitive;
}

function create3DTilesetFromConfig(viewer, config) {
  const primitive = new Cesium3DTileset({
    url: config.url,
    show: !!config.visible,
  });
  if (config.style) {
    primitive.style = new Cesium3DTileStyle(config.style);
  }
  viewer.scene.primitives.add(primitive);

  config.setVisibility = visible => primitive.show = !!visible;
  return primitive;
}

function createSwisstopoWMTSImageryLayer(viewer, config) {
  let layer = null;
  config.setVisibility = visible => layer.show = !!visible;
  config.setOpacity = opacity => layer.alpha = opacity;

  return getSwisstopoImagery(config.layer).then(l => {
    layer = l;
    viewer.scene.imageryLayers.add(layer);
    layer.alpha = config.opacity || 1;
    layer.show = !!config.visible;
    return layer;
  });
}

const factories = {
  ionGeoJSON: createIonGeoJSONFromConfig,
  ion3dtiles: createIon3DTilesetFromConfig,
  '3dtiles': create3DTilesetFromConfig,
  swisstopoWMTS: createSwisstopoWMTSImageryLayer,
  earthquakes: createEarthquakeFromConfig,
};

export function doRender(viewer, target) {
  const templates = layers.map((config, index) => {
    if (!config.promise) {
      config.promise = factories[config.type](viewer, config);
    }
    const changeVisibility = evt => {
      config.setVisibility(evt.target.checked);
      viewer.scene.requestRender();
    };
    const changeOpacity = evt => {
      config.setOpacity(evt.target.value);
      viewer.scene.requestRender();
    };

    return html`
    <div class="ui segment">
      <div class="ui checkbox">
        <input id="layer-item-${index}" type="checkbox" ?checked=${config.visible} @change=${changeVisibility}>
        <label for="layer-item-${index}" data-i18n>${i18next.t(config.label)}</label>
      </div>
      ${config.setOpacity ?
        html`<input type="range" min="0" max="1" value=${config.opacity || 1} @input=${changeOpacity} step="0.05">`
        : ''
      }

    </div>
      `;
  });
  render(templates, target);
}

export function setupLayers(viewer, target) {
  doRender(viewer, target);
  i18next.on('languageChanged', options => {
    doRender(viewer, target);
  });
}
