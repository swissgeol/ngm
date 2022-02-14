import {html} from 'lit';
import Auth from '../auth';
import i18next from 'i18next';
import {LitElementI18n} from '../i18n.js';
import auth from '../store/auth';
import {classMap} from 'lit/directives/class-map.js';


/**
 * Authentication component
 */
class NgmAuth extends LitElementI18n {

  static get properties() {
    return {
      user: {type: Object},

      // OAuth2 parameters
      endpoint: {type: String},
      responseType: {type: String},
      clientId: {type: String},
      redirectUri: {type: String},
      scope: {type: String}
    };
  }

  constructor() {
    super();
    this.user = null;
    this.updateLogoutTimeout_(this.user);
    this.responseType = 'token';
    this.redirectUri = `${location.origin}${location.pathname}`;
    this.scope = 'openid+profile';
    auth.user.subscribe(user => {
      this.user = user;
      this.updateLogoutTimeout_(this.user);
      if (this.popup) {
        this.popup.close();
        this.popup = null;
      }
    });
  }

  /**
   * Set or clear auto logout timer.
   * @param claims
   */
  updateLogoutTimeout_(claims) {
    if (this.expireTimer_) {
      clearTimeout(this.expireTimer_);
      this.expireTimer_ = null;
    }
    if (claims) {
      const expiresIn = 1000 * claims.exp - Date.now();
      if (expiresIn > 0) {
        console.log('setting logout timeout in', expiresIn, 'milliseconds');
        this.expireTimer_ = setTimeout(() => {
          console.log('The token has expired, triggering logout');
          this.logout();
        }, expiresIn);
      }
    }
  }

  async login() {
    // open the authentication popup
    const url = `${this.endpoint}?`
      + `response_type=${this.responseType}`
      + `&client_id=${this.clientId}`
      + `&redirect_uri=${this.redirectUri}`
      + `&scope=${this.scope}`
      + `&state=${Auth.state()}`;

    // open the authentication popup
    this.popup = window.open(url);
    // wait for the user to be authenticated
    await Auth.waitForAuthenticate();
    Auth.initialize();
  }

  logout() {
    Auth.logout();
  }

  render() {
    return html`
      <div class="ngm-user ${classMap({'ngm-active-section': this.user})}"
           @click=${!this.user ? this.login : this.logout}>
        <div class="ngm-user-icon"></div>
        ${!this.user ? i18next.t('lsb_login') : i18next.t('lsb_logout')}
      </div>`;
  }

  createRenderRoot() {
    // no shadow dom
    return this;
  }
}

customElements.define('ngm-auth', NgmAuth);
