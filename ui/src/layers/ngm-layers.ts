import {html, PropertyValues} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n.js';
import './ngm-layers-item';
import DashboardStore from '../store/dashboard';
import {LayerConfig} from '../layertree';

@customElement('ngm-layers')
export default class NgmLayers extends LitElementI18n {
  @property({type: Array})
  accessor layers: LayerConfig[] = [];
  @property({type: Object})
  accessor actions: any;

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('layers')) {
      // Don't show KML assets in project view mode
      const hasKmlAssets = this.layers.some(layer => layer.topicKml);
      if (hasKmlAssets && DashboardStore.projectMode.value) {
        this.layers = this.layers.filter(layer => !layer.topicKml);
      }
    }
  }

  createLayerTemplate(config: LayerConfig, idx: number, len: number) {
    idx = len - 1 - idx; // we want to create in reverse order
    if (!config.promise && config.load) {
      config.promise = config.load();
    }

    const detail = {
      config,
      idx
    };

    return html`
      <ngm-layers-item
        .actions=${this.actions}
        .config=${config}
        .changeOrderActive=${false}
        @removeDisplayedLayer=${() => {
          this.dispatchEvent(new CustomEvent('removeDisplayedLayer', {detail}));
        }}
        @zoomTo=${() => this.dispatchEvent(new CustomEvent('zoomTo', {detail: config}))}
        @layerChanged=${() => this.dispatchEvent(new CustomEvent('layerChanged', {detail: config}))}
      >
      </ngm-layers-item>
    `;
  }

  render() {
    const len = this.layers ? this.layers.length : 0;
    const reverse = [...this.layers].reverse();
    return html`${reverse.map((c, idx) => this.createLayerTemplate(c, idx, len))}`;
  }

  createRenderRoot() {
    return this;
  }
}
