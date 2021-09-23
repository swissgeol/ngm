import {html} from 'lit-element';

import {LitElementI18n} from '../i18n.js';
import i18next from 'i18next';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {showError, showWarning} from '../message';

export default class LayersUpload extends LitElementI18n {
  constructor() {
    super();
    this.uploadedLayers = [];
    this.actions = {
      changeVisibility: (config, visible) => this.changeVisibility(config, visible)
    };
  }

  static get properties() {
    return {
      viewer: {type: Object},
    };
  }

  createRenderRoot() {
    return this;
  }

  onLayerRemove(evt) {
    const source = evt.detail.config.promise;
    this.uploadedLayers = this.uploadedLayers.filter(c => c.promise.name !== source.name);
    this.viewer.dataSources.remove(source);
    this.viewer.scene.requestRender();
    this.requestUpdate();
  }

  changeVisibility(config, visible) {
    const source = this.viewer.dataSources.getByName(config.promise.name);
    source[0].show = visible;
    this.viewer.scene.requestRender();
  }

  async uploadKml(file) {
    if (!file) {
      showWarning(i18next.t('dtd_no_file_to_upload_warn'));
      return;
    }
    try {
      const kmlDataSource = await KmlDataSource.load(file, {
        camera: this.viewer.scene.camera,
        canvas: this.viewer.scene.canvas
      });
      const uploadedLayer = new CustomDataSource();
      let name = kmlDataSource.name;
      kmlDataSource.entities.values.forEach((ent, indx) => {
        if (indx === 0 && !name) {
          name = ent.name;
        }
        uploadedLayer.entities.add(ent);
      });
      // name used as id for datasource
      uploadedLayer.name = `${name}_${Date.now()}`;
      await this.viewer.dataSources.add(uploadedLayer);
      // done like this to have correct rerender of component
      this.uploadedLayers = [...this.uploadedLayers, {
        label: name,
        promise: uploadedLayer,
        zoomToBbox: true,
        hideUpDown: true,
        visible: true
      }];
      this.requestUpdate();
      this.viewer.zoomTo(uploadedLayer);
    } catch (e) {
      console.error(e);
      showError(i18next.t('dtd_cant_upload_kml_error'));
    }

  }

  render() {
    return html`
      <button data-position="top left"
              data-variation="mini"
              class="ui tiny fluid button ngm-add-own-kml-btn"
              @click="${() => this.querySelector('.ngm-upload-kml').click()}">
        ${i18next.t('dtd_add_own_kml')}
      </button>
      <input class="ngm-upload-kml" type='file' accept=".kml,.KML" hidden
             @change=${(e) => this.uploadKml(e.target ? e.target.files[0] : null)}/>
      ${this.uploadedLayers.length ? html`
        <ngm-layers
          @removeDisplayedLayer=${this.onLayerRemove}
          @zoomTo=${evt => this.viewer.zoomTo(evt.detail.promise)}
          .layers=${this.uploadedLayers}
          .actions=${this.actions}>
        </ngm-layers>` : ''}
    `;
  }
}

customElements.define('ngm-layers-upload', LayersUpload);