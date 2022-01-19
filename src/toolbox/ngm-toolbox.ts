import {html} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import './ngm-draw-tool';
import './ngm-slicer';
import './ngm-geometries-list';
import './ngm-draw-section';
import i18next from 'i18next';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {DEFAULT_AOI_COLOR, GEOMETRY_DATASOURCE_NAME} from '../constants';
import MainStore from '../store/main';
import type {Viewer} from 'cesium';
import {JulianDate} from 'cesium';
import LocalStorageController from '../LocalStorageController';
import ToolboxStore from '../store/toolbox';
import {getValueOrUndefined} from '../cesiumutils';
import type {NgmGeometry} from './interfaces';
import {getAreaPositions, updateBoreholeHeights, updateEntityVolume} from './helpers';
import {getSliceParam} from '../permalink';
import {CesiumDraw} from '../draw/CesiumDraw';
import DrawStore from '../store/draw';
import {GeometryController} from './GeometryController';

@customElement('ngm-tools')
export class NgmToolbox extends LitElementI18n {
  @property({type: Boolean}) toolsHidden = true;
  @property() activeTool: 'draw' | 'slicing' | 'gst' | 'data-download' | undefined;
  @state() sectionImageUrl: string | undefined;
  @query('.ngm-toast-placeholder') toastPlaceholder;
  @query('ngm-slicer') slicerElement;
  geometriesDataSource: CustomDataSource = new CustomDataSource(GEOMETRY_DATASOURCE_NAME);
  private viewer: Viewer | null = null;
  private julianDate = new JulianDate();
  private draw: CesiumDraw | undefined;
  private geometryController: GeometryController | undefined;

