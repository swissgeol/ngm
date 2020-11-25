import {LitElement, html} from 'lit-element';
import {I18nMixin} from '../i18n.js';
import '../toolbox/AreaOfInterestDrawer.js';
import '../layers/ngm-layers.js';
import '../layers/ngm-catalog.js';
import LayersActions from '../layers/LayersActions.js';
import {DEFAULT_LAYER_TRANSPARENCY, LAYER_TYPES} from '../constants.js';
import defaultLayerTree from '../layertree.js';
import {getLayerParams, syncLayersParam, getAssetIds, getAttribute} from '../permalink.js';
import {createCesiumObject} from '../layers/helpers.js';
import i18next from 'i18next';
import 'fomantic-ui-css/components/accordion.js';
import $ from '../jquery.js';
import './ngm-map-configuration.js';
import QueryManager from '../query/QueryManager.js';
import {getZoomToPosition} from '../permalink';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import SceneTransforms from 'cesium/Source/Scene/SceneTransforms';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';
import {showWarning} from '../message';

const WELCOME_PANEL = 'welcome-panel';
const TOOLBOX = 'ngm-toolbox';

class LeftSideBar extends I18nMixin(LitElement) {

  static get properties() {
    return {
      viewer: {type: Object},
      zoomTo: {type: Function},
      catalogLayers: {type: Object},
      activeLayers: {type: Object},
      hideWelcome: {type: Boolean},
      mapChooser: {type: Function},
      authenticated: {type: Boolean},
      globeQueueLength_: {type: Number},
    };
  }

  render() {
    if (!this.viewer) {
      return '';
    }

    this.queryManager.activeLayers = this.activeLayers
      .filter(config => config.visible)
      .map(config => config.layer);

    return html`
      <div class="ui styled accordion" id="${WELCOME_PANEL}">
        <div class="title ${!this.hideWelcome ? 'active' : ''}">
          <i class="dropdown icon"></i>
          ${i18next.t('welcome_label')}
        </div>
        <div class="content ${!this.hideWelcome ? 'active' : ''}">
          <div>${i18next.t('welcome_text')}</div>
          <div class="ui tertiary center aligned segment">
            <i class="ui lightbulb icon"></i>
            ${i18next.t('welcome_instructions')}
          </div>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title ngmlightgrey active">
          <i class="dropdown icon"></i>
          ${i18next.t('lyr_geocatalog_label')}
        </div>
        <div class="content ngm-layer-content active">
          <ngm-catalog
            .layers=${this.catalogLayers}
            .authenticated=${this.authenticated}
            @layerclick=${this.onCatalogLayerClicked}
          >
          </ngm-catalog>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title ngmverylightgrey active">
          <i class="dropdown icon"></i>
          ${i18next.t('dtd_displayed_data_label')}
        </div>
        <div class="content active">
          <ngm-layers
            @removeDisplayedLayer=${this.onRemoveDisplayedLayer}
            @layerChanged=${this.onLayerChanged}
            .authenticated=${this.authenticated}
            .layers=${this.activeLayers}
            .actions=${this.layerActions}
            @zoomTo=${evt => this.zoomTo(evt.detail)}>
          </ngm-layers>
          <h4 class="ui horizontal divider ngm-background-divider">
            ${i18next.t('dtd_background_map_label')}
            <div class="ui ${this.globeQueueLength_ > 0 ? 'active' : ''} inline mini loader">
              <span class="small_load_counter">${this.globeQueueLength_}</span>
            </div>
          </h4>
           <ngm-map-configuration .viewer=${this.viewer} .mapChooser=${this.mapChooser}></ngm-map-configuration>
        </div>
      </div>

      <div class="ui styled accordion" id="${TOOLBOX}">
        <div class="title ngmmidgrey">
          <i class="dropdown icon"></i>
          ${i18next.t('tbx_toolbox_label')}
        </div>
        <div class="content">
          <ngm-aoi-drawer .viewer=${this.viewer}></ngm-aoi-drawer>
        </div>
      </div>

      <div class="ui styled accordion">
        <div class="title ngmmidgrey">
          <i class="dropdown icon"></i>
          ${i18next.t('external_tools_label')}
        </div>
        <div class="content">
          <div class="ui link list">
            <a class="item" target="_blank" href="https://swissforages.ch/">
             <button class="ui icon button">
               <i class="pencil ruler icon"></i>
             </button>
             swissforages.ch
            </a>
            <a class="item" target="_blank" href="https://www.strati.ch/">
             <button class="ui icon button">
               <i class="receipt icon"></i>
             </button>
             strati.ch
            </a>
          </div>
        </div>
      </div>
    `;
  }

