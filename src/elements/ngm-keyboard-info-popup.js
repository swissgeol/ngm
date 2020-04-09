import i18next from 'i18next';
import {I18nMixin} from '../i18n';
import {LitElement, html} from 'lit-element';
import $ from '../jquery.js';

import 'fomantic-ui-css/components/popup.js';

const popupId = 'ngm-navigation-info';
const btnId = 'ngm-navigation-info-btn';

const t = a => a;
const infoConfig = [
  {
    title: t('info_tilt_label'),
    content: t('info_tilt')
  },
  {
    title: t('info_look_label'),
    content: t('info_look_key')
  },
  {
    title: t('info_zoom_label'),
    content: t('info_zoom_key')
  },
  {
    title: t('info_move_label'),
    content: t('info_move')
  },
  {
    title: t('info_move_forward_label'),
    content: t('info_move_forward')
  },
  {
    title: t('info_elevator_label'),
    content: t('info_elevator')
  }
];

class NgmKeyboardInfoPopup extends I18nMixin(LitElement) {

  updated() {
    if (!this.popupInited && i18next.language) {
      $(`#${btnId}`).popup({
        position: 'left center',
        content: i18next.t('info_btn'),
        variation: 'mini',
        onShow: () => {
          if (this.querySelector(`#${popupId}`).classList.contains('visible')) {
            return false;
          }
        }
      });
      $(this).popup({
        popup: $(`#${popupId}`),
        on: 'click',
        closable: false,
        onShow: () => this.toggleInfoPopup(),
        onHide: () => this.toggleInfoPopup(false),
        position: 'left center'
      });
      this.popupInited = true;
    }
  }

  toggleInfoPopup(show = true) {
    const navigationWidgetClassList = document.querySelector('ngm-navigation-widgets').classList;
    const buttonClassList = this.querySelector(`#${btnId}`).classList;
    if (show) {
      navigationWidgetClassList.add('no-pointer-events');
      buttonClassList.add('grey');
      $(`#${btnId}`).popup('hide');
      return;
    }
    navigationWidgetClassList.remove('no-pointer-events');
    buttonClassList.remove('grey');
  }

  get infoLineTemplate() {
    return infoConfig.map(value => html`
    <div class="row">
      <div>
        ${i18next.t(value.title)}:
      </div>
      <div>${i18next.t(value.content)}</div>
    </div>`);
  }

  render() {
    return html`
    <button
      id=${btnId}
      class="ui compact mini icon button">
      <i class="keyboard icon"></i>
    </button>
    <div id=${popupId} class="ui popup">
      <h4>${i18next.t('info_popup_label')}</h4>
      <div class="ngm-keyboard-info-content">
        <div class="ngm-keyboard-layout"></div>
        ${this.infoLineTemplate}
      </div>
      <h4 class="ngm-keyboard-tip">${i18next.t('info_tip')}</h4>
    </div>`;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-keyboard-info-popup', NgmKeyboardInfoPopup);
