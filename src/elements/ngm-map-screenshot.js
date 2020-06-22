import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';


class NgmMapScreenshot extends I18nMixin(LitElement) {
  static get properties() {
    return {
      viewer: {type: Object},
      filename: {type: String},
    };
  }

  constructor() {
    super();

    this.filename = 'map.png';
  }

  takeScreenshot() {
    this.viewer.scene.render();
    const link = this.querySelector('a[download]');
    link.href = this.viewer.canvas.toDataURL();
    link.click();
  }

  render() {
    if (this.viewer) {
      return html`
        <button
          data-tooltip=${i18next.t('map_screenshot_btn')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button"
          @click="${this.takeScreenshot}">
            <i class="icon camera"></i>
        </button>
        <a style="display: none" download="${this.filename}"></a>
      `;
    } else {
      return html``;
    }
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-map-screenshot', NgmMapScreenshot);