  initializeActiveLayers() {
    const attributeParams = getAttribute();
    const callback = attributeParams ?
      this.getTileLoadCallback(attributeParams.attributeKey, attributeParams.attributeValue) :
      undefined;
    const flatLayers = this.getFlatLayers(this.catalogLayers, callback);

    const urlLayers = getLayerParams();
    const assetIds = getAssetIds();

    if (!urlLayers.length && !assetIds.length) {
      this.activeLayers = flatLayers.filter(l => l.displayed);
      syncLayersParam(this.activeLayers);
      return;
    }

    // First - make everything hidden
    flatLayers.forEach(l => {
      l.visible = false;
      l.displayed = false;
    });

    const activeLayers = [];
    urlLayers.forEach(urlLayer => {
      let layer = flatLayers.find(fl => fl.layer === urlLayer.name);
      if (!layer) {
        // Layers from the search are not present in the flat layers.
        layer = this.createSearchLayer(urlLayer.name, urlLayer.name);
      }
      layer.visible = urlLayer.visible;
      layer.transparency = urlLayer.transparency;
      layer.displayed = true;
      activeLayers.push(layer);
    });

    assetIds.forEach(assetId => {
      const layer = {
        type: LAYER_TYPES.tiles3d,
        assetId: assetId,
        label: assetId,
        layer: assetId,
        visible: true,
        displayed: true,
        transparencyDisabled: true,
        pickable: true,
        customAsset: true
      };
      layer.load = () => layer.promise = createCesiumObject(this.viewer, layer);
      activeLayers.push(layer);
    });

    this.activeLayers = activeLayers;
    syncLayersParam(this.activeLayers);
  }

  getTileLoadCallback(attributeKey, attributeValue) {
    return (tile, removeTileLoadListener) => {
      const content = tile.content;
      const featuresLength = content.featuresLength;
      for (let i = 0; i < featuresLength; i++) {
        const feature = content.getFeature(i);
        if (feature.getProperty(attributeKey) === attributeValue) {
          removeTileLoadListener();
          this.searchedFeature = feature;
          return;
        }
      }
    };
  }

  update(changedProperties) {
    if (this.viewer && !this.layerActions) {
      this.layerActions = new LayersActions(this.viewer);
      // Handle queries (local and Swisstopo)
      this.queryManager = new QueryManager(this.viewer);
      if (!this.catalogLayers) {
        this.catalogLayers = [...defaultLayerTree];
        this.initializeActiveLayers();
      }
      this.viewer.scene.globe.tileLoadProgressEvent.addEventListener(queueLength => {
        this.globeQueueLength_ = queueLength;
      });
    }
    if (this.searchedFeature) {
      this.queryManager.selectTile(this.searchedFeature);
      this.searchedFeature = undefined;
    }
    super.update(changedProperties);
  }

  updated(changedProperties) {
    if (!this.accordionInited) {
      this.initBarAccordions();
    }

    if (changedProperties.has('authenticated') && !this.authenticated) {
      // user logged out, remove restricted layers.
      const restricted = this.activeLayers.filter(config => config.restricted);
      restricted.forEach(config => {
        const idx = this.activeLayers.indexOf(config);
        this.activeLayers.splice(idx, 1);
        this.removeLayer(config);
      });
    }

    super.updated(changedProperties);
  }

  async onCatalogLayerClicked(evt) {
    // toggle whether the layer is displayed or not (=listed in the side bar)
    const layer = evt.detail.layer;
    if (layer.displayed) {
      if (layer.visible) {
        layer.displayed = false;
        layer.visible = false;
        layer.remove && layer.remove();
        const idx = this.activeLayers.findIndex(l => l === layer);
        this.activeLayers.splice(idx, 1);
      } else {
        layer.visible = true;
      }
    } else {
      await (layer.promise || (layer.promise = createCesiumObject(this.viewer, layer)));
      layer.add && layer.add();
      layer.visible = true;
      layer.displayed = true;
      this.activeLayers.push(layer);
      this.dispatchEvent(new CustomEvent('layeradded', {
        detail: {
          layer
        }
      }));
    }
    layer.setVisibility && layer.setVisibility(layer.visible);

    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.viewer.scene.requestRender();
  }

  onLayerChanged() {
    this.catalogLayers = [...this.catalogLayers];
    syncLayersParam(this.activeLayers);
  }

  onRemoveDisplayedLayer(evt) {
    const {config, idx} = evt.detail;
    this.activeLayers.splice(idx, 1);
    this.removeLayer(config);
  }

  removeLayer(config) {
    config.setVisibility(false);
    config.visible = false;
    config.displayed = false;
    if (config.remove) {
      config.remove();
    }
    this.viewer.scene.requestRender();
    syncLayersParam(this.activeLayers);
    this.catalogLayers = [...this.catalogLayers];
    this.activeLayers = [...this.activeLayers];
    this.requestUpdate();
  }

  getFlatLayers(tree, tileLoadCallback) {
    const flat = [];
    for (const layer of tree) {
      if (layer.children) {
        flat.push(...this.getFlatLayers(layer.children, tileLoadCallback));
      } else {
        layer.load = () =>
          layer.promise = createCesiumObject(this.viewer, layer, tileLoadCallback);
        flat.push(layer);
      }
    }
    return flat;
  }

