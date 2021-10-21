import {syncLayersParam} from '../permalink.js';
import {calculateRectangle, getBoxFromRectangle, calculateBox} from './helpers.js';
import {LAYER_TYPES} from '../constants';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Rectangle from 'cesium/Source/Core/Rectangle';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Color from 'cesium/Source/Core/Color';


export default class LayersAction {
  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;
    this.boundingBoxEntity = this.viewer.entities.add({
      position: Cartesian3.ZERO,
      show: false,
      box: {
        fill: false,
        dimensions: new Cartesian3(1, 1, 1),
        outline: true,
        outlineColor: Color.RED
      },
      rectangle: {
        material: Color.RED.withAlpha(0.3),
        coordinates: new Rectangle(0, 0, 0, 0)
      }
    });
  }

  changeVisibility(config, checked) {
    config.setVisibility(checked);
    config.visible = checked;
    this.viewer.scene.requestRender();
  }

  changeTransparency(config, value) {
    const transparency = Number(value);
    config.setTransparency(transparency);
    config.transparency = transparency;
    this.viewer.scene.requestRender();
  }

  async showBoundingBox(config) {
    const p = await config.promise;
    if (p.boundingRectangle) { // earthquakes
      this.boundingBoxEntity.position = Cartographic.toCartesian(Rectangle.center(p.boundingRectangle));
      this.boundingBoxEntity.box.dimensions = getBoxFromRectangle(p.boundingRectangle, p.maximumHeight);
      this.boundingBoxEntity.rectangle.coordinates = p.boundingRectangle;
      this.boundingBoxEntity.show = true;
      this.viewer.scene.requestRender();
    } else if (p.root && p.root.boundingVolume) {
      const boundingVolume = p.root.boundingVolume.boundingVolume;
      const boundingRectangle = p.root.boundingVolume.rectangle;
      this.boundingBoxEntity.position = boundingVolume.center;
      if (boundingRectangle) {
        this.boundingBoxEntity.box.dimensions = getBoxFromRectangle(boundingRectangle, p.root.boundingVolume.maximumHeight);
        this.boundingBoxEntity.rectangle.coordinates = boundingRectangle;
      } else {
        const boxSize = calculateBox(boundingVolume.halfAxes, p.root.boundingSphere.radius);
        this.boundingBoxEntity.box.dimensions = boxSize;
        this.boundingBoxEntity.rectangle.coordinates = calculateRectangle(boxSize.x, boxSize.y, boundingVolume.center);
      }
      this.boundingBoxEntity.show = true;
      this.viewer.scene.requestRender();
    }
  }

  hideBoundingBox() {
    if (this.boundingBoxEntity.show) {
      this.boundingBoxEntity.show = false;
      this.viewer.scene.requestRender();
    }
  }

  // changes layer position in 'Displayed Layers'
  moveLayer(layers, config, delta) {
    console.assert(delta === -1 || delta === 1);
    const previousIndex = layers.indexOf(config);
    const toIndex = previousIndex + delta;
    if (toIndex < 0 || toIndex > layers.length - 1) {
      // should not happen with proper UI
      return;
    }

    // Swap values
    const otherConfig = layers[toIndex];
    layers[toIndex] = layers[previousIndex];
    layers[previousIndex] = otherConfig;

    // FIXME: this is nonsensical, all imageries should be handled
    // permute imageries order
    if (config.type === LAYER_TYPES.swisstopoWMTS && otherConfig.type === LAYER_TYPES.swisstopoWMTS) {
      const imageries = this.viewer.scene.imageryLayers;
      config.promise.then(i => {
        if (delta < 0) {
          imageries.lower(i);
        } else {
          imageries.raise(i);
        }
      });
    }

    syncLayersParam(layers);
  }


  listenForEvent(config, eventName, callback) {
    const stuff = config.promise; // yes, this is not a promise !
    if (stuff[eventName]) {
      console.debug('Adding event', eventName, 'on', config.layer);
      stuff[eventName].addEventListener(callback);
    }
  }
}
