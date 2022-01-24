import i18next from 'i18next';
import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n.js';
import {classMap} from 'lit-html/directives/class-map.js';
import {DEFAULT_LAYER_OPACITY, LayerType} from '../constants';
import $ from '../jquery.js';
import type {LayerTreeNode} from '../layertree';
import {styleMap} from 'lit/directives/style-map.js';
import {Sortable} from 'sortablejs';
import {showSnackbarInfo} from '../notifications';

export interface Config extends LayerTreeNode {
  add?: (number) => void;
  remove?: () => void;
  heightOffset?: number;
  load: () => Promise<any>;
  setVisibility?: (boolean) => void;
  setOpacity?: (number) => void;
  promise?: Promise<any>;
  notSaveToPermalink?: boolean;
  ownKml?: boolean;
}

@customElement('ngm-layers-item')
export class LayerTreeItem extends LitElementI18n {
  @property({type: Object}) actions: any;
  @property({type: Object}) config!: Config;
  @property({type: Boolean}) changeOrderActive = false;
  @state() loading = 0;
  @state() determinateLoading = false;
  @state() loadProgressRemover_: any;
  @state() movable = false;
  private toggleItemSelection = () => this.movable ? Sortable.utils.select(this) : Sortable.utils.deselect(this);

  firstUpdated() {
    $(this.querySelector('.ui.dropdown')).dropdown();
    if (!this.config.opacity) {
      this.config.opacity = DEFAULT_LAYER_OPACITY;
    }
  }

  updated(changedProps) {
    if (changedProps.has('changeOrderActive')) {
      this.updateMovableState();
    }
    super.updated(changedProps);
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.actions || !this.actions.listenForEvent) return;
    this.loading = 0;
    const callback = (pending, processing) => {
      const newValue = pending + processing;
      if (this.loading === 0 && newValue > 0) {
        setTimeout(() => {
          if (this.loading > 0) this.determinateLoading = true;
        }, 3000);
      } else if (newValue === 0) {
        this.determinateLoading = false;
      }
      this.loading = newValue;
    };
    this.loadProgressRemover_ = this.actions.listenForEvent(this.config, 'loadProgress', callback);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.loadProgressRemover_) {
      this.loadProgressRemover_();
    }
  }

  changeVisibility() {
    this.config.visible = !this.config.visible;
    this.actions.changeVisibility(this.config, this.config.visible);
    this.dispatchEvent(new CustomEvent('layerChanged'));
    // display visibility hint for subsurface layers
    if (this.config.visible
      && [LayerType.tiles3d, LayerType.earthquakes].includes(this.config.type!)) {
      const sidebar = <any> document.getElementsByTagName('ngm-side-bar')[0];
      if (sidebar.displayUndergroundHint
        && !sidebar.viewer?.scene.cameraUnderground) {
        showSnackbarInfo(i18next.t('lyr_subsurface_hint'));
        sidebar.displayUndergroundHint = false;
      }
    }
  }

  changeOpacity(event: Event) {
    const input = event.target as HTMLInputElement;
    this.config.opacity = Number(input.value);
    this.actions.changeOpacity(this.config, this.config.opacity);
    this.dispatchEvent(new CustomEvent('layerChanged'));
    this.requestUpdate();
  }

  onLabelClicked(evt) {
    const input = evt.target.previousElementSibling;
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change'));
  }

  onRemove() {
    this.dispatchEvent(new CustomEvent('removeDisplayedLayer'));
  }

  showLayerLegend(config: Config) {
    this.dispatchEvent(new CustomEvent('showLayerLegend', {
      bubbles: true,
      detail: {
        config
      }
    }));
  }

  get buttons() {
    return html`
      <div class="menu">
        ${this.config?.geocatId || this.config?.legend ? html`
          <div class="item"
               @click=${() => this.showLayerLegend(this.config)}>
            ${i18next.t('dtd_legend_geocat_hint')}
          </div>` : ''}
        ${this.config?.downloadUrl && this.config?.type !== LayerType.earthquakes ? html`
          <div class="item"
               @click=${() => window.open(this.config?.downloadUrl)}>
            ${i18next.t('dtd_download_hint')}
          </div>` : ''}
      </div>
    `;
  }

  updateMovableState() {
    // prevent select/deselect on click on item (not checkbox)
    if (this.changeOrderActive) {
      this.addEventListener('click', this.toggleItemSelection);
    } else {
      this.removeEventListener('click', this.toggleItemSelection);
      if (this.movable) {
        this.movable = false;
        Sortable.utils.deselect(this);
      }
    }
  }

  render() {
    return html`
      <div ?hidden=${!this.changeOrderActive || this.loading > 0} class="ngm-checkbox ${this.movable ? 'active' : ''}"
           @click=${() => this.movable = !this.movable}>
        <input type="checkbox" .checked=${this.movable}>
        <span class="ngm-checkbox-icon"></span>
      </div>

      <div ?hidden=${this.loading > 0 || this.changeOrderActive} class="ngm-layer-icon ${classMap({
        'ngm-visible-icon': !!this.config.visible,
        'ngm-invisible-icon': !this.config.visible
      })}" @click=${this.changeVisibility}>
      </div>
      <div ?hidden=${this.loading === 0} class="ngm-determinate-loader">
        <div
          class="ui inline mini loader ${classMap({active: this.loading > 0, determinate: this.determinateLoading})}">
        </div>
        <span ?hidden=${!this.determinateLoading} class="ngm-load-counter">${this.loading}</span>
      </div>
      <div class="ngm-displayed-slider">
        <label class="ngm-layer-label">
          <i class=${this.config.restricted ? 'lock icon' : ''}></i>
          ${i18next.t(this.config.label)} ${this.config.ownKml ? `(${i18next.t('dtd_own_kml_tag')})` : ''}
        </label>
        <label ?hidden=${!this.config.setOpacity}>${(this.config.opacity! * 100).toFixed()} %</label>
        <input type="range" class="ngm-slider" ?hidden=${!this.config.setOpacity}
               style="background-image: linear-gradient(to right, var(--ngm-interaction-active), var(--ngm-interaction-active) ${this.config.opacity! * 100}%, white ${this.config.opacity! * 100}%)"
               min=0 max=1 step=0.01
               .value=${this.config.opacity?.toString() || '1'}
               @input=${this.changeOpacity}/>
      </div>
      </div>
      <div .hidden=${!this.config.previewColor} class="ngm-displayed-color"
           style=${styleMap({backgroundColor: this.config.previewColor})}>
      </div>
      <div class="ngm-displayed-menu">
        <div class="ngm-layer-icon ngm-zoom-plus-icon" ?hidden=${!this.config.zoomToBbox}
             @mouseenter=${() => {
               if (this.actions && this.actions.showBoundingBox) this.actions.showBoundingBox(this.config);
             }}
             @mouseleave=${() => {
               if (this.actions && this.actions.hideBoundingBox) this.actions.hideBoundingBox();
             }}
             @click=${() => this.dispatchEvent(new CustomEvent('zoomTo'))}>
        </div>
        <div class="ngm-layer-icon ngm-delete-icon"
             @click=${this.onRemove}>
        </div>
        <div class="ui dropdown right pointing ngm-action-menu">
          <div class="ngm-layer-icon ngm-action-menu-icon"></div>
          ${this.buttons}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }

  cloneNode(deep) {
    const node = super.cloneNode(deep) as LayerTreeItem;
    node.config = this.config;
    node.actions = this.actions;
    return node;
  }
}
