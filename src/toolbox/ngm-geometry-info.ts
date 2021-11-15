import {LitElementI18n} from '../i18n';
import {customElement, state} from 'lit/decorators.js';
import {html, PropertyValues} from 'lit';
import draggable from '../elements/draggable';
import {Cartographic, Entity, Viewer} from 'cesium';
import MainStore from '../store/main';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {AOI_DATASOURCE_NAME} from '../constants';
import ToolboxStore from '../store/toolbox';
import i18next from 'i18next';
import {getValueOrUndefined} from '../cesiumutils';
import {NgmGeometry} from './interfaces';
import {classMap} from 'lit-html/directives/class-map.js';
import {downloadGeometry, hideVolume, updateEntityVolume} from './helpers';
import './ngm-geometry-edit';
import {styleMap} from 'lit/directives/style-map.js';
import {showSnackbarConfirmation} from '../notifications';

@customElement('ngm-geometry-info')
export class NgmGeometryInfo extends LitElementI18n {
  @state() geomEntity: Entity | undefined;
  @state() editing = false;
  private viewer: Viewer | null = null;
  private geometriesDataSource: CustomDataSource | undefined;
  private geometry: NgmGeometry | undefined;
  private enableSlicingOnRender = false;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
    ToolboxStore.openedGeometryOptions.subscribe(options => {
      if (this.viewer && !this.geometriesDataSource)
        this.geometriesDataSource = this.viewer.dataSources.getByName(AOI_DATASOURCE_NAME)[0];
      if (!options?.id) {
        this.geomEntity = undefined;
        return;
      }
      const entity = this.geometriesDataSource?.entities.getById(options.id);
      if (!entity) return;
      this.geomEntity = entity;
      this.editing = !!options.editing;
    });
    ToolboxStore.sliceGeometry.subscribe(() => this.requestUpdate());
  }

  protected updated(_changedProperties: PropertyValues) {
    if (this.enableSlicingOnRender) {
      ToolboxStore.setSliceGeometry(this.geometry);
      this.enableSlicingOnRender = false;
    }
    super.updated(_changedProperties);
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  toggleGeomVolume(geom: NgmGeometry) {
    if (geom.volumeShowed) {
      hideVolume(this.geomEntity!);
    } else {
      updateEntityVolume(this.geomEntity!, this.viewer!.scene.globe);
    }
    this.requestUpdate();
  }

  onEditClick() {
    const updateOptions = () => ToolboxStore.setOpenedGeometryOptions({
      id: this.geomEntity!.id,
      editing: !this.editing
    });
    if (this.editing)
      showSnackbarConfirmation(i18next.t('tbx_lost_changes_warning'), {onApprove: updateOptions});
    else {
      ToolboxStore.setSliceGeometry(null);
      updateOptions();
    }
  }

  onSliceClick() {
    if (this.editing) {
      showSnackbarConfirmation(i18next.t('tbx_lost_changes_warning'), {
        onApprove: () => {
          hideVolume(this.geomEntity!);
          this.editing = false;
          this.enableSlicingOnRender = true;
        }
      });
    } else {
      hideVolume(this.geomEntity!);
      ToolboxStore.setSliceGeometry(this.geometry);
    }
  }

  onClose() {
    const updateOptions = () => ToolboxStore.setOpenedGeometryOptions(null);
    if (this.editing)
      showSnackbarConfirmation(i18next.t('tbx_lost_changes_warning'), {onApprove: updateOptions});
    else
      updateOptions();
  }

  getHeight(geom: NgmGeometry) {
    const height = geom.type === 'point' ? Cartographic.fromCartesian(geom.positions[0]).height : geom.volumeHeightLimits?.height;
    return height ? height.toFixed() : '';
  }

  get infoTemplate() {
    const geom: NgmGeometry | undefined = this.geometry;
    if (!geom) return;
    return html`
      <div>
        <button class="ui button ngm-download-obj-btn ngm-action-btn"
                @click=${() => downloadGeometry(this.geometriesDataSource?.entities.getById(geom.id!))}>
          ${i18next.t('tbx_download_btn_label')}
          <div class="ngm-download-icon"></div>
        </button>
        <button @click="${() => ToolboxStore.nextGeometryAction({id: geom.id!, action: 'zoom'})}"
                class="ui button ngm-zoom-obj-btn ngm-action-btn">
          ${i18next.t('obj_info_zoom_to_object_btn_label')}
          <div class="ngm-zoom-plus-icon"></div>
        </button>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-geom-info-content">
        <div class="ngm-geom-description">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_description_label')}</div>
          <div class="ngm-geom-info-value">${geom.description || ''}</div>
        </div>
        <div class="ngm-geom-img">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_image_label')}</div>
          <div ?hidden=${!geom.image} class="ngm-geom-info-value"><img src="${geom.image}" alt="${geom.image}"></div>
        </div>
        <div class="ngm-geom-website">
          <div class="ngm-geom-info-label">${i18next.t('obj_info_website_label')}</div>
          <div ?hidden=${!geom.website} class="ngm-geom-info-value">
            <a href=${geom.website} target="_blank">${geom.website}</a>
          </div>
        </div>
        <div ?hidden=${!geom.volumeShowed} class="ngm-geom-limits">
          <div ?hidden=${geom.type === 'point'}>
            <div class="ngm-geom-info-label">${i18next.t('tbx_volume_lower_limit_label')}</div>
            <div class="ngm-geom-info-value">${geom.volumeHeightLimits?.lowerLimit.toFixed() || '-'} m</div>
          </div>
          <div>
            <div class="ngm-geom-info-label">${i18next.t('tbx_volume_height_label')}</div>
            <div class="ngm-geom-info-value">${this.getHeight(geom)} m</div>
          </div>
          <div ?hidden=${geom.type !== 'point'}>
            <div class="ngm-geom-info-label">${i18next.t('tbx_point_depth_label')}</div>
            <div class="ngm-geom-info-value">${geom.depth?.toFixed() || '-'} m</div>
          </div>
        </div>
        <div ?hidden=${geom.type === 'point' || geom.type === 'line'}>
          <div class="ngm-geom-info-label">${i18next.t('obj_info_area_label')}</div>
          <div class="ngm-geom-info-value">${geom.area || '-'} km²</div>
        </div>
        <div ?hidden=${geom.type === 'point'}>
          <div class="ngm-geom-info-label">
            ${geom.type === 'line' ? i18next.t('obj_info_length_label') : i18next.t('obj_info_perimeter_label')}
          </div>
          <div class="ngm-geom-info-value">${geom.perimeter || '-'} km</div>
        </div>
        <div ?hidden=${geom.type === 'point'}>
          <div class="ngm-geom-info-label">${i18next.t('obj_info_number_segments_label')}</div>
          <div class="ngm-geom-info-value">${geom.numberOfSegments || ''}</div>
        </div>
        <div>
          ${geom.pointSymbol ?
            html`
              <div
                class="ngm-geom-symbol"
                style=${styleMap({
                  '-webkit-mask-image': `url('${geom.pointSymbol}')`,
                  'mask-image': `url('${geom.pointSymbol}')`,
                  backgroundColor: geom.color?.toCssColorString()
                })}></div>` :
            html`
              <div class="ngm-geom-color"
                   style=${styleMap({background: geom.color?.withAlpha(1).toCssColorString()})}>
              </div>`
          }
        </div>
      </div>
    `;
  }

  render() {
    this.hidden = !this.geomEntity;
    if (!this.geomEntity) return '';
    this.geometry = ToolboxStore.openedGeometry;
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${`${i18next.t('tbx_geometry')} ${getValueOrUndefined(this.geomEntity.properties!.type)}`}
        <div class="ngm-close-icon" @click=${() => this.onClose()}></div>
      </div>
      <div class="ngm-geom-info-body">
        ${`${this.geomEntity.name}`}
        <div class="ngm-geom-actions">
          <div
            class="ngm-slicing-icon ${classMap({active: ToolboxStore.geomSliceActive})}"
            @click=${() => this.onSliceClick()}></div>
          <div class="ngm-extrusion-icon ${classMap({active: !!this.geometry?.volumeShowed})}"
               @click=${() => this.toggleGeomVolume(this.geometry!)}></div>
          <div class="ngm-edit-icon ${classMap({active: this.editing})}"
               @click=${() => this.onEditClick()}>
          </div>
        </div>
        <div class="ngm-divider"></div>
        ${this.editing ?
          html`
            <ngm-geometry-edit .entity=${this.geomEntity}></ngm-geometry-edit>` :
          this.infoTemplate
        }
      </div>
      <div class="ngm-drag-area drag-handle">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
