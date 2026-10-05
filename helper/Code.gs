/**
 * Doctor Network Match helper (Google Apps Script web app).
 *
 * The doctor-match page asks this script to fetch a carrier directory address
 * for it, because most carrier directories (and the NPI registry) refuse calls
 * made straight from a web page. Only the hosts listed below can be fetched.
 *
 * Carriers that need a developer key: put the key details in
 * Project Settings > Script Properties (never in this file), as one property
 * per carrier host named  AUTH_<host>  whose value is JSON, for example:
 *   AUTH_apif1.aetna.com = {"tokenUrl":"https://apif1.aetna.com/fhir/v1/fhirserver_auth/oauth2/token",
 *                           "clientId":"...","clientSecret":"...","scope":"Public NonPII"}
 *   AUTH_adasgateway.alignmenthealth.com = {"header":"Ocp-Apim-Subscription-Key","value":"..."}
 * A host that needs both a key header and a token can have all of those fields in one value.
 */
var ALLOWED_HOSTS = [
  'npiregistry.cms.hhs.gov',
  'fhir.humana.com',
  'flex.optum.com',
  'public.fhir.flex.optum.com',
  'apif1.aetna.com',
  'totalview.healthos.elevancehealth.com',
  'api.interop.molinahealthcare.com',
  'directory.cms.gov',
  'providerdirectory.scanhealthplan.com',
  'adasgateway.alignmenthealth.com'
];
// Hosts added later go in Script Properties as EXTRA_HOSTS = "host1,host2" so this file needn't change.

function doGet(e) {
  var url = (e && e.parameter && e.parameter.url) || '';
  var host = (url.match(/^https:\/\/([^\/?#]+)/i) || [])[1];
  var props = PropertiesService.getScriptProperties();
  var extra = (props.getProperty('EXTRA_HOSTS') || '').split(',').map(function (h) { return h.trim(); });
  if (!host || (ALLOWED_HOSTS.indexOf(host) < 0 && extra.indexOf(host) < 0)) {
    return json_({ helperError: 'host not allowed: ' + host, status: 400 });
  }
  var headers = { Accept: 'application/fhir+json, application/json' };
  var auth = props.getProperty('AUTH_' + host);
  if (auth) {
    try { addAuth_(host, JSON.parse(auth), headers); }
    catch (err) { return json_({ helperError: 'key setup problem for ' + host + ': ' + err.message, status: 500 }); }
  }
  var cacheKey = 'u' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url));
  var cached = CacheService.getScriptCache().get(cacheKey);
  if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  var res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true, followRedirects: true });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code >= 400) return json_({ helperError: 'carrier answered HTTP ' + code + ': ' + body.slice(0, 300), status: code });
  if (body.length < 90000) CacheService.getScriptCache().put(cacheKey, body, 6 * 3600);  // 6 hours
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function addAuth_(host, cfg, headers) {
  if (cfg.header) headers[cfg.header] = cfg.value;
  if (cfg.tokenUrl) {
    var cache = CacheService.getScriptCache(), key = 'tok_' + host, tok = cache.get(key);
    if (!tok) {
      var j = fetchToken_(cfg);
      tok = j.access_token;
      cache.put(key, tok, Math.max(60, Math.min(21600, (j.expires_in || 3600) - 120)));
    }
    headers.Authorization = 'Bearer ' + tok;
  }
}

