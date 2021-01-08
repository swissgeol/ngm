import {LitElement, html} from 'lit-element';
import i18next from 'i18next';
import {I18nMixin} from '../i18n.js';

export class NgmButton extends I18nMixin(LitElement) {

  static get properties() {
    return {
      i18n: {type: String},
      icon: {type: String},
    };
  }

  render() {
    return html`
      <button
        class="ui button"
        data-tooltip=${i18next.t(this.i18n)}
        data-variation="mini"
        data-position="top left">
        <i class="icon ${this.icon}"></i>
      </button>
    `;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-button', NgmButton);
