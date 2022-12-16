// FIXME: reset filter on close

import i18next from 'i18next';
import {html, nothing} from 'lit';
import {customElement, property, queryAll} from 'lit/decorators.js';
import {LitElementI18n} from '../i18n';
import draggable from './draggable';
import {dragArea} from './helperElements';
import type {Config} from '../layers/ngm-layers-item';
import {getVoxelShader} from '../layers/voxels-helper';
import {repeat} from 'lit/directives/repeat.js';
import type {Viewer} from 'cesium';
import {setBit} from '../utils';

@customElement('ngm-voxel-filter')
export class NgmVoxelFilter extends LitElementI18n {
  @property({type: Object}) config!: Config;
  @property({type: Object}) viewer!: Viewer;
  @queryAll('.lithology-checkbox input[type="checkbox"]') lithologyCheckbox!: NodeListOf<HTMLInputElement>;
  private min = NaN;
  private max = NaN;

  private minValue: number | undefined;
  private maxValue: number | undefined;

  shouldUpdate(): boolean {
    return this.config !== undefined;
  }

  willUpdate() {
    this.minValue = this.min = this.config.voxelColors!.range[0];
    this.maxValue = this.max = this.config.voxelColors!.range[1];
  }

  render() {
    return html`
      <div class="ngm-floating-window-header drag-handle">
        ${i18next.t('vox_filter_filtering_on')}
        <div class="ngm-close-icon" @click=${() => this.hidden = true}></div>
      </div>
      <div class="content-container">
        <div>
          Hydraulic Conductivity:
          ${i18next.t('vox_filter_min')}
          <input class="ui" type="number" .value="${this.min}" min="${this.minValue}" @input="${evt => this.min = evt.target.value}"/>
          ${i18next.t('vox_filter_max')}
          <input class="ui" type="number" .value="${this.max}" max="${this.maxValue}" @input="${evt => this.max = evt.target.value}"/>
        </div>
        ${this.config.voxelFilter?.lithology ? html`
        <div>
          <div class="">
            <div class="ui radio checkbox">
              <input type="radio" name="operator" value="0" checked>
              <label>${i18next.t('vox_filter_and')}</label>
            </div>
            <div class="ui radio checkbox">
              <input type="radio" name="operator" value="1">
              <label>${i18next.t('vox_filter_or')}</label>
            </div>
            <div class="ui radio checkbox">
              <input type="radio" name="operator" value="2">
              <label>${i18next.t('vox_filter_xor')}</label>
            </div>
          </div>
        </div>
        <div class="lithology-checkbox">
          ${repeat(this.config.voxelFilter.lithology, (lithology: any) =>
            html`<label><input type="checkbox" value="${lithology.index}" checked> ${lithology.label}</label>`
          )}
        </div>
        ` : nothing}
        <button class="ui button ngm-action-btn" @click="${() => this.applyFilter()}">
          ${i18next.t('vox_filter_apply')}
        </button>
      </div>
      ${dragArea}
    `;
  }

  applyFilter() {
    const shader = getVoxelShader(this.config);
    shader.setUniform('u_filter_min', this.min);
    shader.setUniform('u_filter_max', this.max);

    let lithologyExclude = 0;
    this.lithologyCheckbox.forEach((checkbox, index) => {
      if (!checkbox.checked) {
        lithologyExclude = setBit(lithologyExclude, index);
      }
    });
    shader.setUniform('u_filter_lithology_exclude', lithologyExclude);
    const operator = this.querySelector('input[name="operator"]:checked');
    if (operator) {
      shader.setUniform('u_filter_operator', operator.value);
    }

    this.viewer.scene.requestRender();
  }

  firstUpdated() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    this.hidden = false;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}