// Carriers differ in how they want the client id and secret sent, so try the usual ways in turn
// and keep the first that hands back a token. The working way is remembered for 6 hours.
function tokenTries_(cfg) {
  var form = { grant_type: 'client_credentials' };
  if (cfg.scope) form.scope = cfg.scope;
  var both = { grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret };
  if (cfg.scope) both.scope = cfg.scope;
  var basic = 'Basic ' + Utilities.base64Encode(cfg.clientId + ':' + cfg.clientSecret);
  return [
    { name: 'basic header', method: 'post', headers: { Authorization: basic }, payload: form },
    { name: 'form fields', method: 'post', payload: both },
    { name: 'JSON body', method: 'post', contentType: 'application/json', payload: JSON.stringify(both) },
    { name: 'id/secret headers', method: 'post', headers: { client_id: cfg.clientId, client_secret: cfg.clientSecret }, payload: form },
    { name: 'secret as bearer', method: 'post', headers: { Authorization: 'Bearer ' + cfg.clientSecret }, payload: { grant_type: 'client_credentials', client_id: cfg.clientId } },
    { name: 'secret as bearer, GET', method: 'get', headers: { Authorization: 'Bearer ' + cfg.clientSecret, client_id: cfg.clientId } }
  ];
}

function fetchToken_(cfg) {
  var tries = tokenTries_(cfg), seen = [], cache = CacheService.getScriptCache();
  var last = Number(cache.get('tokway_' + cfg.tokenUrl));
  if (last >= 0 && last < tries.length) tries.unshift(tries.splice(last, 1)[0]);
  for (var i = 0; i < tries.length; i++) {
    var t = tries[i], name = t.name;
    delete t.name;
    t.muteHttpExceptions = true;
    t.headers = t.headers || {};
    t.headers.Accept = 'application/json';
    var r = UrlFetchApp.fetch(cfg.tokenUrl, t), text = r.getContentText(), j = null;
    try { j = JSON.parse(text); } catch (e) {}
    var tok = j && (j.access_token || j.accessToken || j.token);
    if (tok) {
      tokenTries_(cfg).forEach(function (x, k) { if (x.name === name) cache.put('tokway_' + cfg.tokenUrl, String(k), 21600); });
      return { access_token: tok, expires_in: j.expires_in || j.expiresIn };
    }
    seen.push(name + ': HTTP ' + r.getResponseCode() + (text ? ' ' + text.slice(0, 120).replace(/\s+/g, ' ') : ' (empty answer)'));
  }
  throw new Error('no token. ' + seen.join('; '));
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Run this once from the editor (Run > testHelper) to check it works and to grant the "connect to external service" permission.
function testHelper() {
  var out = doGet({ parameter: { url: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&last_name=nguyen&city=huntington%20beach&state=CA&limit=1' } });
  Logger.log(out.getContent().slice(0, 500));
}

// Run this from the editor (Run > testAnthem) to check the Anthem key: it logs whether a token came back
// and the start of a doctor search, without the page. If no token comes back it also tries the directory
// with the secret itself as the key, and says which of those worked.
function testAnthem() {
  var host = 'totalview.healthos.elevancehealth.com';
  var url = 'https://' + host + '/resources/unregistered/api/v1/fhir/cms_mandate/mcd/Practitioner?family=Nguyen&given=Vinh&_count=3';
  CacheService.getScriptCache().remove('tok_' + host);
  Logger.log('Through the helper: ' + doGet({ parameter: { url: url } }).getContent().slice(0, 900));
  var cfg = JSON.parse(PropertiesService.getScriptProperties().getProperty('AUTH_' + host) || '{}');
  if (!cfg.clientSecret) return Logger.log('No AUTH_' + host + ' setting found.');
  [['secret as bearer', { Authorization: 'Bearer ' + cfg.clientSecret }],
   ['secret as bearer + client_id', { Authorization: 'Bearer ' + cfg.clientSecret, client_id: cfg.clientId }],
   ['id/secret headers', { client_id: cfg.clientId, client_secret: cfg.clientSecret }],
   ['apikey header', { apikey: cfg.clientSecret }]].forEach(function (w) {
    w[1].Accept = 'application/fhir+json';
    var r = UrlFetchApp.fetch(url, { headers: w[1], muteHttpExceptions: true });
    Logger.log('Directory with ' + w[0] + ': HTTP ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200).replace(/\s+/g, ' '));
  });
}
