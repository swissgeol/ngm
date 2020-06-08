import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';
import $ from '../jquery.js';
import 'fomantic-ui-css/components/slider.js';
import './ngm-map-chooser.js';
import {syncMapTransparencyParam} from '../permalink.js';

class NgmMapConfiguration extends I18nMixin(LitElement) {
  static get properties() {
    return {
      viewer: {type: Object}
    };
  }

  firstUpdated() {
    this.dispatchEvent(new CustomEvent('rendered'));

    $('#ngm-transparency-slider').slider({
      min: 0,
      max: 1,
      start: 1 - this.viewer.scene.globe.translucency.frontFaceAlphaByDistance.nearValue,
      step: 0.01,
      onMove: (val) => {
        if (val === 0) {
          this.viewer.scene.globe.translucency.enabled = false;
          this.viewer.scene.globe.translucency.backFaceAlpha = 1;
        } else {
          this.viewer.scene.globe.translucency.backFaceAlpha = 0;
          this.viewer.scene.globe.translucency.frontFaceAlphaByDistance.nearValue = 1 - val;
          if (!this.viewer.scene.globe.translucency.enabled) {
            this.viewer.scene.globe.translucency.enabled = true;
          }
        }
        this.viewer.scene.requestRender();
        syncMapTransparencyParam(val);
      }
    });
  }

  render() {
    return html`
      <div class="ui segment">
        ${i18next.t('map_transparency_label')}
        <div class="ui grey small slider" id="ngm-transparency-slider"></div>
      </div>
      <ngm-map-chooser></ngm-map-chooser>
      `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-map-configuration', NgmMapConfiguration);
