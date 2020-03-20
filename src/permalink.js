import Math from 'cesium/Core/Math.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';

import {getURLSearchParams, setURLSearchParams} from './utils.js';
import {
  LAYERS_OPACITY_URL_PARAM,
  LAYERS_URL_PARAM,
  LAYERS_VISIBILITY_URL_PARAM,
  ASSET_IDS_URL_PARAM
} from './constants.js';

export function getCameraView() {
  let destination;
  let orientation;

  const params = getURLSearchParams();

  const lon = params.get('lon');
  const lat = params.get('lat');
  const elevation = params.get('elevation');
  if (lon !== null && lat !== null && elevation !== null) {
    destination = Cartesian3.fromDegrees(parseFloat(lon), parseFloat(lat), parseFloat(elevation));
  }
  const heading = params.get('heading');
  const pitch = params.get('pitch');
  if (heading !== null && pitch !== null) {
    orientation = {
      heading: Math.toRadians(parseFloat(heading)),
      pitch: Math.toRadians(parseFloat(pitch)),
      roll: 0
    };
  }
  return {destination, orientation};
}


export function syncCamera(camera) {
  const params = getURLSearchParams();
  const position = camera.positionCartographic;
  params.set('lon', Math.toDegrees(position.longitude).toFixed(5));
  params.set('lat', Math.toDegrees(position.latitude).toFixed(5));
  params.set('elevation', position.height.toFixed(0));
  params.set('heading', Math.toDegrees(camera.heading).toFixed(0));
  params.set('pitch', Math.toDegrees(camera.pitch).toFixed(0));
  setURLSearchParams(params);
}

function safeSplit(str) {
  return str ? str.split(',') : [];
}

/**
 * Parses the URL and returns an array of layer configs.
 */
export function getLayerParams() {
  const params = getURLSearchParams();
  const layersOpacity = safeSplit(params.get(LAYERS_OPACITY_URL_PARAM));
  const layersVisibility = safeSplit(params.get(LAYERS_VISIBILITY_URL_PARAM));
  const layers = safeSplit(params.get(LAYERS_URL_PARAM));

  return layers.map((layer, key) => {
    return {
      name: layer,
      opacity: Number(layersOpacity[key]),
      visible: layersVisibility[key] === 'true',
    };
  });
}

export function getAssetIds() {
  const params = getURLSearchParams();
  return safeSplit(params.get(ASSET_IDS_URL_PARAM));
}

export function syncLayersParam(activeLayers) {
  const params = getURLSearchParams();
  const layerNames = [];
  const layersOpacity = [];
  const layersVisibility = [];
  activeLayers.forEach(l => {
    layerNames.push(l.layer);
    layersOpacity.push(isNaN(l.opacity) ? 1 : l.opacity);
    layersVisibility.push(l.visible);
  });

  if (layerNames.length) {
    params.set(LAYERS_URL_PARAM, layerNames.join(','));
    params.set(LAYERS_VISIBILITY_URL_PARAM, layersVisibility.join(','));
    params.set(LAYERS_OPACITY_URL_PARAM, layersOpacity.join(','));
  } else {
    params.delete(LAYERS_URL_PARAM);
    params.delete(LAYERS_OPACITY_URL_PARAM);
    params.delete(LAYERS_VISIBILITY_URL_PARAM);
  }

  const assetParams = getAssetIds();

  if (assetParams.length) {
    const assetIds = assetParams.filter(id => activeLayers.find(l => l.assetId === id && l.displayed));
    if (assetIds.length) {
      params.set(ASSET_IDS_URL_PARAM, assetIds.join(','));
    } else {
      params.delete(ASSET_IDS_URL_PARAM);
    }
  }

  setURLSearchParams(params);
}

export function isLabelOutlineEnabled() {
  const params = getURLSearchParams();
  return params.get('labelOutline') === 'true';
}
