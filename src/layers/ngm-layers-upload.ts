import {html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n.js';
import i18next from 'i18next';
import KmlDataSource from 'cesium/Source/DataSources/KmlDataSource';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {showSnackbarError, showSnackbarInfo} from '../notifications';
import {DEFAULT_LAYER_OPACITY} from '../constants';
import {Config} from './ngm-layers-item';
import $ from '../jquery.js';
import Viewer from 'cesium/Source/Widgets/Viewer/Viewer';
import {classMap} from 'lit-html/directives/class-map.js';

@customElement('ngm-layers-upload')
export default class LayersUpload extends LitElementI18n {
  @property({type: Object}) viewer!: Viewer;
  @state() uploadedLayers: Config[] = [];
  @state() actions: any;
  @state() loading = false;

  constructor() {
    super();
    this.actions = {
      changeVisibility: (config: Config, visible: boolean) => this.changeVisibility(config, visible)
    };
  }

  onLayerRemove(evt) {
    const source = evt.detail.config.promise;
    this.uploadedLayers = this.uploadedLayers.filter(c => c.promise.name !== source.name);
    this.viewer.dataSources.remove(source);
    this.viewer.scene.requestRender();
    this.requestUpdate();
  }

  changeVisibility(config: Config, visible: boolean) {
    const source = this.viewer.dataSources.getByName(config.promise.name);
    source[0].show = visible;
    this.viewer.scene.requestRender();
  }

  async uploadKml(file: File) {
    if (!file) {
      showSnackbarInfo(i18next.t('dtd_no_file_to_upload_warn'));
    } else if (!file.name.toLowerCase().endsWith('kml')) {
      showSnackbarInfo(i18next.t('dtd_file_not_kml'));
    } else {
      try {
        this.loading = true;
        const kmlDataSource = await KmlDataSource.load(file, {
          camera: this.viewer.scene.camera,
          canvas: this.viewer.scene.canvas
        });
        const uploadedLayer = new CustomDataSource();
        let name = kmlDataSource.name;
        kmlDataSource.entities.values.forEach((ent, indx) => {
          if (indx === 0 && !name) {
            name = ent.name!;
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
          visible: true,
          opacity: DEFAULT_LAYER_OPACITY
        }];
        this.requestUpdate();
        await this.viewer.zoomTo(uploadedLayer);
        (<HTMLInputElement> this.querySelector('.ngm-upload-kml')).value = '';
        this.loading = false;
      } catch (e) {
        this.loading = false;
        console.error(e);
        showSnackbarError(i18next.t('dtd_cant_upload_kml_error'));
      }
    }
  }

  onDrop(event: DragEvent) {

    event.preventDefault();
    $(event.target).removeClass('active');

    for (const file of event.dataTransfer!.files) {
      this.uploadKml(file);
    }
  }

  render() {
    return html`
      <button class="ngm-upload-kml-btn" @click="${() => $(this.querySelector('.ngm-upload-kml')).click()}"
              @drop="${this.onDrop}"
              @dragenter=${(event: DragEvent) => $(event.target).addClass('active')}
              @dragover="${(event: DragEvent) => event.preventDefault()}"
              @dragleave=${(event: DragEvent) => $(event.target).removeClass('active')}>
        ${i18next.t('dtd_add_own_kml')}
        <div ?hidden=${this.loading} class="ngm-layer-icon ngm-file-upload-icon"></div>
        <div
          class="ui inline mini loader ${classMap({active: this.loading})}">
        </div>
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

  createRenderRoot() {
    return this;
  }
}
