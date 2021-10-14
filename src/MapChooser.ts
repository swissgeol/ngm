import {getMapParam, syncMapParam} from './permalink.js';
import i18next from 'i18next';
import {Viewer} from 'cesium';
import {NgmMapChooser} from './elements/ngm-map-chooser';
import {BaseLayerConfig} from './viewer';

export default class MapChooser {
  private viewer: Viewer;
  private config: BaseLayerConfig[];
  public selectedMap: BaseLayerConfig;
  public elements: NgmMapChooser[] = [];

  constructor(viewer, config) {
    this.viewer = viewer;
    this.config = config;
    this.selectedMap = this.getInitialMap();

    i18next.on('languageChanged', () => {
      this.elements.forEach(el => el.choices = this.choices);
    });
  }

  addMapChooser(element) {
    this.elements.push(element);
    element.choices = this.choices;
    element.active = this.selectedMap;
    element.addEventListener('change', (event) => this.selectMap((<CustomEvent>event).detail.active.id));
  }

  getInitialMap(): BaseLayerConfig {
    const mapId = getMapParam();
    const mapConfig = this.config.find(map => map.id === mapId);
    if (mapConfig) {
      return mapConfig;
    } else {
      return this.config.find(map => map.default === true) || this.config[0];
    }
  }

  selectMap(activeId: string) {
    const mapConfig = this.config.find(map => map.id === activeId);
    if (mapConfig) {
      this.elements.forEach(el => el.active = mapConfig);
      this.selectedMap.layers && this.selectedMap.layers.forEach(layer => layer.show = false);
      mapConfig.layers && mapConfig.layers.forEach(layer => layer.show = true);
      this.selectedMap = mapConfig;
      this.viewer.scene.requestRender();
      syncMapParam(mapConfig.id);
    }
  }

  get choices(): BaseLayerConfig[] {
    return this.config.map(map => {
      const choice = {...map, labelKey: i18next.t(map.labelKey)};
      delete choice.layers;
      return choice;
    });
  }
}