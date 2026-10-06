// Viewer-request function of the /api/* behaviour: the API serves its routes at the root
// (GET /health, GET /properties), the SPA calls them as /api/... on the CloudFront origin
// (VITE_API_BASE_URL=/api, the same contract as the Vite dev-server proxy).
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\/api(?=\/|$)/, '') || '/';
  return request;
}
