import {LitElementI18n} from '../i18n';
import {customElement, property, state} from 'lit/decorators.js';
import {html} from 'lit';
import i18next from 'i18next';
import {styleMap} from 'lit/directives/style-map.js';
import {classMap} from 'lit-html/directives/class-map.js';
import MainStore from '../store/main';
import ToolboxStore from '../store/toolbox';
import {getCameraView, syncTargetParam} from '../permalink';

@customElement('ngm-dashboard')
export class NgmDashboard extends LitElementI18n {
  @property({type: Boolean}) hidden = true;
  @state() activeTab: 'dashboard' | 'project' = 'dashboard';
  @state() selectedProject: any | undefined;
  @state() projects: any | undefined;

  async update(changedProperties) {
    if (!this.hidden && !this.projects) {
      this.projects = await (await fetch('./src/sampleData/showcase_projects.json')).json();
    }
    super.update(changedProperties);
  }

  selectView(permalink) {
    const viewer = MainStore.viewerValue;
    if (!viewer) return;
    syncTargetParam(undefined);
    MainStore.nextTargetPointSync();
    this.dispatchEvent(new CustomEvent('close'));
    const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}${permalink}`;
    window.history.pushState({path: url}, '', url);
    MainStore.nextLayersSync();
    MainStore.nextMapSync();
    ToolboxStore.nextSliceSync();
    const {destination, orientation} = getCameraView();
    if (destination && orientation)
      viewer.camera.flyTo({
        destination: destination,
        orientation: orientation,
        duration: 3
      });
    MainStore.nextTargetPointSync();
  }

  previewTemplate(data) {
    return html`
      <div class="ngm-proj-preview" @click=${() => {
        this.selectedProject = data;
        this.activeTab = 'project';
      }}>
        <div class="ngm-proj-preview-img" style=${styleMap({backgroundImage: `url('${data.image}')`})}></div>
        <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: data.color})}>
          <span>${data.title}</span>
        </div>
        <div class="ngm-proj-preview-subtitle"><span>${data.description}</span></div>
      </div>`;
  }

  projectTabTemplate() {
    if (!this.selectedProject) return '';
    return html`
      <div>
        <div class="ngm-proj-title">${this.selectedProject.title}</div>
        <div class="ngm-proj-data">
          ${`${i18next.t('dashboard_created_title')} ${this.selectedProject.created} ${i18next.t('dashboard_by_swisstopo_title')}`}
        </div>
        <div class="ngm-proj-information">
          <div>
            <div class="ngm-proj-preview-img"
                 style=${styleMap({backgroundImage: `url('${this.selectedProject.image}')`})}></div>
            <div class="ngm-proj-preview-title" style=${styleMap({backgroundColor: this.selectedProject.color})}></div>
          </div>
          <div class="ngm-proj-description">
            <div class="ngm-proj-description-title">${i18next.t('dashboard_description')}</div>
            <div class="ngm-proj-description-content">${this.selectedProject.description}</div>
          </div>
        </div>
      </div>
      <div class="ngm-divider"></div>
      <div class="ngm-proj-views-title">
        <div class="ngm-screenshot-icon"></div>
        <div>${i18next.t('dashboard_views')}</div>
      </div>
      <div class="ngm-project-views">
        ${this.selectedProject.views.map(view => html`
          <div class="ngm-action-list-item" @click=${() => this.selectView(view.permalink)}>
            <div class="ngm-action-list-item-header">
              <div>${view.title}</div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  render() {
    if (!this.projects) return '';
    return html`
      <div class="ngm-panel-header">
        <div class="ngm-dashboard-tabs">
          <div class=${classMap({active: this.activeTab === 'dashboard'})}
               @click=${() => {
                 this.activeTab = 'dashboard';
                 this.selectedProject = undefined;
               }}>
            ${i18next.t('lsb_dashboard')}
          </div>
          <div class=${classMap({active: this.activeTab === 'project'})} @click=${() => this.activeTab = 'project'}>
            ${i18next.t('dashboard_swisstopo_template')}
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