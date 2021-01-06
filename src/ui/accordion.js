import $ from '../jquery.js';
import 'fomantic-ui-css/components/accordion.js';


/**
 * @param {HTMLElement} element
 * @param {Object} [options={}]
 * @return {JQuery}
 */
export function accordion(element, options = {}) {
  return $(element).accordion(Object.assign({
    duration: 150
  }, options));
}
