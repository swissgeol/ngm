import {html} from 'lit-element';
import draggable from './draggable.js';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import {unsafeHTML} from 'lit-html/directives/unsafe-html';
import QueryStore from '../store/query';

class NgmObjectInformation extends LitElementI18n {

  static get properties() {
    return {
      info: {type: Object},
      opened: {type: Boolean}
    };
  }

  constructor() {
    super();
    this.opened = false;

    QueryStore.objectInfo.subscribe(info => {
      if (info) {
        this.info = info;
        this.opened = !!info;
      } else if (this.opened) {
        this.opened = false;
        this.info = null;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.opened = false;
      }
    });
  }

  connectedCallback() {
    draggable(this, {
      allowFrom: '.drag-handle'
    });
    super.connectedCallback();
  }

  render() {
    if (this.info && (this.info.popupContent || this.info.properties)) {
      const content = this.info.popupContent ?
        unsafeHTML(this.info.popupContent) :
        html`
          <table class="ui compact small very basic table">
            <tbody>
            ${this.info.properties.map(row => {
              const key = row[0];
              const value = row[1];
              if ((typeof value === 'string') && (value.startsWith('http'))) {
                return html`
                  <tr class="top aligned">
                    <td class="key">${i18next.t(`assets:${key}`)}</td>
                    <td class="value"><a href="${value}" target="_blank" rel="noopener">${value.split('/').pop()}</a></td>
                  </tr>
                `;
              } else {
                return html`
                  <tr class="top aligned">
                    <td class="key">${i18next.t(`assets:${key}`)}</td>
                    <td class="value">${value}</td>
                  </tr>
                `;
              }
            })}
            </tbody>
          </table>`;

      if (this.opened && this.info.onshow) {
        this.info.onshow();
      }
      if (!this.opened && this.info.onhide) {
        this.info.onhide();
      }

      return html`
        <div class="ngm-floating-window" ?hidden="${!this.opened}">
          <div class="ngm-floating-window-header drag-handle">
            <div class="ngm-close-icon" @click=${() => this.opened = false}></div>
          </div>
          <div class="htmlpopup-header" ?hidden="${!this.info.zoom}">
              <button @click="${this.info.zoom}" class="ui right labeled icon button">
                <i class="right search plus icon"></i>
                ${i18next.t('obj_info_zoom_to_object_btn_label')}
              </button>
          </div>
          <div class="content-container">
            ${content}
          </div>
          <div class="ngm-drag-area drag-handle">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
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

customElements.define('ngm-object-information', NgmObjectInformation);
