import $ from '../jquery.js';
import 'fomantic-ui-css/components/dimmer.js';
import 'fomantic-ui-css/components/modal.js';


/**
 * @param {HTMLElement} element
 * @param {Object} [options={}]
 * @return {JQuery}
 */
export function modal(element, options = {}) {
  return $(element).modal(options);
}