  constructor() {
    super();
    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
      this.viewer?.dataSources.add(this.geometriesDataSource);
      this.geometriesDataSource!.entities.collectionChanged.addEventListener((_collection) => {
        LocalStorageController.setAoiInStorage(this.entitiesList);
        ToolboxStore.setGeometries(this.entitiesList);
        this.viewer!.scene.requestRender();
        this.requestUpdate();
      });
      if (this.viewer) {
        this.draw = new CesiumDraw(this.viewer, 'polygon', {
          fillColor: DEFAULT_AOI_COLOR
        });
        this.draw.active = false;
        this.draw.addEventListener('statechanged', (evt) => {
          DrawStore.setDrawState((<CustomEvent>evt).detail.active);
          this.requestUpdate();
          this.viewer!.scene.requestRender();
        });
        this.draw.addEventListener('leftdown', () => {
          const volumeShowedProp = getValueOrUndefined(this.draw!.entityForEdit.properties.volumeShowed);
          const type = getValueOrUndefined(this.draw!.entityForEdit.properties.type);
          if (volumeShowedProp && type !== 'point') {
            this.draw!.entityForEdit.polylineVolume.show = false; // to avoid jumping when mouse over entity
            this.viewer!.scene.requestRender();
          }
        });
        this.draw.addEventListener('leftup', () => {
          if (getValueOrUndefined(this.draw!.entityForEdit.properties.type) === 'point') {
            updateBoreholeHeights(this.draw!.entityForEdit, this.julianDate);
          } else if (getValueOrUndefined(this.draw!.entityForEdit.properties.volumeShowed)) {
            updateEntityVolume(this.draw!.entityForEdit, this.viewer!.scene.globe);
          }
        });
        DrawStore.setDraw(this.draw);
      }
    });
  }

  firstUpdated() {
    const sliceOptions = getSliceParam();
    if (sliceOptions && sliceOptions.type && sliceOptions.slicePoints)
      this.activeTool = 'slicing';
  }

  updated() {
    if (!this.geometryController && this.viewer && this.toastPlaceholder)
      this.geometryController = new GeometryController(this.geometriesDataSource, this.toastPlaceholder);
  }

  showSectionModal(imageUrl) {
    this.sectionImageUrl = imageUrl;
  }

  private get entitiesList(): NgmGeometry[] {
    const opnGeomOptions = ToolboxStore.openedGeometryOptionsValue;
    return this.geometriesDataSource!.entities.values.map(val => {
      const item = {
        id: val.id,
        name: val.name,
        show: val.isShowing || !!(!val.isShowing && opnGeomOptions && val.id === opnGeomOptions.id && opnGeomOptions.editing),
        positions: getAreaPositions(val, this.julianDate),
        area: getValueOrUndefined(val.properties!.area),
        perimeter: getValueOrUndefined(val.properties!.perimeter),
        sidesLength: getValueOrUndefined(val.properties!.sidesLength),
        numberOfSegments: getValueOrUndefined(val.properties!.numberOfSegments),
        type: getValueOrUndefined(val.properties!.type),
        volumeShowed: getValueOrUndefined(val.properties!.volumeShowed),
        volumeHeightLimits: getValueOrUndefined(val.properties!.volumeHeightLimits),
        description: getValueOrUndefined(val.properties!.description),
        image: getValueOrUndefined(val.properties!.image),
        website: getValueOrUndefined(val.properties!.website),
        swissforagesId: getValueOrUndefined(val.properties!.swissforagesId),
        depth: getValueOrUndefined(val.properties!.depth),
        showSlicingBox: getValueOrUndefined(val.properties!.showSlicingBox),
        color: undefined,
        pointSymbol: undefined
      };
      if (val.billboard) {
        item.color = val.properties!.colorBeforeHighlight || val.billboard.color!.getValue(this.julianDate);
        item.pointSymbol = val.billboard.image!.getValue(this.julianDate);
      } else if (val.polyline) {
        item.color = val.properties!.colorBeforeHighlight || val.polyline.material.getValue(this.julianDate).color;
      } else if (val.polygon) {
        item.color = val.properties!.colorBeforeHighlight || val.polygon.material.getValue(this.julianDate).color;
      }
      return item;
    });
  }

  onBackClick() {
    if (this.activeTool === 'slicing') {
      this.slicerElement.toggleSlicer();
    }
    this.activeTool = undefined;
  }

  render() {
    return html`
      <div class="ngm-panel-header">
        <div ?hidden=${!this.activeTool} class="ngm-back-icon" @click=${this.onBackClick}></div>
        ${i18next.t(this.activeTool ? `tbx_${this.activeTool}` : 'lsb_tools')}
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div class="ngm-tools-list" .hidden="${this.activeTool}">
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'draw'}>
          <div class="ngm-vector-icon"></div>
          <div>${i18next.t('tbx_draw')}</div>
        </div>
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'slicing'}>
          <div class="ngm-slicing-icon"></div>
          <div>${i18next.t('tbx_slicing')}</div>
        </div>
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'gst'}>
          <div class="ngm-gst-icon"></div>
          <div>${i18next.t('tbx_gst')}</div>
        </div>
        <div class="ngm-tools-list-item" @click=${() => this.activeTool = 'data-download'}>
          <div class="ngm-download-icon"></div>
          <div>${i18next.t('tbx_data-download')}</div>
        </div>
      </div>
      <div class="ngm-toast-placeholder"></div>
      <ngm-draw-tool .hidden="${this.activeTool !== 'draw'}"
                     .drawerHidden="${this.activeTool !== 'draw' || this.toolsHidden}">
      </ngm-draw-tool>
      <ngm-slicer .hidden=${this.activeTool !== 'slicing'}
                  .slicerHidden="${this.activeTool !== 'slicing' || this.toolsHidden}"
                  .geometriesDataSource=${this.geometriesDataSource}></ngm-slicer>
      <ngm-gst-interaction ?hidden="${this.activeTool !== 'gst'}"></ngm-gst-interaction>
      <ngm-gst-modal .imageUrl="${this.sectionImageUrl}"></ngm-gst-modal>
      <data-download .hidden="${this.activeTool !== 'data-download'}"
                     .geometriesDataSource=${this.geometriesDataSource}></data-download>`;
  }

  createRenderRoot() {
    return this;
  }

}
