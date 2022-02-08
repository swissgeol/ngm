import {LitElementI18n, toLocaleDateString} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import i18next from 'i18next';
import {styleMap} from 'lit/directives/style-map.js';
import {classMap} from 'lit-html/directives/class-map.js';
import MainStore from '../store/main';
import ToolboxStore from '../store/toolbox';
import {getCameraView, setPermalink, syncStoredView, syncTargetParam} from '../permalink';
import NavToolsStore from '../store/navTools';
import DashboardStore from '../store/dashboard';
import LocalStorageController from '../LocalStorageController';
import type {Viewer} from 'cesium';
import {CustomDataSource, KmlDataSource} from 'cesium';
import {showSnackbarError} from '../notifications';
import {DEFAULT_LAYER_OPACITY} from '../constants';
import type {Config} from '../layers/ngm-layers-item';

export interface TranslatedText {
  de: string,
  fr: string,
  it: string,
  en: string,
}

export interface DashboardProjectView {
  title: TranslatedText,
  permalink: string,
}

export interface Asset {
  href: string,
}

export interface DashboardProject {
  title: TranslatedText,
  description: TranslatedText,
  created: string,
  modified: string,
  image: string,
  color: string,
  views: DashboardProjectView[],
  assets: Map<string, Asset> | undefined,
}

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @state() activeTab: 'topics' | 'project' = 'topics';
  @state() selectedProject: DashboardProject | undefined;
  @state() projects: DashboardProject[] | undefined;
  @state() selectedViewIndx: number | undefined;
  private viewer: Viewer | null = null;

  constructor() {
    super();
    DashboardStore.viewIndex.subscribe(async viewIndex => {
      await this.selectView(viewIndex);
    });
    MainStore.viewer.subscribe(viewer => this.viewer = viewer);
  }

  async update(changedProperties) {
    if (!this.hidden && !this.projects) {
      this.projects = await (await fetch('./src/sampleData/showcase_projects.json')).json();
      // sort by newest first
      this.projects?.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    }
    super.update(changedProperties);
  }

  async fetchAssets(assets: Map<string, Asset>) {
    if (!this.viewer) return;
    for (const asset of Object.values(assets)) {
      try {
        const kmlDataSource = await KmlDataSource.load(asset.href, {
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
        const promise = Promise.resolve(uploadedLayer);
        const config: Config = {
          load() {return promise;},
          label: name,
          promise: promise,
          zoomToBbox: true,
          opacity: DEFAULT_LAYER_OPACITY,
          notSaveToPermalink: true,
          ownKml: true
        };

        this.requestUpdate();
        await (<any>document.getElementsByTagName('ngm-side-bar')[0]).onCatalogLayerClicked({
          detail: {
            layer: config
          }
        });
      } catch (e) {
        console.error(e);
        showSnackbarError(i18next.t('dtd_cant_upload_kml_error'));
      }
    }
  }

  async selectView(viewIndex: number | undefined) {
    this.selectedViewIndx = viewIndex;
    syncTargetParam(undefined);
    NavToolsStore.nextTargetPointSync();
    if (this.viewer && this.selectedProject && viewIndex !== undefined) {
      if (!LocalStorageController.storedView) LocalStorageController.storeCurrentView();
      this.dispatchEvent(new CustomEvent('close'));
      const permalink = this.selectedProject.views[viewIndex].permalink;
      setPermalink(permalink);
    } else if (viewIndex === undefined) {
      syncStoredView(LocalStorageController.storedView);
      LocalStorageController.removeStoredView();
    }
    await this.setDataFromPermalink();
  }

  selectProject(project) {
    this.selectedProject = project;
    DashboardStore.setSelectedProject(this.selectedProject);
  }

  deselectProject() {
    this.selectedProject = undefined;
    DashboardStore.setSelectedProject(undefined);
  }

  async setDataFromPermalink() {
    MainStore.nextLayersSync();
    MainStore.nextMapSync();
    if (this.selectedProject?.assets) {
      await this.fetchAssets(this.selectedProject.assets);
    }
    const {destination, orientation} = getCameraView();
    if (destination && orientation)
      this.viewer!.camera.flyTo({
        destination: destination,
        orientation: orientation,
        duration: 3,
        complete: () => {
          ToolboxStore.nextSliceSync();
          NavToolsStore.nextTargetPointSync();
        }
      });
  }

  previewTemplate(proj) {
    return html`
      <div class="ngm-proj-preview" @click=${() => this.selectProject(proj)}>
        <div class="ngm-proj-preview-img" style=${styleMap({backgroundImage: `url('${proj.image}')`})}></div>
        <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: proj.color})}>
          <span>${translated(proj.title)}</span>
        </div>
        <div class="ngm-proj-preview-subtitle"><span>${translated(proj.description)}</span></div>
      </div>`;
  }

  projectTabTemplate() {
    if (!this.selectedProject) return '';
    return html`
      <div>
        <div class="ngm-proj-title">${translated(this.selectedProject.title)}</div>
        <div class="ngm-proj-data">
          ${`${i18next.t('dashboard_modified_title')} ${toLocaleDateString(this.selectedProject.modified)} ${i18next.t('dashboard_by_swisstopo_title')}`}
        </div>
        <div class="ngm-proj-information">
          <div>
            <div class="ngm-proj-preview-img"
                 style=${styleMap({backgroundImage: `url('${this.selectedProject.image}')`})}></div>
            <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: this.selectedProject.color})}></div>
          </div>
          <div class="ngm-proj-description">
            <div class="ngm-proj-description-title">${i18next.t('dashboard_description')}</div>
            <div class="ngm-proj-description-content">${translated(this.selectedProject.description)}</div>
          </div>
        </div>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-views-title">
        <div class="ngm-screenshot-icon"></div>
        <div>${i18next.t('dashboard_views')}</div>
      </div>
      <div class="ngm-project-views">
        ${this.selectedProject.views.map((view, index) => html`
          <div class="ngm-action-list-item ${classMap({active: this.selectedViewIndx === index})}"
               @click=${() => DashboardStore.setViewIndex(this.selectedViewIndx === index ? undefined : index)}>
            <div class="ngm-action-list-item-header">
              <div>${translated(view.title)}</div>
            </div>
          </div>
        `)}
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-label-btn" @click=${this.deselectProject}>
        <div class="ngm-back-icon"></div>
        ${i18next.t('dashboard_back_to_topics')}
      </div>
    `;
  }

  render() {
    if (!this.projects) return '';
    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
          <div class=${classMap({active: this.activeTab === 'topics'})}
               @click=${() => {
                 this.activeTab = 'topics';
                 this.deselectProject();
               }}>
            ${i18next.t('dashboard_topics')}
          </div>
        </div>
        <div class="ngm-close-icon" @click=${() => this.dispatchEvent(new CustomEvent('close'))}></div>
      </div>
      <div ?hidden=${this.selectedProject}>
        <div class="ngm-proj-title">${i18next.t('dashboard_recent_swisstopo')}</div>
        <div class="ngm-projects-list">
          ${this.projects.map(data => this.previewTemplate(data))}
        </div>
      </div>
      <div ?hidden=${!this.selectedProject}>
        ${this.projectTabTemplate()}
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}


function translated(property: TranslatedText): string {
  return property[i18next.language];
}
