import Uri from 'cesium/Source/ThirdParty/Uri';
import when from 'cesium/Source/ThirdParty/when';
import Check from 'cesium/Source/Core/Check';
import defaultValue from 'cesium/Source/Core/defaultValue';
import defined from 'cesium/Source/Core/defined';
import Ion from 'cesium/Source/Core/Ion';
import Resource from 'cesium/Source/Core/Resource';
import RuntimeError from 'cesium/Source/Core/RuntimeError';



/**
 * A {@link Resource} instance that encapsulates Cesium ion asset access.
 * This object is normally not instantiated directly, use {@link S3Resource.fromAssetId}.
 *
 * @alias S3Resource
 * @constructor
 * @augments Resource
 *
 * @param {Object} endpoint The result of the Cesium ion asset endpoint service.
 * @param {Resource} endpointResource The resource used to retreive the endpoint.
 *
 */
function S3Resource(endpoint, endpointResource) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined('endpoint', endpoint);
  Check.defined('endpointResource', endpointResource);
  //>>includeEnd('debug');

  var options;
  var externalType = endpoint.externalType;
  var isExternal = defined(externalType);

  if (!isExternal) {
    options = {
      url: endpoint.url,
      retryAttempts: 1,
      retryCallback: retryCallback,
    };
  } else if (
    externalType === '3DTILES' ||
    externalType === 'STK_TERRAIN_SERVER'
  ) {
    // 3D Tiles and STK Terrain Server external assets can still be represented as an S3Resource
    options = { url: endpoint.options.url };
  } else {
    //External imagery assets have additional configuration that can't be represented as a Resource
    throw new RuntimeError(
      'Ion.createResource does not support external imagery assets; use IonImageryProvider instead.'
    );
  }

  Resource.call(this, options);

  // The asset endpoint data returned from ion.
  this._ionEndpoint = endpoint;
  this._ionEndpointDomain = isExternal
    ? undefined
    : new Uri(endpoint.url).authority;

  // The endpoint resource to fetch when a new token is needed
  this._ionEndpointResource = endpointResource;

  // The primary S3Resource from which an instance is derived
  this._ionRoot = undefined;

  // Shared promise for endpooint requests amd credits (only ever set on the root request)
  this._pendingPromise = undefined;
  this._isExternal = isExternal;
}

if (defined(Object.create)) {
  S3Resource.prototype = Object.create(Resource.prototype);
  S3Resource.prototype.constructor = S3Resource;
}

/**
 * Asynchronously creates an instance.
 *
 * @param {Number} assetId The Cesium ion asset id.
 * @param {Object} [options] An object with the following properties:
 * @param {String} [options.accessToken=Ion.defaultAccessToken] The access token to use.
 * @param {String|Resource} [options.server=Ion.defaultServer] The resource to the Cesium ion API server.
 * @returns {Promise.<S3Resource>} A Promise to am instance representing the Cesium ion Asset.
 *
 * @example
 * //Load a Cesium3DTileset with asset ID of 124624234
 * viewer.scene.primitives.add(new Cesium.Cesium3DTileset({ url: Cesium.S3Resource.fromAssetId(124624234) }));
 *
 * @example
 * //Load a CZML file with asset ID of 10890
 * Cesium.S3Resource.fromAssetId(10890)
 *   .then(function (resource) {
 *     viewer.dataSources.add(Cesium.CzmlDataSource.load(resource));
 *   });
 */
S3Resource.fromAssetId = function (assetId, options) {
  var endpointResource = S3Resource._createEndpointResource(assetId, options);

  return endpointResource.fetchJson().then(function (endpoint) {
    return new S3Resource(endpoint, endpointResource);
  });
};

Object.defineProperties(S3Resource.prototype, {
  /**
   * Gets the credits required for attribution of the asset.
   *
   * @memberof S3Resource.prototype
   * @type {Credit[]}
   * @readonly
   */
  credits: {
    get: function () {
      // Only we're not the root, return its credits;
      if (defined(this._ionRoot)) {
        return this._ionRoot.credits;
      }

      // We are the root
      if (defined(this._credits)) {
        return this._credits;
      }

      this._credits = S3Resource.getCreditsFromEndpoint(
        this._ionEndpoint,
        this._ionEndpointResource
      );

      return this._credits;
    },
  },
});


S3Resource.prototype.clone = function (result) {
  // We always want to use the root's information because it's the most up-to-date
  var ionRoot = defaultValue(this._ionRoot, this);

  if (!defined(result)) {
    result = new S3Resource(
      ionRoot._ionEndpoint,
      ionRoot._ionEndpointResource
    );
  }

  result = Resource.prototype.clone.call(this, result);
  result._ionRoot = ionRoot;
  result._isExternal = this._isExternal;

  return result;
};

S3Resource.prototype.fetchImage = function (options) {
  if (!this._isExternal) {
    var userOptions = options;
    options = {
      preferBlob: true,
    };
    if (defined(userOptions)) {
      options.flipY = userOptions.flipY;
      options.preferImageBitmap = userOptions.preferImageBitmap;
    }
  }
  return Resource.prototype.fetchImage.call(this, options);
};

S3Resource.prototype._makeRequest = function (options) {
  // Don't send ion access token to non-ion servers.
  if (
    this._isExternal ||
    new Uri(this.url).authority !== this._ionEndpointDomain
  ) {
    return Resource.prototype._makeRequest.call(this, options);
  }

  if (!defined(options.headers)) {
    options.headers = {};
  }
  options.headers.Authorization = 'Bearer ' + this._ionEndpoint.accessToken;

  return Resource.prototype._makeRequest.call(this, options);
};

/**
 * @private
 */
S3Resource._createEndpointResource = function (assetId, options) {

  Check.defined('assetId', assetId);

  options = defaultValue(options, defaultValue.EMPTY_OBJECT);
  var server = defaultValue(options.server, Ion.defaultServer);
  var accessToken = defaultValue(options.accessToken, Ion.defaultAccessToken);
  server = Resource.createIfNeeded(server);

  var resourceOptions = {
    url: 'v1/assets/' + assetId + '/endpoint',
  };

  if (defined(accessToken)) {
    resourceOptions.queryParameters = { access_token: accessToken };
  }

  return server.getDerivedResource(resourceOptions);
};

function retryCallback(that, error) {
  var ionRoot = defaultValue(that._ionRoot, that);
  var endpointResource = ionRoot._ionEndpointResource;

  // We only want to retry in the case of invalid credentials (401) or image
  // requests(since Image failures can not provide a status code)
  if (
    !defined(error) ||
    (error.statusCode !== 401 && !(error.target instanceof Image))
  ) {
    return when.resolve(false);
  }

  // We use a shared pending promise for all derived assets, since they share
  // a common access_token.  If we're already requesting a new token for this
  // asset, we wait on the same promise.
  if (!defined(ionRoot._pendingPromise)) {
    ionRoot._pendingPromise = endpointResource
      .fetchJson()
      .then(function (newEndpoint) {
        //Set the token for root resource so new derived resources automatically pick it up
        ionRoot._ionEndpoint = newEndpoint;
        return newEndpoint;
      })
      .always(function (newEndpoint) {
        // Pass or fail, we're done with this promise, the next failure should use a new one.
        ionRoot._pendingPromise = undefined;
        return newEndpoint;
      });
  }

  return ionRoot._pendingPromise.then(function (newEndpoint) {
    // Set the new token and endpoint for this resource
    that._ionEndpoint = newEndpoint;
    return true;
  });
}
export default S3Resource;
