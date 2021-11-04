import {html} from 'lit';
import i18next from 'i18next';
import {LitElementI18n} from '../../i18n.js';
import {syncSliceParam} from '../../permalink';
import $ from '../../jquery';
import 'fomantic-ui-css/components/checkbox';
import SlicerStore from '../../store/slicer';
import {getMeasurements} from '../../cesiumutils';

export class NgmSlicer extends LitElementI18n {
  constructor() {
    super();

    /**
     * @type {import('../../slicer/Slicer').default}
     */
    this.slicer = null;
    SlicerStore.slicer.subscribe(slicer => {
      this.slicer = slicer;
      this.requestUpdate();
    });

    this.popupMinimized = false;
    this.showBox = true;
  }

  updated() {
    if (this.transformPopup)
      this.transformPopup.popup('reposition');
    else if (this.slicer) {
      this.transformPopup = $(this.querySelector('.ngm-box-slice-btn')).popup({
        popup: $(this.querySelector('.ngm-slice-to-draw')),
        on: 'click',
        position: 'top left',
        closable: false
      });
      if (this.slicer.active && this.slicingType === 'view-box') {
        // wait until all buttons loaded to have correct position
        setTimeout(() => this.transformPopup.popup('show'), 1000);

        this.showBox = this.slicer.sliceOptions.showBox;
      }
      this.showBoxCheckbox = $(this.querySelector('.ui.checkbox')).checkbox(this.showBox ? 'check' : 'uncheck');
    }
  }

  toggleSlicer(type) {
    const active = this.slicer.active;
    const boxOptionChanged = this.slicingType !== type;
    this.slicer.active = false;
    if (!active || boxOptionChanged) {
      this.slicer.sliceOptions = {
        type: type,
        showBox: this.showBox,
        deactivationCallback: () => this.onDeactivation(),
        syncBoxPlanesCallback: (sliceInfo) => syncSliceParam(sliceInfo)
      };
      if (type === 'view-line') {
        this.slicer.sliceOptions.activationCallback = () => syncSliceParam({
          type: type,
          slicePoints: this.slicer.sliceOptions.slicePoints
        });
      }
      this.slicer.active = true;
    }
    this.requestUpdate();
  }

  onDeactivation() {
    syncSliceParam();
    this.transformPopup.popup('hide');
    this.requestUpdate();
  }

  get slicingType() {
    return this.slicer.sliceOptions.type;
  }

  get slicingEnabled() {
    return this.slicer.active;
  }

  addCurrentBoxToToolbox() {
    const bbox = this.slicer.slicingBox.bbox;
    const positions = [
      bbox.corners.bottomRight,
      bbox.corners.bottomLeft,
      bbox.corners.topLeft,
      bbox.corners.topRight
    ];
    const type = 'rectangle';
    SlicerStore.setRectangleToCreate({
      type: type,
      positions: positions,
      volumeHeightLimits: {
        height: bbox.height,
        lowerLimit: bbox.lowerLimit - bbox.altitude
      },
      volumeShowed: true,
      showSlicingBox: this.showBox,
      ...getMeasurements(positions, type)
    });
    this.slicer.active = false;
  }

  toggleMinimize() {
    this.popupMinimized = !this.popupMinimized;
    this.requestUpdate();
    this.showBoxCheckbox.checkbox(this.showBox ? 'check' : 'uncheck');
  }

  onShowBoxChange(event) {
    this.showBox = event.target.checked;
    this.slicer.toggleBoxVisibility(this.showBox);
  }

  render() {
    if (this.slicer) {
      return html`
        <button
          data-tooltip=${i18next.t('nav_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ${this.slicingEnabled && this.slicingType === 'view-line' ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer('view-line')}">
          <i class="cut icon"></i>
        </button>
        <button
          data-tooltip=${i18next.t('nav_box_slice_hint')}
          data-position="left center"
          data-variation="mini"
          class="ui compact mini icon button ngm-box-slice-btn ${this.slicingEnabled && this.slicingType === 'view-box' ? 'grey' : ''}"
          @pointerdown="${() => this.toggleSlicer('view-box')}">
          <i class="cube icon"></i>
        </button>
        <div class="ui mini popup ngm-slice-to-draw">
          <div class="body ${this.popupMinimized ? 'minimized' : ''}">
            <i class="${!this.popupMinimized ? 'minus' : 'expand alternate'} icon" @click="${this.toggleMinimize}"></i>
            <div ?hidden="${this.popupMinimized}" class="content">
              <div class="ui checkbox">
                <input type="checkbox" @change="${this.onShowBoxChange}">
                <label>${i18next.t('nav_box_show_slice_box')}</label>
              </div>
              <div class="description">
                <i class="lightbulb icon"></i>
                <label>${i18next.t('nav_box_slice_transform_hint')}</label>
              </div>
              <button
                class="ui tiny button"
                @click="${this.addCurrentBoxToToolbox}">
                ${i18next.t('nav_box_slice_transform_btn')}
              </button>
            </div>
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

customElements.define('ngm-slicer', NgmSlicer);
