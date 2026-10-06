// Viewer-request function of the default (S3) behaviour: React Router paths such as /properties/42
// have no object in the bucket, so every request without a file extension is served index.html.
// API errors are not affected because /api/* is a separate behaviour.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (!uri.split('/').pop().includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