  // adds layer from search to 'Displayed Layers'
  addLayerFromSearch(searchLayer) {
    let layer;
    if (searchLayer.dataSourceName) {
      layer = this.activeLayers.find(l => l.type === searchLayer.dataSourceName); // check for layers like earthquakes
    } else {
      layer = this.activeLayers.find(l => l.layer === searchLayer.layer); // check for swisstopoWMTS layers
    }

    if (layer) { // for layers added before
      if (layer.type === LAYER_TYPES.swisstopoWMTS) {
        const index = this.activeLayers.indexOf(layer);
        this.activeLayers.splice(index, 1);
        layer.remove();
        layer.add(0);
        this.activeLayers.push(layer);
      }
      layer.setVisibility(true);
      layer.visible = true;
      layer.displayed = true;
      this.viewer.scene.requestRender();
    } else { // for new layers
      this.activeLayers.push(this.createSearchLayer(searchLayer.title, searchLayer.layer));
    }
    this.activeLayers = [...this.activeLayers];
    syncLayersParam(this.activeLayers);
    this.requestUpdate();
  }

  createSearchLayer(title, layer) {
    const config = {
      type: LAYER_TYPES.swisstopoWMTS,
      label: title,
      layer: layer,
      visible: true,
      displayed: true,
      transparency: DEFAULT_LAYER_TRANSPARENCY
    };
    config.load = () => config.promise = createCesiumObject(this.viewer, config);
    return config;
  }

  accordionFactory(element) {
    switch (element.id) {
      case WELCOME_PANEL: {
        accordion(element, {
          onChange: () => this.dispatchEvent(new CustomEvent('welcome_panel_changed'))
        });
        break;
      }
      case TOOLBOX: {
        accordion(element, {
          animateChildren: false,
          onClosing: () => {
            const aoiElement = this.querySelector('ngm-aoi-drawer');
            aoiElement.cancelDraw();
          },
          onOpening: () => {
            const aoiElement = this.querySelector('ngm-aoi-drawer');
            aoiElement.cancelDraw();
          }
        });
        break;
      }
      default:
        accordion(element);
    }
  }

  initBarAccordions() {
    const sideBarElement = document.querySelector('ngm-left-side-bar');

    for (let i = 0; i < sideBarElement.childElementCount; i++) {
      const element = sideBarElement.children.item(i);
      if (element.classList.contains('accordion')) {
        this.accordionFactory(element);
      }
    }

    this.accordionInited = true;
  }

  zoomToPermalinkObject() {
    const zoomToPosition = getZoomToPosition();
    if (zoomToPosition) {
      let altitude = this.viewer.scene.globe.getHeight(this.viewer.scene.camera.positionCartographic) || 0;
      const cartesianPosition = Cartesian3.fromDegrees(zoomToPosition.longitude, zoomToPosition.latitude, zoomToPosition.height + altitude);
      const completeCallback = () => {
        const windowPosition = SceneTransforms.wgs84ToWindowCoordinates(this.viewer.scene, cartesianPosition);
        if (windowPosition) {
          let maxTries = 25;
          let triesCounter = 0;
          const eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
          eventHandler.setInputAction(event => maxTries = 0, ScreenSpaceEventType.LEFT_DOWN);
          // Waits while will be possible to select an object
          const tryToSelect = () => setTimeout(() => {
            const currentAltitude = this.viewer.scene.globe.getHeight(this.viewer.scene.camera.positionCartographic) || 0;
            if (altitude !== currentAltitude) {
              altitude = currentAltitude;
              const cartesianPosition = Cartesian3.fromDegrees(zoomToPosition.longitude, zoomToPosition.latitude, zoomToPosition.height + altitude);
              this.zoomToObjectCoordinates(cartesianPosition);
            }
            triesCounter += 1;
            this.queryManager.pickObject(windowPosition);
            if (!this.queryManager.objectSelector.selectedObj && triesCounter <= maxTries) {
              tryToSelect();
            } else {
              eventHandler.destroy();
              if (triesCounter > maxTries) {
                showWarning(i18next.t('dtd_object_on_coordinates_not_found_warning'));
              }
            }
          }, 500);
          tryToSelect();
        }

      };
      this.zoomToObjectCoordinates(cartesianPosition, completeCallback);
    }
  }

  zoomToObjectCoordinates(center, complete) {
    const boundingSphere = new BoundingSphere(center, 1000);
    const zoomHeadingPitchRange = new HeadingPitchRange(0, Math.PI / 8, boundingSphere.radius);
    this.viewer.scene.camera.flyToBoundingSphere(boundingSphere, {
      duration: 0,
      offset: zoomHeadingPitchRange,
      complete: complete
    });
  }

  createRenderRoot() {
    return this;
  }
}

function accordion(element, options = {}) {
  return $(element).accordion(Object.assign({
    duration: 150
  }, options));
}


customElements.define('ngm-left-side-bar', LeftSideBar);
